import { useRef, useState, useCallback, useEffect } from "react";

interface LandingPageProps {
  onEnterBuilder: () => void;
  onEnterPages?: () => void;
}

type NodeId =
  | "upload"
  | "prompt-0"
  | "prompt-1"
  | "prompt-2"
  | "gen-0"
  | "gen-1"
  | "gen-2";

const INITIAL_POSITIONS: Record<NodeId, { x: number; y: number }> = {
  upload: { x: 20, y: 200 },
  "prompt-0": { x: 440, y: 60 },
  "prompt-1": { x: 440, y: 440 },
  "prompt-2": { x: 440, y: 820 },
  "gen-0": { x: 920, y: 30 },
  "gen-1": { x: 920, y: 410 },
  "gen-2": { x: 920, y: 790 },
};

const CONNECTIONS: { from: NodeId; to: NodeId; fromSide: "right"; toSide: "left" }[] = [
  { from: "upload", to: "prompt-0", fromSide: "right", toSide: "left" },
  { from: "upload", to: "prompt-1", fromSide: "right", toSide: "left" },
  { from: "upload", to: "prompt-2", fromSide: "right", toSide: "left" },
  { from: "prompt-0", to: "gen-0", fromSide: "right", toSide: "left" },
  { from: "prompt-1", to: "gen-1", fromSide: "right", toSide: "left" },
  { from: "prompt-2", to: "gen-2", fromSide: "right", toSide: "left" },
];

const NODE_COLORS: Record<string, string> = {
  upload: "#a855f7",
  prompt: "#c084fc",
  gen: "#a855f7",
};

const PROMPT_CARDS = [
  { angle: "Front-facing hero shot, centered composition, studio lighting, clean background, product photography, 8K", style: "Cinematic" },
  { angle: "Three-quarter angle view, slight tilt, dramatic side lighting, cinematic depth of field, commercial photography", style: "Cinematic" },
  { angle: "Flat lay top-down overhead view, symmetrical composition, soft even lighting, catalog style", style: "Cinematic" },
];

const IMAGE_GEN_CARDS = [
  { tabs: ["Text", "Image"], model: "Stable Diffusion 3.5", credits: "20" },
  { tabs: ["Text", "Image"], model: "Stable Diffusion 3.5", credits: "20" },
  { tabs: ["Text", "Image"], model: "Stable Diffusion 3.5", credits: "20" },
];

// Node sizes (approximate)
const NODE_SIZES: Record<string, { w: number; h: number }> = {
  upload: { w: 280, h: 180 },
  prompt: { w: 340, h: 280 },
  gen: { w: 340, h: 320 },
};

function getNodeSize(id: NodeId) {
  if (id === "upload") return NODE_SIZES.upload;
  if (id.startsWith("prompt")) return NODE_SIZES.prompt;
  return NODE_SIZES.gen;
}

function getConnectorPoints(
  positions: Record<NodeId, { x: number; y: number }>,
  from: NodeId,
  to: NodeId
) {
  const fPos = positions[from];
  const tPos = positions[to];
  const fSize = getNodeSize(from);
  const tSize = getNodeSize(to);
  const x1 = fPos.x + fSize.w;
  const y1 = fPos.y + fSize.h / 2;
  const x2 = tPos.x;
  const y2 = tPos.y + tSize.h / 2;
  return { x1, y1, x2, y2 };
}

// === DraggableNode ===
function DraggableNode({
  id,
  position,
  scale,
  onDrag,
  children,
}: {
  id: NodeId;
  position: { x: number; y: number };
  scale: number;
  onDrag: (id: NodeId, x: number, y: number) => void;
  children: React.ReactNode;
}) {
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, nx: 0, ny: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      dragging.current = true;
      dragStart.current = {
        mx: e.clientX,
        my: e.clientY,
        nx: position.x,
        ny: position.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [position]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = (e.clientX - dragStart.current.mx) / scale;
      const dy = (e.clientY - dragStart.current.my) / scale;
      onDrag(id, dragStart.current.nx + dx, dragStart.current.ny + dy);
    },
    [id, scale, onDrag]
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      className="absolute"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: "grab",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
    </div>
  );
}

