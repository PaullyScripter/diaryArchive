import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

/**
 * Media URLs returned by the API are stable paths under /api/v1/... (or a
 * configured public CDN URL). A bare relative path like `/api/v1/media/file/<id>`
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

const MEDIA_ID_RE = /^[a-f0-9]{24}$/i;

/** Build a stable API reference that never contains a signed MinIO URL. */
export function stableMediaUrl(
  mediaId: string,
  variant: "original" | "standard" | "thumb" = "original",
): string {
  if (!MEDIA_ID_RE.test(mediaId)) return "";
  return "/api/v1/media/file/" + mediaId + "?v=" + variant;
}

function serializeHtmlDocument(doc: Document): string {
  // DOMParser moves leading style blocks into <head>. Put them back because
  // the diary renderer expects its author CSS in the fragment.
  const styles = Array.from(doc.head.querySelectorAll("style"))
    .map((style) => style.outerHTML)
    .join("");
  return styles + doc.body.innerHTML;
}

/**
 * Replace uploaded-media URLs with stable media identifiers before content is
 * saved or encrypted. This prevents signed URLs from becoming permanent
 * diary references.
 */
export function normalizeMediaReferencesInHtml(html: string): string {
  if (!html || typeof DOMParser === "undefined" || !html.includes("data-media-id")) {
    return html;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll<HTMLElement>("[data-media-id]").forEach((element) => {
    const mediaId = element.getAttribute("data-media-id") || "";
    if (!MEDIA_ID_RE.test(mediaId)) return;
    const currentSrc = element.getAttribute("src") || "";
    let variant: "original" | "standard" | "thumb" = "original";
    try {
      const parsed = new URL(currentSrc, window.location.origin);
      const requested = parsed.searchParams.get("v");
      if (requested === "standard" || requested === "thumb") variant = requested;
    } catch {
      // Signed or malformed legacy URLs use the original variant.
    }
    element.setAttribute("src", stableMediaUrl(mediaId, variant));
  });
  return serializeHtmlDocument(doc);
}

/**
 * Fetch media through the authenticated API and replace image sources with
 * browser object URLs. The API request carries the access token; an <img>
 * request cannot. Public media also works anonymously.
 */
export async function hydrateMediaUrlsInHtml(
  html: string,
  signal?: AbortSignal,
): Promise<{ html: string; objectUrls: string[] }> {
  if (!html || typeof DOMParser === "undefined" || !html.includes("data-media-id")) {
    return { html, objectUrls: [] };
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const objectUrls: string[] = [];
  const elements = Array.from(doc.querySelectorAll<HTMLElement>("[data-media-id]"));

  const hydrateOne = async (element: HTMLElement) => {
    if (signal?.aborted) return;
    const mediaId = element.getAttribute("data-media-id") || "";
    if (!MEDIA_ID_RE.test(mediaId)) return;
    const stableUrl = stableMediaUrl(mediaId);
    const resolvedUrl = resolveMediaUrl(stableUrl) || stableUrl;
    try {
      // apiClient already has /api/v1 as its base URL. Passing the full
      // stable path here would duplicate that prefix in Axios.
      const apiPath = stableUrl.replace(/^\/api\/v1/, "") || "/";
      const response = await apiClient.get(apiPath, { responseType: "blob", signal });
      const objectUrl = URL.createObjectURL(response.data as Blob);
      objectUrls.push(objectUrl);
      element.setAttribute("src", objectUrl);
    } catch {
      if (!signal?.aborted) {
        // Stable URL remains the fallback: public media can render it, while
        // private media remains an authorization-checked 404.
        element.setAttribute("src", resolvedUrl);
      }
    }
  };

  // Bound concurrent authenticated fetches so a long diary cannot create an
  // unbounded burst of requests and browser object URLs.
  for (let i = 0; i < elements.length; i += 4) {
    await Promise.all(elements.slice(i, i + 4).map(hydrateOne));
  }

  return { html: serializeHtmlDocument(doc), objectUrls };
}

/** React lifecycle wrapper that revokes browser object URLs on replacement. */
export function useHydratedMediaHtml(html: string): string {
  const [hydratedHtml, setHydratedHtml] = useState(html);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let objectUrls: string[] = [];
    setHydratedHtml(html);
    hydrateMediaUrlsInHtml(html, controller.signal)
      .then((result) => {
        objectUrls = result.objectUrls;
        if (active) setHydratedHtml(result.html);
        else objectUrls.forEach((url) => URL.revokeObjectURL(url));
      })
      .catch(() => {
        // Aborted hydration is expected during navigation or replacement.
      });
    return () => {
      active = false;
      controller.abort();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [html]);

  return hydratedHtml;
}

/**
 * Rewrite relative /api/... URLs found in already-saved diary HTML (e.g.
 * `src`, `srcset`, `poster`) so legacy content keeps rendering after the media
 * proxy was introduced. Leaves absolute URLs untouched.
 */
export function resolveMediaUrlsInHtml(html: string): string {
  html = normalizeMediaReferencesInHtml(html);
  if (!html || !html.includes("/api/")) return html;
  const origin = apiOrigin();
  if (!origin) return html;
  if (typeof DOMParser === "undefined") {
    return html.replace(/(\b(?:src|poster)=["'])\/api\//g, `$1${origin}/api/`);
  }
  if (!html.includes("srcset=")) {
    return html.replace(/(\b(?:src|poster)=["'])\/api\//g, `$1${origin}/api/`);
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const element of Array.from(doc.querySelectorAll<HTMLElement>("[src], [poster], [srcset]"))) {
    for (const attribute of ["src", "poster"]) {
      const value = element.getAttribute(attribute);
      if (value?.startsWith("/api/")) element.setAttribute(attribute, `${origin}${value}`);
    }
    const srcset = element.getAttribute("srcset");
    if (srcset) {
      element.setAttribute(
        "srcset",
        srcset
          .split(",")
          .map((candidate) => candidate.trim().replace(/^\/api\//, `${origin}/api/`))
          .join(", "),
      );
    }
  }
  return serializeHtmlDocument(doc);
}
