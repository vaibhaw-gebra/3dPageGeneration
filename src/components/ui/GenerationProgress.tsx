import type { PipelineState } from "../../types";

interface GenerationProgressProps {
  state: PipelineState;
}

const STATUS_LABELS: Record<string, string> = {
  idle: "Ready",
  "generating-prompts": "Designing Camera Angles",
  "generating-frames": "Generating Frames",
  "processing-frames": "Processing Frames",
  "planning-page": "Designing Page Layout",
  assembling: "Assembling Website",
  complete: "Complete!",
  error: "Error",
};

export function GenerationProgress({ state }: GenerationProgressProps) {
  const isActive = state.status !== "idle" && state.status !== "complete";

  if (state.status === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-zinc-900 rounded-2xl p-8 border border-zinc-800 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">
            {STATUS_LABELS[state.status] || state.status}
          </h2>
          <p className="text-zinc-400 text-sm">{state.message}</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <p className="text-right text-xs text-zinc-500">
            {Math.round(state.progress)}%
          </p>
        </div>

        {/* Frame Previews */}
        {state.generatedFrames && state.generatedFrames.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">
              Generated Frames
            </p>
            <div className="grid grid-cols-4 gap-2">
              {state.generatedFrames.map((frame) => (
                <div
                  key={frame.index}
                  className="aspect-video rounded-lg overflow-hidden bg-zinc-800"
                >
                  <img
                    src={frame.imageUrl}
                    alt={`Frame ${frame.index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spinner */}
        {isActive && (
          <div className="flex justify-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {state.status === "error" && (
          <p className="text-red-400 text-sm text-center">{state.error}</p>
        )}
      </div>
    </div>
  );
}
