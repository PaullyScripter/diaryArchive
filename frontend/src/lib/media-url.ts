/**
 * Media URLs returned by the API are absolute paths under /api/v1/... (or a
 * CDN / signed URL). A bare relative path like `/api/v1/media/file/<id>`
 * resolves against the page origin, which (when the API lives on its own
 * origin via NEXT_PUBLIC_API_URL) does not serve those requests, so images
 * render as broken. Resolve such paths to the API origin the browser actually
 * uses for XHR.
 */

function apiOrigin(): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
  if (!/^https?:\/\//i.test(base)) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

/** Resolve a single media URL to one the browser can load. */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/api/")) {
    const origin = apiOrigin();
    if (origin) return `${origin}${url}`;
  }
  return url;
}

/**
 * Rewrite relative /api/... URLs found in already-saved diary HTML (e.g.
 * `src`, `srcset`, `poster`) so legacy content keeps rendering after the media
 * proxy was introduced. Leaves absolute URLs untouched.
 */
export function resolveMediaUrlsInHtml(html: string): string {
  if (!html || !html.includes("/api/")) return html;
  const origin = apiOrigin();
  if (!origin) return html;
  return html.replace(/(\b(?:src|poster)=["'])\/api\//g, `$1${origin}/api/`);
}