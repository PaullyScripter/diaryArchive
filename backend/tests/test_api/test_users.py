import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import DatabaseManager
from app.main import app
from app.repositories.user_repo import UserRepository


@pytest.fixture(autouse=True)
async def clear_db():
    db = DatabaseManager.get_db()
    await db.users.delete_many({})
    await db.diaries.delete_many({})
    await db.refresh_tokens.delete_many({})


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_user(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={"username": "profileuser", "password": "ValidPass123"},
    )
    assert response.status_code == 201
    data = response.json()
    content = data.get("data", data)
    return {
        "id": content.get("id"),
        "username": "profileuser",
        "access_token": content.get("access_token"),
    }


@pytest.fixture
async def auth_token(auth_user):
    return auth_user["access_token"]


class TestGetProfile:
    async def test_get_profile_success(self, client: AsyncClient, auth_user: dict):
        response = await client.get(f"/api/v1/users/{auth_user['username']}")
        assert response.status_code == 200
        body = response.json()
        data = body.get("data", body)
        assert data["username"] == "profileuser"
        assert data["id"] == auth_user["id"]
        assert "avatar_path" in data
        assert "about" in data
        assert "favorite_quote" in data
        assert "currently_feeling" in data
        assert "stats" in data
        assert data["stats"]["diary_count"] == 0
        assert data["stats"]["follower_count"] == 0
        assert data["stats"]["following_count"] == 0
        assert "created_at" in data
        assert data["is_following"] is False
        assert "email_encrypted" not in data
        assert "email_hash" not in data
        assert "password_hash" not in data
        assert "is_admin" not in data
        assert "preferences" not in data

    async def test_get_profile_not_found(self, client: AsyncClient):
        response = await client.get("/api/v1/users/nonexistentuser")
        assert response.status_code == 404
        body = response.json()
        error = body.get("error", body)
        assert "not found" in error.get("message", "").lower()

    async def test_get_profile_banned(self, client: AsyncClient, auth_user: dict):
        repo = UserRepository()
        user = await repo.get_by_username("profileuser")
        await repo.update(str(user["_id"]), {"is_banned": True})

        response = await client.get(f"/api/v1/users/{auth_user['username']}")
        assert response.status_code == 403
        body = response.json()
        error = body.get("error", body)
        assert "suspended" in error.get("message", "").lower()

    async def test_get_profile_is_following_flag_when_authenticated(
        self, client: AsyncClient, auth_token: str, auth_user: dict
    ):
        response = await client.get(
            f"/api/v1/users/{auth_user['username']}",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["is_following"] is False


class TestUpdateProfile:
    async def test_update_profile_full(self, client: AsyncClient, auth_token: str):
        response = await client.put(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "about": "Test bio for profile update",
                "favorite_quote": "To be or not to be",
                "currently_feeling": "confident",
            },
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["about"] == "Test bio for profile update"
        assert data["favorite_quote"] == "To be or not to be"
        assert data["currently_feeling"] == "confident"

        profile_resp = await client.get("/api/v1/users/profileuser")
        assert profile_resp.status_code == 200
        profile = profile_resp.json()["data"]
        assert profile["about"] == "Test bio for profile update"
        assert profile["favorite_quote"] == "To be or not to be"

    async def test_update_profile_partial(self, client: AsyncClient, auth_token: str):
        await client.put(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"about": "First pass"},
        )

        response = await client.put(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"currently_feeling": "tired"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["about"] == "First pass"
        assert data["currently_feeling"] == "tired"

    async def test_update_profile_unauthorized(self, client: AsyncClient):
        response = await client.put(
            "/api/v1/users/me",
            json={"about": "Should fail"},
        )
        assert response.status_code == 401

    async def test_update_profile_about_too_long(self, client: AsyncClient, auth_token: str):
        response = await client.put(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"about": "x" * 501},
        )
        assert response.status_code == 422

    async def test_update_profile_invalid_theme(self, client: AsyncClient, auth_token: str):
        response = await client.put(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"preferences": {"theme": "neon"}},
        )
        assert response.status_code == 422


