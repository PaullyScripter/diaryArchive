"use client";

import Link from "next/link";

export interface SanitizationIssue {
  type: "tag" | "attribute" | "css-value" | "css-at-rule" | "uri-scheme";
  name: string;
}

interface SanitizationWarningProps {
  issues: SanitizationIssue[];
  onDismiss: () => void;
  className?: string;
}

const LABELS: Record<SanitizationIssue["type"], string> = {
  tag: "HTML tag",
  attribute: "HTML attribute",
  "css-value": "CSS value",
  "css-at-rule": "CSS at-rule",
  "uri-scheme": "URI scheme",
};

export function detectSanitizationIssues(html: string, css: string): SanitizationIssue[] {
  const issues: SanitizationIssue[] = [];
  const seen = new Set<string>();

  const add = (type: SanitizationIssue["type"], name: string) => {
    const key = `${type}:${name}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push({ type, name });
    }
  };

  // Blocked HTML tags
  const blockedTags = [
    "script", "iframe", "object", "embed", "form", "textarea",
    "select", "option", "button", "svg", "math", "link", "meta",
    "base", "template",
  ];
  for (const tag of blockedTags) {
    if (new RegExp(`<${tag}[\\s>]`, "i").test(html)) {
      add("tag", `<${tag}>`);
    }
  }

  // Blocked event-handler attributes
  const eventHandlers = [
    "onclick", "ondblclick", "onmousedown", "onmouseup", "onmouseover",
    "onmousemove", "onmouseout", "onkeypress", "onkeydown", "onkeyup",
    "onfocus", "onblur", "onsubmit", "onreset", "onselect", "onchange",
    "onload", "onerror", "onresize", "onscroll", "onunload", "onbeforeunload",
  ];
  for (const handler of eventHandlers) {
    if (new RegExp(`${handler}\\s*=`, "i").test(html)) {
      add("attribute", handler);
    }
  }

  // data-* attributes
  if (/data-[a-z-]+=/i.test(html)) {
    add("attribute", "data-*");
  }

  // Blocked URI schemes in href/src
  const uriSchemes = ["javascript:", "vbscript:", "data:", "file:", "about:"];
  for (const scheme of uriSchemes) {
    if (new RegExp(`${scheme.replace(":", "\\s*:")}`, "i").test(html)) {
      add("uri-scheme", scheme);
    }
  }

  // Blocked CSS value patterns
  const blockedCssPatterns: [string, string][] = [
    ["url\\s*\\(", "url()"],
    ["expression\\s*\\(", "expression()"],
    ["@import", "@import"],
    ["javascript\\s*:", "javascript:"],
    ["vbscript\\s*:", "vbscript:"],
    ["data\\s*:", "data:"],
    ["-moz-binding", "-moz-binding"],
    ["behavior\\s*:", "behavior:"],
    ["progid\\s*:", "progid:"],
    ["document\\s*\\.", "document."],
    ["window\\s*\\.", "window."],
  ];
  const combinedCss = css;
  for (const [pattern, label] of blockedCssPatterns) {
    if (new RegExp(pattern, "i").test(combinedCss)) {
      add("css-value", label);
    }
  }

  // Blocked CSS at-rules
  const blockedAtRules = ["@import", "@font-face", "@charset"];
  for (const rule of blockedAtRules) {
    if (new RegExp(`${rule.replace("@", "@\\s*")}`, "i").test(combinedCss)) {
      add("css-at-rule", rule);
    }
  }

  return issues;
}

function describeIssues(issues: SanitizationIssue[]): string {
  const tags = issues.filter((i) => i.type === "tag");
  const attrs = issues.filter((i) => i.type === "attribute");
  const cssVals = issues.filter((i) => i.type === "css-value");
  const atRules = issues.filter((i) => i.type === "css-at-rule");
  const schemes = issues.filter((i) => i.type === "uri-scheme");

  const parts: string[] = [];
  if (tags.length) parts.push(`blocked tags (${tags.map((i) => i.name).join(", ")})`);
  if (attrs.length) parts.push(`blocked attributes (${attrs.map((i) => i.name).join(", ")})`);
  if (cssVals.length) parts.push(`blocked CSS values (${cssVals.map((i) => i.name).join(", ")})`);
  if (atRules.length) parts.push(`blocked CSS at-rules (${atRules.map((i) => i.name).join(", ")})`);
  if (schemes.length) parts.push(`blocked URI schemes (${schemes.map((i) => i.name).join(", ")})`);

  return parts.join("; ");
}

export function SanitizationWarning({
  issues,
  onDismiss,
  className = "",
}: SanitizationWarningProps) {
  if (issues.length === 0) return null;

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-xs text-foreground ${className}`}
    >
      <p className="text-muted mt-0.5 flex-1">
        <span className="font-medium text-amber-700 dark:text-amber-400">
          Some content will be removed on save.
        </span>{" "}
        Your diary includes {describeIssues(issues)}. These are stripped by the
        sanitizer to protect readers.{" "}
        <Link
          href="/policy/advanced-editor"
          className="underline text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300"
        >
          Learn more about what is allowed.
        </Link>
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 flex items-center gap-1 rounded px-1.5 py-1 text-amber-700 dark:text-amber-400 font-medium cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50"
        aria-label="Dismiss warning"
      >
        I understand.
      </button>
    </div>
  );
}
