import type { MouseEvent as ReactMouseEvent } from "react";

/** Thin vertical drag handle. Reports horizontal drag deltas via `onDrag(dx)`. */
export function ResizeHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  function onMouseDown(e: ReactMouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    function onMove(ev: MouseEvent) {
      onDrag(ev.clientX - startX);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="vertical"
      className="resize-handle w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors duration-150 hover:bg-accent/40 active:bg-accent"
    />
  );
}
