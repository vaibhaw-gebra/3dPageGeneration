import { generateFramePrompts, generatePagePlan, generateAllFrames, extractSite, type AgentExtractionResult } from "../api/bedrock";
import type {
  FrameManifest,
  FrameEntry,
  GeneratedFrame,
  PagePlan,
  PipelineState,
  UserInput,
} from "../types";

function buildFrameManifest(frames: GeneratedFrame[]): FrameManifest {
  const totalFrames = frames.length;
  const segmentSize = 1 / totalFrames;

  const entries: FrameEntry[] = frames.map((frame, i) => ({
    index: frame.index,
    imageUrl: frame.imageUrl,
    scrollStart: i * segmentSize,
    scrollEnd: (i + 1) * segmentSize,
    transition: i === 0 ? "none" : "crossfade",
  }));

  return { frames: entries, totalFrames, aspectRatio: "16:9" };
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Pipeline stopped by user", "AbortError");
  }
}

/**
 * Waits for the user to approve the current stage.
 * Returns a promise that resolves when approve() is called,
 * or rejects if the signal is aborted.
 */
function waitForApproval(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Pipeline stopped by user", "AbortError"));
      return;
    }

    const onAbort = () => {
      reject(new DOMException("Pipeline stopped by user", "AbortError"));
    };

    // Store the resolve function globally so the App can call it
    _approvalResolve = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// Global approval resolve — called from outside to continue the pipeline
let _approvalResolve: (() => void) | null = null;

/** Call this to approve the current stage and continue the pipeline */
export function approvePipelineStage() {
  if (_approvalResolve) {
    const resolve = _approvalResolve;
    _approvalResolve = null;
    resolve();
  }
}

export async function runPipeline(
  input: UserInput,
  onStateChange: (state: PipelineState) => void,
  signal?: AbortSignal
): Promise<{ frameManifest: FrameManifest; pagePlan: PagePlan }> {
  try {
    // ── Stage 0: Multi-Agent Analysis ─────────────────────────────
    let extractedSite: AgentExtractionResult | undefined = input.extractedSite as AgentExtractionResult | undefined;
    if (input.referenceUrl && !extractedSite) {
      onStateChange({
        status: "generating-prompts",
        progress: 2,
        message: `🔍 Style Extractor: Launching Playwright to analyze ${input.referenceUrl}...`,
      });

      checkAbort(signal);
      extractedSite = await extractSite(input.referenceUrl);
      checkAbort(signal);

      // Show what the agents found
      const agentSummary = [
        extractedSite.colorScheme ? `🎨 Color Architect: "${extractedSite.colorScheme.mood}" palette (${extractedSite.colorScheme.warmth} tones)` : null,
        extractedSite.contentAnalysis ? `📝 Content Analyst: ${extractedSite.contentAnalysis.contentTone} tone for ${extractedSite.contentAnalysis.targetAudience}` : null,
        `📐 Style Extractor: ${extractedSite.sections.length} sections, ${extractedSite.fonts.length} fonts detected`,
      ].filter(Boolean);

      for (const msg of agentSummary) {
        onStateChange({
          status: "generating-prompts",
          progress: 8,
          message: msg!,
        });
        // Small delay so messages appear sequentially in chat
        await new Promise((r) => setTimeout(r, 300));
      }
    } else if (!extractedSite) {
      // No URL — run Color Architect standalone for the user's prompt
      onStateChange({
        status: "generating-prompts",
        progress: 3,
        message: "🎨 Color Architect: Designing palette for your scene...",
      });

      checkAbort(signal);
      // Use the design-frames endpoint which includes color scheme logic
    }

    // ── Stage 1: Cinematic Director — camera angles ─────────────
    onStateChange({
      status: "generating-prompts",
      progress: 10,
      message: "🎬 Cinematic Director: Planning a single continuous camera orbit through your scene...",
    });

    checkAbort(signal);
    const framePrompts = await generateFramePrompts(
      input.prompt,
      input.frameCount,
      input.imageBase64,
      extractedSite
    );
    checkAbort(signal);

    // Wait for approval of prompts
    onStateChange({
      status: "waiting-approval",
      progress: 20,
      message: `Created ${framePrompts.length} camera angles. Review and approve to continue.`,
      framePrompts,
      approvalStage: "prompts",
    });

    await waitForApproval(signal);
    checkAbort(signal);

    // ── Stage 2: Generate frames ────────────────────────────────
    onStateChange({
      status: "generating-frames",
      progress: 25,
      message: "🖼️ Image Generator: Rendering cinematic frames via Stable Diffusion...",
      framePrompts,
    });

    const generatedFrames = await generateAllFrames(
      framePrompts,
      (completed, total) => {
        checkAbort(signal);
        const frameProgress = 25 + (completed / total) * 40;
        onStateChange({
          status: "generating-frames",
          progress: frameProgress,
          message: `🖼️ Image Generator: Frame ${completed}/${total} rendered`,
          framePrompts,
        });
      }
    );
    checkAbort(signal);

    // Wait for approval of frames
    onStateChange({
      status: "waiting-approval",
      progress: 65,
      message: `Generated ${generatedFrames.length} frames. Review and approve to continue.`,
      framePrompts,
      generatedFrames,
      approvalStage: "frames",
    });

    await waitForApproval(signal);
    checkAbort(signal);

    // ── Stage 3: Process frames + Generate page plan ────────────
    onStateChange({
      status: "processing-frames",
      progress: 70,
      message: "📦 Frame Composer: Building scroll sequence...",
      framePrompts,
      generatedFrames,
    });

    const frameManifest = buildFrameManifest(generatedFrames);

    onStateChange({
      status: "planning-page",
      progress: 80,
      message: "📐 Page Architect: Designing layout, sections, and copy...",
      framePrompts,
      generatedFrames,
      frameManifest,
    });

    checkAbort(signal);
    const pagePlan = await generatePagePlan(input.prompt, input.frameCount, extractedSite);
    checkAbort(signal);

    // Wait for approval of page plan
    onStateChange({
      status: "waiting-approval",
      progress: 95,
      message: "Page layout ready. Review and approve to build the website.",
      framePrompts,
      generatedFrames,
      frameManifest,
      pagePlan,
      approvalStage: "page-plan",
    });

    await waitForApproval(signal);
    checkAbort(signal);

    // ── Stage 4: Complete ───────────────────────────────────────
    onStateChange({
      status: "complete",
      progress: 100,
      message: "Your 3D website is ready!",
      framePrompts,
      generatedFrames,
      frameManifest,
      pagePlan,
    });

    return { frameManifest, pagePlan };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      _approvalResolve = null;
      onStateChange({
        status: "error",
        progress: 0,
        message: "Generation stopped. You can refine your prompt and try again.",
        error: "stopped",
      });
      throw error;
    }
    const message = error instanceof Error ? error.message : "Pipeline failed";
    _approvalResolve = null;
    onStateChange({
      status: "error",
      progress: 0,
      message,
      error: message,
    });
    throw error;
  }
}

