import { describe, it, expect } from "vitest";
import { splitHtmlCss } from "@/lib/html-css";

describe("splitHtmlCss", () => {
  it("extracts a leading <style> block as CSS and the rest as HTML", () => {
    const input = '<style>.a{color:red}</style><div class="a">hi</div>';
    const out = splitHtmlCss(input);
    expect(out.css).toBe(".a{color:red}");
    expect(out.html).toBe('<div class="a">hi</div>');
  });

  it("tolerates surrounding whitespace around the style block", () => {
    const input = "\n  <style> body { margin: 0 } </style>\n<p>x</p>";
    const out = splitHtmlCss(input);
    expect(out.css).toBe(" body { margin: 0 } ");
    expect(out.html).toBe("<p>x</p>");
  });

  it("returns css empty when there is no leading style block", () => {
    const out = splitHtmlCss("<p>just body</p>");
    expect(out.css).toBe("");
    expect(out.html).toBe("<p>just body</p>");
  });

  it("does not strip a style block that is not at the start", () => {
    const input = '<p>a</p><style>.x{}</style>';
    const out = splitHtmlCss(input);
    expect(out.css).toBe("");
    expect(out.html).toBe(input);
  });
});