import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "em", "strong", "a", "img", "br", "span", "small",
  "sub", "sup", "mark", "abbr", "cite", "q", "s", "u",
  "article", "section", "header", "footer", "aside",
  "nav", "main", "figure", "figcaption", "div",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "caption", "colgroup", "col",
  "dl", "dt", "dd", "hr", "details", "summary",
  "label", "input", "fieldset", "legend",
  "style",
];

const ALLOWED_ATTR = [
  "class", "style", "title",
  "href", "target", "rel",
  "src", "alt", "width", "height",
  "data-media-id",
  "type", "checked", "disabled", "value", "name",
  "for",
  "span", "colspan", "rowspan", "scope", "align", "valign",
];

// Constructs that must never survive inside a CSS value or <style> block.
// The DISABLED- prefix neuters the token while keeping surrounding CSS intact.
const CSS_DANGEROUS_PATTERNS: RegExp[] = [
  // Prevent author CSS from creating overlays or UI-redress surfaces inside
  // rendered diary containers. Layout and typography remain available, but
  // positioning/layering/filtering is controlled by the application shell.
  /(^|[;{]\s*)(position|top|right|bottom|left|inset|z-index|filter|backdrop-filter|content|transform|transform-origin)\s*:/gim,
  /url\s*\(/gi,
  /expression\s*\(/gi,
  /@import/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /data\s*:/gi,
  /-moz-binding/gi,
  /behavior\s*:/gi,
  /progid\s*:/gi,
  /document\s*\./gi,
  /window\s*\./gi,
];

// Decode CSS escape sequences ("\72", "\0072", "\r") to their real characters.
// The dangerous-value patterns below run on plain text; without this, an
// attacker could hide "url(" as "u\72l(" and slip an external request (a
// tracking beacon / exfiltration) past the scrub. This matters most for
// private diaries, which are end-to-end encrypted and never reach the backend
// sanitizer, so the browser is the only line of defense.
function decodeCssEscapes(css: string): string {
  return css
    .replace(/\\([0-9a-fA-F]{1,6})[ \t\r\n\f]?/g, (_m, hex: string) => {
      const cp = parseInt(hex, 16);
      if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
        return "\ufffd";
      }
      return String.fromCodePoint(cp);
    })
    .replace(/\\(\r\n|\r|\n)/g, "") // line continuation drops the backslash
    .replace(/\\(.)/g, "$1"); // escaped literal character
}

export function scrubCssText(css: string): string {
  // Decode escapes first so the blocklist sees "url(", "javascript:", etc.
  // even when the author wrote them escaped.
  let out = decodeCssEscapes(css);
  // Keep the declaration delimiter in place and prefix the property itself.
  // Prefixing the whole match would produce `DISABLED-;position:` and leave
  // the dangerous declaration active in the browser.
  out = out.replace(
    CSS_DANGEROUS_PATTERNS[0],
    (_match, delimiter: string, property: string) => `${delimiter}DISABLED-${property}:`,
  );
  for (const pattern of CSS_DANGEROUS_PATTERNS.slice(1)) {
    out = out.replace(pattern, (match) => `DISABLED-${match}`);
  }
  // Decoding can turn an escape like "\3c/style\3e" into "</style>". Re-encode
  // any angle bracket so the content can never break out of the <style>
  // element or form an HTML tag. CSS escapes preserve the rendered value, so
  // this is semantics-preserving.
  out = out.replace(/</g, "\\3c ").replace(/>/g, "\\3e ");
  return out;
}

const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;

// Keep DOMPurify's safe URI schemes and add only the http(s)-backed blob URLs
// created by URL.createObjectURL for authenticated media hydration. The later
// image-source policy still decides whether a retained image may render.
const ALLOWED_URI_REGEXP = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|blob:https?:\/\/|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

// Inline style="" attributes are allowed through DOMPurify but are NOT covered
// by the <style> block scrub above. Scrub them with the same blocklist so a
// value like `background: url(https://evil.example/beacon)` — a tracking /
// exfiltration vector, especially in E2E-encrypted private diaries that never
// reach the backend sanitizer — cannot slip through as an inline style.
let styleHookRegistered = false;

function ensureStyleHookRegistered() {
  if (styleHookRegistered || typeof DOMPurify.addHook !== "function") return;
  styleHookRegistered = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.hasAttribute && node.hasAttribute("style")) {
      node.setAttribute("style", scrubCssText(node.getAttribute("style") || ""));
    }
  });
}

