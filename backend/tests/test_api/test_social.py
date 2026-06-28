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
        json={"username": "testuser", "password": "ValidPass123"},
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
            "title": "Test Diary",
            "content_html": "<p>Hello world</p>",
            "content_text": "Hello world",
            "tags": ["test"],
            "comments_enabled": True,
        },
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


class TestComments:
    async def test_create_comment(self, client: AsyncClient, auth_token: str, public_diary: str):
        response = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Great diary!"},
        )
        assert response.status_code == 201
        data = response.json()["data"]
        assert data["content"] == "Great diary!"
        assert data["is_deleted"] is False

    async def test_create_comment_empty_content(self, client: AsyncClient, auth_token: str, public_diary: str):
        response = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": ""},
        )
        assert response.status_code == 422

    async def test_create_comment_no_auth(self, client: AsyncClient, public_diary: str):
        response = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            json={"content": "Nice!"},
        )
        assert response.status_code == 401

    async def test_list_comments(self, client: AsyncClient, auth_token: str, public_diary: str):
        await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "First comment"},
        )
        response = await client.get(f"/api/v1/diaries/{public_diary}/comments")
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 1
        assert body["data"][0]["content"] == "First comment"

    async def test_delete_comment_as_author(self, client: AsyncClient, auth_token: str, public_diary: str):
        create_resp = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "To be deleted"},
        )
        comment_id = create_resp.json()["data"]["id"]

        response = await client.delete(
            f"/api/v1/diaries/{public_diary}/comments/{comment_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 204

        list_resp = await client.get(f"/api/v1/diaries/{public_diary}/comments")
        comments = list_resp.json()["data"]
        assert len(comments) == 0

    async def test_comment_count_incremented(self, client: AsyncClient, auth_token: str, public_diary: str):
        await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Comment 1"},
        )
        diary_resp = await client.get(f"/api/v1/diaries/{public_diary}")
        diary = diary_resp.json()["data"]
        assert diary["stats"]["comment_count"] == 1


