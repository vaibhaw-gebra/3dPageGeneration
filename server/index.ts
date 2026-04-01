import express from "express";
import cors from "cors";
import { fromSSO } from "@aws-sdk/credential-providers";
import { extractStylesFromUrl, closeBrowser } from "./agents/style-extractor.js";
import { analyzeContent } from "./agents/content-analyst.js";
import { designColorScheme } from "./agents/color-architect.js";
import { designFramePrompts } from "./agents/cinematic-director.js";
import { designPagePlan } from "./agents/page-architect.js";
import { generateImage, getImageProviderName, IMAGE_PROVIDER } from "./agents/image-generator.js";
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

    // Also run Content Analyst in parallel with Claude analysis
    const [contentAnalysis, colorScheme] = await Promise.all([
      analyzeContent(
        `Website at ${url}: "${styles.meta.title}" — ${styles.meta.description}`,
        styles
      ),
      designColorScheme(
        `Website matching "${styles.meta.title}". Sections: ${styles.sections.join(", ")}. Fonts: ${styles.fonts.join(", ")}`,
        styles
      ),
    ]);

    console.log(`[StyleExtractor] Done: ${styles.sections.length} sections, ${styles.fonts.length} fonts`);
    console.log(`[ContentAnalyst] Tone: ${contentAnalysis.contentTone}, Audience: ${contentAnalysis.targetAudience}`);
    console.log(`[ColorArchitect] Mood: ${colorScheme.mood}, Warmth: ${colorScheme.warmth}`);

    res.json({
      styles,
      contentAnalysis,
      colorScheme,
      // Legacy format for existing frontend
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
      sections: styles.sections,
      contentSnippets: [contentAnalysis.valueProposition, ...contentAnalysis.keyBenefits],
      imageUrls: styles.images,
    });
  } catch (error: any) {
    console.error("Extraction error:", error.message);
    res.status(500).json({ error: error.message });
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
      colorScheme || { primary: "#a855f7", secondary: "#6366f1", accent: "#f59e0b", background: "#0a0a0a", text: "#fafafa", mood: "cinematic dark", warmth: "cool" as const },
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
      colorScheme || { primary: "#a855f7", secondary: "#6366f1", accent: "#f59e0b", background: "#0a0a0a", text: "#fafafa", mood: "cinematic dark", warmth: "cool" as const },
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
    const result = await generateImage(prompt, seed, ssoCredentials, IMAGE_REGION);
    res.json({ imageUrl: result.imageUrl });
  } catch (error: any) {
    console.error("Image error:", error.message);
    res.status(500).json({ error: error.message });
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
