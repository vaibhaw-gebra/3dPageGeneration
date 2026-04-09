import { invokeClaudeRaw } from "../llm.js";
import type { ExtractedStyles } from "./style-extractor.js";

export interface ContentAnalysis {
  brandName: string;
  brandVoice: string;
  targetAudience: string;
  valueProposition: string;
  painPoints: string[];
  keyBenefits: string[];
  contentTone: "professional" | "casual" | "technical" | "playful" | "luxury";
  suggestedSections: string[];
  existingCopy: {
    headlines: string[];
    ctaTexts: string[];
    stats: string[];
  };
}

/**
 * Content Analyst Agent — deep analysis of the extracted website data
 * to understand brand, audience, content strategy, and reusable copy.
 */
export async function analyzeContent(
  userPrompt: string,
  extractedStyles: ExtractedStyles | null
): Promise<ContentAnalysis> {
  let siteContext = "";
  if (extractedStyles) {
    const headlines = extractedStyles.headings
      ?.slice(0, 10)
      .map((h) => `h${h.level}: "${h.text}"`)
      .join("\n") || "";

    const sections = extractedStyles.sections
      ?.map((s) => `[${s.type}] headings: ${s.headings.join(" | ")} — CTAs: ${s.ctaButtons.join(", ")}`)
      .join("\n") || "";

    const testimonials = extractedStyles.testimonials
      ?.map((t) => `"${t.quote.slice(0, 100)}" — ${t.author}`)
      .join("\n") || "";

    siteContext = `

EXTRACTED WEBSITE DATA:
- Title: "${extractedStyles.meta.title}"
- Description: "${extractedStyles.meta.description}"
- Logo: ${extractedStyles.logos?.[0]?.alt || "not detected"}
- Nav links: ${extractedStyles.navLinks?.join(", ") || "none"}
- Social: ${extractedStyles.socialLinks?.join(", ") || "none"}
- CTA buttons found: ${extractedStyles.ctaTexts?.join(", ") || "none"}
- Stats found: ${extractedStyles.stats?.join(", ") || "none"}
- Fonts: ${extractedStyles.fonts?.join(", ")}
- Images: ${extractedStyles.images?.length || 0} (roles: ${[...new Set(extractedStyles.images?.map(i => i.role))].join(", ")})

Headings found:
${headlines}

Page sections:
${sections}

${testimonials ? `Testimonials:\n${testimonials}` : ""}`;
  }

  const systemPrompt = `You are an expert marketing strategist. Analyze the website brief and any extracted data to produce a comprehensive content strategy.

Extract and preserve as much REAL content as possible from the reference site (headlines, CTAs, stats). Don't invent — use what's there.

Respond with ONLY a JSON object:
{
  "brandName": "detected brand name or suggested name",
  "brandVoice": "1-sentence brand voice description",
  "targetAudience": "specific target audience (be precise, not generic)",
  "valueProposition": "core value proposition in 1 sentence",
  "painPoints": ["3 specific pain points the product solves"],
  "keyBenefits": ["4 key benefits to highlight"],
  "contentTone": "professional" | "casual" | "technical" | "playful" | "luxury",
  "suggestedSections": ["ordered section types: header, hero, features, stats, showcase, testimonial, cta, footer"],
  "existingCopy": {
    "headlines": ["best headlines found on the site (up to 5)"],
    "ctaTexts": ["CTA button texts found"],
    "stats": ["stats/numbers found like '10K+ users', '99.9% uptime'"]
  }
}`;

  const result = await invokeClaudeRaw(
    systemPrompt,
    `Analyze this website:\n${userPrompt}${siteContext}`
  );

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Content analysis failed");
  return JSON.parse(jsonMatch[0]);
}
