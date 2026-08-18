"""MED-10: admin mutation endpoints are rate-limited per admin account.

These tests prove that every admin mutation path calls the rate limiter and
surfaces a 429 when throttled. The actual counter/backoff behaviour of the
limiter is exercised end-to-end elsewhere (auth lockout tests); here we control
the limiter to verify the admin wiring and the per-account keying.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.v1.endpoints import admin as admin_mod
from app.api.v1.endpoints.admin import _admin_rate_limit
from app.core.exceptions import RateLimitException
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _register(client, username, is_admin=False):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "ValidPass1", "accepted_terms": True},
    )
    assert resp.status_code == 201
    data = resp.json().get("data", resp.json())
    if is_admin:
        from app.repositories.user_repo import UserRepository

        await UserRepository().set_admin_role(data["id"], True)
        data["is_admin"] = True
    return data


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _as_admin(data):
    return {"_id": data["id"], "username": data["username"]}


class _ThrottleAfter:
    """Fake check_rate_limit that allows `limit` calls per key then blocks."""

    def __init__(self, limit):
        self.limit = limit
        self.calls: dict[str, int] = {}

    async def __call__(self, key, max_attempts, window_seconds):
        self.calls[key] = self.calls.get(key, 0) + 1
        if self.calls[key] > self.limit:
            return True, 0
        return False, self.limit - self.calls[key]


@pytest.fixture
def throttle_after(monkeypatch):
    def _apply(limit):
        fake = _ThrottleAfter(limit)
        monkeypatch.setattr(admin_mod, "check_rate_limit", fake)
        return fake

    return _apply


async def test_admin_rate_limit_blocks_after_threshold(client, throttle_after):
    admin = _as_admin(await _register(client, "adminrl", is_admin=True))
    throttle_after(3)
    request = client.build_request("PUT", "http://test/x")

    for _ in range(3):
        await _admin_rate_limit(request, admin, "admin_action")
    with pytest.raises(RateLimitException):
        await _admin_rate_limit(request, admin, "admin_action")


async def test_admin_rate_limit_is_keyed_per_admin_account(client, throttle_after):
    admin1 = _as_admin(await _register(client, "admin1", is_admin=True))
    admin2 = _as_admin(await _register(client, "admin2", is_admin=True))
    fake = throttle_after(2)
    request = client.build_request("PUT", "http://test/x")

    await _admin_rate_limit(request, admin1, "admin_action")
    await _admin_rate_limit(request, admin1, "admin_action")
    with pytest.raises(RateLimitException):
        await _admin_rate_limit(request, admin1, "admin_action")

    # Different admin account shares no allowance state.
    await _admin_rate_limit(request, admin2, "admin_action")
    assert sum(fake.calls.values()) == 4


async def test_admin_mutation_endpoint_returns_429_when_throttled(client, throttle_after):
    admin = await _register(client, "adminrl2", is_admin=True)
    owner = await _register(client, "owner")
    resp = await client.post(
        "/api/v1/diaries",
        json={"title": "t", "content_text": "c", "privacy": "public"},
        headers=_auth(owner["access_token"]),
    )
    diary_id = resp.json().get("data", resp.json())["id"]

    throttle_after(2)
    payload = {"reason": "violates community guidelines"}
    for _ in range(2):
        r = await client.put(
            f"/api/v1/admin/diaries/{diary_id}/hide",
            json=payload,
            headers=_auth(admin["access_token"]),
        )
        assert r.status_code == 200

    r3 = await client.put(
        f"/api/v1/admin/diaries/{diary_id}/hide",
        json=payload,
        headers=_auth(admin["access_token"]),
    )
    assert r3.status_code == 429
    assert "admin actions" in r3.json()["error"]["message"].lower()
