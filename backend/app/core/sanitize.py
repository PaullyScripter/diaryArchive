import bleach

ALLOWED_TAGS = {
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "em", "strong", "a", "img", "table", "thead",
    "tbody", "tr", "th", "td", "hr", "br", "span",
    "style", "div",
}

ALLOWED_ATTRIBUTES = {
    "*": ["class"],
    "a": ["href", "target", "rel"],
    "img": ["src", "alt", "width", "height"],
}


def sanitize_html(html: str) -> str:
    cleaned = bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True,
    )
    cleaned = bleach.linkify(cleaned)
    return cleaned
