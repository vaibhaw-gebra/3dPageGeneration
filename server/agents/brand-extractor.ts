import { GoogleGenAI } from "@google/genai";
import { extractStylesFromUrl, type ExtractedStyles } from "./style-extractor.js";
import { invokeClaudeRaw } from "../llm.js";

// ─── Config ─────────────────────────────────────────────────────

const GCP_PROJECT = process.env.VITE_GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
const GCP_LOCATION = process.env.VITE_GCP_LOCATION || "global";
const GEMINI_VISION_MODEL = process.env.VITE_GEMINI_VISION_MODEL || "gemini-2.0-flash";

const genAI = new GoogleGenAI({
  vertexai: true,
  project: GCP_PROJECT,
  location: GCP_LOCATION,
});

// ─── Types ──────────────────────────────────────────────────────

export interface BrandAssets {
  logo: { light?: string | null; dark?: string | null; alt?: string | null };
  favicon: string;
  heroBackgroundImage?: string | null;
  socials?: { twitter?: string | null; linkedin?: string | null; github?: string | null; instagram?: string | null };
}

export interface BrandStrategy {
  industry?: string;
  valueProposition?: string;
  voice?: { persona?: string; tone?: string };
  style?: { archetype?: "Expert" | "Friendly" | "Bold" | "Minimalist" };
}

export interface ThemeTokens {
  [key: string]: string | null | undefined;
}

export interface BrandAndTheme {
  brandAssets?: BrandAssets;
  strategy?: BrandStrategy;
  themeConfig?: { tokens: ThemeTokens };
}

export interface BrandExtractionProgress {
  event: "progress" | "complete" | "error";
  message?: string;
  progress?: number;
  step?: string;
  data?: BrandAndTheme;
}

// ─── Gemini Vision: Screenshot Analysis ─────────────────────────

