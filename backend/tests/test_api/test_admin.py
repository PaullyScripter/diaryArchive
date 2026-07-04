import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import DatabaseManager
from app.main import app
from app.repositories.user_repo import UserRepository


@pytest.fixture(autouse=True)
async def clear_db():
    db = DatabaseManager.get_db()
    for coll in ["users", "reports", "audit_logs", "refresh_tokens",
                  "diaries", "comments", "likes"]:
        try:
            await db[coll].delete_many({})
        except Exception:
            pass


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _register(client: AsyncClient, username: str, password: str = "ValidPass1",
                     is_admin: bool = False) -> dict:
    resp = await client.post("/api/v1/auth/register",
                             json={"username": username, "password": password})
    assert resp.status_code == 201
    body = resp.json()
    data = body.get("data", body)
    if is_admin:
        user_repo = UserRepository()
        await user_repo.set_admin_role(data["id"], True)
        data["is_admin"] = True
    return data


async def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _create_diary(client: AsyncClient, token: str, title: str = "Test Diary",
                         content: str = "Test content for diary.") -> str:
    resp = await client.post("/api/v1/diaries",
                             json={"title": title, "content_text": content, "privacy": "public"},
                             headers=_auth_headers(token))
    body = resp.json()
    return body.get("data", body)["id"]


async def _create_comment(client: AsyncClient, token: str, diary_id: str,
                           text: str = "Test comment") -> str:
    resp = await client.post(f"/api/v1/diaries/{diary_id}/comments",
                             json={"content_text": text},
                             headers=_auth_headers(token))
    body = resp.json()
    return body.get("data", body)["id"]


# ═══════════════════════════════════════════════════════════
# Report Submission
# ═══════════════════════════════════════════════════════════

class TestReportSubmission:
    async def test_submit_report_success(self, client: AsyncClient):
        user1 = await _register(client, "reporter1")
        user2 = await _register(client, "reporteduser")
        diary_id = await _create_diary(client, user2["access_token"])

        resp = await client.post("/api/v1/reports",
                                 json={"target_type": "diary", "target_id": diary_id,
                                       "reason": "spam"},
                                 headers=_auth_headers(user1["access_token"]))
        assert resp.status_code == 201
        data = resp.json().get("data", resp.json())
        assert data["target_type"] == "diary"
        assert data["target_id"] == diary_id
        assert data["reason"] == "spam"
        assert data["status"] == "pending"

    async def test_submit_report_duplicate_returns_409(self, client: AsyncClient):
        user1 = await _register(client, "reporter1")
        user2 = await _register(client, "reporteduser")
        diary_id = await _create_diary(client, user2["access_token"])

        await client.post("/api/v1/reports",
                          json={"target_type": "diary", "target_id": diary_id, "reason": "spam"},
                          headers=_auth_headers(user1["access_token"]))
        resp = await client.post("/api/v1/reports",
                                 json={"target_type": "diary", "target_id": diary_id,
                                       "reason": "inappropriate_content"},
                                 headers=_auth_headers(user1["access_token"]))
        assert resp.status_code == 409

    async def test_submit_report_target_not_found_returns_404(self, client: AsyncClient):
        user1 = await _register(client, "reporter1")
        resp = await client.post("/api/v1/reports",
                                 json={"target_type": "diary",
                                       "target_id": "aaaaaaaaaaaaaaaaaaaaaaaa",
                                       "reason": "spam"},
                                 headers=_auth_headers(user1["access_token"]))
        assert resp.status_code == 404

    async def test_submit_report_invalid_target_type(self, client: AsyncClient):
        user1 = await _register(client, "reporter1")
        user2 = await _register(client, "reporteduser")
        diary_id = await _create_diary(client, user2["access_token"])

        resp = await client.post("/api/v1/reports",
                                 json={"target_type": "invalid_type", "target_id": diary_id,
                                       "reason": "spam"},
                                 headers=_auth_headers(user1["access_token"]))
        assert resp.status_code == 422

    async def test_submit_report_user_target(self, client: AsyncClient):
        user1 = await _register(client, "reporter1")
        user2 = await _register(client, "reporteduser")

        resp = await client.post("/api/v1/reports",
                                 json={"target_type": "user", "target_id": user2["id"],
                                       "reason": "harassment", "description": "This user is harassing me"},
                                 headers=_auth_headers(user1["access_token"]))
        assert resp.status_code == 201

    async def test_submit_report_comment_target(self, client: AsyncClient):
        user1 = await _register(client, "reporter1")
        user2 = await _register(client, "diaryowner")
        diary_id = await _create_diary(client, user2["access_token"])
        comment_id = await _create_comment(client, user2["access_token"], diary_id)

        resp = await client.post("/api/v1/reports",
                                 json={"target_type": "comment", "target_id": comment_id,
                                       "reason": "inappropriate_content"},
                                 headers=_auth_headers(user1["access_token"]))
        assert resp.status_code == 201


