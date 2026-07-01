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

  it("handles empty string", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("handles null/undefined gracefully", () => {
    expect(() => sanitizeHtml(null as unknown as string)).not.toThrow();
    expect(() => sanitizeHtml(undefined as unknown as string)).not.toThrow();
  });
});
