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
  const scoped = css.replace(ROOT_SELECTOR_RE, "$1 :host");
  // Code editors / preview iframes apply a box-sizing reset so that author
  // declarations like `width: min(1420px, 100%)` together with padding fit
  // inside the diary box instead of overflowing it. Without this, content-box
  // sizing (the CSS default) makes the border-box larger than `100%`, which
  // clips / scrolls the design. Apply it only within the shadow tree.
  const reset =
    ":host, :host *, :host *::before, :host *::after { box-sizing: border-box; }";
  return `${reset}\n${scoped}`;
}