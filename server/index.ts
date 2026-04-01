import express from "express";
import cors from "cors";
import { fromSSO } from "@aws-sdk/credential-providers";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { extractStylesFromUrl, closeBrowser } from "./agents/style-extractor.js";
import { analyzeContent } from "./agents/content-analyst.js";
import { designColorScheme } from "./agents/color-architect.js";
import { designFramePrompts } from "./agents/cinematic-director.js";
import { designPagePlan } from "./agents/page-architect.js";
import { invokeClaudeRaw, REGION, PROFILE } from "./llm.js";

const IMAGE_REGION = process.env.VITE_BEDROCK_IMAGE_REGION || REGION;
const CLAUDE_MODEL_ID =
  process.env.VITE_BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-v1-0";
const IMAGE_MODEL_ID =
  process.env.VITE_BEDROCK_IMAGE_MODEL_ID || "stability.sd3-5-large-v1:0";

const ssoCredentials = fromSSO({ profile: PROFILE });

const claudeClient = new BedrockRuntimeClient({
  region: REGION,
  credentials: ssoCredentials,
});

const imageClient = new BedrockRuntimeClient({
  region: IMAGE_REGION,
  credentials: ssoCredentials,
});

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

// ─── Image Generation ───────────────────────────────────────────
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, seed } = req.body;
    const requestBody = buildImageRequestBody(prompt, seed);

    const command = new InvokeModelCommand({
      modelId: IMAGE_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: requestBody,
    });

    const response = await imageClient.send(command);
    const imageDataUrl = parseImageResponse(response.body);
    res.json({ imageUrl: imageDataUrl });
  } catch (error: any) {
    console.error("Image error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Image Model Helpers ────────────────────────────────────────

function buildImageRequestBody(prompt: string, seed: number): string {
  if (IMAGE_MODEL_ID.startsWith("amazon.nova-canvas")) {
    return JSON.stringify({
      taskType: "TEXT_IMAGE",
      textToImageParams: { text: prompt },
      imageGenerationConfig: { numberOfImages: 1, width: 1280, height: 720, seed: seed % 858993459, quality: "standard" },
    });
  }
  if (IMAGE_MODEL_ID.startsWith("amazon.titan-image")) {
    return JSON.stringify({
      taskType: "TEXT_IMAGE",
      textToImageParams: { text: prompt },
      imageGenerationConfig: { numberOfImages: 1, width: 1280, height: 720, seed, quality: "standard" },
    });
  }
  if (IMAGE_MODEL_ID.includes("sd3")) {
    return JSON.stringify({
      prompt, seed: seed % 4294967295, mode: "text-to-image", output_format: "png", aspect_ratio: "16:9",
    });
  }
  if (IMAGE_MODEL_ID.startsWith("stability.")) {
    return JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }], cfg_scale: 7, seed: seed % 4294967295, steps: 30, width: 1280, height: 720,
    });
  }
  throw new Error(`Unsupported image model: ${IMAGE_MODEL_ID}`);
}

function parseImageResponse(responseBody: Uint8Array): string {
  const parsed = JSON.parse(new TextDecoder().decode(responseBody));
  if (IMAGE_MODEL_ID.startsWith("amazon.nova-canvas") || IMAGE_MODEL_ID.startsWith("amazon.titan-image")) {
    const b64 = parsed.images?.[0];
    if (!b64) throw new Error("No image in response");
    return `data:image/png;base64,${b64}`;
  }
  if (IMAGE_MODEL_ID.includes("sd3")) {
    const b64 = parsed.images?.[0];
    if (!b64) throw new Error("No image in response");
    return `data:image/png;base64,${b64}`;
  }
  if (IMAGE_MODEL_ID.startsWith("stability.")) {
    const b64 = parsed.artifacts?.[0]?.base64;
    if (!b64) throw new Error("No image in response");
    return `data:image/png;base64,${b64}`;
  }
  throw new Error(`Unknown model: ${IMAGE_MODEL_ID}`);
}

// ─── Startup ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🔧 EverForge 3D Server running on http://localhost:${PORT}`);
  console.log(`   Claude: ${CLAUDE_MODEL_ID} (${REGION})`);
  console.log(`   Image:  ${IMAGE_MODEL_ID} (${IMAGE_REGION})`);
  console.log(`\n   Agents:`);
  console.log(`   ├─ Style Extractor  (Playwright → DOM analysis)`);
  console.log(`   ├─ Content Analyst  (Claude → brand/audience strategy)`);
  console.log(`   ├─ Color Architect  (Claude → palette design)`);
  console.log(`   ├─ Cinematic Director (Claude → camera angles)`);
  console.log(`   └─ Page Architect   (Claude → section layout + copy)\n`);
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