# ═══════════════════════════════════════════════════════════
# Admin Authorization
# ═══════════════════════════════════════════════════════════

class TestAdminAuthorization:
    async def test_non_admin_gets_403_on_admin_endpoints(self, client: AsyncClient):
        user = await _register(client, "normaluser")
        endpoints = [
            "/api/v1/admin/reports",
            "/api/v1/admin/users",
            "/api/v1/admin/audit-logs",
            "/api/v1/admin/stats",
            "/api/v1/admin/health",
        ]
        for ep in endpoints:
            resp = await client.get(ep, headers=_auth_headers(user["access_token"]))
            assert resp.status_code == 403, f"Expected 403 for {ep}, got {resp.status_code}"

    async def test_admin_can_access_admin_endpoints(self, client: AsyncClient):
        admin = await _register(client, "adminuser", is_admin=True)
        resp = await client.get("/api/v1/admin/stats",
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200

    async def test_admin_can_access_health(self, client: AsyncClient):
        admin = await _register(client, "adminuser2", is_admin=True)
        resp = await client.get("/api/v1/admin/health",
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body


# ═══════════════════════════════════════════════════════════
# Admin Report Management
# ═══════════════════════════════════════════════════════════

class TestAdminReports:
    async def test_admin_list_reports(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        user1 = await _register(client, "reporter1")
        user2 = await _register(client, "reported")
        diary_id = await _create_diary(client, user2["access_token"])

        await client.post("/api/v1/reports",
                          json={"target_type": "diary", "target_id": diary_id, "reason": "spam"},
                          headers=_auth_headers(user1["access_token"]))

        resp = await client.get("/api/v1/admin/reports",
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) >= 1
        assert body["meta"]["total"] >= 1

    async def test_admin_resolve_report(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        user1 = await _register(client, "reporter1")
        user2 = await _register(client, "reported")
        diary_id = await _create_diary(client, user2["access_token"])

        report_resp = await client.post("/api/v1/reports",
                                        json={"target_type": "diary", "target_id": diary_id,
                                              "reason": "spam"},
                                        headers=_auth_headers(user1["access_token"]))
        report_id = report_resp.json().get("data", {})["id"]

        resp = await client.put(f"/api/v1/admin/reports/{report_id}",
                                json={"status": "resolved",
                                      "resolution_note": "Content reviewed and removed"},
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        data = resp.json().get("data", resp.json())
        assert data["status"] == "resolved"

    async def test_admin_dismiss_report(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        user1 = await _register(client, "reporter1")
        user2 = await _register(client, "reported")
        diary_id = await _create_diary(client, user2["access_token"])

        report_resp = await client.post("/api/v1/reports",
                                        json={"target_type": "diary", "target_id": diary_id,
                                              "reason": "spam"},
                                        headers=_auth_headers(user1["access_token"]))
        report_id = report_resp.json().get("data", {})["id"]

        resp = await client.put(f"/api/v1/admin/reports/{report_id}",
                                json={"status": "dismissed"},
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        data = resp.json().get("data", resp.json())
        assert data["status"] == "dismissed"

    async def test_resolved_report_creates_audit_log(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        user1 = await _register(client, "reporter1")
        user2 = await _register(client, "reported")
        diary_id = await _create_diary(client, user2["access_token"])

        report_resp = await client.post("/api/v1/reports",
                                        json={"target_type": "diary", "target_id": diary_id,
                                              "reason": "spam"},
                                        headers=_auth_headers(user1["access_token"]))
        report_id = report_resp.json().get("data", {})["id"]

        await client.put(f"/api/v1/admin/reports/{report_id}",
                         json={"status": "resolved",
                               "resolution_note": "Content removed after review"},
                         headers=_auth_headers(admin["access_token"]))

        resp = await client.get("/api/v1/admin/audit-logs",
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        logs = resp.json()["data"]
        assert any(log["action"] == "report_resolved" for log in logs)


# ═══════════════════════════════════════════════════════════
# Admin User Management
# ═══════════════════════════════════════════════════════════

class TestAdminUserManagement:
    async def test_admin_list_users(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        await _register(client, "user1")
        await _register(client, "user2")

        resp = await client.get("/api/v1/admin/users",
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        body = resp.json()
        assert body["meta"]["total"] >= 3

    async def test_admin_search_users_by_username(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        await _register(client, "john_doe")
        await _register(client, "jane_doe")
        await _register(client, "bob_smith")

        resp = await client.get("/api/v1/admin/users?q=j",
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        body = resp.json()
        usernames = [u["username"] for u in body["data"]]
        assert all(name.startswith("j") for name in usernames)

    async def test_admin_ban_user(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        user = await _register(client, "targetuser")

        resp = await client.put(f"/api/v1/admin/users/{user['id']}/ban",
                                json={"is_banned": True,
                                      "reason": "Violating terms of service repeatedly"},
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        data = resp.json().get("data", resp.json())
        assert data["is_banned"] is True

    async def test_ban_revokes_refresh_tokens(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        user = await _register(client, "targetuser")

        login_resp = await client.post("/api/v1/auth/login",
                                       json={"username": "targetuser", "password": "ValidPass1"})
        assert login_resp.status_code == 200

        await client.put(f"/api/v1/admin/users/{user['id']}/ban",
                         json={"is_banned": True, "reason": "Violating terms of service repeatedly"},
                         headers=_auth_headers(admin["access_token"]))

        refresh_resp = await client.post("/api/v1/auth/refresh")
        assert refresh_resp.status_code in (401, 422)

    async def test_cannot_ban_admin(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        admin2 = await _register(client, "admin2", is_admin=True)

        resp = await client.put(f"/api/v1/admin/users/{admin2['id']}/ban",
                                json={"is_banned": True,
                                      "reason": "Trying to ban another admin"},
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 403

    async def test_ban_requires_reason(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        user = await _register(client, "targetuser")

        resp = await client.put(f"/api/v1/admin/users/{user['id']}/ban",
                                json={"is_banned": True, "reason": "short"},
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 422

    async def test_admin_unban_user(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        user = await _register(client, "targetuser")

        await client.put(f"/api/v1/admin/users/{user['id']}/ban",
                         json={"is_banned": True, "reason": "Violating terms of service repeatedly"},
                         headers=_auth_headers(admin["access_token"]))

        resp = await client.put(f"/api/v1/admin/users/{user['id']}/ban",
                                json={"is_banned": False},
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200

    async def test_admin_change_role(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        user = await _register(client, "promoteme")

        resp = await client.put(f"/api/v1/admin/users/{user['id']}/role",
                                json={"is_admin": True},
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        data = resp.json().get("data", resp.json())
        assert data["is_admin"] is True

    async def test_cannot_change_own_role(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)

        resp = await client.put(f"/api/v1/admin/users/{admin['id']}/role",
                                json={"is_admin": False},
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 403

    async def test_cannot_demote_last_admin(self, client: AsyncClient):
        admin = await _register(client, "onlyadmin", is_admin=True)
        user = await _register(client, "promoteme")
        await client.put(f"/api/v1/admin/users/{user['id']}/role",
                         json={"is_admin": True},
                         headers=_auth_headers(admin["access_token"]))

        resp = await client.put(f"/api/v1/admin/users/{user['id']}/role",
                                json={"is_admin": False},
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 403


# ═══════════════════════════════════════════════════════════
# Audit Logs
# ═══════════════════════════════════════════════════════════

class TestAuditLogs:
    async def test_audit_log_list(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        user = await _register(client, "targetuser")

        await client.put(f"/api/v1/admin/users/{user['id']}/ban",
                         json={"is_banned": True, "reason": "Violating terms of service repeatedly"},
                         headers=_auth_headers(admin["access_token"]))

        resp = await client.get("/api/v1/admin/audit-logs",
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) >= 1

    async def test_audit_log_filter_by_action(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)
        user = await _register(client, "targetuser")

        await client.put(f"/api/v1/admin/users/{user['id']}/ban",
                         json={"is_banned": True, "reason": "Violating terms of service repeatedly"},
                         headers=_auth_headers(admin["access_token"]))

        resp = await client.get("/api/v1/admin/audit-logs?action=ban_user",
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        body = resp.json()
        for log in body["data"]:
            assert log["action"] == "ban_user"


# ═══════════════════════════════════════════════════════════
# Stats & Health
# ═══════════════════════════════════════════════════════════

class TestAdminStats:
    async def test_stats_returns_expected_structure(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)

        resp = await client.get("/api/v1/admin/stats",
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        body = resp.json()
        data = body["data"]
        assert "users" in data
        assert "diaries" in data
        assert "interactions" in data
        assert "reports" in data
        assert "system" in data
        assert "total" in data["users"]
        assert "banned" in data["users"]
        assert "admins" in data["users"]

    async def test_health_returns_expected_structure(self, client: AsyncClient):
        admin = await _register(client, "admin", is_admin=True)

        resp = await client.get("/api/v1/admin/health",
                                headers=_auth_headers(admin["access_token"]))
        assert resp.status_code == 200
        body = resp.json()
        data = body["data"]
        assert "status" in data
        assert "checks" in data
        assert "timestamp" in data
        assert data["status"] in ("healthy", "degraded")