class TestUpdateEmail:
    async def test_add_email(self, client: AsyncClient, auth_token: str, auth_user: dict):
        response = await client.put(
            "/api/v1/users/me/email",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"email": "test@diaryarchive.com"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["has_email"] is True
        assert data["email_verified"] is False
        assert "message" in data

        repo = UserRepository()
        user = await repo.get_by_username("profileuser")
        assert user.get("email_encrypted") is not None
        assert user.get("email_hash") is not None
        assert user.get("email_encrypted") != "test@diaryarchive.com"

    async def test_remove_email(self, client: AsyncClient, auth_token: str):
        await client.put(
            "/api/v1/users/me/email",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"email": "temp@test.com"},
        )

        response = await client.put(
            "/api/v1/users/me/email",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"email": None},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["has_email"] is False

        repo = UserRepository()
        user = await repo.get_by_username("profileuser")
        assert user.get("email_encrypted") is None
        assert user.get("email_hash") is None

    async def test_duplicate_email(self, client: AsyncClient, auth_token: str):
        await client.put(
            "/api/v1/users/me/email",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"email": "dup@test.com"},
        )

        await client.post(
            "/api/v1/auth/register",
            json={"username": "otheruser", "password": "OtherPass123"},
        )
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "otheruser", "password": "OtherPass123"},
        )
        other_token = login_resp.json()["data"]["access_token"]

        response = await client.put(
            "/api/v1/users/me/email",
            headers={"Authorization": f"Bearer {other_token}"},
            json={"email": "dup@test.com"},
        )
        assert response.status_code == 409

    async def test_email_unauthorized(self, client: AsyncClient):
        response = await client.put(
            "/api/v1/users/me/email",
            json={"email": "test@test.com"},
        )
        assert response.status_code == 401

    async def test_invalid_email_format(self, client: AsyncClient, auth_token: str):
        response = await client.put(
            "/api/v1/users/me/email",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"email": "not-an-email"},
        )
        assert response.status_code == 422


class TestGetUserDiaries:
    async def test_get_user_diaries_empty(self, client: AsyncClient, auth_user: dict):
        response = await client.get(f"/api/v1/users/{auth_user['username']}/diaries")
        assert response.status_code == 200
        body = response.json()
        data = body.get("data", body)
        assert isinstance(data, list)
        assert len(data) == 0
        meta = body.get("meta", {})
        assert meta.get("total") == 0
        assert meta.get("page") == 1

    async def test_get_user_diaries_nonexistent_user(self, client: AsyncClient):
        response = await client.get("/api/v1/users/nobody/diaries")
        assert response.status_code == 404

    async def test_get_user_diaries_pagination(self, client: AsyncClient, auth_token: str):
        from app.repositories.diary_repo import DiaryRepository
        from app.repositories.user_repo import UserRepository
        from datetime import UTC, datetime

        user_repo = UserRepository()
        user = await user_repo.get_by_username("profileuser")
        user_id = str(user["_id"])

        diary_repo = DiaryRepository()
        now = datetime.now(UTC)
        for i in range(25):
            await diary_repo.create({
                "user_id": user["_id"],
                "privacy": "public",
                "title": f"Test Diary {i}",
                "content_html": f"<p>Content {i}</p>",
                "content_text": f"Content {i}",
                "tags": ["test"],
                "emotion": None,
                "comments_enabled": True,
                "comments_locked": False,
                "stats": {"like_count": 0, "comment_count": 0, "bookmark_count": 0},
                "year": now.year,
                "month": now.month,
                "created_at": now,
                "updated_at": now,
                "published_at": now,
            })

        page1 = await client.get(
            f"/api/v1/users/profileuser/diaries?page=1&per_page=20"
        )
        assert page1.status_code == 200
        body1 = page1.json()
        assert len(body1["data"]) == 20
        assert body1["meta"]["total"] == 25
        assert body1["meta"]["has_next"] is True

        page2 = await client.get(
            f"/api/v1/users/profileuser/diaries?page=2&per_page=20"
        )
        assert page2.status_code == 200
        body2 = page2.json()
        assert len(body2["data"]) == 5
        assert body2["meta"]["has_next"] is False

    async def test_get_user_diaries_excludes_private(
        self, client: AsyncClient, auth_token: str
    ):
        from app.repositories.diary_repo import DiaryRepository
        from app.repositories.user_repo import UserRepository
        from datetime import UTC, datetime

        user_repo = UserRepository()
        user = await user_repo.get_by_username("profileuser")

        diary_repo = DiaryRepository()
        now = datetime.now(UTC)
        await diary_repo.create({
            "user_id": user["_id"],
            "privacy": "public",
            "title": "Visible Diary",
            "content_html": "<p>Hi</p>",
            "content_text": "Hi",
            "tags": [],
            "emotion": None,
            "comments_enabled": True,
            "comments_locked": False,
            "stats": {"like_count": 0, "comment_count": 0, "bookmark_count": 0},
            "year": now.year,
            "month": now.month,
            "created_at": now,
            "updated_at": now,
            "published_at": now,
        })
        await diary_repo.create({
            "user_id": user["_id"],
            "privacy": "private",
            "title": None,
            "content_html": None,
            "content_text": None,
            "encrypted_data": {"iv": "aa", "salt": "bb", "ciphertext": "cc"},
            "tags": [],
            "emotion": None,
            "comments_enabled": False,
            "comments_locked": False,
            "stats": {"like_count": 0, "comment_count": 0, "bookmark_count": 0},
            "year": now.year,
            "month": now.month,
            "created_at": now,
            "updated_at": now,
            "published_at": None,
        })

        response = await client.get("/api/v1/users/profileuser/diaries")
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 1
        assert body["meta"]["total"] == 1
        assert body["data"][0]["title"] == "Visible Diary"
