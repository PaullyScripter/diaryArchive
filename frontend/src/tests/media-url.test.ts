import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { resolveMediaUrl, resolveMediaUrlsInHtml } from "@/lib/media-url";

describe("resolveMediaUrl", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.diaryarchive.com/api/v1");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("leaves absolute URLs untouched", () => {
    expect(resolveMediaUrl("https://cdn.example.com/x.webp")).toBe("https://cdn.example.com/x.webp");
  });

  it("resolves a relative /api/ path against the API origin", () => {
    expect(resolveMediaUrl("/api/v1/media/file/abc?v=original")).toBe(
      "https://api.diaryarchive.com/api/v1/media/file/abc?v=original",
    );
  });

  it("returns undefined for empty input", () => {
    expect(resolveMediaUrl(undefined)).toBeUndefined();
    expect(resolveMediaUrl(null)).toBeUndefined();
  });
});

describe("resolveMediaUrlsInHtml", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.diaryarchive.com/api/v1");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rewrites relative /api/ src URLs in saved HTML", () => {
    const html = '<img src="/api/v1/media/file/abc?v=standard" alt="x">';
    expect(resolveMediaUrlsInHtml(html)).toBe(
      '<img src="https://api.diaryarchive.com/api/v1/media/file/abc?v=standard" alt="x">',
    );
  });

  it("leaves absolute and CDN URLs untouched", () => {
    const html = '<img src="https://cdn.example.com/x.webp"><img src="/img/local.png">';
    expect(resolveMediaUrlsInHtml(html)).toBe(html);
  });

  it("returns the input unchanged when there is no /api/ path", () => {
    const html = "<p>hello</p>";
    expect(resolveMediaUrlsInHtml(html)).toBe(html);
  });

  it("handles srcset and poster attributes", () => {
    const html = '<video poster="/api/v1/media/file/v">';
    expect(resolveMediaUrlsInHtml(html)).toBe(
      '<video poster="https://api.diaryarchive.com/api/v1/media/file/v">',
    );
  });
});