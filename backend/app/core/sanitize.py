import re

import bleach
from bleach.css_sanitizer import CSSSanitizer
from tinycss2 import parse_declaration_list, parse_stylesheet, serialize
from tinycss2.ast import AtRule, Declaration, QualifiedRule

ALLOWED_TAGS = {
    # core text
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "em", "strong", "a", "img", "br", "span", "small",
    "sub", "sup", "mark", "abbr", "cite", "q", "s", "u",
    # semantic layout (commonly used in custom HTML/CSS diaries)
    "article", "section", "header", "footer", "aside",
    "nav", "main", "figure", "figcaption", "div",
    # tables
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "caption", "colgroup", "col",
    # lists / structure
    "dl", "dt", "dd", "hr", "details", "summary",
    # forms (interactive but inert without JS; used for checklists/toggles)
    "label", "input", "fieldset", "legend",
    # style
    "style",
}

ALLOWED_ATTRIBUTES = {
    "*": ["class", "style", "title"],
    "a": ["href", "target", "rel"],
    "img": ["src", "alt", "width", "height"],
    "input": ["type", "checked", "disabled", "value", "name"],
    "label": ["for"],
    "col": ["span"],
    "colgroup": ["span"],
    "td": ["colspan", "rowspan", "align", "valign"],
    "th": ["colspan", "rowspan", "scope", "align", "valign"],
}

# Benign layout/typography properties. CSS properties are inert on their own;
# the danger lives in VALUES (url(), expression(), behavior, ...) which are
# rejected by _CSS_VALUE_RE below. Custom properties (--*) are allowed so
# writers can define their own design tokens.
ALLOWED_CSS_PROPERTIES = frozenset({
    # typography
    "font-family", "font-size", "font-weight", "font-style",
    "color", "background-color", "background", "background-image",
    "text-align", "text-decoration", "text-indent", "text-transform",
    "line-height", "letter-spacing", "white-space", "word-wrap",
    "vertical-align", "text-shadow", "word-break", "overflow-wrap",
    # box model
    "margin", "margin-left", "margin-right", "margin-top", "margin-bottom",
    "padding", "padding-left", "padding-right", "padding-top", "padding-bottom",
    "border", "border-left", "border-right", "border-top", "border-bottom",
    "border-radius", "box-shadow", "border-collapse", "border-spacing",
    # sizing / layout
    "width", "height", "min-width", "min-height", "max-width", "max-height",
    "display", "float", "overflow", "overflow-x", "overflow-y",
    "position", "top", "right", "bottom", "left", "inset", "z-index",
    "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink",
    "flex-basis", "gap", "row-gap", "column-gap",
    "align-items", "align-self", "align-content", "justify-content",
    "justify-items", "justify-self", "place-items", "place-content", "place-self",
    "grid", "grid-template", "grid-template-columns", "grid-template-rows",
    "grid-template-areas", "grid-column", "grid-column-start", "grid-column-end",
    "grid-row", "grid-row-start", "grid-row-end", "grid-area",
    "grid-auto-flow", "grid-auto-rows", "grid-auto-columns", "grid-gap",
    "box-sizing", "aspect-ratio", "object-fit", "object-position",
    "opacity", "transform", "transform-origin", "transition",
    "content", "filter", "backdrop-filter", "cursor", "user-select",
    "visibility", "overflow-wrap", "text-overflow",
    "columns", "column-count", "column-gap",
})

# Constructs that must never survive in a CSS value or stylesheet.
_CSS_VALUE_RE = re.compile(
    r"url\s*\(|"
    r"expression\s*\(|"
    r"@import|"
    r"javascript\s*:|"
    r"vbscript\s*:|"
    r"data\s*:|"
    r"-moz-binding|"
    r"behavior\s*:|"
    r"progid\s*:|"
    r"document\s*\.|"
    r"window\s*\.",
    re.IGNORECASE,
)

_DANGEROUS_URI_PREFIXES = ("javascript:", "vbscript:", "data:", "file:", "about:")

_MAX_RULE_DEPTH = 12


def _decode_css_escapes(css: str) -> str:
    """Decode CSS escape sequences ("\72", "\0072", "\72(", "\3c") to their
    real characters so the value blocklist sees "url(", "javascript:", etc.
    even when the author wrote them escaped. tinycss2 normalizes some escapes
    but not all (e.g. "\28" for "(" survives), which previously let
    "url\28(...)" slip past the regex.
    """
    out = []
    i, n = 0, len(css)
    while i < n:
        ch = css[i]
        if ch != "\\" or i + 1 >= n:
            out.append(ch)
            i += 1
            continue
        nxt = css[i + 1]
        if nxt in "\r\n":
            # line continuation: drop the backslash and the newline(s)
            i += 2 if (nxt == "\r" and i + 2 < n and css[i + 2] == "\n") else 1
            continue
        if nxt in "0123456789abcdefABCDEF":
            j = i + 1
            while j < n and j < i + 7 and css[j] in "0123456789abcdefABCDEF":
                j += 1
            cp = int(css[i + 1 : j], 16)
            if cp == 0 or cp > 0x10FFFF or 0xD800 <= cp <= 0xDFFF:
                out.append("\ufffd")
            else:
                out.append(chr(cp))
            # an optional single whitespace after a hex escape is consumed
            if j < n and css[j] in " \t\r\n\f":
                j += 1
            i = j
            continue
        # escaped single character: the backslash is dropped
        out.append(nxt)
        i += 2
    return "".join(out)


