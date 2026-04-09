import { useState, useCallback } from "react";
import type { CreatePageFormData } from "../../types";

interface CreatePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreatePageFormData) => void;
}

export function CreatePageModal({ isOpen, onClose, onCreate }: CreatePageModalProps) {
  const [pageName, setPageName] = useState("");
  const [goal, setGoal] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [context, setContext] = useState("");
  const [frameCount, setFrameCount] = useState(8);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!pageName.trim() || !goal.trim()) return;
      onCreate({
        pageName: pageName.trim(),
        goal: goal.trim(),
        referenceUrl: referenceUrl.trim() || undefined,
        context: context.trim() || undefined,
        frameCount,
      });
      // Reset form
      setPageName("");
      setGoal("");
      setReferenceUrl("");
      setContext("");
      setFrameCount(8);
      setShowAdvanced(false);
    },
    [pageName, goal, referenceUrl, context, frameCount, onCreate]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Create New Page</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Define your page and let AI generate a cinematic 3D website
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Page Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">Page Name *</label>
            <input
              type="text"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              placeholder="e.g., Landing Page, About Us, Product Showcase"
              className="w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2.5 border border-zinc-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none placeholder:text-zinc-600"
              autoFocus
            />
          </div>

          {/* Goal / Scene Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">Scene Description *</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Describe the 3D scene and website purpose. e.g., A futuristic robot in a dark studio with neon lighting for a SaaS landing page..."
              rows={3}
              className="w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2.5 border border-zinc-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none placeholder:text-zinc-600 resize-none"
            />
          </div>

          {/* Reference URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">
              Reference Website
              <span className="text-zinc-500 font-normal ml-1">(optional)</span>
            </label>
            <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2.5 border border-zinc-700 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500">
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
            </div>
            <p className="text-[11px] text-zinc-600">
              We'll extract styles, colors, and content from this website to guide generation
            </p>
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Advanced Options
          </button>

          {showAdvanced && (
            <div className="space-y-4 pl-2 border-l-2 border-zinc-800">
              {/* Additional Context */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Additional Context</label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Any specific copy, brand guidelines, or requirements..."
                  rows={2}
                  className="w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2.5 border border-zinc-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none placeholder:text-zinc-600 resize-none"
                />
              </div>

              {/* Frame Count */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">
                  Frame Count: <span className="text-purple-400">{frameCount}</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={4}
                    max={144}
                    step={1}
                    value={frameCount}
                    onChange={(e) => setFrameCount(Number(e.target.value))}
                    className="flex-1 accent-purple-500 h-1"
                  />
                  <input
                    type="number"
                    min={4}
                    max={144}
                    value={frameCount}
                    onChange={(e) => setFrameCount(Math.min(144, Math.max(4, Number(e.target.value) || 4)))}
                    className="w-14 bg-zinc-800 text-white text-xs text-center rounded px-2 py-1.5 border border-zinc-700 outline-none focus:border-purple-500"
                  />
                </div>
                <p className="text-[11px] text-zinc-600">
                  More frames = smoother scroll animation, but longer generation time
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!pageName.trim() || !goal.trim()}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:bg-zinc-700 disabled:text-zinc-500 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Generate Page
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
