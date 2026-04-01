import { useCallback, useRef } from "react";

interface ResizeHandleProps {
  onResize: (deltaX: number, containerWidth: number) => void;
}

export function ResizeHandle({ onResize }: ResizeHandleProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const deltaX = e.clientX - lastX.current;
      lastX.current = e.clientX;
      const containerWidth =
        (e.currentTarget as HTMLElement).parentElement?.offsetWidth || 1;
      onResize(deltaX, containerWidth);
    },
    [onResize]
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  return (
    <div
      className="w-1.5 shrink-0 cursor-col-resize group relative flex items-center justify-center hover:bg-purple-500/20 active:bg-purple-500/30 transition-colors"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Visible handle line */}
      <div className="w-0.5 h-8 rounded-full bg-zinc-700 group-hover:bg-purple-500 group-active:bg-purple-400 transition-colors" />
    </div>
  );
}
