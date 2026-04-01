import { useState, useCallback, useRef, useEffect } from "react";
import type { PipelineStatus, ApprovalStage } from "../../types";

// ─── Types ───────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "system";
  text: string;
  imagePreview?: string;
  timestamp: Date;
}

interface ChatPanelProps {
  onSend: (prompt: string, image?: File, imageBase64?: string, referenceUrl?: string) => void;
  onStop: () => void;
  onApprove: () => void;
  isGenerating: boolean;
  isWaitingApproval: boolean;
  approvalStage?: ApprovalStage;
  messages: ChatMessage[];
  currentStatus: PipelineStatus;
  phase: "initial" | "active";
}

// ─── Constants ───────────────────────────────────────────────────

const QUICK_START_TEMPLATES = [
  {
    label: "SaaS Landing Page",
    prompt:
      "A modern SaaS landing page with a futuristic city skyline, floating holographic UI elements, and a gradient sky from deep purple to warm orange. The camera dollies forward through glass towers.",
  },
  {
    label: "Portfolio Website",
    prompt:
      "A creative portfolio website set in an art gallery with white marble walls, dramatic spotlights on abstract paintings, and a serene atmosphere. The camera slowly pans across the gallery space.",
  },
  {
    label: "E-commerce Store",
    prompt:
      "A luxury e-commerce store interior with warm wooden shelves, elegant product displays, soft ambient lighting, and golden accents. The camera glides through the premium retail space.",
  },
];

const QUICK_GUIDE_STEPS = [
  { icon: "01", text: "Describe your website scene" },
  { icon: "02", text: "AI designs cinematic camera angles" },
  { icon: "03", text: "Frames are generated from each angle" },
  { icon: "04", text: "Page layout and copy are composed" },
  { icon: "05", text: "Scroll-driven 3D website is assembled" },
];

const APPROVAL_LABELS: Record<ApprovalStage, { title: string; desc: string }> = {
  prompts: { title: "Camera Angles Ready", desc: "Review the angles in the pipeline panel, then approve to generate frames." },
  frames: { title: "Frames Generated", desc: "Review the generated frames, then approve to design the page layout." },
  "page-plan": { title: "Page Layout Ready", desc: "Review the layout plan, then approve to build the final website." },
};

// ─── Component ───────────────────────────────────────────────────

