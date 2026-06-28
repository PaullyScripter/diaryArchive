import bleach
from bleach.css_sanitizer import CSSSanitizer

ALLOWED_TAGS = {
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "em", "strong", "a", "img", "table", "thead",
    "tbody", "tr", "th", "td", "hr", "br", "span",
    "style", "div",
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


def sanitize_html(html: str) -> str:
    cleaned = bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        css_sanitizer=css_sanitizer,
        strip=True,
    )
    cleaned = bleach.linkify(cleaned)
    return cleaned
