import express from "express";
import cors from "cors";
import { fromSSO } from "@aws-sdk/credential-providers";
import { extractStylesFromUrl, closeBrowser } from "./agents/style-extractor.js";
import { analyzeContent } from "./agents/content-analyst.js";
import { designColorScheme } from "./agents/color-architect.js";
import { designFramePrompts } from "./agents/cinematic-director.js";
import { designPagePlan } from "./agents/page-architect.js";
import { generateImageFromPrompt, getImageProviderName, IMAGE_PROVIDER } from "./agents/image-generator.js";
import { extractBrandFromUrl } from "./agents/brand-extractor.js";
import { invokeClaudeRaw, REGION, PROFILE } from "./llm.js";

const IMAGE_REGION = process.env.VITE_BEDROCK_IMAGE_REGION || REGION;
const ssoCredentials = fromSSO({ profile: PROFILE });

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ─── Health ─────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", region: REGION, profile: PROFILE });
});

// ─── Agent: Claude Text ─────────────────────────────────────────
app.post("/api/claude", async (req, res) => {
  try {
    const { systemPrompt, userMessage } = req.body;
    const text = await invokeClaudeRaw(systemPrompt, userMessage);
    res.json({ text });
  } catch (error: any) {
    console.error("Claude error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Agent: Style Extractor (Playwright) ────────────────────────
app.post("/api/extract-site", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) { res.status(400).json({ error: "URL required" }); return; }

    console.log(`[StyleExtractor] Extracting: ${url}`);
    const styles = await extractStylesFromUrl(url);

    // Build rich context for the other agents
    const sectionSummary = styles.sections
      .map((s) => `${s.type}: "${s.headings[0] || ""}" (${s.ctaButtons.join(", ") || "no CTA"})`)
      .join("\n");

    const headingsSummary = styles.headings
      .map((h) => `h${h.level}: ${h.text}`)
      .join("\n");

    const contentBrief = [
      `Website: "${styles.meta.title}" — ${styles.meta.description}`,
      `URL: ${url}`,
      `Logo: ${styles.logos[0]?.alt || styles.logos[0]?.src?.slice(0, 50) || "not found"}`,
      `Nav links: ${styles.navLinks.join(", ")}`,
      `Section types: ${styles.sectionTypes.join(", ")}`,
      `Fonts: ${styles.fonts.join(", ")}`,
      `CTA buttons: ${styles.ctaTexts.slice(0, 5).join(", ")}`,
      `Social: ${styles.socialLinks.join(", ")}`,
      headingsSummary ? `Headings:\n${headingsSummary}` : "",
      sectionSummary ? `Sections:\n${sectionSummary}` : "",
      styles.stats.length ? `Stats found: ${styles.stats.join(", ")}` : "",
      styles.testimonials.length ? `Testimonials: ${styles.testimonials.length} found` : "",
    ].filter(Boolean).join("\n");

    console.log(`[StyleExtractor] Done: ${styles.sections.length} sections, ${styles.fonts.length} fonts, ${styles.logos.length} logos, ${styles.images.length} images`);

    // Run Content Analyst + Color Architect in parallel with full context
    const [contentAnalysis, colorScheme] = await Promise.all([
      analyzeContent(contentBrief, styles),
      designColorScheme(contentBrief, styles),
    ]);

    console.log(`[ContentAnalyst] Tone: ${contentAnalysis.contentTone}, Audience: ${contentAnalysis.targetAudience}`);
    console.log(`[ColorArchitect] Mood: ${colorScheme.mood}, Warmth: ${colorScheme.warmth}`);

    res.json({
      styles,
      contentAnalysis,
      colorScheme,
      // Legacy format for frontend
      title: styles.meta.title,
      description: styles.meta.description,
      colorPalette: {
        primary: colorScheme.primary,
        secondary: colorScheme.secondary,
        accent: colorScheme.accent,
        background: colorScheme.background,
        text: colorScheme.text,
      },
      fonts: styles.fonts,
      sections: styles.sectionTypes,
      contentSnippets: [
        contentAnalysis.valueProposition,
        ...contentAnalysis.keyBenefits,
        ...styles.headings.slice(0, 3).map((h) => h.text),
      ],
      imageUrls: styles.images.map((i) => i.src),
    });
  } catch (error: any) {
    console.error("Extraction error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── SSE: Brand & Theme Extraction (like everforge v2) ──────────
app.post("/api/extract-brand", async (req, res) => {
  const { url } = req.body;
  if (!url) { res.status(400).json({ error: "URL required" }); return; }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const keepalive = setInterval(() => {
    res.write(`data: ${JSON.stringify({ event: "keepalive" })}\n\n`);
  }, 15000);

  try {
    for await (const event of extractBrandFromUrl(url)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (error: any) {
    console.error("Brand extraction error:", error.message);
    res.write(`data: ${JSON.stringify({ event: "error", message: error.message })}\n\n`);
  } finally {
    clearInterval(keepalive);
    res.end();
  }
});

// ─── Agent: Cinematic Director (Frame Prompts) ──────────────────
app.post("/api/design-frames", async (req, res) => {
  try {
    const { prompt, frameCount, colorScheme, contentAnalysis, imageBase64 } = req.body;
    console.log(`[CinematicDirector] Designing ${frameCount} frames...`);

    const frames = await designFramePrompts(
      prompt,
      frameCount,
      colorScheme || { primary: "#ffffff", secondary: "#cccccc", accent: "#dddddd", background: "#111111", text: "#fafafa", mood: "", warmth: "neutral" as const },
      contentAnalysis || null,
      imageBase64
    );

    console.log(`[CinematicDirector] Generated ${frames.length} frame prompts`);
    res.json({ frames });
  } catch (error: any) {
    console.error("Frame design error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Agent: Page Architect (Page Plan) ──────────────────────────
app.post("/api/design-page", async (req, res) => {
  try {
    const { prompt, frameCount, colorScheme, contentAnalysis, extractedStyles } = req.body;
    console.log(`[PageArchitect] Designing page layout...`);

    const plan = await designPagePlan(
      prompt,
      frameCount,
      colorScheme || { primary: "#ffffff", secondary: "#cccccc", accent: "#dddddd", background: "#111111", text: "#fafafa", mood: "", warmth: "neutral" as const },
      contentAnalysis || null,
      extractedStyles || null
    );

    console.log(`[PageArchitect] Plan: ${plan.sections?.length || 0} sections`);
    res.json(plan);
  } catch (error: any) {
    console.error("Page design error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Agent: Image Generator (Vertex AI or Bedrock) ─────────────
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, seed } = req.body;
    const result = await generateImageFromPrompt(prompt, seed, ssoCredentials, IMAGE_REGION);
    res.json({ imageUrl: result.imageUrl });
  } catch (error: any) {
    console.error("Image error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── SSE: Full Page Generation Pipeline (like everforge v2) ─────
app.post("/api/generate-page", async (req, res) => {
  const { prompt, referenceUrl, frameCount = 8, imageBase64 } = req.body;
  if (!prompt) { res.status(400).json({ error: "prompt required" }); return; }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (event: string, data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ event, ...data })}\n\n`);
  };

  const keepalive = setInterval(() => {
    res.write(`data: ${JSON.stringify({ event: "keepalive" })}\n\n`);
  }, 15000);

  try {
    // Stage 1: Website extraction (if URL provided)
    let extractedStyles: Awaited<ReturnType<typeof extractStylesFromUrl>> | null = null;
    let contentAnalysis: Awaited<ReturnType<typeof analyzeContent>> | null = null;
    let colorScheme: Awaited<ReturnType<typeof designColorScheme>> | null = null;

    if (referenceUrl) {
      sendEvent("progress", { message: "Extracting website styles...", progress: 5, step: "extraction" });
      extractedStyles = await extractStylesFromUrl(referenceUrl);

      sendEvent("progress", { message: "Analyzing content & designing color palette...", progress: 10, step: "analysis" });
      const contentBrief = [
        `Website: "${extractedStyles.meta.title}" — ${extractedStyles.meta.description}`,
        `URL: ${referenceUrl}`,
        `Section types: ${extractedStyles.sectionTypes.join(", ")}`,
        `Fonts: ${extractedStyles.fonts.join(", ")}`,
      ].join("\n");

      [contentAnalysis, colorScheme] = await Promise.all([
        analyzeContent(contentBrief, extractedStyles),
        designColorScheme(contentBrief, extractedStyles),
      ]);

      sendEvent("progress", { message: `Extracted: ${extractedStyles.sections.length} sections, ${colorScheme.mood} palette`, progress: 15, step: "analysis" });
    }

    // Stage 2: Cinematic Director
    sendEvent("progress", { message: "Designing camera angles...", progress: 20, step: "frames-design" });
    const defaultColorScheme = colorScheme || { primary: "#ffffff", secondary: "#cccccc", accent: "#dddddd", background: "#111111", text: "#fafafa", mood: "", warmth: "neutral" as const };
    const framePrompts = await designFramePrompts(prompt, frameCount, defaultColorScheme, contentAnalysis, imageBase64);
    sendEvent("progress", { message: `Designed ${framePrompts.length} camera angles`, progress: 25, step: "frames-design", data: { framePrompts } });

    // Stage 3: Image Generation
    const baseSeed = Math.floor(Math.random() * 1000000);
    const generatedFrames: Array<{ index: number; imageUrl: string; width: number; height: number; angle: string; zoom: string; mood: string }> = [];
    const batchSize = 2;

    for (let i = 0; i < framePrompts.length; i += batchSize) {
      const batch = framePrompts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (fp) => {
          const result = await generateImageFromPrompt(fp.prompt, baseSeed + fp.index, ssoCredentials, IMAGE_REGION);
          return { index: fp.index, imageUrl: result.imageUrl, width: 1280, height: 720, angle: fp.angle, zoom: fp.zoom, mood: fp.mood };
        })
      );
      generatedFrames.push(...batchResults);
      const frameProgress = 25 + (generatedFrames.length / framePrompts.length) * 40;
      sendEvent("progress", { message: `Generated frame ${generatedFrames.length}/${framePrompts.length}`, progress: Math.round(frameProgress), step: "image-gen" });
    }

    generatedFrames.sort((a, b) => a.index - b.index);

    // Stage 4: Build frame manifest
    sendEvent("progress", { message: "Building scroll sequence...", progress: 70, step: "processing" });
    const segmentSize = 1 / generatedFrames.length;
    const frameManifest = {
      frames: generatedFrames.map((frame, i) => ({
        index: frame.index,
        imageUrl: frame.imageUrl,
        scrollStart: i * segmentSize,
        scrollEnd: (i + 1) * segmentSize,
        transition: i === 0 ? "none" as const : "crossfade" as const,
      })),
      totalFrames: generatedFrames.length,
      aspectRatio: "16:9",
    };

    // Stage 5: Page Architect
    sendEvent("progress", { message: "Designing page layout and copy...", progress: 80, step: "page-design" });
    const pagePlan = await designPagePlan(
      prompt,
      frameCount,
      defaultColorScheme,
      contentAnalysis,
      extractedStyles
    );

    sendEvent("progress", { message: "Page generation complete!", progress: 100, step: "complete" });

    // Final complete event with all data
    sendEvent("complete", {
      data: { frameManifest, pagePlan },
    });
  } catch (error: any) {
    console.error("SSE pipeline error:", error.message);
    sendEvent("error", { message: error.message, step: "error" });
  } finally {
    clearInterval(keepalive);
    res.end();
  }
});

// ─── Startup ────────────────────────────────────────────────────
const CLAUDE_MODEL_ID = process.env.VITE_BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-v1-0";

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🔧 EverForge 3D Server running on http://localhost:${PORT}`);
  console.log(`   Claude: ${CLAUDE_MODEL_ID} (${REGION})`);
  console.log(`   Image:  ${getImageProviderName()}`);
  console.log(`\n   Agents:`);
  console.log(`   ├─ Style Extractor    (Playwright → DOM analysis)`);
  console.log(`   ├─ Content Analyst    (Claude → brand/audience strategy)`);
  console.log(`   ├─ Color Architect    (Claude → palette design)`);
  console.log(`   ├─ Cinematic Director (Claude → camera angles)`);
  console.log(`   ├─ Page Architect     (Claude → section layout + copy)`);
  console.log(`   └─ Image Generator    (${IMAGE_PROVIDER === "vertex-nano-banana" ? "Vertex AI → Nano Banana Pro" : "Bedrock → " + (process.env.VITE_BEDROCK_IMAGE_MODEL_ID || "SD 3.5")})\n`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});
process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});