async function analyzeScreenshotWithGemini(
  screenshotBase64: string,
  extractedStyles: ExtractedStyles
): Promise<{
  refinedTokens: ThemeTokens;
  brandAssets: BrandAssets;
  strategy: BrandStrategy;
}> {
  const siteContext = [
    `Title: "${extractedStyles.meta.title}"`,
    `Description: "${extractedStyles.meta.description}"`,
    `Fonts detected: ${extractedStyles.fonts.join(", ")}`,
    `Section types: ${extractedStyles.sectionTypes.join(", ")}`,
    `Colors found: BG=${extractedStyles.colors.backgrounds.slice(0, 5).join(", ")} Text=${extractedStyles.colors.texts.slice(0, 3).join(", ")}`,
    `Logo: ${extractedStyles.logos[0]?.alt || extractedStyles.logos[0]?.src?.slice(0, 60) || "not found"}`,
    `Nav links: ${extractedStyles.navLinks.join(", ")}`,
    `CTA texts: ${extractedStyles.ctaTexts.slice(0, 5).join(", ")}`,
    `Social links: ${extractedStyles.socialLinks.join(", ")}`,
    extractedStyles.headings.length ? `Headings: ${extractedStyles.headings.slice(0, 5).map(h => `h${h.level}: "${h.text}"`).join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const prompt = `You are an expert brand analyst and web designer. Analyze this website screenshot and extracted data to produce a comprehensive brand extraction.

EXTRACTED SITE DATA:
${siteContext}

Analyze the screenshot carefully for:
1. EXACT colors used (primary brand color, accent, background, text colors)
2. Typography (heading font, body font, weights)
3. Design style (border radius, shadows, spacing patterns)
4. Brand identity (industry, voice, positioning)

Return ONLY a JSON object with this EXACT structure:
{
  "tokens": {
    "--color-primary": "#hex (the MAIN brand color from the site)",
    "--color-primary-fg": "#hex (text on primary bg, usually white or dark)",
    "--color-accent": "#hex (secondary/accent color for CTAs, highlights)",
    "--color-accent-fg": "#hex (text on accent bg)",
    "--bg-canvas": "#hex (main page background)",
    "--bg-surface": "#hex (card/section background)",
    "--bg-subtle": "#hex (subtle background variation)",
    "--text-main": "#hex (primary text color)",
    "--text-muted": "#hex (secondary/muted text)",
    "--font-heading": "font family name for headings",
    "--font-body": "font family name for body text",
    "--font-heading-weight": "700 or 600 or 800",
    "--font-body-size": "16px or 15px",
    "--font-body-height": "1.6 or 1.5",
    "--radius-btn": "Npx (button border radius)",
    "--radius-card": "Npx (card border radius)",
    "--shadow-card": "CSS shadow value",
    "--border-subtle": "#hex (subtle border color)",
    "--border-width": "1px",
    "--transition-dur": "0.2s",
    "--hover-lift": "-2px or -1px",
    "--inverse-bg-canvas": "#hex (dark mode bg)",
    "--inverse-bg-surface": "#hex (dark mode surface)",
    "--inverse-text-main": "#hex (dark mode text)",
    "--inverse-text-muted": "#hex (dark mode muted text)"
  },
  "brandAssets": {
    "logo": { "alt": "brand name from logo" },
    "favicon": "${extractedStyles.meta.favicon || ""}",
    "socials": {
      "twitter": "url or null",
      "linkedin": "url or null",
      "github": "url or null"
    }
  },
  "strategy": {
    "industry": "specific industry (e.g., SaaS, Fintech, E-commerce)",
    "valueProposition": "10-20 word value prop",
    "voice": {
      "persona": "how the brand speaks (e.g., Confident expert, Friendly guide)",
      "tone": "tone description (e.g., Professional but approachable)"
    },
    "style": {
      "archetype": "Expert" or "Friendly" or "Bold" or "Minimalist"
    }
  }
}

IMPORTANT:
- Extract EXACT colors from the screenshot, not generic guesses
- All colors must be hex format (#RRGGBB)
- Font names should be clean (no CSS variable artifacts)
- Look carefully at the screenshot for the ACTUAL primary brand color`;

  const response = await genAI.models.generateContent({
    model: GEMINI_VISION_MODEL,
    contents: [
      { text: prompt },
      {
        inlineData: {
          mimeType: "image/png",
          data: screenshotBase64,
        },
      },
    ],
  });

  const text = response.candidates?.[0]?.content?.parts
    ?.filter((p: any) => p.text)
    .map((p: any) => p.text)
    .join("") || "";

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Gemini vision analysis returned no JSON");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // Try to repair truncated JSON
    let repaired = jsonMatch[0];
    const opens = (repaired.match(/\{/g) || []).length;
    const closes = (repaired.match(/\}/g) || []).length;
    repaired = repaired.replace(/,\s*$/, "");
    for (let i = 0; i < opens - closes; i++) repaired += "}";
    parsed = JSON.parse(repaired);
  }

  return {
    refinedTokens: parsed.tokens || {},
    brandAssets: parsed.brandAssets || { logo: {}, favicon: "" },
    strategy: parsed.strategy || {},
  };
}

// ─── Build Heuristic Tokens (pre-LLM baseline) ─────────────────

function isNeutral(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  return saturation < 0.15; // Low saturation = neutral/gray/white/black
}

function buildHeuristicTokens(styles: ExtractedStyles): ThemeTokens {
  const bg = styles.colors.backgrounds;
  const text = styles.colors.texts;
  const accents = styles.colors.accents;

  // Find actual brand color: first non-neutral, non-background color from backgrounds or accents
  const allColors = [...bg.slice(1), ...accents, ...text].filter(c => c.startsWith("#") && c.length >= 7);
  const brandColor = allColors.find(c => !isNeutral(c)) || "#7c3aed";

  // Find the main background (usually first, and neutral)
  const canvasBg = bg.find(c => c.startsWith("#") && isNeutral(c)) || bg[0] || "#ffffff";

  // Find muted text (neutral, different from main text)
  const mainText = text[0] || "#1f2937";
  const mutedText = text.find(c => c !== mainText && c.startsWith("#")) || "#6b7280";

  // Find border color (neutral, light)
  const borderColor = styles.colors.borders.find(c => c.startsWith("#") && isNeutral(c)) || "#e5e7eb";

  return {
    "--color-primary": brandColor,
    "--color-primary-fg": "#ffffff",
    "--color-accent": allColors.find(c => !isNeutral(c) && c !== brandColor) || brandColor,
    "--color-accent-fg": "#ffffff",
    "--bg-canvas": canvasBg,
    "--bg-surface": "#f9fafb",
    "--bg-subtle": "#f3f4f6",
    "--text-main": mainText,
    "--text-muted": isNeutral(mutedText) ? mutedText : "#6b7280",
    "--font-heading": styles.fonts[0] || "Inter",
    "--font-body": styles.fonts[1] || styles.fonts[0] || "Inter",
    "--font-heading-weight": "700",
    "--font-body-size": "16px",
    "--font-body-height": "1.6",
    "--radius-btn": styles.spacing.borderRadius || "8px",
    "--radius-card": "12px",
    "--shadow-card": "0 1px 3px rgba(0,0,0,0.1)",
    "--border-subtle": borderColor,
    "--border-width": "1px",
    "--transition-dur": "0.2s",
    "--hover-lift": "-2px",
    "--inverse-bg-canvas": "#0f172a",
    "--inverse-bg-surface": "#1e293b",
    "--inverse-text-main": "#f8fafc",
    "--inverse-text-muted": "#94a3b8",
  };
}

// ─── WCAG Contrast Guards ───────────────────────────────────

function hexToLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isLightColor(hex: string): boolean {
  return hexToLuminance(hex) > 0.5;
}

function applyContrastGuards(tokens: ThemeTokens) {
  const canvas = tokens["--bg-canvas"];
  const textMain = tokens["--text-main"];

  if (!canvas || !textMain || !canvas.startsWith("#") || !textMain.startsWith("#")) return;

  // If text-main has poor contrast against canvas, fix it
  const ratio = contrastRatio(canvas, textMain);
  if (ratio < 4.5) {
    // Canvas is light → use dark text. Canvas is dark → use light text.
    tokens["--text-main"] = isLightColor(canvas) ? "#1f2937" : "#f8fafc";
    tokens["--text-muted"] = isLightColor(canvas) ? "#6b7280" : "#94a3b8";
  }

  // Also fix inverse tokens if needed
  const invCanvas = tokens["--inverse-bg-canvas"];
  const invText = tokens["--inverse-text-main"];
  if (invCanvas && invText && invCanvas.startsWith("#") && invText.startsWith("#")) {
    if (contrastRatio(invCanvas, invText) < 4.5) {
      tokens["--inverse-text-main"] = isLightColor(invCanvas) ? "#1f2937" : "#f8fafc";
      tokens["--inverse-text-muted"] = isLightColor(invCanvas) ? "#6b7280" : "#94a3b8";
    }
  }
}

// ─── Main Pipeline: Extract Brand & Theme ───────────────────────

export async function* extractBrandFromUrl(
  url: string
): AsyncGenerator<BrandExtractionProgress> {
  const startTime = Date.now();

  // Stage 1: Playwright DOM extraction
  yield { event: "progress", message: "Launching browser to scan website...", progress: 5, step: "browser" };

  let extractedStyles: ExtractedStyles;
  try {
    extractedStyles = await extractStylesFromUrl(url);
  } catch (err: any) {
    yield { event: "error", message: `Failed to load website: ${err.message}`, step: "browser" };
    return;
  }

  yield {
    event: "progress",
    message: `Extracted ${extractedStyles.sections.length} sections, ${extractedStyles.fonts.length} fonts, ${extractedStyles.logos.length} logos`,
    progress: 25,
    step: "extraction",
  };

  // Stage 2: Build heuristic tokens (fast baseline)
  yield { event: "progress", message: "Building initial theme tokens from CSS...", progress: 30, step: "heuristics" };
  const heuristicTokens = buildHeuristicTokens(extractedStyles);

  // Stage 3: Gemini vision analysis (screenshot + data)
  yield { event: "progress", message: "Analyzing screenshot with Gemini vision for accurate brand extraction...", progress: 40, step: "vision" };

  let refinedTokens = heuristicTokens;
  let brandAssets: BrandAssets = {
    logo: { alt: extractedStyles.logos[0]?.alt || extractedStyles.meta.title },
    favicon: extractedStyles.meta.favicon,
    socials: {},
  };
  let strategy: BrandStrategy = {};

  try {
    const visionResult = await analyzeScreenshotWithGemini(
      extractedStyles.screenshot,
      extractedStyles
    );

    // Merge vision results with heuristics (vision takes priority)
    refinedTokens = { ...heuristicTokens };
    for (const [key, value] of Object.entries(visionResult.refinedTokens)) {
      if (value && typeof value === "string" && value.trim()) {
        refinedTokens[key] = value;
      }
    }

    brandAssets = {
      ...brandAssets,
      ...visionResult.brandAssets,
      favicon: visionResult.brandAssets?.favicon || extractedStyles.meta.favicon || "",
    };

    strategy = visionResult.strategy || {};

    yield {
      event: "progress",
      message: `Vision analysis complete: ${strategy.industry || "unknown"} industry, ${strategy.style?.archetype || "unknown"} style`,
      progress: 75,
      step: "vision-complete",
    };
  } catch (err: any) {
    console.warn("[BrandExtractor] Gemini vision failed, using heuristic tokens:", err.message);
    yield {
      event: "progress",
      message: "Vision analysis unavailable — using CSS-based extraction",
      progress: 75,
      step: "vision-fallback",
    };
  }

  // Stage 4: Content analysis with Claude (for deeper strategy)
  yield { event: "progress", message: "Analyzing content strategy...", progress: 80, step: "content" };

  try {
    const contentBrief = [
      `Website: "${extractedStyles.meta.title}" — ${extractedStyles.meta.description}`,
      `URL: ${url}`,
      `Sections: ${extractedStyles.sectionTypes.join(", ")}`,
      `Headings: ${extractedStyles.headings.slice(0, 5).map(h => h.text).join(" | ")}`,
      `CTAs: ${extractedStyles.ctaTexts.slice(0, 5).join(", ")}`,
    ].join("\n");

    const contentResult = await invokeClaudeRaw(
      `You are a brand strategist. Analyze this website data and return ONLY a JSON object:
{
  "industry": "specific industry",
  "valueProposition": "10-20 word value prop",
  "voice": { "persona": "how brand speaks", "tone": "tone description" },
  "style": { "archetype": "Expert|Friendly|Bold|Minimalist" }
}`,
      contentBrief,
      2048
    );

    const jsonMatch = contentResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Merge Claude's strategy (fills gaps from vision)
      strategy = {
        industry: strategy.industry || parsed.industry,
        valueProposition: strategy.valueProposition || parsed.valueProposition,
        voice: strategy.voice?.persona ? strategy.voice : parsed.voice,
        style: strategy.style?.archetype ? strategy.style : parsed.style,
      };
    }
  } catch (err: any) {
    console.warn("[BrandExtractor] Content analysis fallback:", err.message);
  }

  // Stage 5: Populate social links from DOM extraction
  for (const link of extractedStyles.socialLinks) {
    const name = link.toLowerCase();
    if (!brandAssets.socials) brandAssets.socials = {};
    if (name.includes("twitter") || name.includes("x")) brandAssets.socials.twitter = link;
    else if (name.includes("linkedin")) brandAssets.socials.linkedin = link;
    else if (name.includes("github")) brandAssets.socials.github = link;
    else if (name.includes("instagram")) brandAssets.socials.instagram = link;
  }

  // Stage 5b: Gemini vision logo identification
  yield { event: "progress", message: "Identifying brand logo with vision...", progress: 88, step: "logo-vision" };

  let visionBrandName: string | null = null;
  try {
    const logoResponse = await genAI.models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: [
        {
          text: `Look at the TOP of this webpage screenshot — the header/navigation bar area.
What is the BRAND NAME shown in the logo at the top-left of the page?
Reply with ONLY the brand name, nothing else. For example: "GitHub" or "Stripe" or "Linear".
If you cannot identify the brand logo, reply with "UNKNOWN".`,
        },
        { inlineData: { mimeType: "image/png", data: extractedStyles.screenshot } },
      ],
    });
    const logoText = logoResponse.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join("")
      .trim() || "";
    if (logoText && logoText !== "UNKNOWN" && logoText.length < 50) {
      visionBrandName = logoText.replace(/^["']|["']$/g, ""); // Strip quotes
      console.log(`[BrandExtractor] Gemini identified brand: "${visionBrandName}"`);
    }
  } catch (err: any) {
    console.warn("[BrandExtractor] Vision logo ID failed:", err.message);
  }

  // Pick the best logo from scored DOM candidates using vision brand name as guide
  const logos = extractedStyles.logos;

  // If Gemini identified a brand name, try to match it to a DOM logo
  let bestLogo = logos[0]; // Default: highest scored
  if (visionBrandName && logos.length > 1) {
    const visionLower = visionBrandName.toLowerCase();
    const match = logos.find(l => {
      const alt = (l.alt || "").toLowerCase();
      const src = (l.src || "").toLowerCase();
      return alt.includes(visionLower) || visionLower.includes(alt.replace(/logo|logotype|icon/gi, "").trim()) || src.includes(visionLower);
    });
    if (match) bestLogo = match;
  }

  // Set brand name from vision or DOM
  brandAssets.logo.alt = visionBrandName || bestLogo?.alt || extractedStyles.meta.title || "";

  // Set logo URL from best candidate
  if (bestLogo) {
    if (bestLogo.type === "img" && bestLogo.src) {
      let logoUrl = bestLogo.src;
      if (logoUrl.startsWith("/")) {
        try { logoUrl = new URL(logoUrl, url).href; } catch { /* keep relative */ }
      }
      brandAssets.logo.light = logoUrl;
    } else if (bestLogo.type === "svg" && bestLogo.src?.startsWith("<svg")) {
      brandAssets.logo.light = `data:image/svg+xml;base64,${Buffer.from(bestLogo.src).toString("base64")}`;
    }
  }

  // Resolve relative favicon URL to absolute
  if (brandAssets.favicon && brandAssets.favicon.startsWith("/")) {
    try { brandAssets.favicon = new URL(brandAssets.favicon, url).href; } catch { /* keep as-is */ }
  }

  // Stage 6: WCAG contrast guards
  applyContrastGuards(refinedTokens);

  yield { event: "progress", message: "Finalizing brand theme...", progress: 95, step: "finalize" };

  const brandAndTheme: BrandAndTheme = {
    brandAssets,
    strategy,
    themeConfig: { tokens: refinedTokens },
  };

  const durationMs = Date.now() - startTime;
  console.log(`[BrandExtractor] Complete in ${durationMs}ms: ${strategy.industry || "unknown"} / ${strategy.style?.archetype || "unknown"}`);

  yield {
    event: "complete",
    message: "Brand extraction complete!",
    progress: 100,
    step: "complete",
    data: brandAndTheme,
  };
}
