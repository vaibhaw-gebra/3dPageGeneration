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
 * Cinematic Director Agent — designs a coherent sequence of camera angles
 * for a SINGLE continuous scene. Every frame shares the same scene description
 * but varies ONLY the camera angle, zoom, and lighting direction.
 *
 * This ensures all generated images look like they belong to the same world
 * and create a smooth scroll transition.
 */
export async function designFramePrompts(
  userPrompt: string,
  frameCount: number,
  colorScheme: ColorScheme,
  contentAnalysis: ContentAnalysis | null,
  imageBase64?: string
): Promise<FramePrompt[]> {
  const toneHint = contentAnalysis
    ? `\nBrand: ${contentAnalysis.brandName || ""}. Tone: ${contentAnalysis.contentTone}. Audience: ${contentAnalysis.targetAudience}.`
    : "";

  // Only include color hints if they came from actual extraction (not defaults)
  const hasRealColors = colorScheme.mood && colorScheme.mood !== "cinematic dark";
  const colorHint = hasRealColors
    ? `\nSCENE MOOD HINT (use as subtle guidance, NOT as a color filter):
- Overall mood: "${colorScheme.mood}" (${colorScheme.warmth} tones)
- Let the scene's natural colors dominate. Do NOT tint the entire image with one color.`
    : "";

  const systemPrompt = `You are a cinematic director planning a single continuous camera move through ONE scene.

YOUR JOB: Create ${frameCount} frames that show the EXACT SAME scene from a smoothly changing camera path.
Think of it as a drone shot slowly orbiting and zooming around a single subject/environment.
${colorHint}${toneHint}

CRITICAL RULES FOR VISUAL CONTINUITY:

1. SCENE ANCHOR — Write a 1-2 sentence "base scene" description that stays IDENTICAL in every prompt.
   The scene description should faithfully represent what the user asked for with NATURAL, REALISTIC colors.
   Example: "A sleek chrome robot standing in a dark studio with polished concrete floor, volumetric amber fog, and warm side lighting."

2. CAMERA PATH — Each frame changes ONLY:
   - Camera angle (orbit left → front → right → above → low → back to front)
   - Zoom level (wide establishing → medium → close-up → medium → wide pullback)
   - Subtle lighting shift (but same light sources)

3. PROMPT STRUCTURE — Every prompt MUST follow this exact format:
   "[SCENE ANCHOR]. Camera: [angle description]. [Lighting detail]. [Atmosphere detail]."

   The scene anchor text must be WORD-FOR-WORD identical across all ${frameCount} prompts.
   Only the camera/lighting/atmosphere sentences change.

4. SMOOTH TRANSITIONS — Adjacent frames should have small angle changes (15-30 degrees), not jumps.
   Frame sequence should create a smooth orbit: front → slight right → right → slight high → overhead → pull back.

5. NEVER change the subject, environment, materials, or color palette between frames.
   Frame 1 and Frame ${frameCount} should clearly be the same place.

6. COLOR ACCURACY — Use colors that match the scene naturally. A forest should be green, an ocean blue,
   a sunset orange/pink. Do NOT force any specific hex color or tint across all frames. Let the scene dictate its own palette.

Respond with ONLY a JSON array:
[{
  "index": 0,
  "angle": "front-center",
  "zoom": "wide",
  "mood": "establishing, atmospheric",
  "prompt": "[exact scene anchor]. Camera positioned directly in front, centered, wide establishing shot. Soft natural lighting from the left. Subtle atmospheric haze.",
  "cameraPosition": {"x": 0, "y": 0, "z": 1}
}]`;

  const userMessage = imageBase64
    ? `Scene concept: ${userPrompt}\n\nA reference image is provided. Create ${frameCount} camera positions that orbit around this exact scene. Keep every detail identical — only the camera moves.`
    : `Scene concept: ${userPrompt}\n\nFirst, design the base scene in vivid detail (materials, lighting, environment). Then create ${frameCount} frames that smoothly orbit through it. The scene anchor text must be identical in every prompt.`;

  // ~300 tokens per frame + overhead; ensure enough room for large frame counts
  const estimatedTokens = Math.max(8192, frameCount * 350 + 1024);
  const result = await invokeClaudeRaw(systemPrompt, userMessage, estimatedTokens);

  let jsonMatch = result.match(/\[[\s\S]*\]/);

  // If no complete array found, try to repair truncated JSON
  if (!jsonMatch) {
    const arrayStart = result.indexOf("[");
    if (arrayStart !== -1) {
      let partial = result.slice(arrayStart);
      // Close any unclosed object and array
      const openBraces = (partial.match(/{/g) || []).length;
      const closeBraces = (partial.match(/}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) partial += "}";
      if (!partial.trimEnd().endsWith("]")) {
        // Remove trailing comma if present, then close array
        partial = partial.replace(/,\s*$/, "") + "]";
      }
      jsonMatch = partial.match(/\[[\s\S]*\]/);
    }
  }

  if (!jsonMatch) throw new Error("Frame prompt generation failed — could not parse response as JSON array");

  let frames: FramePrompt[];
  try {
    frames = JSON.parse(jsonMatch[0]) as FramePrompt[];
  } catch {
    throw new Error("Frame prompt generation failed — invalid JSON in response");
  }

  // Validate consistency — check that prompts share a common prefix
  if (frames.length >= 2) {
    const words0 = frames[0].prompt.split(" ").slice(0, 10).join(" ");
    const words1 = frames[1].prompt.split(" ").slice(0, 10).join(" ");
    if (words0 !== words1) {
      console.warn("[CinematicDirector] Warning: frame prompts may not share a consistent scene anchor");
      console.warn(`  Frame 0 start: "${words0}"`);
      console.warn(`  Frame 1 start: "${words1}"`);
    }
  }

  return frames;
}