class TestLikes:
    async def test_toggle_like_add(self, client: AsyncClient, auth_token: str, public_diary: str):
        response = await client.post(
            f"/api/v1/diaries/{public_diary}/like",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["is_liked"] is True
        assert data["like_count"] == 1

    async def test_toggle_like_remove(self, client: AsyncClient, auth_token: str, public_diary: str):
        await client.post(
            f"/api/v1/diaries/{public_diary}/like",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        response = await client.post(
            f"/api/v1/diaries/{public_diary}/like",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        data = response.json()["data"]
        assert data["is_liked"] is False
        assert data["like_count"] == 0

    async def test_like_no_auth(self, client: AsyncClient, public_diary: str):
        response = await client.post(f"/api/v1/diaries/{public_diary}/like")
        assert response.status_code == 401

    async def test_is_liked_in_diary_response(self, client: AsyncClient, auth_token: str, public_diary: str):
        await client.post(
            f"/api/v1/diaries/{public_diary}/like",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        response = await client.get(
            f"/api/v1/diaries/{public_diary}",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        diary = response.json()["data"]
        assert diary["is_liked"] is True


class TestBookmarks:
    async def test_toggle_bookmark_add(self, client: AsyncClient, auth_token: str, public_diary: str):
        response = await client.post(
            f"/api/v1/diaries/{public_diary}/bookmark",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["is_bookmarked"] is True
        assert data["bookmark_count"] == 1

    async def test_toggle_bookmark_remove(self, client: AsyncClient, auth_token: str, public_diary: str):
        await client.post(
            f"/api/v1/diaries/{public_diary}/bookmark",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        response = await client.post(
            f"/api/v1/diaries/{public_diary}/bookmark",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        data = response.json()["data"]
        assert data["is_bookmarked"] is False
        assert data["bookmark_count"] == 0

    async def test_my_bookmarks(self, client: AsyncClient, auth_token: str, public_diary: str):
        await client.post(
            f"/api/v1/diaries/{public_diary}/bookmark",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        response = await client.get(
            "/api/v1/me/bookmarks",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) >= 1


class TestFollows:
    async def test_toggle_follow_add(self, client: AsyncClient, auth_token: str):
        await client.post(
            "/api/v1/auth/register",
            json={"username": "targetuser", "password": "ValidPass123"},
        )
        response = await client.post(
            "/api/v1/users/targetuser/follow",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["is_following"] is True
        assert data["follower_count"] == 1

    async def test_toggle_follow_remove(self, client: AsyncClient, auth_token: str):
        await client.post(
            "/api/v1/auth/register",
            json={"username": "targetuser2", "password": "ValidPass123"},
        )
        await client.post(
            "/api/v1/users/targetuser2/follow",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        response = await client.post(
            "/api/v1/users/targetuser2/follow",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        data = response.json()["data"]
        assert data["is_following"] is False

    async def test_self_follow_prevented(self, client: AsyncClient, auth_token: str):
        response = await client.post(
            "/api/v1/users/testuser/follow",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 422

    async def test_followers_list(self, client: AsyncClient, auth_token: str):
        await client.post(
            "/api/v1/auth/register",
            json={"username": "targetuser3", "password": "ValidPass123"},
        )
        await client.post(
            "/api/v1/users/targetuser3/follow",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        response = await client.get("/api/v1/users/targetuser3/followers")
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 1
        assert body["data"][0]["username"] == "testuser"

    async def test_following_list(self, client: AsyncClient, auth_token: str):
        await client.post(
            "/api/v1/auth/register",
            json={"username": "targetuser4", "password": "ValidPass123"},
        )
        await client.post(
            "/api/v1/users/targetuser4/follow",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        response = await client.get("/api/v1/users/testuser/following")
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 1
        assert body["data"][0]["username"] == "targetuser4"


class TestMyLikes:
    async def test_my_likes(self, client: AsyncClient, auth_token: str, public_diary: str):
        await client.post(
            f"/api/v1/diaries/{public_diary}/like",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        response = await client.get(
            "/api/v1/me/likes",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) >= 1
        assert "meta" in body

    async def test_my_likes_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/me/likes")
        assert response.status_code == 401


class TestThreadedReplies:
    async def test_create_reply(self, client: AsyncClient, auth_token: str, public_diary: str):
        create_resp = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Parent comment"},
        )
        parent_id = create_resp.json()["data"]["id"]

        reply_resp = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "A reply", "parent_comment_id": parent_id},
        )
        assert reply_resp.status_code == 201
        reply = reply_resp.json()["data"]
        assert reply["parent_comment_id"] == parent_id
        assert reply["depth"] == 1

    async def test_list_replies(self, client: AsyncClient, auth_token: str, public_diary: str):
        create_resp = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Parent"},
        )
        parent_id = create_resp.json()["data"]["id"]

        await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Reply 1", "parent_comment_id": parent_id},
        )
        await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Reply 2", "parent_comment_id": parent_id},
        )

        response = await client.get(f"/api/v1/comments/{parent_id}/replies")
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 2

    async def test_reply_increments_reply_count(self, client: AsyncClient, auth_token: str, public_diary: str):
        create_resp = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Parent"},
        )
        parent_id = create_resp.json()["data"]["id"]

        await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Reply", "parent_comment_id": parent_id},
        )

        response = await client.get(f"/api/v1/diaries/{public_diary}/comments")
        comments = response.json()["data"]
        parent = next(c for c in comments if c["id"] == parent_id)
        assert parent["reply_count"] >= 1


class TestCommentLikes:
    async def test_toggle_comment_like(self, client: AsyncClient, auth_token: str, public_diary: str):
        create_resp = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Like me"},
        )
        comment_id = create_resp.json()["data"]["id"]

        response = await client.post(
            f"/api/v1/comments/{comment_id}/like",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["is_liked"] is True
        assert data["like_count"] == 1

    async def test_comment_like_toggle(self, client: AsyncClient, auth_token: str, public_diary: str):
        create_resp = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Toggle me"},
        )
        comment_id = create_resp.json()["data"]["id"]

        await client.post(
            f"/api/v1/comments/{comment_id}/like",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        response = await client.post(
            f"/api/v1/comments/{comment_id}/like",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        data = response.json()["data"]
        assert data["is_liked"] is False
        assert data["like_count"] == 0


class TestFollowingFeed:
    async def test_following_feed_empty(self, client: AsyncClient, auth_token: str):
        response = await client.get(
            "/api/v1/me/following/feed",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 0
        assert body["meta"]["total"] == 0

    async def test_following_feed_with_content(self, client: AsyncClient, auth_token: str):
        await client.post(
            "/api/v1/auth/register",
            json={"username": "writer1", "password": "ValidPass123"},
        )
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "writer1", "password": "ValidPass123"},
        )
        writer_token = login_resp.json()["data"]["access_token"]

        await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {writer_token}"},
            json={
                "privacy": "public",
                "title": "Writer diary",
                "content_html": "<p>Content</p>",
                "content_text": "Content",
                "tags": ["writing"],
            },
        )

        await client.post(
            "/api/v1/users/writer1/follow",
            headers={"Authorization": f"Bearer {auth_token}"},
        )

        response = await client.get(
            "/api/v1/me/following/feed",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) >= 1
        assert body["data"][0]["author"]["username"] == "writer1"

    async def test_following_feed_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/me/following/feed")
        assert response.status_code == 401


class TestCommentsDisabled:
    async def test_create_comment_comments_disabled(self, client: AsyncClient, auth_token: str):
        create_resp = await client.post(
            "/api/v1/diaries",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "privacy": "public",
                "title": "No Comments",
                "content_html": "<p>Test</p>",
                "content_text": "Test",
                "tags": ["test"],
                "comments_enabled": False,
            },
        )
        diary_id = create_resp.json()["data"]["id"]

        response = await client.post(
            f"/api/v1/diaries/{diary_id}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Should fail"},
        )
        assert response.status_code == 422


class TestCommentDiaryIdValidation:
    async def test_delete_comment_wrong_diary_id(self, client: AsyncClient, auth_token: str, public_diary: str):
        create_resp = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Test comment"},
        )
        comment_id = create_resp.json()["data"]["id"]

        response = await client.delete(
            f"/api/v1/diaries/aaaaaaaaaaaaaaaaaaaaaaaa/comments/{comment_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 404


class TestDeleteCommentAuthorization:
    async def test_delete_comment_non_author_non_owner(self, client: AsyncClient, auth_token: str, public_diary: str):
        create_resp = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "My comment"},
        )
        comment_id = create_resp.json()["data"]["id"]

        await client.post(
            "/api/v1/auth/register",
            json={"username": "otheruser", "password": "ValidPass123"},
        )
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "otheruser", "password": "ValidPass123"},
        )
        other_token = login_resp.json()["data"]["access_token"]

        response = await client.delete(
            f"/api/v1/diaries/{public_diary}/comments/{comment_id}",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert response.status_code == 403

    async def test_delete_comment_as_diary_owner(self, client: AsyncClient, auth_token: str, public_diary: str):
        create_resp = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Diary owner's comment"},
        )
        comment_id = create_resp.json()["data"]["id"]

        response = await client.delete(
            f"/api/v1/diaries/{public_diary}/comments/{comment_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 204


class TestDeletedCommentContent:
    async def test_deleted_comment_has_null_content(self, client: AsyncClient, auth_token: str, public_diary: str):
        create_resp = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Will be deleted"},
        )
        comment_id = create_resp.json()["data"]["id"]

        await client.delete(
            f"/api/v1/diaries/{public_diary}/comments/{comment_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
        )

        db = DatabaseManager.get_db()
        from bson import ObjectId
        doc = await db.comments.find_one({"_id": ObjectId(comment_id)})
        assert doc is not None
        assert doc["is_deleted"] is True
        assert doc["content"] is None
        assert "deleted_at" in doc


class TestCommentCountIntegrity:
    async def test_delete_comment_decrements_count(self, client: AsyncClient, auth_token: str, public_diary: str):
        await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Comment 1"},
        )
        create_resp = await client.post(
            f"/api/v1/diaries/{public_diary}/comments",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": "Comment 2"},
        )
        comment_id = create_resp.json()["data"]["id"]

        diary_before = await client.get(f"/api/v1/diaries/{public_diary}")
        assert diary_before.json()["data"]["stats"]["comment_count"] == 2

        await client.delete(
            f"/api/v1/diaries/{public_diary}/comments/{comment_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
        )

        diary_after = await client.get(f"/api/v1/diaries/{public_diary}")
        assert diary_after.json()["data"]["stats"]["comment_count"] == 1


