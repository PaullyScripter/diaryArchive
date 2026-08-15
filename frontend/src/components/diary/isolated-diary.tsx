"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { scopeAuthorCss } from "@/lib/scope-css";

interface IsolatedDiaryProps {
  html: string;
  className?: string;
  style?: CSSProperties;
  /**
   * Reports the diary's natural content width (the widest top-level element,
   * which reflects an author-declared max-width). Used by the resizable window
   * to open the diary at its intended size.
   */
  onContentWidth?: (width: number) => void;
}

/**
 * Renders already-sanitized diary HTML into a Shadow DOM subtree so the
 * author's <style> blocks and markup cannot leak out and restyle/break the
 * host page (e.g. the light/dark theme switch or global layout). This gives
 * each HTML/CSS diary its own isolated scope, like a virtual machine: its CSS
 * applies only to itself, and the page's CSS cannot bleed into it either.
 */
export function IsolatedDiary({
  html,
  className,
  style,
  onContentWidth,
}: IsolatedDiaryProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onContentWidthRef = useRef(onContentWidth);
  onContentWidthRef.current = onContentWidth;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    root.innerHTML = scopeAuthorCss(html);

    const callback = onContentWidthRef.current;
    if (!callback) return;

    const report = () => {
      let w = 0;
      for (const el of Array.from(root.children)) {
        const rw = (el as HTMLElement).getBoundingClientRect().width;
        if (rw > w) w = rw;
      }
      callback(w > 0 ? w : host.clientWidth);
    };

    report();
    const ro = new ResizeObserver(report);
    for (const el of Array.from(root.children)) ro.observe(el);
    return () => ro.disconnect();
  }, [html]);

  return (
    <div
      ref={hostRef}
      className={`${className ?? ""} [isolation:isolate] [transform:translateZ(0)]`}
      style={style}
    />
  );
}