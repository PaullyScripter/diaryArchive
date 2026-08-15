"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";

interface ResizableDiaryWindowProps {
  children: ReactNode;
}

/**
 * Wraps a custom HTML/CSS diary in a resizable-width window.
 * Width defaults to 100% of the available space and can be dragged narrower
 * via the right-edge handle. Height is left to the content (no clipping),
 * so full-page designs render naturally. Horizontal scrolling kicks in when
 * the content overflows the chosen width.
 */
export function ResizableDiaryWindow({ children }: ResizableDiaryWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const max = rect.right - rect.left;
    const next = Math.min(Math.max(e.clientX - rect.left, 320), max);
    setWidth(next);
  };

  const stopDragging = () => {
    draggingRef.current = false;
  };

  return (
    <div
      ref={containerRef}
      className="relative mt-6"
      style={{ width: width ?? "100%" }}
    >
      <div className="overflow-x-auto">{children}</div>
      <button
        type="button"
        aria-label="Resize diary width"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        className="absolute right-0 inset-y-0 w-2 cursor-ew-resize touch-none bg-transparent hover:bg-border/60 active:bg-accent/40 focus:outline-none focus-visible:bg-border/60"
      />
    </div>
  );
}