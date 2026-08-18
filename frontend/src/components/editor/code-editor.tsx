"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { loader } from "@monaco-editor/react";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  { ssr: false },
);

export type EditorLanguage = "html" | "css";

interface CodeEditorProps {
  language: EditorLanguage;
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
  dark?: boolean;
  ariaLabel?: string;
}

// Load Monaco and wire up Emmet + local workers on the client only, so the
// editor never touches `window` during SSR/prerender and stays privacy-first
// (no CDN requests).
async function ensureMonaco() {
  // monaco-editor's ESM entry has no default export — it exports the editor
  // API as named members (editor, languages, Uri, ...). Import the whole
  // module namespace and pass that as the Monaco instance.
  const monaco = await import("monaco-editor");
  const { emmetHTML, emmetCSS } = await import("emmet-monaco-es");
  emmetHTML(monaco as never);
  emmetCSS(monaco as never);
  loader.config({ monaco: monaco as never });
}

export function CodeEditor({
  language,
  value,
  onChange,
  height = "100%",
  dark = false,
  ariaLabel,
}: CodeEditorProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    ensureMonaco()
      .then(() => {
        if (mounted) setReady(true);
      })
      .catch((err) => {
        console.error("Failed to initialise Monaco editor:", err);
        if (mounted) setError(true);
      });
    return () => {
      mounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center text-xs text-destructive">
        Editor failed to load. Reload the page to try again.
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center text-xs text-muted">
        Loading editor…
      </div>
    );
  }

  return (
    <div
      style={{ width: "100%", height: height === "100%" ? "100%" : height }}
      className="overflow-hidden"
    >
      <MonacoEditor
        language={language}
        value={value}
        height="100%"
        width="100%"
        theme={dark ? "vs-dark" : "light"}
        onChange={(v) => {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => onChange(v ?? ""), 150);
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily:
            '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace',
          lineHeight: 20,
          tabSize: 2,
          insertSpaces: true,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          renderWhitespace: "selection",
          roundedSelection: false,
          smoothScrolling: true,
          folding: true,
          foldingHighlight: true,
          showFoldingControls: "always",
          bracketPairColorization: { enabled: true },
          guides: { indentation: true, bracketPairs: true },
          matchBrackets: "always",
          autoClosingBrackets: "languageDefined",
          autoClosingQuotes: "languageDefined",
          autoIndent: "full",
          formatOnPaste: false,
          formatOnType: false,
          links: true,
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          wordBasedSuggestions: "currentDocument",
          selectionHighlight: true,
          occurrencesHighlight: "singleFile",
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          padding: { top: 8, bottom: 8 },
          contextmenu: true,
          ariaLabel: ariaLabel ?? "code editor",
        }}
      />
    </div>
  );
}