from app.core.sanitize import sanitize_html


def test_style_block_preserved():
    html = '<style>.diary-entry { color: red; }</style><div class="diary-entry">hi</div>'
    result = sanitize_html(html)
    assert "<style>" in result
    assert ".diary-entry" in result
    assert "color: red" in result
    assert '<div class="diary-entry">hi</div>' in result


def test_style_block_keeps_benign_css():
    html = (
        '<style>'
        '.hero{background:linear-gradient(rgba(66,49,40,0.65),rgba(66,49,40,0.65)),'
        'linear-gradient(135deg,#b89c82,#5d514b);font-size:clamp(42px,7vw,76px);'
        'font-family:Georgia,"Times New Roman",serif;border-radius:24px;'
        'box-shadow:0 25px 70px rgba(72,52,39,0.18)}'
        '.hero::first-letter{float:left;font-size:75px;color:#9b7657}'
        '@media (max-width:700px){.hero{padding:50px 25px}}'
        '</style><p class="hero">hi</p>'
    )
    result = sanitize_html(html)
    assert "linear-gradient(rgba(66,49,40,0.65)" in result
    assert "clamp(42px,7vw,76px)" in result
    assert "Georgia,\"Times New Roman\"" in result
    assert "border-radius:24px" in result
    assert "box-shadow:0 25px 70px rgba(72,52,39,0.18)" in result
    assert "::first-letter" in result
    assert "@media" in result
    assert "max-width:700px" in result


def test_style_block_drops_dangerous_values():
    html = (
        '<style>'
        '.a{background:url(javascript:alert(1))}'
        '.b{width:expression(alert(1))}'
        '.c{behavior:url(x.htc)}'
        '.d{-moz-binding:url(x.xml#y)}'
        '.e{background:url(data:image/svg+xml;base64,PHNjcmlwdD4=)}'
        '.f{color:red}'
        '</style><p>x</p>'
    )
    result = sanitize_html(html)
    assert "url(" not in result
    assert "expression" not in result
    assert "behavior" not in result
    assert "binding" not in result
    assert "data:" not in result
    assert "color:red" in result


def test_style_block_drops_import_and_other_at_rules():
    html = (
        '<style>'
        '@import url("https://evil.example/x.css");'
        '@charset "utf-8";'
        '@font-face{font-family:x;src:url(https://evil/x.woff)}'
        '.x{color:red}'
        '</style><p>x</p>'
    )
    result = sanitize_html(html)
    assert "@import" not in result
    assert "@charset" not in result
    assert "@font-face" not in result
    assert ".x { color:red; }" in result


def test_style_block_drops_unapproved_properties():
    html = (
        '<style>'
        '.a{clip-path:url(#evil);filter:blur(1px);animation:none;color:red}'
        '.b{position:fixed;top:0;width:100%}'
        '</style><p>x</p>'
    )
    result = sanitize_html(html)
    assert "clip-path" not in result
    assert "filter:" not in result
    assert "animation" not in result
    assert "color:red" in result
    assert "position:fixed" in result


def test_style_attr_css_filtered():
    html = '<p style="color: red; filter: blur(1px); background: url(x)">hi</p>'
    result = sanitize_html(html)
    assert "color: red" in result
    assert "filter" not in result
    assert "url(" not in result


def test_style_attr_url_removed_even_when_benign():
    html = '<p style="background: url(https://evil.example/track.png); color: red">hi</p>'
    result = sanitize_html(html)
    assert "url(" not in result
    assert "color: red" in result


def test_dangerous_uris_stripped():
    html = (
        '<a href="javascript:alert(1)">x</a>'
        '<a href="data:text/html;base64,PHNjcmlwdD4=">y</a>'
        '<img src="javascript:alert(1)">'
        '<a href="https://ok.example">z</a>'
    )
    result = sanitize_html(html)
    assert "javascript:" not in result
    assert "data:text/html" not in result
    assert 'href="https://ok.example"' in result


def test_disallowed_tags_stripped():
    html = "<script>alert(1)</script><header>Hello</header><div class=\"x\">body</div>"
    result = sanitize_html(html)
    assert "<script>" not in result
    assert "<header>" not in result
    assert "Hello" in result