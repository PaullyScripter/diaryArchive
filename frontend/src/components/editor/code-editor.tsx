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

// Tell Monaco how to spawn its workers. getWorker takes precedence over the
// webpack plugin's getWorkerUrl, so the built-in HTML/CSS language service
// (tag completion, CSS property suggestions, formatting, hover) actually loads.
// We use webpack 5's native `new Worker(new URL(...))` pattern (relative paths,
// resolved at build time) so the worker files are emitted and served same-origin
// by Next.js (privacy-first, no CDN). The monaco-editor-webpack-plugin alone
// emits workers to /_next/*.worker.js which Next's dev server doesn't serve
// (404), so we override getWorker.
function configureWorkers() {
  if (typeof window === "undefined") return;
  const env = (window as unknown as { MonacoEnvironment?: { getWorker?: unknown } })
    .MonacoEnvironment;
  if (env?.getWorker) return;
  (window as unknown as { MonacoEnvironment: { getWorker?: unknown } }).MonacoEnvironment = {
    ...(env as { getWorker?: unknown }),
    getWorker: (_workerId: string, label: string) => {
      if (label === "html" || label === "handlebars" || label === "razor") {
        return new Worker(
          new URL(
            "../../../node_modules/monaco-editor/esm/vs/languages/features/html/html.worker.js",
            import.meta.url,
          ),
          { type: "module" },
        );
      }
      if (label === "css" || label === "scss" || label === "less") {
        return new Worker(
          new URL(
            "../../../node_modules/monaco-editor/esm/vs/languages/features/css/css.worker.js",
            import.meta.url,
          ),
          { type: "module" },
        );
      }
      return new Worker(
        new URL(
          "../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js",
          import.meta.url,
        ),
        { type: "module" },
      );
    },
  };
}

// Load Monaco and wire up Emmet + local workers on the client only, so the
// editor never touches `window` during SSR/prerender and stays privacy-first
// (no CDN requests).
async function ensureMonaco() {
  configureWorkers();
  // monaco-editor's ESM entry has no default export - it exports the editor
  // API as named members (editor, languages, Uri, ...). Import the whole
  // module namespace and pass that as the Monaco instance.
  const monaco = await import("monaco-editor");
  const { emmetHTML, emmetCSS } = await import("emmet-monaco-es");
  // monaco 0.5x dropped the internal Monarch tokenizer structure that emmet's
  // default 'monarch' detection relied on. Use the public 'standard' tokenizer
  // API (model.tokenization.getLineTokens) so abbreviation detection works.
  emmetHTML(monaco as never, ["html"], { tokenizer: "standard" });
  emmetCSS(monaco as never, ["css"], { tokenizer: "standard" });
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
        Loading editor...
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
