import { useState, useCallback, useRef } from "react";
import { LandingPage } from "./components/LandingPage";
import { Navbar } from "./components/ui/Navbar";
import { ChatPanel } from "./components/ui/ChatPanel";
import { PipelineView } from "./components/ui/PipelineView";
import { ResizeHandle } from "./components/ui/ResizeHandle";
import { PagesDashboard } from "./components/ui/PagesDashboard";
import { runPipeline, approvePipelineStage, regenerateLayout } from "./pipeline/frame-generator";
import { generateStandaloneHTML } from "./export/html-export";
import { pageStore } from "./store/pageStore";
import type { PipelineState, FrameManifest, PagePlan, SavedPage } from "./types";
import type { AspectRatio } from "./components/ui/Navbar";
import type { ChatMessage } from "./components/ui/ChatPanel";

let messageIdCounter = 0;
function nextMsgId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

type AppView = "landing" | "pages" | "builder";
type BuilderPhase = "initial" | "active";

export default function App() {
  const [view, setView] = useState<AppView>("landing");
  const [builderPhase, setBuilderPhase] = useState<BuilderPhase>("initial");
  const [pipelineState, setPipelineState] = useState<PipelineState>({
    status: "idle",
    progress: 0,
    message: "",
  });
  const [result, setResult] = useState<{
    frameManifest: FrameManifest;
    pagePlan: PagePlan;
  } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [chatWidthPct, setChatWidthPct] = useState(30);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const lastSystemMsgRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addSystemMessage = useCallback((text: string) => {
    if (lastSystemMsgRef.current === text) return;
    lastSystemMsgRef.current = text;
    setMessages((prev) => [
      ...prev,
      { id: nextMsgId(), role: "system", text, timestamp: new Date() },
    ]);
  }, []);

  const handleSend = useCallback(
    async (prompt: string, image?: File, imageBase64?: string, referenceUrl?: string, frameCount?: number) => {
      const frames = frameCount || 8;
      if (builderPhase === "initial") {
        setBuilderPhase("active");
      }

      const displayText = referenceUrl
        ? `${prompt}\n\n🔗 Reference: ${referenceUrl}`
        : prompt;
      const userMsg: ChatMessage = {
        id: nextMsgId(),
        role: "user",
        text: displayText,
        imagePreview: imageBase64
          ? `data:image/png;base64,${imageBase64}`
          : undefined,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      lastSystemMsgRef.current = null;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        if (result) {
          addSystemMessage("Updating page layout with your changes (keeping existing frames)...");

          const updatedResult = await regenerateLayout(
            { prompt, referenceUrl, frameCount: result.frameManifest.totalFrames },
            result.frameManifest,
            (state) => {
              setPipelineState(state);
              if (state.message) addSystemMessage(state.message);
            },
            controller.signal
          );
          setResult(updatedResult);
          // Auto-save to page store if we have a current page
          if (currentPageId) {
            pageStore.updatePageResult(currentPageId, updatedResult);
          }
          addSystemMessage(
            "Page updated! Check the preview on the right."
          );
        } else {
          if (referenceUrl) {
            addSystemMessage(`Extracting design from ${referenceUrl}...`);
          }
          addSystemMessage("Starting generation pipeline...");

          const pipelineResult = await runPipeline(
            { prompt, image, imageBase64, referenceUrl, frameCount: frames },
            (state) => {
              setPipelineState(state);
              if (state.message) addSystemMessage(state.message);
            },
            controller.signal
          );
          setResult(pipelineResult);
          // Auto-save to page store if we have a current page
          if (currentPageId) {
            pageStore.updatePageResult(currentPageId, pipelineResult);
          }
          addSystemMessage(
            "Your 3D website is ready! You can preview it on the right and export as HTML."
          );
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          addSystemMessage(
            "Generation stopped. Refine your prompt below and I'll use our conversation as context."
          );
        } else {
          addSystemMessage(
            "Something went wrong. Try again with a different prompt."
          );
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [addSystemMessage, builderPhase, result, currentPageId]
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleExport = useCallback(() => {
    if (!result) return;
    const html = generateStandaloneHTML(result.frameManifest, result.pagePlan);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.pagePlan.title.replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const handleReset = useCallback(() => {
    abortControllerRef.current?.abort();
    setResult(null);
    setPipelineState({ status: "idle", progress: 0, message: "" });
    setMessages([]);
    setBuilderPhase("initial");
    setChatWidthPct(30);
    setCurrentPageId(null);
    lastSystemMsgRef.current = null;
  }, []);

  // Open a saved page in the builder
  const handleOpenPage = useCallback((page: SavedPage) => {
    if (page.status === "complete" && page.frameManifest && page.pagePlan) {
      setResult({ frameManifest: page.frameManifest, pagePlan: page.pagePlan });
      setPipelineState({ status: "complete", progress: 100, message: "Page loaded from saved pages." });
      setBuilderPhase("active");
      setCurrentPageId(page.id);
      setMessages([
        {
          id: nextMsgId(),
          role: "system",
          text: `Loaded "${page.name}". You can refine the layout or export as HTML.`,
          timestamp: new Date(),
        },
      ]);
      setView("builder");
    }
  }, []);

  const isWaitingApproval = pipelineState.status === "waiting-approval";
  const isGenerating =
    !isWaitingApproval &&
    pipelineState.status !== "idle" &&
    pipelineState.status !== "complete" &&
    pipelineState.status !== "error";

  const handleApprove = useCallback(() => {
    approvePipelineStage();
  }, []);

  const showActions = pipelineState.status === "complete" && result !== null;

  if (view === "landing") {
    return (
      <LandingPage
        onEnterBuilder={() => setView("builder")}
        onEnterPages={() => setView("pages")}
      />
    );
  }

  if (view === "pages") {
    return (
      <PagesDashboard
        onOpenPage={handleOpenPage}
        onBack={() => setView("landing")}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">
      <Navbar
        onExport={handleExport}
        onReset={handleReset}
        showActions={showActions}
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        onBack={() => {
          handleReset();
          setView("pages");
        }}
        onPages={() => {
          handleReset();
          setView("pages");
        }}
      />

      <div className="flex flex-1 min-h-0">
        {/* Chat panel */}
        <div
          style={
            builderPhase === "active"
              ? { width: `${chatWidthPct}%`, minWidth: "280px" }
              : { width: "100%" }
          }
          className="shrink-0 h-full"
        >
          <ChatPanel
            onSend={handleSend}
            onStop={handleStop}
            onApprove={handleApprove}
            isGenerating={isGenerating}
            isWaitingApproval={isWaitingApproval}
            approvalStage={pipelineState.approvalStage}
            messages={messages}
            currentStatus={pipelineState.status}
            phase={builderPhase}
          />
        </div>

        {/* Resize handle + Preview panel */}
        {builderPhase === "active" && (
          <>
            <ResizeHandle
              onResize={(deltaX, containerWidth) => {
                setChatWidthPct((prev) => {
                  const deltaPct = (deltaX / containerWidth) * 100;
                  const next = prev + deltaPct;
                  return Math.min(Math.max(next, 20), 80);
                });
              }}
            />
            <div className="flex-1 min-w-0 h-full bg-zinc-950">
              <PipelineView pipelineState={pipelineState} result={result} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
