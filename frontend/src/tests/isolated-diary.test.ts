import { describe, it, expect } from "vitest";
import { scopeAuthorCss } from "@/lib/scope-css";

describe("scopeAuthorCss", () => {
  it("remaps leading :root/body/html selectors to :host", () => {
    const css = "body { background: #111 } :root { --accent: #e93 } html { margin: 0 }";
    const out = scopeAuthorCss(css);
    expect(out).not.toContain("body {");
    expect(out).not.toContain(":root {");
    expect(out).not.toContain("html {");
    expect(out).toContain(":host { background: #111 }");
    expect(out).toContain(":host { --accent: #e93 }");
    expect(out).toContain(":host { margin: 0 }");
  });

  it("remaps a leading :root that follows an opening <style> tag", () => {
    // scopeAuthorCss runs on the full stored HTML string, which starts with an
    // opening <style> tag, so the first selector (typically :root with CSS
    // custom properties) is preceded by '>' — it must still be remapped to
    // :host or its --vars never reach the shadow tree and every var() breaks.
    const out = scopeAuthorCss("<style>:root { --paper: #e7dcc0; --ink: #211d17; } body { color: var(--ink) }</style><div>x</div>");
    expect(out).toContain(":host { --paper: #e7dcc0; --ink: #211d17; }");
    expect(out).toContain(":host { color: var(--ink) }");
    expect(out).not.toContain(":root {");
  });

  it("remaps body in a comma-separated selector list", () => {
    const out = scopeAuthorCss("body, .hero { color: red }");
    expect(out).toContain(":host, .hero { color: red }");
  });

  it("does not touch selectors where body/:root are not leading", () => {
    const css = ".card body span { color: red } div > p { margin: 0 } a:root { color: x }";
    const out = scopeAuthorCss(css);
    expect(out).toContain(".card body span { color: red }");
    expect(out).toContain("a:root { color: x }");
    expect(out).toContain("div > p { margin: 0 }");
  });

  it("does not rewrite declaration values or strings", () => {
    const css = '.x { content: "body { " } .y { font-family: body }';
    const out = scopeAuthorCss(css);
    expect(out).toContain('content: "body { "');
    expect(out).toContain("font-family: body");
  });

  it("prepends a box-sizing border-box reset so author widths fit their padding", () => {
    // Author CSS like `.newspaper { width: min(1420px, 100%); padding: 22px 36px }`
    // uses content-box sizing by default, so the border-box (content + padding)
    // overflows `100%` and clips/scrolls. Code editors/preview iframes apply a
    // border-box reset; do the same scoped to the shadow tree so `width: 100%`
    // plus padding stays within the diary box.
    const out = scopeAuthorCss("<style>body { margin: 0 } .x { width: 100% }</style><div class=x></div>");
    expect(out.startsWith(":host, :host *, :host *::before, :host *::after { box-sizing: border-box; }")).toBe(true);
    expect(out).toContain(":host { margin: 0 }");
  });
});