"""PHASE 9: account data export + account deletion."""

from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import DatabaseManager
from app.main import app
from app.repositories.diary_repo import DiaryRepository
from app.repositories.user_repo import UserRepository


@pytest.fixture(autouse=True)
async def clear_db():
    db = DatabaseManager.get_db()
    for coll in (
        "users",
        "diaries",
        "comments",
        "comment_likes",
        "likes",
        "bookmarks",
        "follows",
        "notifications",
        "reports",
        "tickets",
        "achievements",
        "media",
        "refresh_tokens",
        "password_reset_tokens",
        "email_verification_tokens",
    ):
        await db[coll].delete_many({})


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_user(client: AsyncClient):
    return await _register(client, "exportuser")


async def _register(client: AsyncClient, username: str) -> dict:
    response = await client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "ValidPass123", "accepted_terms": True},
    )
    assert response.status_code == 201
    data = response.json().get("data", response.json())
    return {"id": data["id"], "username": username, "access_token": data["access_token"]}


async def _make_diary(db, user_id, privacy: str):
    now = datetime.now(UTC)
    return await DiaryRepository().create(
        {
            "user_id": user_id,
            "privacy": privacy,
            "title": "Private Diary" if privacy == "private" else "Public Diary",
            "content_html": "<p>Hi</p>" if privacy == "public" else None,
            "content_text": "Hi" if privacy == "public" else None,
            "encrypted_data": {"iv": "aa", "salt": "bb", "ciphertext": "cc"},
            "tags": [],
            "emotion": None,
            "comments_enabled": True,
            "comments_locked": False,
            "stats": {"like_count": 0, "comment_count": 0, "bookmark_count": 0},
            "year": now.year,
            "month": now.month,
            "created_at": now,
            "updated_at": now,
            "published_at": now if privacy == "public" else None,
        }
    )


class TestDataExport:
    async def test_export_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/users/me/export")
        assert response.status_code == 401

    async def test_export_empty(self, client: AsyncClient, auth_user):
        response = await client.get(
            "/api/v1/users/me/export",
            headers={"Authorization": f"Bearer {auth_user['access_token']}"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["profile"]["username"] == "exportuser"
        assert data["diaries"] == []
        assert data["comments"] == []
        assert data["likes"] == []

    async def test_export_includes_diaries_and_comments(self, client: AsyncClient, auth_user):
        db = DatabaseManager.get_db()
        from bson import ObjectId

        uid = ObjectId(auth_user["id"])
        await _make_diary(db, uid, "public")
        await _make_diary(db, uid, "private")

        await db.comments.insert_one(
            {
                "user_id": uid,
                "diary_id": ObjectId(),
                "content": "my comment",
                "is_deleted": False,
                "parent_comment_id": None,
                "created_at": datetime.now(UTC),
            }
        )

        response = await client.get(
            "/api/v1/users/me/export",
            headers={"Authorization": f"Bearer {auth_user['access_token']}"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data["diaries"]) == 2
        priv = next(d for d in data["diaries"] if d["privacy"] == "private")
        assert priv["encrypted_data"]["ciphertext"] == "cc"
        assert len(data["comments"]) == 1
        assert data["comments"][0]["content"] == "my comment"


class TestAccountDeletion:
    async def test_delete_requires_auth(self, client: AsyncClient):
        response = await client.delete("/api/v1/users/me")
        assert response.status_code == 401

    async def test_delete_removes_user_and_related_data(self, client: AsyncClient, auth_user):
        db = DatabaseManager.get_db()
        from bson import ObjectId

        uid = ObjectId(auth_user["id"])

        await _make_diary(db, uid, "public")
        await db.likes.insert_one({"user_id": uid, "diary_id": ObjectId()})
        await db.follows.insert_one({"follower_id": uid, "following_id": ObjectId()})
        await db.follows.insert_one({"follower_id": ObjectId(), "following_id": uid})
        await db.notifications.insert_one({"user_id": uid, "actor_id": ObjectId(), "type": "like"})
        await db.notifications.insert_one({"actor_id": uid, "type": "follow"})
        await db.tickets.insert_one({"user_id": uid, "category": "account_help", "status": "open"})
        await db.achievements.insert_one({"user_id": uid, "code": "first_diary"})

        response = await client.delete(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {auth_user['access_token']}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["data"]["deleted"] is True

        repo = UserRepository()
        user = await repo.get_by_id(auth_user["id"])
        assert user is None

        assert await db.diaries.count_documents({"user_id": uid}) == 0
        assert await db.likes.count_documents({"user_id": uid}) == 0
        assert await db.follows.count_documents({"follower_id": uid}) == 0
        assert await db.follows.count_documents({"following_id": uid}) == 0
        assert await db.notifications.count_documents({"user_id": uid}) == 0
        assert await db.notifications.count_documents({"actor_id": uid}) == 0
        assert await db.tickets.count_documents({"user_id": uid}) == 0
        assert await db.achievements.count_documents({"user_id": uid}) == 0

    async def test_delete_then_profile_404(self, client: AsyncClient, auth_user):
        await client.delete(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {auth_user['access_token']}"},
        )
        response = await client.get(f"/api/v1/users/{auth_user['username']}")
        assert response.status_code == 404
