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
    await db.comments.delete_many({})
    await db.likes.delete_many({})
    await db.bookmarks.delete_many({})
    await db.refresh_tokens.delete_many({})


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_token(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={"username": "diaryauthor", "password": "ValidPass123"},
    )
    assert response.status_code == 201
    data = response.json().get("data", response.json())
    return data["access_token"]


@pytest.fixture
async def auth_user(auth_token):
    repo = UserRepository()
    user = await repo.get_by_username("diaryauthor")
    return {"id": str(user["_id"]), "token": auth_token}


class TestCreateDiary:
    async def test_create_public_diary(self, client: AsyncClient, auth_token: str):
        response = await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "privacy": "public",
                "title": "My First Diary",
                "content_html": "<p>Hello world</p>",
                "content_text": "Hello world",
                "tags": ["life", "first"],
                "emotion": "hopeful",
                "comments_enabled": True,
            },
        )
        assert response.status_code == 201
        data = response.json()["data"]
        assert "id" in data
        assert data["message"] == "Diary created successfully."

        repo = UserRepository()
        user = await repo.get_by_username("diaryauthor")
        assert user["stats"]["diary_count"] == 1

    async def test_create_diary_banned_user(
        self, client: AsyncClient, auth_token: str
    ):
        repo = UserRepository()
        user = await repo.get_by_username("diaryauthor")
        await repo.update(str(user["_id"]), {"is_banned": True})

        response = await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"title": "Should fail", "content_text": "test"},
        )
        assert response.status_code == 403

    async def test_create_diary_unauthorized(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/diaries",
            json={"title": "No auth", "content_text": "test"},
        )
        assert response.status_code == 401

    async def test_create_diary_validation(self, client: AsyncClient, auth_token: str):
        response = await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"title": "", "content_text": ""},
        )
        assert response.status_code == 422


class TestGetDiary:
    async def test_get_diary_by_id(self, client: AsyncClient, auth_token: str):
        create_resp = await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "title": "A Public Diary",
                "content_html": "<p>Content here</p>",
                "content_text": "Content here",
                "tags": ["test"],
            },
        )
        diary_id = create_resp.json()["data"]["id"]

        response = await client.get(f"/api/v1/diaries/{diary_id}")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["title"] == "A Public Diary"
        assert data["content_html"] == "<p>Content here</p>"
        assert data["author"]["username"] == "diaryauthor"
        assert data["tags"] == ["test"]
        assert data["is_owner"] is False

    async def test_get_diary_not_found(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/diaries/aaaaaaaaaaaaaaaaaaaaaaaa"
        )
        assert response.status_code == 404


class TestUpdateDiary:
    async def test_update_diary_owner(self, client: AsyncClient, auth_token: str):
        create_resp = await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "title": "Original Title",
                "content_html": "<p>Original</p>",
                "content_text": "Original",
                "tags": ["old"],
            },
        )
        diary_id = create_resp.json()["data"]["id"]

        response = await client.put(
            f"/api/v1/diaries/{diary_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"title": "Updated Title", "tags": ["new"]},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["title"] == "Updated Title"
        assert data["tags"] == ["new"]

    async def test_update_diary_non_owner(
        self, client: AsyncClient, auth_token: str
    ):
        create_resp = await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"title": "First", "content_text": "First"},
        )
        diary_id = create_resp.json()["data"]["id"]

        await client.post(
            "/api/v1/auth/register",
            json={"username": "otherperson", "password": "OtherPass123"},
        )
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "otherperson", "password": "OtherPass123"},
        )
        other_token = login_resp.json()["data"]["access_token"]

        response = await client.put(
            f"/api/v1/diaries/{diary_id}",
            headers={"Authorization": f"Bearer {other_token}"},
            json={"title": "Hacked"},
        )
        assert response.status_code == 403


