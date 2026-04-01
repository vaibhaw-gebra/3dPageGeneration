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
    `Create a stunning website for: ${userPrompt}\n\nWrite REAL, specific, compelling content for every section.`
  );

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Page plan generation failed");
  return JSON.parse(jsonMatch[0]);
}
