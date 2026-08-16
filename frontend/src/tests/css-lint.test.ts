import { describe, it, expect } from "vitest";
import { tokenizeCss, braceBalance } from "@/lib/css-lint";
import { previewThemeStyle } from "@/lib/preview-theme";

describe("tokenizeCss", () => {
  it("splits a simple rule into tokens", () => {
    const tokens = tokenizeCss("body { color: red; }");
    expect(tokens.some((t) => t.type === "property" && t.text === "color")).toBe(true);
    expect(tokens.some((t) => t.type === "punct" && t.text === "{")).toBe(true);
    expect(tokens.some((t) => t.type === "punct" && t.text === "}")).toBe(true);
  });

  it("keeps comments intact as a single token", () => {
    const tokens = tokenizeCss("/* hi } */ body { }");
    expect(tokens.some((t) => t.type === "comment" && t.text === "/* hi } */")).toBe(true);
  });

  it("does not treat braces inside strings as punctuation", () => {
    const tokens = tokenizeCss(".a { content: \"}\"; }");
    const punctBraces = tokens.filter((t) => t.type === "punct" && (t.text === "{" || t.text === "}"));
    // only the real opening and closing brace
    expect(punctBraces).toHaveLength(2);
  });

  it("detects at-rules and colors", () => {
    const tokens = tokenizeCss("@media (max-width: 600px) { .a { color: #ff00aa; } }");
    expect(tokens.some((t) => t.type === "at-rule" && t.text === "@media")).toBe(true);
    expect(tokens.some((t) => t.type === "color" && t.text === "#ff00aa")).toBe(true);
  });
});

describe("braceBalance", () => {
  it("returns 0 for balanced css", () => {
    expect(braceBalance("body { color: red; } a { color: blue; }")).toBe(0);
  });

  it("counts unclosed braces", () => {
    expect(braceBalance("body { color: red;")).toBe(1);
  });

  it("counts extra closing braces", () => {
    expect(braceBalance("body { color: red; } }")).toBe(-1);
  });

  it("ignores braces in comments and strings", () => {
    expect(braceBalance("/* } */ .a { content: \"{\"; }")).toBe(0);
  });

  it("returns 0 for empty input", () => {
    expect(braceBalance("")).toBe(0);
  });
});

describe("previewThemeStyle", () => {
  it("returns undefined for system theme", () => {
    expect(previewThemeStyle("system")).toBeUndefined();
  });

  it("overrides foreground for dark theme", () => {
    const style = previewThemeStyle("dark") as Record<string, string>;
    expect(style["--color-background"]).toBe("hsl(40 5% 12%)");
  });

  it("sets light background for light theme", () => {
    const style = previewThemeStyle("light") as Record<string, string>;
    expect(style["--color-background"]).toBe("hsl(40 20% 96%)");
  });
});