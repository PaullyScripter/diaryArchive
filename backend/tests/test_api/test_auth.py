import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import DatabaseManager
from app.main import app
from app.repositories.user_repo import UserRepository


@pytest.fixture(autouse=True)
async def clear_users():
    db = DatabaseManager.get_db()
    await db.users.delete_many({})
    await db.refresh_tokens.delete_many({})
    await db.password_reset_tokens.delete_many({})


async def _get_test_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def registered_user(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={"username": "testuser", "password": "ValidPass123"},
    )
    assert response.status_code == 201
    data = response.json()
    return {
        "id": data.get("id") or data.get("data", {}).get("id"),
        "username": "testuser",
        "password": "ValidPass123",
        "access_token": data.get("access_token") or data.get("data", {}).get("access_token"),
    }


class TestRegister:
    async def test_register_success(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/register",
            json={"username": "newuser", "password": "StrongPass1"},
        )
        assert response.status_code == 201
        body = response.json()
        data = body.get("data", body)
        assert "id" in data
        assert data["username"] == "newuser"
        assert "access_token" in data

    async def test_register_duplicate_username(self, client: AsyncClient, registered_user: dict):
        response = await client.post(
            "/api/v1/auth/register",
            json={"username": "testuser", "password": "OtherPass1"},
        )
        assert response.status_code == 409
        body = response.json()
        error = body.get("error", body)
        assert "already taken" in error.get("message", "").lower()

    async def test_register_weak_password(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/register",
            json={"username": "weakuser", "password": "short"},
        )
        assert response.status_code == 422

    async def test_register_missing_letter(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/register",
            json={"username": "noletters", "password": "12345678"},
        )
        assert response.status_code == 422

    async def test_register_duplicate_email(self, client: AsyncClient):
        await client.post(
            "/api/v1/auth/register",
            json={"username": "user1", "password": "ValidPass1", "email": "same@test.com"},
        )
        response = await client.post(
            "/api/v1/auth/register",
            json={"username": "user2", "password": "ValidPass1", "email": "same@test.com"},
        )
        assert response.status_code == 409

    async def test_register_invalid_username(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/register",
            json={"username": "ab", "password": "ValidPass1"},
        )
        assert response.status_code == 422


class TestLogin:
    async def test_login_success(self, client: AsyncClient, registered_user: dict):
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "ValidPass123"},
        )
        assert response.status_code == 200
        body = response.json()
        data = body.get("data", body)
        assert "access_token" in data
        assert data["username"] == "testuser"

    async def test_login_wrong_password(self, client: AsyncClient, registered_user: dict):
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "WrongPass123"},
        )
        assert response.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "nobody", "password": "SomePass123"},
        )
        assert response.status_code == 401

    async def test_login_banned_user(self, client: AsyncClient, registered_user: dict):
        repo = UserRepository()
        user = await repo.get_by_username("testuser")
        if user:
            await repo.update(str(user["_id"]), {"is_banned": True})

        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "ValidPass123"},
        )
        assert response.status_code == 403


class TestRefresh:
    async def test_refresh_token(self, client: AsyncClient, registered_user: dict):
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "ValidPass123"},
        )
        cookies = login_resp.cookies
        refresh_cookie = cookies.get("refresh_token")

        response = await client.post(
            "/api/v1/auth/refresh",
            cookies={"refresh_token": refresh_cookie},
        )
        assert response.status_code == 200
        body = response.json()
        data = body.get("data", body)
        assert "access_token" in data

    async def test_refresh_missing_cookie(self, client: AsyncClient):
        response = await client.post("/api/v1/auth/refresh")
        assert response.status_code == 401

    async def test_refresh_rotated(self, client: AsyncClient, registered_user: dict):
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "ValidPass123"},
        )
        cookies = login_resp.cookies
        refresh_cookie = cookies.get("refresh_token")

        await client.post(
            "/api/v1/auth/refresh",
            cookies={"refresh_token": refresh_cookie},
        )

        response = await client.post(
            "/api/v1/auth/refresh",
            cookies={"refresh_token": refresh_cookie},
        )
        assert response.status_code == 401


class TestLogout:
    async def test_logout(self, client: AsyncClient, registered_user: dict):
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "ValidPass123"},
        )
        cookies = login_resp.cookies
        refresh_cookie = cookies.get("refresh_token")
        access_token = registered_user["access_token"]

        response = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"},
            cookies={"refresh_token": refresh_cookie},
        )
        assert response.status_code == 204

        refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            cookies={"refresh_token": refresh_cookie},
        )
        assert refresh_resp.status_code == 401


class TestMe:
    async def test_me_authenticated(self, client: AsyncClient, registered_user: dict):
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {registered_user['access_token']}"},
        )
        assert response.status_code == 200
        body = response.json()
        data = body.get("data", body)
        assert data["username"] == "testuser"

    async def test_me_unauthenticated(self, client: AsyncClient):
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401

    async def test_me_banned_user(self, client: AsyncClient, registered_user: dict):
        repo = UserRepository()
        user = await repo.get_by_username("testuser")
        if user:
            await repo.update(str(user["_id"]), {"is_banned": True})

        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {registered_user['access_token']}"},
        )
        assert response.status_code == 403


class TestChangePassword:
    async def test_change_password(self, client: AsyncClient, registered_user: dict):
        response = await client.put(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {registered_user['access_token']}"},
            json={"current_password": "ValidPass123", "new_password": "NewValidPass1"},
        )
        assert response.status_code == 200

        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "NewValidPass1"},
        )
        assert login_resp.status_code == 200

    async def test_change_password_wrong_current(self, client: AsyncClient, registered_user: dict):
        response = await client.put(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {registered_user['access_token']}"},
            json={"current_password": "WrongPass123", "new_password": "NewValidPass1"},
        )
        assert response.status_code == 401

    async def test_change_password_invalid_new(self, client: AsyncClient, registered_user: dict):
        response = await client.put(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {registered_user['access_token']}"},
            json={"current_password": "ValidPass123", "new_password": "short"},
        )
        assert response.status_code == 422


class TestPasswordReset:
    async def test_request_reset_nonexistent(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/request-password-reset",
            json={"username": "nobody"},
        )
        assert response.status_code == 200
        body = response.json()
        data = body.get("data", body)
        assert "message" in data

    async def test_reset_password_success(self, client: AsyncClient, registered_user: dict):
        repo = UserRepository()
        user = await repo.get_by_username("testuser")

        from app.core.security import hash_token
        from app.repositories.password_reset_token_repo import PasswordResetTokenRepository
        reset_repo = PasswordResetTokenRepository()

        from app.core.security import generate_refresh_token
        token_raw = generate_refresh_token()
        token_hash = hash_token(token_raw)
        await reset_repo.create_token(str(user["_id"]), token_hash)

        response = await client.post(
            "/api/v1/auth/reset-password",
            json={"token": token_raw, "new_password": "ResetPass123"},
        )
        assert response.status_code == 200

        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "testuser", "password": "ResetPass123"},
        )
        assert login_resp.status_code == 200
