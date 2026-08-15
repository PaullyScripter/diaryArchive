// Top-level selectors that normally target the document (html / body / :root)
// are remapped to :host so they style the diary box itself instead of leaking
// into (or reading) the host page. Only matches a selector-list position so
// compound selectors like ".card body" are left alone (they simply match
// nothing inside the shadow tree).
const ROOT_SELECTOR_RE = /(^|[{,}])\s*(html|body|:root)(?=\s*[{,])/g;

export function scopeAuthorCss(css: string): string {
  return css.replace(ROOT_SELECTOR_RE, "$1 :host");
}