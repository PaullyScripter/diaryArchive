import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

describe("sanitizeHtml", () => {
  it("removes script tags", () => {
    const result = sanitizeHtml('<p>Hello</p><script>alert("xss")</script>');
    expect(result).toContain("<p>Hello</p>");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("removes onerror handlers", () => {
    const result = sanitizeHtml('<img src=x onerror="alert(1)">');
    expect(result).not.toContain("onerror");
  });

  it("preserves safe HTML", () => {
    const input = "<p><strong>bold</strong> <em>italic</em> text</p>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
  });

  it("preserves links with href", () => {
    const input = '<a href="https://example.com">link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('href="https://example.com"');
  });

  it("strips javascript: URLs from links", () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("preserves lists", () => {
    const input = "<ul><li>one</li><li>two</li></ul>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<li>one</li>");
  });

  it("preserves style blocks for custom CSS", () => {
    const input =
      '<style>.diary-entry{color:red}</style><div class="diary-entry">hi</div>';
    const result = sanitizeHtml(input);
    expect(result).toContain("<style>");
    expect(result).toContain(".diary-entry{color:red}");
    expect(result).toContain('<div class="diary-entry">');
  });

  it("neutralizes dangerous CSS inside style blocks", () => {
    const input =
      '<style>.a{background:url(javascript:alert(1));color:red}@import url("https://evil.example/x.css");.b{width:expression(1)}</style><p>x</p>';
    const result = sanitizeHtml(input);
    expect(result).toContain("<style>");
    expect(result).toContain("DISABLED-url(");
    expect(result).toContain("DISABLED-javascript:");
    expect(result).toContain("DISABLED-@import");
    expect(result).toContain("DISABLED-expression(");
    expect(result).not.toContain("url(javascript");
    expect(result).toContain("color:red");
  });

  it("keeps benign CSS inside style blocks", () => {
    const input =
      '<style>.hero{background:linear-gradient(rgba(66,49,40,0.65),rgba(66,49,40,0.65));font-size:clamp(42px,7vw,76px);font-family:Georgia,"Times New Roman",serif;border-radius:24px}@media (max-width:700px){.hero{padding:50px 25px}}</style><p class="hero">x</p>';
    const result = sanitizeHtml(input);
    expect(result).toContain("linear-gradient(rgba(66,49,40,0.65)");
    expect(result).toContain("clamp(42px,7vw,76px)");
    expect(result).toContain("Georgia,\"Times New Roman\"");
    expect(result).toContain("border-radius:24px");
    expect(result).toContain("@media");
    expect(result).toContain("max-width:700px");
  });

  it("preserves new semantic tags used by advanced diaries", () => {
    const input =
      '<article><header><h1>Title</h1></header><section><label for="c"><input type="checkbox" checked> <small>small</small></label></section><footer>footer</footer><aside>aside</aside></article>';
    const result = sanitizeHtml(input);
    expect(result).toContain("<article>");
    expect(result).toContain("<header>");
    expect(result).toContain("<section>");
    expect(result).toContain("<label");
    expect(result).toContain("<input");
    expect(result).toContain("checked");
    expect(result).toContain("<small>");
    expect(result).toContain("<footer>");
    expect(result).toContain("<aside>");
  });

  it("keeps CSS custom properties and var() in style attributes", () => {
    const input =
      '<p style="--value: 81%; width: var(--value)">hi</p>';
    const result = sanitizeHtml(input);
    expect(result).toContain("--value");
    expect(result).toContain("var(--value)");
    expect(result).toContain("width");
  });

  it("keeps CSS custom properties inside style blocks", () => {
    const input =
      '<style>:root{--accent:#9b7657}.bar{width:var(--value);backdrop-filter:blur(8px);box-sizing:border-box;inset:0;place-items:center}</style><p class="bar">x</p>';
    const result = sanitizeHtml(input);
    expect(result).toContain("--accent:#9b7657");
    expect(result).toContain("var(--value)");
    expect(result).toContain("backdrop-filter");
    expect(result).toContain("box-sizing");
    expect(result).toContain("inset:0");
    expect(result).toContain("place-items");
  });

  it("catches CSS escape-sequence obfuscated url() in style blocks", () => {
    const input =
      String.raw`<style>.a{background:u\72l(https://evil.example/x.png);color:red}</style>`;
    const result = sanitizeHtml(input);
    // The escaped "u\72l(" was decoded to "url(" and neutralized.
    expect(result).toContain("DISABLED-url(");
    expect(result).not.toContain(String.raw`u\72l(`);
    expect(result).toContain("color:red");
  });

  it("catches escaped javascript: and data: in style blocks", () => {
    const input =
      String.raw`<style>.a{background:j\61vascript:alert(1)}.b{content:\64\61\74\61\3a x}</style>`;
    const result = sanitizeHtml(input);
    expect(result).toContain("DISABLED-javascript:");
    expect(result).not.toContain(String.raw`j\61vascript:`);
    expect(result).toContain("DISABLED-data:");
  });

  it("catches url() with escaped parentheses", () => {
    const input = String.raw`<style>.a{background:url\28https://evil.example/x.png\29}</style>`;
    const result = sanitizeHtml(input);
    // "\28" decodes to "(" so "url(" is recognized and neutralized in place.
    expect(result).toContain("DISABLED-url(");
    expect(result).not.toContain(String.raw`url\28`);
  });

  it("prevents style-block breakout via decoded closing tag", () => {
    const input = String.raw`<style>.a{content:"\3c/style\3e"}</style><script>alert(1)</script>`;
    const result = sanitizeHtml(input);
    // The decoded "</style>" inside the value is re-encoded to "\3c /style\3e "
    // so it cannot close the <style> element; the <script> is stripped.
    expect(result).toContain(String.raw`content:"\3c /style\3e "`);
    expect(result).not.toContain(String.raw`content:"</style>"`);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("neutralizes url()/javascript: inside inline style attributes (LOW-11)", () => {
    const input =
      '<div style="background:url(https://evil.example/beacon.png);color:red">x</div>';
    const result = sanitizeHtml(input);
    // The url() call is broken by the DISABLED- prefix so no request fires.
    expect(result).toContain("DISABLED-url(");
    expect(result).not.toContain("background:url(");
    expect(result).toContain("color:red");
  });

  it("neutralizes escaped url() inside inline style attributes (LOW-11)", () => {
    const input = String.raw`<div style="background:u\72l(https://evil.example/x.png);color:red">x</div>`;
    const result = sanitizeHtml(input);
    expect(result).toContain("DISABLED-url(");
    expect(result).not.toContain("background:url(");
    expect(result).toContain("color:red");
  });

  it("handles empty string", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("handles null/undefined gracefully", () => {
    expect(() => sanitizeHtml(null as unknown as string)).not.toThrow();
    expect(() => sanitizeHtml(undefined as unknown as string)).not.toThrow();
  });

  it("drops arbitrary external images (tracking pixel)", () => {
    const input =
      '<p>hi</p><img src="https://tracker.example/pixel.gif" alt="t">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("tracker.example");
    expect(result).not.toContain("<img");
  });

  it("keeps same-origin relative media images", () => {
    const input = '<img src="/api/v1/media/file/abc?v=original" alt="m">';
    const result = sanitizeHtml(input);
    expect(result).toContain("/api/v1/media/file/abc");
  });

  it("keeps images from the configured API origin", () => {
    const prev = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = "https://api.diaryarchive.com/api/v1";
    try {
      const input =
        '<img src="https://api.diaryarchive.com/api/v1/media/file/x?v=original">';
      const result = sanitizeHtml(input);
      expect(result).toContain("api.diaryarchive.com");
    } finally {
      process.env.NEXT_PUBLIC_API_URL = prev;
    }
  });

  it("drops images from arbitrary hosts even when API origin is set", () => {
    const prev = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = "https://api.diaryarchive.com/api/v1";
    try {
      const input = '<img src="https://evil.example/steal.gif">';
      const result = sanitizeHtml(input);
      expect(result).not.toContain("evil.example");
      expect(result).not.toContain("<img");
    } finally {
      process.env.NEXT_PUBLIC_API_URL = prev;
    }
  });
});
