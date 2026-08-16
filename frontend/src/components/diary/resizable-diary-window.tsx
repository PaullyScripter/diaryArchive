"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

interface ResizableDiaryWindowProps {
  children: ReactNode;
  /**
   * The diary's own natural content width (e.g. the author set a max-width in
   * their CSS). When provided it becomes the initial window width so the diary
   * opens at its intended size; if absent the window defaults to 100% of the
   * available space. The user can still drag narrower or wider in both cases.
   */
  naturalWidth?: number | null;
}

/**
 * Wraps a custom HTML/CSS diary in a resizable-width window.
 * Width defaults to the diary's natural width (or 100% when none is set) and
 * can be dragged via the right-edge handle. Height is left to the content (no
 * clipping), so full-page designs render naturally. Horizontal scrolling kicks
 * in when the content overflows the chosen width.
 */
export function ResizableDiaryWindow({
  children,
  naturalWidth,
}: ResizableDiaryWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const userResizedRef = useRef(false);
  const appliedNaturalRef = useRef(false);

  // Adopt the diary's natural width once, before any user drag, so an
  // author-declared max-width is respected while resizing stays enabled.
  useEffect(() => {
    if (!naturalWidth || naturalWidth <= 0 || appliedNaturalRef.current) return;
    appliedNaturalRef.current = true;
    const parent = containerRef.current?.parentElement;
    const max = parent?.clientWidth ?? naturalWidth;
    setWidth(Math.min(naturalWidth, max));
  }, [naturalWidth]);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    userResizedRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Use the parent's full width as the upper bound (not the container's
    // current, possibly-shrunk width) so the window can always be grown back.
    const parent = containerRef.current.parentElement;
    const max = parent?.clientWidth ?? window.innerWidth;
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
        className="group absolute right-0 inset-y-0 w-5 cursor-ew-resize touch-none bg-transparent focus:outline-none"
      >
        <span className="pointer-events-none absolute top-1/2 right-0.5 -translate-y-1/2 flex h-16 flex-col items-center justify-center gap-[3px] rounded-full bg-border/70 px-[3px] transition-colors group-hover:bg-accent group-active:bg-accent">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-2.5 w-0.5 rounded-full bg-foreground/40" />
          ))}
        </span>
      </button>
    </div>
  );
}