class TestDeleteDiary:
    async def test_delete_diary(self, client: AsyncClient, auth_token: str):
        create_resp = await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"title": "To Delete", "content_text": "Bye"},
        )
        diary_id = create_resp.json()["data"]["id"]

        response = await client.delete(
            f"/api/v1/diaries/{diary_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 204

        repo = UserRepository()
        user = await repo.get_by_username("diaryauthor")
        assert user["stats"]["diary_count"] == 0


class TestListDiaries:
    async def test_list_public_diaries(self, client: AsyncClient, auth_token: str):
        for i in range(3):
            await client.post(
                "/api/v1/diaries",
                headers={"Authorization": f"Bearer {auth_token}"},
                json={
                    "title": f"Diary {i}",
                    "content_text": f"Content {i}",
                    "tags": ["life"],
                    "emotion": "happy",
                },
            )

        response = await client.get("/api/v1/diaries?page=1&per_page=20")
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 3
        assert body["meta"]["total"] == 3
        assert body["meta"]["has_next"] is False

    async def test_list_diaries_filter_tags(
        self, client: AsyncClient, auth_token: str
    ):
        await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "title": "Life Entry",
                "content_text": "Life",
                "tags": ["life"],
            },
        )
        await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "title": "Travel Entry",
                "content_text": "Travel",
                "tags": ["travel"],
            },
        )

        response = await client.get("/api/v1/diaries?tags=life")
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 1
        assert body["data"][0]["title"] == "Life Entry"

    async def test_list_diaries_filter_emotion(
        self, client: AsyncClient, auth_token: str
    ):
        await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "title": "Happy entry",
                "content_text": "Happy",
                "emotion": "happy",
            },
        )
        await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "title": "Sad entry",
                "content_text": "Sad",
                "emotion": "sad",
            },
        )

        response = await client.get("/api/v1/diaries?emotion=sad")
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 1
        assert body["data"][0]["title"] == "Sad entry"

    async def test_list_diaries_filter_year_month(
        self, client: AsyncClient, auth_token: str
    ):
        create_resp = await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"title": "June 2026", "content_text": "test"},
        )
        diary_id = create_resp.json()["data"]["id"]

        now_year = 2026
        now_month = 6

        response = await client.get(
            f"/api/v1/diaries?year={now_year}&month={now_month}"
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) >= 1


class TestRandomDiary:
    async def test_random_diary(self, client: AsyncClient, auth_token: str):
        await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"title": "Random test", "content_text": "test"},
        )

        response = await client.get("/api/v1/diaries/random")
        assert response.status_code == 200
        data = response.json()["data"]
        assert "id" in data
        assert "content_html" in data


class TestHTMLSanitization:
    async def test_html_sanitization(self, client: AsyncClient, auth_token: str):
        response = await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "title": "Safe",
                "content_html": '<p>Hello</p><script>alert("xss")</script>',
                "content_text": "Hello",
            },
        )
        assert response.status_code == 201
        diary_id = response.json()["data"]["id"]

        get_resp = await client.get(f"/api/v1/diaries/{diary_id}")
        html = get_resp.json()["data"]["content_html"]
        assert "<p>Hello</p>" in html
        assert "<script>" not in html

    async def test_diary_xss_prevention(self, client: AsyncClient, auth_token: str):
        response = await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "title": "XSS test",
                "content_html": '<img src=x onerror="alert(1)">',
                "content_text": "test",
            },
        )
        assert response.status_code == 201
        diary_id = response.json()["data"]["id"]

        get_resp = await client.get(f"/api/v1/diaries/{diary_id}")
        html = get_resp.json()["data"]["content_html"]
        assert "onerror" not in html


class TestMyDiaries:
    async def test_my_diaries_list(self, client: AsyncClient, auth_token: str):
        await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"title": "Public one", "content_text": "test", "privacy": "public"},
        )
        await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"title": "Draft one", "content_text": "test", "privacy": "draft"},
        )

        response = await client.get(
            "/api/v1/me/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["meta"]["total"] == 2

        draft_resp = await client.get(
            "/api/v1/me/diaries?privacy=draft",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert draft_resp.json()["meta"]["total"] == 1