// === Main Component ===
export function LandingPage({ onEnterBuilder, onEnterPages }: LandingPageProps) {
  const [positions, setPositions] = useState(INITIAL_POSITIONS);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.8);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffsetStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleNodeDrag = useCallback((id: NodeId, x: number, y: number) => {
    setPositions((prev) => ({ ...prev, [id]: { x, y } }));
  }, []);

  // Canvas panning (background click only)
  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.dataset.canvas !== "true") return;
      if (e.button !== 0) return;
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panOffsetStart.current = { ...canvasOffset };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [canvasOffset]
  );

  const onCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return;
      setCanvasOffset({
        x: panOffsetStart.current.x + (e.clientX - panStart.current.x),
        y: panOffsetStart.current.y + (e.clientY - panStart.current.y),
      });
    },
    [isPanning]
  );

  const onCanvasPointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(Math.max(s - e.deltaY * 0.001, 0.25), 2));
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const resetView = useCallback(() => {
    setCanvasOffset({ x: 0, y: 0 });
    setScale(0.8);
    setPositions(INITIAL_POSITIONS);
  }, []);

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Navbar */}
      <nav className="h-14 flex items-center justify-between px-6 border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-xl shrink-0 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            </div>
            <span className="text-white font-black text-base tracking-wider">EVERFORGE</span>
          </div>
          <div className="hidden md:flex items-center gap-5">
            {["Features", "3D Builder", "My Pages", "Pricing"].map((item) => (
              <button
                key={item}
                onClick={
                  item === "3D Builder" ? onEnterBuilder :
                  item === "My Pages" ? onEnterPages :
                  undefined
                }
                className={`text-sm transition-colors ${item === "3D Builder" || item === "My Pages" ? "text-white font-medium" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onEnterPages && (
            <button
              onClick={onEnterPages}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors border border-zinc-700"
            >
              My Pages
            </button>
          )}
          <button
            onClick={onEnterBuilder}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Start Building
          </button>
        </div>
      </nav>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ cursor: isPanning ? "grabbing" : "default" }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onWheel={onWheel}
        data-canvas="true"
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #27272a 1px, transparent 1px)",
            backgroundSize: `${24 * scale}px ${24 * scale}px`,
            backgroundPosition: `${canvasOffset.x % (24 * scale)}px ${canvasOffset.y % (24 * scale)}px`,
          }}
          data-canvas="true"
        />

        {/* Panning background (click target) */}
        <div className="absolute inset-0" data-canvas="true" />

        {/* Transformed content */}
        <div
          className="absolute"
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            left: "calc(50% - 700px)",
            top: "calc(50% - 600px)",
          }}
        >
          {/* SVG Connectors */}
          <svg
            className="absolute pointer-events-none"
            style={{ width: "1400px", height: "1400px", left: 0, top: 0 }}
            viewBox="0 0 1400 1400"
            fill="none"
          >
            {CONNECTIONS.map((conn, i) => {
              const { x1, y1, x2, y2 } = getConnectorPoints(positions, conn.from, conn.to);
              const mx = (x1 + x2) / 2;
              const fromColor = conn.from === "upload"
                ? NODE_COLORS.upload
                : conn.from.startsWith("prompt")
                ? NODE_COLORS.prompt
                : NODE_COLORS.gen;
              return (
                <g key={i}>
                  <path
                    d={`M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                    stroke="#3f3f46"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    fill="none"
                  />
                  <circle cx={x1} cy={y1} r="5" fill={fromColor} opacity="0.7" />
                  <circle cx={x2} cy={y2} r="5" fill="#3f3f46" />
                </g>
              );
            })}
          </svg>

          {/* Draggable Nodes */}
          <div className="relative" style={{ width: "1400px", height: "1400px" }}>

            {/* Upload Node */}
            <DraggableNode id="upload" position={positions.upload} scale={scale} onDrag={handleNodeDrag}>
              <div style={{ width: "280px" }}>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/95 overflow-hidden shadow-xl shadow-black/30 hover:border-zinc-700 transition-colors">
                  <div className="px-4 py-2.5 bg-purple-600/10 border-b border-zinc-800 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.068 2.069m-7.154-4.31a.75.75 0 10-1.06 1.06.75.75 0 001.06-1.06zm-4.5 7.5h11.25a2.25 2.25 0 002.25-2.25v-11.25a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v11.25a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span className="text-sm font-semibold text-white">IMAGE UPLOAD</span>
                  </div>
                  <div className="p-4">
                    <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3 3 0 013.825 3.838A3.75 3.75 0 0118 19.5H6.75z" />
                      </svg>
                      <p className="text-xs text-zinc-500">Drop image or click to upload</p>
                      <p className="text-[10px] text-zinc-600">PNG, JPG, WebP, GIF</p>
                    </div>
                  </div>
                </div>
              </div>
            </DraggableNode>

            {/* Prompt Nodes */}
            {PROMPT_CARDS.map((card, i) => (
              <DraggableNode
                key={`prompt-${i}`}
                id={`prompt-${i}` as NodeId}
                position={positions[`prompt-${i}` as NodeId]}
                scale={scale}
                onDrag={handleNodeDrag}
              >
                <div style={{ width: "340px" }}>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/95 overflow-hidden shadow-xl shadow-black/30 hover:border-zinc-700 transition-colors">
                    <div className="px-4 py-2.5 bg-purple-600/10 border-b border-zinc-800 flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                      </svg>
                      <span className="text-sm font-semibold text-white">TEXT PROMPT</span>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-zinc-300 leading-relaxed">{card.angle}</p>
                    </div>
                  </div>
                  <div className="flex justify-center my-3">
                    <div className="px-5 py-1.5 rounded-full bg-gradient-to-r from-purple-600/80 to-purple-600/80 text-white text-xs font-medium flex items-center gap-1.5 border border-purple-500/30">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      Enhance with AI
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-1 mb-2">
                    <div className="w-7 h-3.5 bg-zinc-700 rounded-full relative">
                      <div className="w-2.5 h-2.5 bg-zinc-500 rounded-full absolute left-0.5 top-0.5" />
                    </div>
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      Lock to Image
                    </span>
                  </div>
                  <div className="px-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold block mb-1">Style</span>
                    <div className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300">{card.style}</div>
                  </div>
                </div>
              </DraggableNode>
            ))}

            {/* Generation Nodes */}
            {IMAGE_GEN_CARDS.map((card, i) => (
              <DraggableNode
                key={`gen-${i}`}
                id={`gen-${i}` as NodeId}
                position={positions[`gen-${i}` as NodeId]}
                scale={scale}
                onDrag={handleNodeDrag}
              >
                <div style={{ width: "340px" }}>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/95 overflow-hidden shadow-xl shadow-black/30 hover:border-zinc-700 transition-colors">
                    <div className="px-4 py-2.5 bg-purple-600/10 border-b border-zinc-800 flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      <span className="text-sm font-semibold text-white">IMAGE GENERATION</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex gap-1">
                        {card.tabs.map((tab, ti) => (
                          <span key={ti} className={`px-2.5 py-0.5 text-xs rounded-md ${ti === 0 ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 bg-zinc-800"}`}>{tab}</span>
                        ))}
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">Model</span>
                          <span className="text-[10px] text-purple-500 font-medium">{card.credits} CREDITS</span>
                        </div>
                        <div className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300">{card.model}</div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">Aspect Ratio</span>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {["Auto", "1:1 Square", "16:9 Wide", "9:16 Tall", "4:3 Standard"].map((ratio, ri) => (
                            <span key={ri} className={`px-2 py-0.5 text-[10px] rounded-md ${ri === 1 ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-500"}`}>{ratio}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">Resolution</span>
                        <div className="flex gap-1 mt-1">
                          {["1K (1024px)", "2K (~2048px)", "4K (4096px)"].map((res, ri) => (
                            <span key={ri} className={`px-2 py-0.5 text-[10px] rounded-md flex items-center gap-1 ${ri === 0 ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-500"}`}>
                              {ri > 0 && (
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                              )}
                              {res}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </DraggableNode>
            ))}
          </div>
        </div>

        {/* Floating Hero Text */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-3 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            AI-Powered 3D Website Builder
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
            One image. <span className="text-purple-400">Infinite angles.</span>
          </h1>
        </div>

        {/* Floating CTA */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-auto flex items-center gap-3">
          <button
            onClick={onEnterBuilder}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all hover:scale-105 shadow-lg shadow-purple-600/25"
          >
            Start Building Your 3D Website
          </button>
          {onEnterPages && (
            <button
              onClick={onEnterPages}
              className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-all border border-zinc-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              My Pages
            </button>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-1 pointer-events-auto">
          <button
            onClick={() => setScale((s) => Math.min(s + 0.15, 2))}
            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 text-sm font-bold flex items-center justify-center transition-colors"
          >
            +
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s - 0.15, 0.25))}
            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 text-sm font-bold flex items-center justify-center transition-colors"
          >
            -
          </button>
          <button
            onClick={resetView}
            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 flex items-center justify-center transition-colors"
            title="Reset view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          </button>
          <div className="text-[10px] text-zinc-600 text-center mt-1">{Math.round(scale * 100)}%</div>
        </div>

        {/* Add Node Button */}
        <div className="absolute bottom-6 left-6 z-10 pointer-events-auto">
          <button className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 text-lg flex items-center justify-center transition-colors">
            +
          </button>
        </div>
      </div>
    </div>
  );
}