def _escape_angle_brackets(css: str) -> str:
    """Re-encode '<' and '>' as CSS escapes so decoded content cannot break
    out of the <style> element or form an HTML tag. Semantics-preserving."""
    return css.replace("<", "\\3c ").replace(">", "\\3e ")


class _CustomPropertyAwareCSSSanitizer(CSSSanitizer):
    """Bleach css_sanitizer that preserves CSS custom properties (--*).

    Delegates to _sanitize_declarations (same allowlist + value regex used
    for <style> blocks) so inline style attributes and <style> blocks behave
    identically, including support for author-defined design tokens.
    """

    def sanitize_css(self, css_text: str) -> str:
        declarations = _sanitize_declarations(css_text)
        return serialize(declarations) if declarations else ""


css_sanitizer = _CustomPropertyAwareCSSSanitizer(
    allowed_css_properties=ALLOWED_CSS_PROPERTIES
)


def _sanitize_declarations(content) -> list:
    """Return only safe, allowlisted CSS declarations from a token list or string."""
    try:
        declarations = parse_declaration_list(
            content, skip_comments=True, skip_whitespace=True
        )
    except Exception:
        return []
    kept = []
    for declaration in declarations:
        if not isinstance(declaration, Declaration):
            continue
        prop = declaration.name.strip().lower()
        # Allow custom properties (design tokens) the author defines themselves.
        is_custom_prop = prop.startswith("--")
        if not is_custom_prop and prop not in ALLOWED_CSS_PROPERTIES:
            continue
        # Decode CSS escapes first so "url\28(...)" is seen as "url(...)".
        serialized_value = serialize(declaration.value)
        if _CSS_VALUE_RE.search(_decode_css_escapes(serialized_value)):
            continue
        kept.append(declaration)
    return kept


def _process_rules(tokens, depth: int = 0) -> list:
    if depth > _MAX_RULE_DEPTH:
        return []
    result = []
    for token in tokens:
        if isinstance(token, QualifiedRule):
            declarations = _sanitize_declarations(token.content)
            if declarations:
                result.append(f"{serialize(token.prelude)} {{ {serialize(declarations)} }}")
        elif isinstance(token, AtRule):
            if token.content is None:
                continue  # statement at-rules (@import, @charset, ...) are dropped
            keyword = token.at_keyword.lower()
            inner = " ".join(
                _process_rules(
                    parse_stylesheet(token.content, skip_comments=True, skip_whitespace=True),
                    depth + 1,
                )
            )
            if keyword in ("media", "supports") and inner:
                result.append(f"@{keyword} {serialize(token.prelude)} {{ {inner} }}")
            elif keyword.endswith("keyframes") and inner:
                result.append(f"@{keyword} {serialize(token.prelude)} {{ {inner} }}")
            # block at-rules not listed above are dropped.
    return result


def _sanitize_css_stylesheet(css: str) -> str:
    """Parse a <style> block with tinycss2 and rebuild it safely."""
    if not css or not css.strip():
        return ""
    try:
        tokens = parse_stylesheet(css, skip_comments=True, skip_whitespace=True)
    except Exception:
        return ""
    rules = _process_rules(tokens)
    # Re-encode any '<' / '>' so decoded content (e.g. "\3c/style\3e") cannot
    # break out of the <style> element or form an HTML tag.
    return _escape_angle_brackets(" ".join(rules)) if rules else ""


def _sanitize_style_attr(value: str):
    """Sanitize an inline style attribute value; return None to drop it."""
    declarations = _sanitize_declarations(value)
    if not declarations:
        return None
    return serialize(declarations)


def _attribute_filter(tag, name, value):
    """Bleach attribute callback: allowlist + value hardening."""
    wildcard = ALLOWED_ATTRIBUTES.get("*", [])
    if name not in wildcard and name not in ALLOWED_ATTRIBUTES.get(tag, []):
        return None
    if name == "style":
        return _sanitize_style_attr(value)
    if name in ("href", "src"):
        stripped = value.strip().lstrip()
        if stripped.lower().startswith(_DANGEROUS_URI_PREFIXES):
            return None
    return value


_STYLE_BLOCK_RE = re.compile(r"<style[^>]*>(.*?)</style>", re.IGNORECASE | re.DOTALL)


def _scrub_style_blocks(html: str) -> str:
    def _replace(match: re.Match) -> str:
        return f"<style>{_sanitize_css_stylesheet(match.group(1))}</style>"

    return _STYLE_BLOCK_RE.sub(_replace, html)


# bleach only uses the attributes callable as a boolean gate and re-runs its
# own css_sanitizer on the original value, so style attribute VALUES are
# rewritten here after cleaning (drops url() and unapproved properties).
_STYLE_ATTR_RE = re.compile(r'style=("([^"]*)"|\'([^\']*)\')', re.IGNORECASE)


def _rewrite_style_attrs(html: str) -> str:
    def _repl(match: re.Match) -> str:
        value = match.group(2) if match.group(2) is not None else match.group(3)
        safe = _sanitize_style_attr(value)
        if safe is None:
            return ""
        return f'style="{safe}"'

    return _STYLE_ATTR_RE.sub(_repl, html)


def sanitize_html(html: str) -> str:
    html = _scrub_style_blocks(html)
    cleaned = bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=_attribute_filter,
        css_sanitizer=css_sanitizer,
        strip=True,
    )
    cleaned = bleach.linkify(cleaned, skip_tags={"style"})
    cleaned = _rewrite_style_attrs(cleaned)
    return cleaned