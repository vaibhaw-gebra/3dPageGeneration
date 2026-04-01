import { invokeClaudeRaw } from "../llm.js";
import type { ExtractedStyles } from "./style-extractor.js";

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  backgroundAlt: string;
  text: string;
  textMuted: string;
  mood: string;
  warmth: "warm" | "cool" | "neutral";
}

/**
 * Color Architect Agent — designs a cohesive color palette based on the
 * user's brief and optional reference site colors.
 * Ensures the palette is NOT always blue/dark — varied and scene-appropriate.
 */
export async function designColorScheme(
  userPrompt: string,
  extractedStyles: ExtractedStyles | null
): Promise<ColorScheme> {
  const refColors = extractedStyles
    ? `\n\nReference site colors to draw inspiration from (adapt, don't copy exactly):
- Backgrounds: ${extractedStyles.colors.backgrounds.slice(0, 5).join(", ")}
- Texts: ${extractedStyles.colors.texts.slice(0, 3).join(", ")}
- Fonts used: ${extractedStyles.fonts.join(", ")}`
    : "";

  const systemPrompt = `You are a color theory expert designing a website palette.

CRITICAL RULES:
- DO NOT default to blue or dark blue. Match the COLOR MOOD of the scene description.
- A robot product → metallic silver/cyan/orange. A nature scene → greens/earth tones. A luxury brand → gold/black/cream.
- Warm scenes need warm accents (amber, coral, orange). Cool scenes need cool accents (teal, violet, ice blue).
- The accent color should POP against the background. High contrast is essential.
- Background can be dark (#0a0a0a, #111) or light (#fafafa, #fff) depending on the brief.
- NEVER use generic blue (#3b82f6) unless the brief specifically mentions blue.${refColors}

Respond with ONLY a JSON object:
{
  "primary": "#hex — main brand color",
  "secondary": "#hex — supporting color",
  "accent": "#hex — high-contrast CTA/highlight color",
  "background": "#hex — page background",
  "backgroundAlt": "#hex — alternate section background",
  "text": "#hex — main text color",
  "textMuted": "#hex — secondary text color",
  "mood": "1-3 word mood description (e.g. 'warm industrial', 'clean minimal', 'bold neon')",
  "warmth": "warm" | "cool" | "neutral"
}`;

  const result = await invokeClaudeRaw(
    systemPrompt,
    `Design a color palette for this website: ${userPrompt}`
  );

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Color scheme generation failed");
  return JSON.parse(jsonMatch[0]);
}