function apiOrigin(): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
  if (!/^https?:\/\//i.test(base)) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

/**
 * Options controlling image-source policy for a rendered diary.
 *
 * `allowExternalImages` is retained as a source-compatible, deprecated option
 * for callers compiled against older releases. It is intentionally ignored:
 * both public and private diaries use application-hosted media only, so a
 * diary cannot silently turn every reader into a third-party tracking request.
 */
export interface SanitizeOptions {
  allowExternalImages?: boolean;
}

/**
 * Decide whether an <img src> may render.
 *
 * Policy: allow (a) same-origin relative paths, (b) the configured API origin
 * (which is where the app serves uploaded media — this may be http in local
 * dev), and (c) transient blob URLs created by authenticated media hydration.
 * Reject everything else: javascript:, data:, vbscript:, file:, and external
 * http(s) hosts. No plaintext or payload-exfil channel is opened.
 */
export function isAllowedImageSource(
  value: string,
  _allowExternalImages = false,
): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  if (v.startsWith("/")) return true; // same-origin relative
  // Authenticated media is fetched with Axios and rendered through a browser
  // object URL. These URLs are transient, browser-local references created by
  // the app; rejecting them here makes images flash once and then disappear
  // when the hydrated HTML is sanitized.
  if (/^blob:https?:\/\//i.test(v)) return true;
  const origin = apiOrigin();
  if (origin) {
    try {
      // App-hosted media may be http in local dev, so match the exact origin.
      if (new URL(v).origin === origin) return true;
    } catch {
      return false;
    }
  }
  // Arbitrary remote images are blocked even when a legacy caller passes the
  // former opt-in flag. This is a product-wide privacy invariant.
  if (/^https?:\/\//i.test(v)) return false;
  return false;
}

export function sanitizeHtml(html: string, options?: SanitizeOptions): string {
  ensureStyleHookRegistered();
  const allowExternalImages = options?.allowExternalImages ?? false;

  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP,
    FORCE_BODY: true,
  });

  const result = cleaned.replace(STYLE_BLOCK_RE, (match, css: string) =>
    match.replace(css, scrubCssText(css))
  );

  if (!result.includes("<img")) return result;

  // Drop src (and the whole empty img tag for cleanliness) on disallowed hosts.
  // Note: parsing as a full HTML document hoists any leading <style> block into
  // <head>, so doc.body.innerHTML alone would silently drop the author's CSS.
  // Re-append the style blocks (re-serialized) to keep the CSS with the body.
  const doc = new DOMParser().parseFromString(result, "text/html");
  doc.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (!isAllowedImageSource(src, allowExternalImages)) img.remove();
  });
  const styles = Array.from(doc.querySelectorAll("head style"))
    .map((s) => s.outerHTML)
    .join("");
  return `${styles}${doc.body.innerHTML}`;
}

export function sanitizeCss(css: string): string {
  return scrubCssText(css);
}

/**
 * Return the `<img src>` values that the current policy would strip from an
 * HTML fragment, so callers can warn the author *why* their image was removed
 * instead of silently dropping it. `options` mirror `sanitizeHtml`.
 */
export function findDisallowedImageSources(
  html: string,
  options?: SanitizeOptions
): string[] {
  if (!html || !html.includes("<img")) return [];
  const allowExternalImages = options?.allowExternalImages ?? false;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const bad: string[] = [];
  doc.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (src && !isAllowedImageSource(src, allowExternalImages)) {
      bad.push(src);
    }
  });
  return bad;
}
