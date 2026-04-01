import type { FramePrompt, GeneratedFrame, PagePlan, ExtractedSite } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "";

// ─── Agent: Style Extractor + Content Analyst + Color Architect ─

export interface AgentExtractionResult extends ExtractedSite {
  styles?: unknown;
  contentAnalysis?: {
    brandVoice: string;
    targetAudience: string;
    valueProposition: string;
    painPoints: string[];
    keyBenefits: string[];
    contentTone: string;
    suggestedSections: string[];
  };
  colorScheme?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    backgroundAlt: string;
    text: string;
    textMuted: string;
    mood: string;
    warmth: string;
  };
}

export async function extractSite(url: string): Promise<AgentExtractionResult> {
  const res = await fetch(`${API_BASE}/api/extract-site`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Extraction error: ${err.error}`);
  }
  return res.json();
}

// ─── Agent: Cinematic Director ──────────────────────────────────

export async function generateFramePrompts(
  userPrompt: string,
  frameCount: number,
  imageBase64?: string,
  extractedSite?: AgentExtractionResult
): Promise<FramePrompt[]> {
  const res = await fetch(`${API_BASE}/api/design-frames`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: userPrompt,
      frameCount,
      colorScheme: extractedSite?.colorScheme,
      contentAnalysis: extractedSite?.contentAnalysis,
      imageBase64,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Frame design error: ${err.error}`);
  }
  const data = await res.json();
  return data.frames;
}

// ─── Agent: Page Architect ──────────────────────────────────────

export async function generatePagePlan(
  userPrompt: string,
  frameCount: number,
  extractedSite?: AgentExtractionResult
): Promise<PagePlan> {
  const res = await fetch(`${API_BASE}/api/design-page`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: userPrompt,
      frameCount,
      colorScheme: extractedSite?.colorScheme,
      contentAnalysis: extractedSite?.contentAnalysis,
      extractedStyles: extractedSite?.styles,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Page design error: ${err.error}`);
  }
  return res.json();
}

// ─── Image Generation ───────────────────────────────────────────

async function generateFrame(
  framePrompt: FramePrompt,
  seed: number
): Promise<GeneratedFrame> {
  const res = await fetch(`${API_BASE}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: framePrompt.prompt,
      seed: seed + framePrompt.index,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Image generation error: ${err.error}`);
  }
  const data = await res.json();
  return {
    index: framePrompt.index,
    imageUrl: data.imageUrl,
    width: 1280,
    height: 720,
    angle: framePrompt.angle,
    zoom: framePrompt.zoom,
    mood: framePrompt.mood,
  };
}

export async function generateAllFrames(
  framePrompts: FramePrompt[],
  onProgress?: (completed: number, total: number) => void
): Promise<GeneratedFrame[]> {
  const baseSeed = Math.floor(Math.random() * 1000000);
  const frames: GeneratedFrame[] = [];
  const batchSize = 2;

  for (let i = 0; i < framePrompts.length; i += batchSize) {
    const batch = framePrompts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((prompt) => generateFrame(prompt, baseSeed))
    );
    frames.push(...batchResults);
    onProgress?.(frames.length, framePrompts.length);
  }

  return frames.sort((a, b) => a.index - b.index);
}
