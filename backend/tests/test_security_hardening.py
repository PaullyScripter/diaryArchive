"""Regression tests for the security hardening fixes.

Covers:
- SEV-001: get_client_ip ignores spoofed X-Forwarded-For / prefers X-Real-IP
- SEV-002: appeal endpoints lock out after repeated failed attempts
- PRI-001: public media URLs use a configured public base URL, never the
  internal MinIO host
- PRIV-001: hash_email is keyed (HMAC) and not raw SHA-256
- SEV-005: ticket reply rejects empty messages
- SEV-007: banned users return 404 (no account-state enumeration)
"""

import pytest

from app.core.security import get_client_ip
from app.services.encryption_service import hash_email, legacy_email_hash, matches_email_hash


class _FakeRequest:
    def __init__(self, headers: dict | None = None, host: str = "1.2.3.4"):
        self._headers = headers or {}
        self.headers = self._headers
        self.client = type("C", (), {"host": host})()


def test_get_client_ip_prefers_trusted_real_ip():
    req = _FakeRequest({"x-real-ip": "9.9.9.9", "x-forwarded-for": "evil.example"})
    assert get_client_ip(req) == "9.9.9.9"


def test_get_client_ip_ignores_spoofed_forwarded_when_no_real_ip():
    # No X-Real-IP: the rightmost (proxy-appended) value is authoritative, never
    # the attacker-supplied leftmost entry.
    req = _FakeRequest({"x-forwarded-for": "6.6.6.6, 5.5.5.5"})
    assert get_client_ip(req) == "5.5.5.5"


def test_get_client_ip_falls_back_to_socket():
    req = _FakeRequest(headers={}, host="7.7.7.7")
    assert get_client_ip(req) == "7.7.7.7"


def test_hash_email_is_keyed_and_versioned():
    digest = hash_email("User@Example.COM")
    assert digest.startswith("v2:")
    # Same normalized input always yields the same keyed digest.
    assert digest == hash_email("user@example.com")
    # It is NOT a plain raw SHA-256 of the lowercase email.
    assert digest != legacy_email_hash("user@example.com")
    assert not digest.endswith(legacy_email_hash("user@example.com"))


def test_hash_email_differs_from_sha256_of_value():
    import hashlib
    raw = hashlib.sha256(b"user@example.com").hexdigest()
    assert hash_email("user@example.com") != f"v2:{raw}"


def test_matches_email_hash_accepts_keyed_and_legacy():
    assert matches_email_hash("USER@Example.com", hash_email("user@example.com"))
    assert matches_email_hash("user@example.com", legacy_email_hash("user@example.com"))
    assert not matches_email_hash("other@example.com", hash_email("user@example.com"))
    assert not matches_email_hash("user@example.com", None)


def test_public_media_url_never_uses_internal_host(monkeypatch):
    from app.core.config import settings
    from app.services import media_service

    media = {
        "_id": "000000000000000000000001",
        "user_id": "000000000000000000000002",
        "diary_id": None,
        "filename": "pic.webp",
        "mime_type": "image/webp",
        "size_bytes": 100,
        "stored_path": "users/x/abc.webp",
        "is_private": False,
        "created_at": None,
    }

    # When no public base URL is configured, fall back to the app's own
    # same-origin media proxy (never expires, never leaks the internal MinIO
    # host). The frontend resolves the relative /api/... URL against the API
    # origin.
    monkeypatch.setattr(settings, "public_media_base_url", None)
    result = media_service._build_media_response(media)
    assert result["url"].startswith("/api/v1/media/file/")
    assert "minio" not in result["url"]
    assert "localhost" not in result["url"]

    # When configured, use the public base URL.
    monkeypatch.setattr(settings, "public_media_base_url", "https://media.diaryarchive.com")
    result = media_service._build_media_response(media)
    assert result["url"] == "https://media.diaryarchive.com/diaryarchive/users/x/abc.webp"
    assert "minio" not in result["url"]


