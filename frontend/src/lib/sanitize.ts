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
  "type", "checked", "disabled", "value", "name",
  "for",
  "span", "colspan", "rowspan", "scope", "align", "valign",
];

// Constructs that must never survive inside a CSS value or <style> block.
// The DISABLED- prefix neuters the token while keeping surrounding CSS intact.
const CSS_DANGEROUS_PATTERNS: RegExp[] = [
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
  for (const pattern of CSS_DANGEROUS_PATTERNS) {
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

/**
 * Decide whether an <img src> may render.
 *
 * Policy: same-origin relative paths and any https: URL are allowed, so authors
 * can reference external images (e.g. a hosted newspaper photo) and the diary
 * renders like a full-page editor. Only unsafe schemes that cannot be an image
 * and are typical injection/exfiltration vectors are rejected outright:
 * javascript:, data:, vbscript:, file:, and the like. External images still
 * only load over https — never http, never inline data blobs — so no plaintext
 * or payload-exfil channel is opened.
 *
 * Note: allowing arbitrary https images means the reader's IP is visible to the
 * image host (a tracking/identification vector). This is the explicit author
 * preference; the trade-off is documented here rather than silently applied.
 */
export function isAllowedImageSource(value: string): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  if (v.startsWith("/")) return true; // same-origin relative
  // Allow https: images (external hosts included); reject everything else.
  return /^https:\/\//i.test(v);
}

export function sanitizeHtml(html: string): string {
  ensureStyleHookRegistered();

  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
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
    if (!isAllowedImageSource(src)) img.remove();
  });
  const styles = Array.from(doc.querySelectorAll("head style"))
    .map((s) => s.outerHTML)
    .join("");
  return `${styles}${doc.body.innerHTML}`;
}

export function sanitizeCss(css: string): string {
  return scrubCssText(css);
}