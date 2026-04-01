import { invokeClaudeRaw } from "../llm.js";
import type { ColorScheme } from "./color-architect.js";
import type { ContentAnalysis } from "./content-analyst.js";

export interface FramePrompt {
  index: number;
  angle: string;
  zoom: "wide" | "medium" | "close";
  mood: string;
  prompt: string;
  cameraPosition: { x: number; y: number; z: number };
}

/**
 * Cinematic Director Agent — designs camera angles and writes detailed
 * image generation prompts that match the color palette and content tone.
 * Ensures visual VARIETY — no two frames should look the same.
 */
export async function designFramePrompts(
  userPrompt: string,
  frameCount: number,
  colorScheme: ColorScheme,
  contentAnalysis: ContentAnalysis | null,
  imageBase64?: string
): Promise<FramePrompt[]> {
  const toneHint = contentAnalysis
    ? `\nContent tone: ${contentAnalysis.contentTone}. Target audience: ${contentAnalysis.targetAudience}.`
    : "";

  const systemPrompt = `You are a cinematic director designing ${frameCount} camera angles for a 3D scroll-driven website.

COLOR PALETTE TO MATCH (this is critical — images must reflect these colors):
- Primary: ${colorScheme.primary}
- Accent: ${colorScheme.accent}
- Background mood: ${colorScheme.mood}
- Warmth: ${colorScheme.warmth}${toneHint}

RULES FOR VISUAL VARIETY:
1. Each frame MUST have a distinctly different camera angle, zoom, and lighting
2. Frame 1: Wide establishing shot — showcase the full scene
3. Frame 2: Slight left rotation, dramatic side lighting
4. Frame 3: Close-up detail shot — focus on a key element
5. Frame 4: High angle looking down, atmospheric fog
6. Frame 5: Low angle looking up, power shot
7. Frame 6-8: Dynamic angles — dutch tilt, over-shoulder, macro detail, pull-back reveal

IMAGE PROMPT RULES:
- ALWAYS specify the color temperature and palette in each prompt
- Include "${colorScheme.warmth}" tones and "${colorScheme.mood}" mood
- Specify exact lighting: "warm amber side light", "cool blue rim light", "golden hour glow"
- Include material textures: "brushed metal", "frosted glass", "matte surface"
- NEVER write "blue tones" or "blue lighting" unless the palette is actually blue
- Each prompt should be 3-4 detailed sentences

Respond with ONLY a JSON array of ${frameCount} objects:
[{
  "index": 0,
  "angle": "wide-establishing",
  "zoom": "wide",
  "mood": "descriptive mood for this specific frame",
  "prompt": "detailed 3-4 sentence image generation prompt with specific colors, lighting, and materials",
  "cameraPosition": {"x": 0, "y": 0, "z": 1}
}]`;

  const userMessage = imageBase64
    ? `Scene: ${userPrompt}\n\nA reference image is provided. Generate ${frameCount} varied camera angle prompts that reimagine this scene from different perspectives, matching the color palette above.`
    : `Scene: ${userPrompt}\n\nGenerate ${frameCount} dramatically different camera angle prompts matching the color palette above.`;

  const result = await invokeClaudeRaw(systemPrompt, userMessage);
  const jsonMatch = result.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Frame prompt generation failed");
  return JSON.parse(jsonMatch[0]);
}
