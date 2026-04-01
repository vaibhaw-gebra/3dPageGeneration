export type AspectRatio = "16:9" | "9:16" | "1:1";

interface NavbarProps {
  onExport: () => void;
  onReset: () => void;
  showActions: boolean;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onBack?: () => void;
}

const ASPECT_OPTIONS: { label: string; value: AspectRatio; icon: string }[] = [
  { label: "Desktop", value: "16:9", icon: "16:9" },
  { label: "Phone", value: "9:16", icon: "9:16" },
  { label: "Square", value: "1:1", icon: "1:1" },
];

export function Navbar({
  onExport,
  onReset,
  showActions,
  aspectRatio,
  onAspectRatioChange,
  onBack,
}: NavbarProps) {
  return (
    <nav className="h-14 flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
      {/* Left: Back + Logo + Title */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Back to home"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
        )}
        <span className="text-purple-400 font-black text-lg tracking-wider">
          EVERFORGE
        </span>
        <span className="text-zinc-500 text-sm">|</span>
        <span className="text-zinc-300 text-sm font-medium">
          3D Website Builder
        </span>
      </div>

      {/* Center: Aspect Ratio Toggles */}
      <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
        {ASPECT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onAspectRatioChange(opt.value)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              aspectRatio === opt.value
                ? "bg-purple-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span className="mr-1.5">{opt.label}</span>
            <span className="text-[10px] opacity-70">{opt.icon}</span>
          </button>
        ))}
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center gap-2">
        {showActions && (
          <>
            <button
              onClick={onExport}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Export HTML
            </button>
            <button
              onClick={onReset}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              New Site
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
