import re

import bleach
from bleach.css_sanitizer import CSSSanitizer

ALLOWED_TAGS = {
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "em", "strong", "a", "img", "table", "thead",
    "tbody", "tr", "th", "td", "hr", "br", "span",
    "div", "style",
}

ALLOWED_ATTRIBUTES = {
    "*": ["class", "style"],
    "a": ["href", "target", "rel"],
    "img": ["src", "alt", "width", "height"],
}

ALLOWED_CSS_PROPERTIES = frozenset({
    "font-family", "font-size", "font-weight", "font-style",
    "color", "background-color", "background",
    "text-align", "text-decoration", "text-indent",
    "line-height", "letter-spacing",
    "margin", "margin-left", "margin-right", "margin-top", "margin-bottom",
    "padding", "padding-left", "padding-right", "padding-top", "padding-bottom",
    "border", "border-left", "border-right", "border-top", "border-bottom",
    "width", "height", "max-width", "max-height",
})

css_sanitizer = CSSSanitizer(allowed_css_properties=ALLOWED_CSS_PROPERTIES)


def _sanitize_css_text(css: str) -> str:
    css = re.sub(r"url\s*\(", "DISABLED-url(", css, flags=re.IGNORECASE)
    css = re.sub(r"@import", "DISABLED-import", css, flags=re.IGNORECASE)
    css = re.sub(r"expression\s*\(", "DISABLED-expression(", css, flags=re.IGNORECASE)
    css = re.sub(r"javascript\s*:", "DISABLED-javascript:", css, flags=re.IGNORECASE)
    return css


_STYLE_BLOCK_RE = re.compile(r"<style[^>]*>(.*?)</style>", re.IGNORECASE | re.DOTALL)


def _scrub_style_blocks(html: str) -> str:
    def _replace(match: re.Match) -> str:
        return f"<style>{_sanitize_css_text(match.group(1))}</style>"

    return _STYLE_BLOCK_RE.sub(_replace, html)


def sanitize_html(html: str) -> str:
    html = _scrub_style_blocks(html)
    cleaned = bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        css_sanitizer=css_sanitizer,
        strip=True,
    )
    cleaned = bleach.linkify(cleaned, skip_tags={"style"})
    return cleaned
