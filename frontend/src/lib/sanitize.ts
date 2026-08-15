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

export function scrubCssText(css: string): string {
  let out = css;
  for (const pattern of CSS_DANGEROUS_PATTERNS) {
    out = out.replace(pattern, (match) => `DISABLED-${match}`);
  }
  return out;
}

const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;

export function sanitizeHtml(html: string): string {
  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: true,
  });
  return cleaned.replace(STYLE_BLOCK_RE, (match, css: string) =>
    match.replace(css, scrubCssText(css))
  );
}

export function sanitizeCss(css: string): string {
  return scrubCssText(css);
}