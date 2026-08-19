// Top-level selectors that normally target the document (html / body / :root)
// are remapped to :host so they style the diary box itself instead of leaking
// into (or reading) the host page. Only matches a selector-list position so
// compound selectors like ".card body" are left alone (they simply match
// nothing inside the shadow tree).
//
// The boundary set includes '>' because scopeAuthorCss runs on the full stored
// HTML string, which begins with an opening <style> tag — so a leading
// ":root {" / "html {" / "body {" sits right after the tag's '>' and would
// otherwise be missed, leaving its CSS custom properties (--var) out of the
// shadow tree and silently breaking every var() that depends on them.
const ROOT_SELECTOR_RE = /(^|[{,}>])\s*(html|body|:root)(?=\s*[{,])/g;

export function scopeAuthorCss(css: string): string {
  return css.replace(ROOT_SELECTOR_RE, "$1 :host");
}