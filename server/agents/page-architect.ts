import { invokeClaudeRaw } from "../llm.js";
import type { ColorScheme } from "./color-architect.js";
import type { ContentAnalysis } from "./content-analyst.js";
import type { ExtractedStyles } from "./style-extractor.js";

/**
 * Page Architect Agent — plans the full page structure with detailed,
 * production-quality content for every section.
 * Uses insights from Content Analyst + Color Architect + Style Extractor.
 */
export async function designPagePlan(
  userPrompt: string,
  frameCount: number,
  colorScheme: ColorScheme,
  contentAnalysis: ContentAnalysis | null,
  extractedStyles: ExtractedStyles | null
) {
  const contentContext = contentAnalysis
    ? `\n\nCONTENT STRATEGY (from Content Analyst):
- Brand voice: ${contentAnalysis.brandVoice}
- Target audience: ${contentAnalysis.targetAudience}
- Value proposition: ${contentAnalysis.valueProposition}
- Pain points to address: ${contentAnalysis.painPoints.join(", ")}
- Key benefits: ${contentAnalysis.keyBenefits.join(", ")}
- Tone: ${contentAnalysis.contentTone}
- Suggested sections: ${contentAnalysis.suggestedSections.join(" → ")}`
    : "";

  const siteContext = extractedStyles
    ? `\n\nREFERENCE SITE (from Style Extractor):
- Title: "${extractedStyles.meta.title}"
- Sections: ${extractedStyles.sections.join(", ")}
- Fonts: ${extractedStyles.fonts.join(", ")}
- Adapt this structure and improve upon it.`
    : "";

  const systemPrompt = `You are a senior page architect at a top design agency.
Create a complete, production-quality page plan with REAL content (not placeholders).

COLOR PALETTE (use these exact hex values):
- Primary: ${colorScheme.primary}
- Secondary: ${colorScheme.secondary}
- Accent: ${colorScheme.accent}
- Background: ${colorScheme.background}
- Text: ${colorScheme.text}
- Font suggestion: match the mood "${colorScheme.mood}"${contentContext}${siteContext}

PAGE STRUCTURE (include ALL of these in order):
1. "header" — nav with brand name + 4 links + CTA button
2. "hero" — bold headline, subheadline, description, primary + secondary CTA
3. "features" — exactly 3 or 4 feature cards (icon + title + description each)
4. "stats" — 3-4 impressive statistics
5. "showcase" — product/service deep-dive with detailed paragraph
6. "testimonial" — 2-3 realistic testimonials with full names and real-sounding roles
7. "cta" — strong closing call-to-action
8. "footer" — brand, social links, copyright

WRITING RULES:
- Headlines: 3-7 words, punchy, benefit-focused
- Body: specific benefits, not vague marketing speak
- Features: each must solve a real problem with a concrete title
- Stats: impressive but believable (use K+, %, x faster, etc.)
- Testimonials: sound like real people, mention specific outcomes
- Icons: use one of: sparkles, shield, zap, globe, rocket

Return ONLY JSON:
{
  "title": "Page Title",
  "description": "Meta description (150 chars)",
  "sections": [
    {"type":"header","frameIndex":0,"headline":"","body":"","brandName":"Name","navLinks":["Features","About","Pricing","Contact"]},
    {"type":"hero","frameIndex":0,"headline":"...","subheadline":"...","body":"...","ctaText":"...","ctaLink":"#"},
    {"type":"features","frameIndex":2,"headline":"...","subheadline":"...","body":"","features":[{"title":"...","description":"...","icon":"sparkles"}]},
    {"type":"stats","frameIndex":3,"headline":"...","body":"","stats":[{"value":"10K+","label":"..."}]},
    {"type":"showcase","frameIndex":4,"headline":"...","body":"...","ctaText":"..."},
    {"type":"testimonial","frameIndex":5,"headline":"...","body":"","testimonials":[{"quote":"...","author":"...","role":"..."}]},
    {"type":"cta","frameIndex":6,"headline":"...","body":"...","ctaText":"..."},
    {"type":"footer","frameIndex":7,"headline":"","body":"","brandName":"...","copyrightText":"...","socialLinks":["Twitter","GitHub","LinkedIn"]}
  ],
  "colorPalette": {
    "primary": "${colorScheme.primary}",
    "secondary": "${colorScheme.secondary}",
    "accent": "${colorScheme.accent}",
    "background": "${colorScheme.background}",
    "text": "${colorScheme.text}"
  },
  "fontFamily": "Inter"
}`;

  const result = await invokeClaudeRaw(
    systemPrompt,
    `Create a stunning website for: ${userPrompt}\n\nWrite REAL, specific, compelling content for every section.`,
    8192
  );

  // Robust JSON extraction — handle truncated or malformed output
  let jsonStr = result;

  // Strip markdown code fences
  jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");

  // Find the outermost JSON object
  const start = jsonStr.indexOf("{");
  if (start === -1) throw new Error("Page plan generation failed — no JSON found");
  jsonStr = jsonStr.slice(start);

  // Try parsing as-is
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Attempt to repair truncated JSON by closing open brackets
    let repaired = jsonStr;
    const opens = (repaired.match(/\[/g) || []).length;
    const closes = (repaired.match(/\]/g) || []).length;
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;

    // Remove trailing comma before closing
    repaired = repaired.replace(/,\s*$/, "");

    for (let i = 0; i < opens - closes; i++) repaired += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";

    try {
      return JSON.parse(repaired);
    } catch (e2) {
      console.error("JSON repair failed. Raw response length:", result.length);
      console.error("First 500 chars:", result.slice(0, 500));
      console.error("Last 500 chars:", result.slice(-500));
      throw new Error(`Page plan JSON parse failed: ${(e2 as Error).message}`);
    }
  }
}
