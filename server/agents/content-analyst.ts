import { invokeClaudeRaw } from "../llm.js";
import type { ExtractedStyles } from "./style-extractor.js";

export interface ContentAnalysis {
  brandVoice: string;
  targetAudience: string;
  valueProposition: string;
  painPoints: string[];
  keyBenefits: string[];
  contentTone: "professional" | "casual" | "technical" | "playful" | "luxury";
  suggestedSections: string[];
}

/**
 * Content Analyst Agent — analyzes the extracted website data + screenshot
 * via Claude Vision to understand the brand, audience, and content strategy.
 */
export async function analyzeContent(
  userPrompt: string,
  extractedStyles: ExtractedStyles | null
): Promise<ContentAnalysis> {
  const siteContext = extractedStyles
    ? `\n\nReference website analysis:
- Title: ${extractedStyles.meta.title}
- Description: ${extractedStyles.meta.description}
- Sections found: ${extractedStyles.sections.join(", ")}
- Fonts: ${extractedStyles.fonts.join(", ")}
- Background colors: ${extractedStyles.colors.backgrounds.slice(0, 5).join(", ")}
- Text colors: ${extractedStyles.colors.texts.slice(0, 3).join(", ")}`
    : "";

  const systemPrompt = `You are a marketing strategist analyzing a website brief.
Given a user's description${extractedStyles ? " and reference website data" : ""}, produce a content strategy.

Respond with ONLY a JSON object:
{
  "brandVoice": "1-sentence brand voice description",
  "targetAudience": "specific target audience",
  "valueProposition": "core value proposition in 1 sentence",
  "painPoints": ["3 pain points the product solves"],
  "keyBenefits": ["3-4 key benefits to highlight"],
  "contentTone": "professional" | "casual" | "technical" | "playful" | "luxury",
  "suggestedSections": ["ordered list of 6-8 section types to include: header, hero, features, stats, showcase, testimonial, cta, footer"]
}`;

  const result = await invokeClaudeRaw(
    systemPrompt,
    `Analyze this website brief: ${userPrompt}${siteContext}`
  );

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Content analysis failed");
  return JSON.parse(jsonMatch[0]);
}
