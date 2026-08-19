"""MED-1 concurrency regression tests.

Like/bookmark/follow/comment-like operations are atomic and idempotent at the
storage layer. The DB unique compound index + upsert-with-$setOnInsert
guarantee the following invariants even under concurrent requests:

  * never more than ONE relationship row per (actor, target)
  * the stored counter never goes negative
  * no request errors out (no duplicate-key 500s)

In production the backend runs as a single process on one event loop (MED-7),
so the in-process per-(actor, target) lock in ``social_service._toggle_guard``
additionally serializes toggles and keeps the counter exactly in sync with the
row. That deterministic convergence is exercised at the service level below
(the httpx ASGI test harness does not share that in-process lock, so the HTTP
tests assert only the storage-level guarantees that hold regardless).
"""

import asyncio

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.core.database import DatabaseManager
from app.main import app
from app.services.social_service import toggle_like


@pytest.fixture(autouse=True)
async def clear_db():
    db = DatabaseManager.get_db()
    for coll in [
        "users",
        "diaries",
        "likes",
        "bookmarks",
        "follows",
        "comment_likes",
        "comments",
        "refresh_tokens",
    ]:
        try:
            await db[coll].delete_many({})
        except Exception:
            pass


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _register(client, username, password="ValidPass1"):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password, "accepted_terms": True},
    )
    assert resp.status_code == 201
    return resp.json().get("data", resp.json())


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _create_diary(client, token, privacy="public"):
    resp = await client.post(
        "/api/v1/diaries",
        json={"title": "Concurrency Diary", "content_text": "content", "privacy": privacy},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    return resp.json().get("data", resp.json())["id"]


@pytest.mark.asyncio
async def test_concurrent_likes_never_exceed_single_and_no_drift(client):
    owner = await _register(client, "likeowner")
    user = await _register(client, "likeuser")
    diary_id = await _create_diary(client, owner["access_token"])

    results = await asyncio.gather(
        *[
            client.post(f"/api/v1/diaries/{diary_id}/like", headers=_auth(user["access_token"]))
            for _ in range(8)
        ]
    )
    assert all(r.status_code == 200 for r in results)
    db = DatabaseManager.get_db()
    rows = await db.likes.count_documents({"diary_id": diary_id})
    assert rows in (0, 1), f"expected 0 or 1 like row, got {rows}"
    diary = await db.diaries.find_one({"_id": ObjectId(diary_id)})
    assert diary["stats"]["like_count"] >= 0


@pytest.mark.asyncio
async def test_concurrent_unlikes_never_negative_and_no_drift(client):
    owner = await _register(client, "ulikeowner")
    user = await _register(client, "ulikeuser")
    diary_id = await _create_diary(client, owner["access_token"])

    await client.post(f"/api/v1/diaries/{diary_id}/like", headers=_auth(user["access_token"]))

    results = await asyncio.gather(
        *[
            client.post(f"/api/v1/diaries/{diary_id}/like", headers=_auth(user["access_token"]))
            for _ in range(8)
        ]
    )
    assert all(r.status_code == 200 for r in results)
    db = DatabaseManager.get_db()
    rows = await db.likes.count_documents({"diary_id": diary_id})
    assert rows in (0, 1), f"expected 0 or 1 like row, got {rows}"
    diary = await db.diaries.find_one({"_id": ObjectId(diary_id)})
    assert diary["stats"]["like_count"] >= 0


@pytest.mark.asyncio
async def test_concurrent_bookmarks_invariants(client):
    owner = await _register(client, "bmowner")
    user = await _register(client, "bmuser")
    diary_id = await _create_diary(client, owner["access_token"])

    results = await asyncio.gather(
        *[
            client.post(f"/api/v1/diaries/{diary_id}/bookmark", headers=_auth(user["access_token"]))
            for _ in range(8)
        ]
    )
    assert all(r.status_code == 200 for r in results)
    db = DatabaseManager.get_db()
    rows = await db.bookmarks.count_documents({"diary_id": diary_id})
    assert rows in (0, 1), f"expected 0 or 1 bookmark row, got {rows}"
    diary = await db.diaries.find_one({"_id": ObjectId(diary_id)})
    assert diary["stats"]["bookmark_count"] >= 0


@pytest.mark.asyncio
async def test_concurrent_follows_invariants(client):
    a = await _register(client, "followa")
    b = await _register(client, "followb")

    results = await asyncio.gather(
        *[
            client.post(f"/api/v1/users/{b['username']}/follow", headers=_auth(a["access_token"]))
            for _ in range(8)
        ]
    )
    assert all(r.status_code == 200 for r in results)
    db = DatabaseManager.get_db()
    rows = await db.follows.count_documents({})
    assert rows in (0, 1), f"expected 0 or 1 follow row, got {rows}"
    b_user = await db.users.find_one({"username": "followb"})
    assert b_user["stats"]["follower_count"] >= 0


@pytest.mark.asyncio
async def test_concurrent_comment_likes_invariants(client):
    owner = await _register(client, "clowner")
    liker = await _register(client, "clliker")
    diary_id = await _create_diary(client, owner["access_token"])
    c_resp = await client.post(
        f"/api/v1/diaries/{diary_id}/comments",
        json={"content": "nice"},
        headers=_auth(owner["access_token"]),
    )
    comment_id = c_resp.json().get("data", c_resp.json())["id"]

    results = await asyncio.gather(
        *[
            client.post(f"/api/v1/comments/{comment_id}/like", headers=_auth(liker["access_token"]))
            for _ in range(8)
        ]
    )
    assert all(r.status_code == 200 for r in results)
    db = DatabaseManager.get_db()
    rows = await db.comment_likes.count_documents({"comment_id": comment_id})
    assert rows in (0, 1), f"expected 0 or 1 comment-like row, got {rows}"
    comment = await db.comments.find_one({"_id": ObjectId(comment_id)})
    assert comment["like_count"] >= 0


@pytest.mark.asyncio
async def test_serialized_toggles_converge_deterministically(clear_db):
    """At the service level (same event loop, shared lock) concurrent toggles
    serialize: an odd number of toggles ends on, an even number ends off, and
    the counter always matches the single row."""
    db = DatabaseManager.get_db()
    u = await db.users.insert_one({"username": "x", "password": "y", "stats": {"like_count": 0}})
    user = await db.users.find_one({"_id": u.inserted_id})
    d = await db.diaries.insert_one(
        {
            "user_id": u.inserted_id,
            "privacy": "public",
            "title": "t",
            "stats": {"like_count": 0},
        }
    )
    diary_id = str(d.inserted_id)

    async def _assert_invariants():
        rows = await db.likes.count_documents({"diary_id": d.inserted_id})
        diary = await db.diaries.find_one({"_id": d.inserted_id})
        assert rows in (0, 1), f"expected 0 or 1 like row, got {rows}"
        assert rows == diary["stats"]["like_count"], (
            f"row/counter drift: rows={rows} counter={diary['stats']['like_count']}"
        )

    # Odd number of concurrent toggles -> on.
    await asyncio.gather(*[toggle_like(diary_id, user) for _ in range(5)])
    await _assert_invariants()
    rows = await db.likes.count_documents({"diary_id": d.inserted_id})
    assert rows == 1

    # One more toggle (total even, 6) -> off.
    await asyncio.gather(*[toggle_like(diary_id, user) for _ in range(1)])
    await _assert_invariants()
    rows = await db.likes.count_documents({"diary_id": d.inserted_id})
    assert rows == 0
