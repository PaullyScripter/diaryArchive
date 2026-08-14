from app.core.sanitize import sanitize_html


def test_style_block_preserved():
    html = '<style>.diary-entry { color: red; }</style><div class="diary-entry">hi</div>'
    result = sanitize_html(html)
    assert "<style>" in result
    assert ".diary-entry { color: red; }" in result
    assert '<div class="diary-entry">hi</div>' in result


def test_style_block_content_sanitized():
    html = '<style>.x{background:url(javascript:alert(1))}</style><p>ok</p>'
    result = sanitize_html(html)
    assert "DISABLED-url(" in result
    assert "DISABLED-javascript:" in result
    assert "url(javascript:alert(1))" not in result


def test_style_attr_css_filtered():
    html = '<p style="color: red; position: fixed; background: url(x)">hi</p>'
    result = sanitize_html(html)
    assert "color: red" in result
    assert "position: fixed" not in result


def test_disallowed_tags_stripped():
    html = "<script>alert(1)</script><header>Hello</header><div class=\"x\">body</div>"
    result = sanitize_html(html)
    assert "<script>" not in result
    assert "<header>" not in result
    assert "Hello" in result