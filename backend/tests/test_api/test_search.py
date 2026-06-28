import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import DatabaseManager
from app.main import app
from app.search.indexer import DiaryIndexer


@pytest.fixture(autouse=True)
async def clear_db():
    db = DatabaseManager.get_db()
    await db.users.delete_many({})
    await db.diaries.delete_many({})
    await db.comments.delete_many({})
    await db.likes.delete_many({})
    await db.bookmarks.delete_many({})
    await db.follows.delete_many({})
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
        json={"username": "searchuser", "password": "ValidPass123"},
    )
    assert response.status_code == 201
    data = response.json().get("data", response.json())
    return data["access_token"]


@pytest.fixture
async def public_diary(client: AsyncClient, auth_token: str):
    response = await client.post(
        "/api/v1/diaries",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={
            "privacy": "public",
            "title": "Rainy Day Thoughts",
            "content_html": "<p>A walk in the rain</p>",
            "content_text": "A walk in the rain",
            "tags": ["life", "weather"],
            "emotion": "reflective",
        },
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


class TestSearch:
    async def test_search_endpoint_accessible(self, client: AsyncClient):
        response = await client.get("/api/v1/search")
        assert response.status_code == 200
        body = response.json()
        assert "data" in body
        assert "meta" in body
        assert body["meta"]["total"] == 0

    async def test_search_no_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/search?q=test")
        assert response.status_code == 200


class TestTagsPopular:
    async def test_popular_tags(self, client: AsyncClient):
        response = await client.get("/api/v1/tags/popular?limit=10")
        assert response.status_code == 200
        body = response.json()
        assert "data" in body
        assert isinstance(body["data"], list)

    async def test_popular_tags_limit(self, client: AsyncClient):
        response = await client.get("/api/v1/tags/popular?limit=5")
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) <= 5


class TestEmotions:
    async def test_emotions(self, client: AsyncClient):
        response = await client.get("/api/v1/emotions")
        assert response.status_code == 200
        body = response.json()
        assert "data" in body
        assert isinstance(body["data"], list)

    async def test_emotions_include_all_valid(self, client: AsyncClient):
        from app.models.diary import VALID_EMOTIONS
        response = await client.get("/api/v1/emotions")
        body = response.json()
        returned = {e["emotion"] for e in body["data"]}
        for em in VALID_EMOTIONS:
            assert em in returned


class TestSearchWithInvalidToken:
    async def test_search_with_invalid_token_falls_back_anonymous(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/search?q=test",
            headers={"Authorization": "Bearer invalid-token-that-cannot-be-decoded"},
        )
        assert response.status_code == 200

    async def test_search_with_expired_token(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/search?q=test",
            headers={"Authorization": "Bearer this-is-a-fake-token-for-testing"},
        )
        assert response.status_code == 200


class TestSearchGracefulDegradation:
    async def test_search_returns_empty_when_no_results(self, client: AsyncClient):
        response = await client.get("/api/v1/search?q=nonexistenttermxyz123")
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 0
        assert "meta" in body
