import type { FramePrompt, GeneratedFrame, PagePlan, ExtractedSite, FrameManifest } from "../types";
import type { BrandAndTheme } from "../types/brand";

const API_BASE = import.meta.env.VITE_API_URL || "";

// ─── Brand & Theme Extraction (SSE) ────────────────────────────

export interface BrandExtractionEvent {
  event: "progress" | "complete" | "error" | "keepalive";
  message?: string;
  progress?: number;
  step?: string;
  data?: BrandAndTheme;
}

export async function streamExtractBrand(
  url: string,
  onProgress: (event: BrandExtractionEvent) => void,
  signal?: AbortSignal
): Promise<BrandAndTheme> {
  const res = await fetch(`${API_BASE}/api/extract-brand`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Brand extraction error: ${err.error}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: BrandAndTheme | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const parsed = JSON.parse(line.slice(6)) as BrandExtractionEvent;
        if (parsed.event === "complete" && parsed.data) {
          finalResult = parsed.data;
        }
        if (parsed.event === "error") {
          throw new Error(parsed.message || "Brand extraction failed");
        }
        onProgress(parsed);
      } catch (e) {
        if (e instanceof Error && e.message.includes("failed")) throw e;
      }
    }
  }

  if (!finalResult) throw new Error("Brand extraction stream ended without result");
  return finalResult;
}

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

// ─── SSE: Full Page Generation Stream (like everforge v2) ──────

export interface SSEProgressEvent {
  event: "progress" | "complete" | "error" | "keepalive";
  message?: string;
  progress?: number;
  step?: string;
  data?: { frameManifest: FrameManifest; pagePlan: PagePlan };
}

export async function streamGeneratePage(
  params: {
    prompt: string;
    referenceUrl?: string;
    frameCount: number;
    imageBase64?: string;
  },
  onProgress: (event: SSEProgressEvent) => void,
  signal?: AbortSignal
): Promise<{ frameManifest: FrameManifest; pagePlan: PagePlan }> {
  const res = await fetch(`${API_BASE}/api/generate-page`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Generation error: ${err.error}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: { frameManifest: FrameManifest; pagePlan: PagePlan } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const parsed = JSON.parse(line.slice(6)) as SSEProgressEvent;
        if (parsed.event === "complete" && parsed.data) {
          finalResult = parsed.data;
        }
        if (parsed.event === "error") {
          throw new Error(parsed.message || "Generation failed");
        }
        onProgress(parsed);
      } catch (e) {
        if (e instanceof Error && e.message !== "Generation failed") continue;
        throw e;
      }
    }
  }

  if (!finalResult) {
    throw new Error("Stream ended without result");
  }

  return finalResult;
}
