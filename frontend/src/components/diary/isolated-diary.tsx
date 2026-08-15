"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { scopeAuthorCss } from "@/lib/scope-css";

interface IsolatedDiaryProps {
  html: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders already-sanitized diary HTML into a Shadow DOM subtree so the
 * author's <style> blocks and markup cannot leak out and restyle/break the
 * host page (e.g. the light/dark theme switch or global layout). This gives
 * each HTML/CSS diary its own isolated scope, like a virtual machine: its CSS
 * applies only to itself, and the page's CSS cannot bleed into it either.
 */
export function IsolatedDiary({ html, className, style }: IsolatedDiaryProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    root.innerHTML = scopeAuthorCss(html);
  }, [html]);

  return <div ref={hostRef} className={className} style={style} />;
}