/**
 * Regenerates only the page layout/copy using existing frames.
 * Called for follow-up prompts after the initial generation is complete.
 */
export async function regenerateLayout(
  input: { prompt: string; referenceUrl?: string; frameCount: number },
  existingManifest: FrameManifest,
  onStateChange: (state: PipelineState) => void,
  signal?: AbortSignal
): Promise<{ frameManifest: FrameManifest; pagePlan: PagePlan }> {
  try {
    // Optional: extract reference site with full agent pipeline
    let extractedSite: AgentExtractionResult | undefined;
    if (input.referenceUrl) {
      onStateChange({
        status: "planning-page",
        progress: 10,
        message: `🔍 Style Extractor: Analyzing ${input.referenceUrl}...`,
      });
      checkAbort(signal);
      extractedSite = await extractSite(input.referenceUrl);
      checkAbort(signal);
    }

    // Regenerate page plan with new prompt via Page Architect
    onStateChange({
      status: "planning-page",
      progress: 40,
      message: "📐 Page Architect: Redesigning layout and copy...",
      frameManifest: existingManifest,
    });

    checkAbort(signal);
    const pagePlan = await generatePagePlan(
      input.prompt,
      input.frameCount,
      extractedSite
    );
    checkAbort(signal);

    // Complete — reuse existing frames
    onStateChange({
      status: "complete",
      progress: 100,
      message: "Page layout updated!",
      frameManifest: existingManifest,
      pagePlan,
    });

    return { frameManifest: existingManifest, pagePlan };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      _approvalResolve = null;
      onStateChange({
        status: "error",
        progress: 0,
        message: "Update stopped.",
        error: "stopped",
      });
      throw error;
    }
    const message = error instanceof Error ? error.message : "Layout regeneration failed";
    onStateChange({
      status: "error",
      progress: 0,
      message,
      error: message,
    });
    throw error;
  }
}
