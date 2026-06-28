import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "em", "strong", "a", "img", "table", "thead",
  "tbody", "tr", "th", "td", "hr", "br", "span",
  "div", "style",
];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [
      "class", "style", "href", "target", "rel",
      "src", "alt", "width", "height",
    ],
    ALLOW_DATA_ATTR: false,
  });
}

export function sanitizeCss(css: string): string {
  const safe = css
    .replace(/url\s*\(/gi, "DISABLED-url(")
    .replace(/@import/gi, "DISABLED-import")
    .replace(/expression\s*\(/gi, "DISABLED-expression(")
    .replace(/javascript\s*:/gi, "DISABLED-javascript:");
  return safe;
}
