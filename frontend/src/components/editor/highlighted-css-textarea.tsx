"use client";

import * as React from "react";
import { tokenizeCss, braceBalance, type TokenType } from "@/lib/css-lint";

const TOKEN_COLORS: Record<TokenType, string> = {
  plain: "var(--color-foreground)",
  comment: "var(--color-subtle)",
  string: "hsl(130 45% 40%)",
  property: "hsl(210 70% 45%)",
  "at-rule": "hsl(270 50% 50%)",
  color: "hsl(28 80% 45%)",
  number: "hsl(180 60% 35%)",
  punct: "var(--color-muted)",
};

interface HighlightedCssTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  textareaClassName?: string;
  containerClassName?: string;
}

export function HighlightedCssTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  textareaClassName,
  containerClassName,
}: HighlightedCssTextareaProps) {
  const preRef = React.useRef<HTMLPreElement | null>(null);
  const tokens = React.useMemo(() => tokenizeCss(value), [value]);
  const balance = React.useMemo(() => braceBalance(value), [value]);

  const lint =
    value.trim() === ""
      ? ""
      : balance !== 0
        ? balance > 0
          ? `${balance} unclosed {`
          : `${-balance} extra }`
        : "";

  return (
    <div className={`relative ${containerClassName ?? ""}`}>
      <pre
        ref={preRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words font-mono text-xs leading-normal ${textareaClassName ?? ""}`}
        style={{ color: "var(--color-foreground)", paddingTop: undefined, paddingBottom: undefined }}
      >
        {value === "" ? (
          <span className="text-subtle">{placeholder}</span>
        ) : (
          tokens.map((t, i) => (
            <span key={i} style={{ color: TOKEN_COLORS[t.type], fontStyle: t.type === "comment" ? "italic" : undefined }}>
              {t.text}
            </span>
          ))
        )}
      </pre>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (preRef.current) {
            preRef.current.scrollTop = e.currentTarget.scrollTop;
            preRef.current.scrollLeft = e.currentTarget.scrollLeft;
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
        className={`relative block bg-transparent text-transparent caret-foreground font-mono text-xs leading-normal focus:outline-none focus:ring-0 resize-y placeholder:text-subtle disabled:cursor-not-allowed disabled:opacity-50 ${textareaClassName ?? ""}`}
      />
      {lint !== "" && (
        <span
          className="absolute top-1 right-2 z-10 rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] text-destructive pointer-events-none"
          title="Unbalanced braces in your CSS"
        >
          {lint}
        </span>
      )}
    </div>
  );
}