export function ChatPanel({
  onSend,
  onStop,
  onApprove,
  isGenerating,
  isWaitingApproval,
  approvalStage,
  messages,
  currentStatus,
  phase,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith("image/")) {
        setAttachedImage(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
      }
    },
    []
  );

  const clearImage = useCallback(() => {
    setAttachedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isGenerating) return;
      const base64 = imagePreview?.split(",")[1];
      const url = referenceUrl.trim() || undefined;
      onSend(trimmed, attachedImage || undefined, base64, url);
      setInput("");
      setReferenceUrl("");
      setShowUrlInput(false);
      clearImage();
    },
    [input, isGenerating, attachedImage, imagePreview, onSend, clearImage]
  );

  const handleQuickStart = useCallback(
    (prompt: string) => {
      if (isGenerating) return;
      setInput(prompt);
    },
    [isGenerating]
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setAttachedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const isBusy = isGenerating || isWaitingApproval;

  // ─── Initial Centered Layout ─────────────────────────────────
  if (phase === "initial") {
    return (
      <div
        className="flex-1 flex items-center justify-center p-6"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-sm text-purple-300 font-medium">
                Claude Sonnet 4.5 + Stable Diffusion 3.5
              </span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              What would you like to build?
            </h1>
            <p className="text-zinc-500 text-sm">
              Describe your scene. You'll approve each step before we proceed.
            </p>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {QUICK_GUIDE_STEPS.map((step) => (
              <div
                key={step.icon}
                className="text-center space-y-2 px-2 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50"
              >
                <div className="w-8 h-8 mx-auto rounded-lg bg-purple-600/20 border border-purple-500/20 flex items-center justify-center">
                  <span className="text-[10px] font-mono text-purple-400 font-bold">{step.icon}</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-tight">{step.text}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {imagePreview && (
              <div className="flex items-center gap-2 px-3">
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Attached" className="h-14 rounded-lg border border-zinc-700" />
                  <button
                    onClick={clearImage}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <span className="text-xs text-zinc-500">{attachedImage?.name}</span>
              </div>
            )}

            {/* URL Reference Input (collapsible) */}
            {showUrlInput && (
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-1.556a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.28" />
                </svg>
                <input
                  type="url"
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  placeholder="https://example.com — extract colors, fonts & layout"
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => { setReferenceUrl(""); setShowUrlInput(false); }}
                  className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 focus-within:border-purple-500/50 transition-colors"
            >
              <div className="flex items-end gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                {/* Image attach */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                  title="Attach reference image"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.068 2.069m-7.154-4.31a.75.75 0 10-1.06 1.06.75.75 0 001.06-1.06zm-4.5 7.5h11.25a2.25 2.25 0 002.25-2.25v-11.25a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v11.25a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </button>
                {/* URL link */}
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className={`p-2 rounded-lg transition-colors ${showUrlInput || referenceUrl ? "text-purple-400 bg-purple-500/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"}`}
                  title="Add reference website URL"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-1.556a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.28" />
                  </svg>
                </button>
                <textarea
                  ref={(el) => {
                    if (el) { el.style.height = "0px"; el.style.height = Math.min(el.scrollHeight, 160) + "px"; }
                  }}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    const el = e.target;
                    el.style.height = "0px";
                    el.style.height = Math.min(el.scrollHeight, 160) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
                  }}
                  placeholder="A futuristic robot in a dark studio with neon lighting..."
                  rows={1}
                  className="flex-1 bg-transparent text-white text-sm px-2 py-2 outline-none resize-none placeholder:text-zinc-600 overflow-y-auto"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:bg-zinc-800 disabled:text-zinc-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
              {referenceUrl && !showUrlInput && (
                <div className="flex items-center gap-1.5 mt-1.5 ml-2">
                  <svg className="w-3 h-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-1.556a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.28" />
                  </svg>
                  <span className="text-[11px] text-purple-400 truncate max-w-[300px]">{referenceUrl}</span>
                </div>
              )}
            </form>
          </div>

          <div className="flex gap-2 justify-center flex-wrap">
            {QUICK_START_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                onClick={() => handleQuickStart(tpl.prompt)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-full text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Active Sidebar Layout ───────────────────────────────────
  return (
    <div
      className="w-full bg-zinc-900 border-r border-zinc-800 flex flex-col h-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isWaitingApproval ? "bg-amber-400" : "bg-purple-400"} ${isBusy ? "animate-pulse" : ""}`} />
          <h2 className="text-sm font-semibold text-zinc-200 tracking-wider">CHAT</h2>
        </div>
        <span className="text-[10px] text-zinc-600 px-2 py-0.5 bg-zinc-800 rounded">
          Claude 4.5 + SD 3.5
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Approval Bar */}
      {isWaitingApproval && approvalStage && (
        <div className="px-3 py-3 border-t border-amber-800/30 bg-amber-950/20">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span className="text-sm font-medium text-amber-300">
                {APPROVAL_LABELS[approvalStage].title}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {APPROVAL_LABELS[approvalStage].desc}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onApprove}
                className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Approve & Continue
              </button>
              <button
                onClick={onStop}
                className="px-3 py-2 text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-900/20 border border-zinc-700 rounded-lg transition-colors"
              >
                Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar (when actively generating, not waiting) */}
      {isGenerating && !isWaitingApproval && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-4 h-4 text-purple-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-xs text-purple-300 font-medium truncate">
                {statusLabel(currentStatus)}
              </span>
            </div>
            <button
              onClick={onStop}
              className="shrink-0 px-2.5 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-800/40 rounded-lg transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-3 py-2 border-t border-zinc-800">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Attached" className="h-14 rounded-lg border border-zinc-700" />
            <button
              onClick={clearImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* URL Input (sidebar) */}
      {showUrlInput && (
        <div className="px-3 py-2 border-t border-zinc-800">
          <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-2.5 py-1.5">
            <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-1.556a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.28" />
            </svg>
            <input
              type="url"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 bg-transparent text-white text-xs outline-none placeholder:text-zinc-600"
            />
            <button type="button" onClick={() => { setReferenceUrl(""); setShowUrlInput(false); }} className="text-zinc-500 hover:text-zinc-300">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-800 flex items-end gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40"
          title="Attach reference image"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          disabled={isBusy}
          className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${showUrlInput || referenceUrl ? "text-purple-400 bg-purple-500/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"}`}
          title="Add reference website URL"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-1.556a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.28" />
          </svg>
        </button>
        <div className="flex-1 relative">
          <textarea
            ref={(el) => {
              if (el) { el.style.height = "0px"; el.style.height = Math.min(el.scrollHeight, 160) + "px"; }
            }}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.target;
              el.style.height = "0px";
              el.style.height = Math.min(el.scrollHeight, 160) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
            }}
            placeholder={isBusy ? "Waiting for approval or generation..." : "Refine your prompt or describe changes..."}
            rows={1}
            disabled={isBusy}
            className="w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none placeholder:text-zinc-600 disabled:opacity-50 overflow-y-auto"
          />
        </div>
        {isGenerating && !isWaitingApproval ? (
          <button
            type="button"
            onClick={onStop}
            className="p-2 rounded-lg bg-red-600/80 hover:bg-red-500 text-white transition-colors"
            title="Stop generation"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={isBusy || !input.trim()}
            className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        )}
      </form>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
          isUser
            ? "bg-purple-700/40 text-purple-100 border border-purple-800/50"
            : "bg-zinc-800 text-zinc-300 border border-zinc-700/50"
        }`}
      >
        {message.imagePreview && (
          <img src={message.imagePreview} alt="Reference" className="max-h-24 rounded mb-2" />
        )}
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <p className="text-[10px] mt-1 opacity-50">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

function statusLabel(status: PipelineStatus): string {
  const labels: Record<string, string> = {
    "generating-prompts": "Designing camera angles...",
    "generating-frames": "Generating frames...",
    "processing-frames": "Processing frames...",
    "planning-page": "Designing page layout...",
    assembling: "Assembling website...",
    complete: "Complete!",
  };
  return labels[status] || "Working...";
}

export type { ChatMessage };
