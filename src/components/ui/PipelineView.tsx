import type { PipelineStatus, PipelineState, PagePlan, FrameManifest } from "../../types";
import { PageRenderer } from "../PageRenderer";

interface PipelineStep {
  id: string;
  number: string;
  label: string;
  statuses: PipelineStatus[];
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "prompt",
    number: "01",
    label: "Prompt Input",
    statuses: ["generating-prompts"],
  },
  {
    id: "visual",
    number: "02",
    label: "Visual Draft",
    statuses: ["generating-frames", "processing-frames"],
  },
  {
    id: "motion",
    number: "03",
    label: "Motion Pass",
    statuses: ["planning-page"],
  },
  {
    id: "build",
    number: "04",
    label: "Website Build",
    statuses: ["assembling", "complete"],
  },
];

function getStepState(
  step: PipelineStep,
  currentStatus: PipelineStatus,
  approvalStage?: string
): "pending" | "active" | "completed" | "waiting" {
  const allStatuses: PipelineStatus[] = [
    "idle",
    "generating-prompts",
    "generating-frames",
    "processing-frames",
    "planning-page",
    "assembling",
    "complete",
  ];

  if (currentStatus === "idle" || currentStatus === "error") {
    return "pending";
  }

  // Map waiting-approval to the stage it's waiting after
  if (currentStatus === "waiting-approval") {
    const stageMap: Record<string, PipelineStatus> = {
      prompts: "generating-prompts",
      frames: "processing-frames",
      "page-plan": "planning-page",
    };
    const effectiveStatus = approvalStage ? stageMap[approvalStage] || "idle" : "idle";
    const effectiveIdx = allStatuses.indexOf(effectiveStatus);
    const stepFirstIdx = allStatuses.indexOf(step.statuses[0]);
    const stepLastIdx = allStatuses.indexOf(step.statuses[step.statuses.length - 1]);

    if (effectiveIdx > stepLastIdx) return "completed";
    if (effectiveIdx >= stepFirstIdx && effectiveIdx <= stepLastIdx) return "waiting";
    return "pending";
  }

  const currentIdx = allStatuses.indexOf(currentStatus);
  const stepFirstStatusIdx = allStatuses.indexOf(step.statuses[0]);
  const stepLastStatusIdx = allStatuses.indexOf(
    step.statuses[step.statuses.length - 1]
  );

  if (currentIdx > stepLastStatusIdx) return "completed";
  if (currentIdx >= stepFirstStatusIdx && currentIdx <= stepLastStatusIdx)
    return "active";
  return "pending";
}

interface PipelineViewProps {
  pipelineState: PipelineState;
  result: { frameManifest: FrameManifest; pagePlan: PagePlan } | null;
}

function SpinnerIcon() {
  return (
    <svg
      className="w-5 h-5 text-purple-400 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-purple-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WaitingIcon() {
  return (
    <div className="w-5 h-5 rounded-full border-2 border-amber-400 flex items-center justify-center">
      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
    </div>
  );
}

function PendingIcon() {
  return <div className="w-5 h-5 rounded-full border-2 border-zinc-600" />;
}

export function PipelineView({ pipelineState, result }: PipelineViewProps) {
  const { status, progress, message, generatedFrames } = pipelineState;
  const showPreview = status === "complete" && result;

  if (showPreview) {
    return (
      <div className="h-full w-full relative overflow-y-auto bg-zinc-950" data-preview-scroll="true">
        <PageRenderer
          pagePlan={result.pagePlan}
          frameManifest={result.frameManifest}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      {status === "idle" ? (
        <IdleState />
      ) : status === "error" ? (
        <ErrorState message={pipelineState.error || "An error occurred"} />
      ) : (
        <ActivePipeline
          status={status}
          progress={progress}
          message={message}
          generatedFrames={generatedFrames}
          approvalStage={pipelineState.approvalStage}
        />
      )}
    </div>
  );
}

function IdleState() {
  return (
    <div className="text-center space-y-4 max-w-md">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-purple-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-zinc-200">
        Generation Pipeline
      </h3>
      <p className="text-sm text-zinc-500">
        Describe your website in the chat panel or pick a quick start template to
        begin the generation pipeline.
      </p>
      <div className="flex flex-col gap-2 pt-4">
        {PIPELINE_STEPS.map((step) => (
          <div
            key={step.id}
            className="flex items-center gap-3 px-4 py-2.5 bg-zinc-800/50 rounded-lg border border-zinc-800"
          >
            <span className="text-xs font-mono text-zinc-500">
              {step.number}
            </span>
            <span className="text-sm text-zinc-400">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center space-y-3 max-w-md">
      <div className="w-12 h-12 mx-auto rounded-full bg-red-900/30 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-red-400">Pipeline Error</h3>
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  );
}

function ActivePipeline({
  status,
  progress,
  message,
  generatedFrames,
  approvalStage,
}: {
  status: PipelineStatus;
  progress: number;
  message: string;
  generatedFrames?: PipelineState["generatedFrames"];
  approvalStage?: string;
}) {
  const isWaiting = status === "waiting-approval";

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-zinc-200">
          {isWaiting ? "Waiting for Approval" : "Building Your Website"}
        </h3>
        <p className="text-sm text-zinc-500">{message}</p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isWaiting ? "bg-amber-500" : "bg-purple-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-right text-xs text-zinc-600">
          {Math.round(progress)}%
        </p>
      </div>

      {/* Pipeline Steps */}
      <div className="space-y-2">
        {PIPELINE_STEPS.map((step) => {
          const state = getStepState(step, status, approvalStage);
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                state === "active"
                  ? "bg-purple-900/20 border-purple-800"
                  : state === "waiting"
                  ? "bg-amber-900/20 border-amber-800/50"
                  : state === "completed"
                  ? "bg-zinc-800/50 border-zinc-700"
                  : "bg-zinc-800/30 border-zinc-800"
              }`}
            >
              {state === "active" ? (
                <SpinnerIcon />
              ) : state === "waiting" ? (
                <WaitingIcon />
              ) : state === "completed" ? (
                <CheckIcon />
              ) : (
                <PendingIcon />
              )}
              <span className="text-xs font-mono text-zinc-500 mr-1">
                {step.number}
              </span>
              <span
                className={`text-sm font-medium ${
                  state === "active"
                    ? "text-purple-300"
                    : state === "waiting"
                    ? "text-amber-300"
                    : state === "completed"
                    ? "text-zinc-300"
                    : "text-zinc-500"
                }`}
              >
                {step.label}
              </span>
              {state === "waiting" && (
                <span className="ml-auto text-[10px] text-amber-400 font-medium uppercase tracking-wider">
                  Awaiting approval
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Generated frames preview */}
      {generatedFrames && generatedFrames.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Generated Frames
          </p>
          <div className="grid grid-cols-4 gap-2">
            {generatedFrames.map((frame) => (
              <div
                key={frame.index}
                className="aspect-video rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700"
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
    </div>
  );
}