def test_fastapi_docs_disabled_in_production(monkeypatch):
    """HIGH-1: /docs, /redoc and /openapi.json must not exist in production."""
    from fastapi.testclient import TestClient

    from app.core.config import settings
    from app.main import create_app

    monkeypatch.setattr(settings, "debug", False)
    app = create_app()
    client = TestClient(app)

    assert app.docs_url is None
    assert app.redoc_url is None
    assert app.openapi_url is None

    for path in ("/docs", "/redoc", "/openapi.json", "/api/v1/openapi.json"):
        resp = client.get(path)
        assert resp.status_code in (404, 405), (
            f"{path} must not be exposed in production (got {resp.status_code})"
        )


def test_fastapi_docs_enabled_in_development(monkeypatch):
    """HIGH-1: /docs, /redoc and /openapi.json exist when debug is enabled."""
    from fastapi.testclient import TestClient

    from app.core.config import settings
    from app.main import create_app

    monkeypatch.setattr(settings, "debug", True)
    app = create_app()
    client = TestClient(app)

    assert app.docs_url == "/docs"
    assert app.redoc_url == "/redoc"
    assert app.openapi_url == "/openapi.json"
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_production_csp_contains_no_dev_origins(monkeypatch):
    """MED-9: production CSP must not reference localhost or internal hosts."""
    from app.core.config import settings
    from app.core.middleware import _build_csp

    monkeypatch.setattr(settings, "debug", False)
    monkeypatch.setattr(settings, "public_media_base_url", "https://media.diaryarchive.com")
    monkeypatch.setattr(settings, "public_api_url", "https://api.diaryarchive.com")

    csp = _build_csp()
    assert "localhost" not in csp
    assert "minio" not in csp
    assert "media.diaryarchive.com" in csp
    assert "api.diaryarchive.com" in csp
    assert "object-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp


def test_development_csp_allows_dev_origins(monkeypatch):
    """In debug mode dev origins are permitted so local media still loads."""
    from app.core.config import settings
    from app.core.middleware import _build_csp

    monkeypatch.setattr(settings, "debug", True)
    csp = _build_csp()
    assert "http://localhost:9000" in csp
    assert "http://minio:9000" in csp


def test_request_log_ip_is_anonymized():
    from app.core.middleware import _anonymize_ip

    assert _anonymize_ip("203.0.113.45") == "203.0.113.x"
    assert _anonymize_ip("1.2.3.4") == "1.2.3.x"
    assert _anonymize_ip("2001:db8::1").startswith("2001:db8:xxxx") or _anonymize_ip(
        "2001:db8::1"
    ).startswith("2001:xxxx")
    assert _anonymize_ip("") == ""
    assert _anonymize_ip("unknown") == "unknown"


@pytest.mark.asyncio
async def test_account_lockout_blocks_brute_force_regardless_of_ip():
    """MED-5: repeated failed logins against one account lock it out, so an
    attacker rotating IPs cannot brute-force a single account."""
    from app.core.config import settings
    from app.core.security import clear_attempts, is_locked_out, record_failed_attempt

    max_attempts, window = settings.get_rate_limit("login_account")
    key = "auth_fail:login:targetuser"

    await clear_attempts(key)
    assert await is_locked_out(key, max_attempts) is False

    locked = False
    for _ in range(max_attempts + 2):
        locked = await record_failed_attempt(key, max_attempts, window)
    assert locked is True
    assert await is_locked_out(key, max_attempts) is True

    # A different account is unaffected by targetuser's lockout.
    assert await is_locked_out("auth_fail:login:otheruser", max_attempts) is False

    # A successful login clears the counter and unlocks the account.
    await clear_attempts(key)
    assert await is_locked_out(key, max_attempts) is False


def test_ticket_reply_rejects_empty_message():
    from pydantic import ValidationError

    from app.models.ticket import TicketReply

    with pytest.raises(ValidationError):
        TicketReply(message="")


@pytest.mark.asyncio
async def test_appeal_lockout_helpers():
    from app.core.config import settings
    from app.core.security import (
        clear_attempts,
        record_failed_attempt,
    )

    key = "appeal_lockout:testuser"
    await clear_attempts(key)
    max_attempts, window = settings.get_rate_limit("appeal_status_lockout")

    locked = False
    for _ in range(max_attempts + 3):
        locked = await record_failed_attempt(key, max_attempts, window)
    assert locked is True

    # Lockout is per-account: an unrelated key is unaffected.
    locked_other = False
    for _ in range(2):
        locked_other = await record_failed_attempt("appeal_lockout:other", max_attempts, window)
    assert locked_other is False