class TestIsFollowingInLists:
    async def test_is_following_in_followers_list(self, client: AsyncClient, auth_token: str):
        await client.post(
            "/api/v1/auth/register",
            json={"username": "followed_user", "password": "ValidPass123"},
        )
        await client.post(
            "/api/v1/users/followed_user/follow",
            headers={"Authorization": f"Bearer {auth_token}"},
        )

        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "followed_user", "password": "ValidPass123"},
        )
        target_token = login_resp.json()["data"]["access_token"]

        response = await client.get(
            "/api/v1/users/followed_user/followers",
            headers={"Authorization": f"Bearer {target_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) >= 1
        assert body["data"][0]["is_following"] is False


class TestIdempotentToggle:
    async def test_like_toggle_idempotent(self, client: AsyncClient, auth_token: str, public_diary: str):
        resp1 = await client.post(
            f"/api/v1/diaries/{public_diary}/like",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp2 = await client.post(
            f"/api/v1/diaries/{public_diary}/like",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp3 = await client.post(
            f"/api/v1/diaries/{public_diary}/like",
            headers={"Authorization": f"Bearer {auth_token}"},
        )

        assert resp1.json()["data"]["is_liked"] is True
        assert resp2.json()["data"]["is_liked"] is False
        assert resp3.json()["data"]["is_liked"] is True
        assert resp3.json()["data"]["like_count"] == 1
