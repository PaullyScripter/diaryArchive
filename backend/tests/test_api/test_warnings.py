"""Regression tests for MED-4: moderation bio-confirmation must be
server-verified. A warned user cannot simply claim they changed their bio; the
server requires the bio to actually differ from the offending snapshot and be
updated after the warning was issued. A user also cannot self-clear their own
pending moderation reports."""
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import DatabaseManager
from app.main import app
from app.repositories.user_repo import UserRepository


@pytest.fixture(autouse=True)
async def clear_db():
    db = DatabaseManager.get_db()
    for coll in ["users", "reports", "audit_logs", "refresh_tokens"]:
        try:
            await db[coll].delete_many({})
        except Exception:
            pass


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _register(client: AsyncClient, username: str, password: str = "ValidPass1",
                    is_admin: bool = False) -> dict:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "password": password,
            "accepted_terms": True,
        },
    )
    assert resp.status_code == 201
    data = resp.json().get("data", resp.json())
    if is_admin:
        await UserRepository().set_admin_role(data["id"], True)
        data["is_admin"] = True
    return data


async def _issue_bio_warning(client: AsyncClient, admin_token: str, user_id: str,
                             reason: str = "Inappropriate bio content") -> int:
    resp = await client.post("/api/v1/admin/warnings/bio",
                             json={"user_id": user_id, "reason": reason},
                             headers=_auth(admin_token))
    assert resp.status_code == 200
    return resp.json().get("data", resp.json())


class TestBioConfirmServerVerification:
    async def test_confirm_rejected_when_bio_unchanged(self, client: AsyncClient):
        user = await _register(client, "warneduser")
        admin = await _register(client, "admin1", is_admin=True)
        await _issue_bio_warning(client, admin["access_token"], user["id"])

        resp = await client.put("/api/v1/users/me/confirm-bio-change",
                                headers=_auth(user["access_token"]))
        assert resp.status_code in (400, 422)
        assert "not changed" in resp.json().get("error", {}).get("message", "").lower()

    async def test_confirm_rejected_when_no_pending_warning(self, client: AsyncClient):
        user = await _register(client, "nowarnuser")
        resp = await client.put("/api/v1/users/me/confirm-bio-change",
                                headers=_auth(user["access_token"]))
        assert resp.status_code in (400, 422)

    async def test_confirm_rejected_when_edit_before_warning(self, client: AsyncClient):
        """If the bio was set before the warning (identical to snapshot), a claim
        of compliance must be rejected — nothing actually changed afterwards."""
        user = await _register(client, "editbefore")
        admin = await _register(client, "admin2", is_admin=True)

        # Set the bio BEFORE the warning.
        resp = await client.put("/api/v1/users/me",
                                  json={"about": "My original bio"},
                                  headers=_auth(user["access_token"]))
        assert resp.status_code == 200

        await _issue_bio_warning(client, admin["access_token"], user["id"])

        # Bio unchanged (== snapshot) -> reject.
        resp = await client.put("/api/v1/users/me/confirm-bio-change",
                                headers=_auth(user["access_token"]))
        assert resp.status_code in (400, 422)
        assert "not changed" in resp.json().get("error", {}).get("message", "").lower()

    async def test_confirm_succeeds_after_real_post_warning_edit(self, client: AsyncClient):
        user = await _register(client, "gooduser")
        admin = await _register(client, "admin3", is_admin=True)
        await _issue_bio_warning(client, admin["access_token"], user["id"])

        # Actually change the bio after the warning.
        resp = await client.put("/api/v1/users/me",
                                  json={"about": "My corrected compliant bio"},
                                  headers=_auth(user["access_token"]))
        assert resp.status_code == 200

        resp = await client.put("/api/v1/users/me/confirm-bio-change",
                                headers=_auth(user["access_token"]))
        assert resp.status_code == 200
        data = resp.json().get("data", resp.json())
        assert "confirmed" in data.get("message", "").lower()

    async def test_confirm_does_not_self_clear_pending_reports(self, client: AsyncClient):
        """A user confirming their bio change must NOT be able to clear their own
        pending moderation reports from the admin queue."""
        user = await _register(client, "reporttarget")
        reporter = await _register(client, "reporter1")
        admin = await _register(client, "admin4", is_admin=True)

        # Reporter files a report against the user.
        resp = await client.post("/api/v1/reports",
                                 json={"target_type": "user", "target_id": user["id"],
                                       "reason": "inappropriate_content"},
                                 headers=_auth(reporter["access_token"]))
        assert resp.status_code == 201

        await _issue_bio_warning(client, admin["access_token"], user["id"])
        # Comply and confirm.
        await client.put("/api/v1/users/me",
                           json={"about": "fixed compliant bio"},
                           headers=_auth(user["access_token"]))
        resp = await client.put("/api/v1/users/me/confirm-bio-change",
                                headers=_auth(user["access_token"]))
        assert resp.status_code == 200

        # The report must still be pending for admin review (not self-cleared).
        from bson import ObjectId

        db = DatabaseManager.get_db()
        report = await db.reports.find_one({
            "target_type": "user",
            "target_id": ObjectId(user["id"]),
        })
        assert report is not None
        assert report["status"] == "pending"


class TestBioWarningAutoBlank:
    async def test_auto_blank_only_when_bio_unchanged(self, client: AsyncClient):
        """check_bio_warnings must blank the bio only if it still matches the
        offending snapshot; a user who actually changed it is not punished."""
        from datetime import UTC, datetime, timedelta

        from app.tasks.warnings import check_bio_warnings

        user = await _register(client, "autoblank")
        admin = await _register(client, "admin5", is_admin=True)
        await _issue_bio_warning(client, admin["access_token"], user["id"])

        # Make the warning deadline already expired.
        user_repo = UserRepository()
        await user_repo.update(user["id"], {
            "bio_warning_deadline": datetime.now(UTC) - timedelta(minutes=1),
        })

        # User did NOT change their bio -> auto-blank.
        await check_bio_warnings()
        db = DatabaseManager.get_db()
        raw = await db.users.find_one({"username": "autoblank"})
        assert raw["about"] is None

    async def test_auto_blank_skips_compliant_user(self, client: AsyncClient):
        from datetime import UTC, datetime, timedelta

        from app.tasks.warnings import check_bio_warnings

        user = await _register(client, "compliantuser")
        admin = await _register(client, "admin6", is_admin=True)
        await _issue_bio_warning(client, admin["access_token"], user["id"])

        # User changes their bio, then the deadline expires.
        await client.put("/api/v1/users/me",
                           json={"about": "I fixed my bio"},
                           headers=_auth(user["access_token"]))
        user_repo = UserRepository()
        await user_repo.update(user["id"], {
            "bio_warning_deadline": datetime.now(UTC) - timedelta(minutes=1),
        })

        await check_bio_warnings()
        db = DatabaseManager.get_db()
        raw = await db.users.find_one({"username": "compliantuser"})
        assert raw["about"] == "I fixed my bio"
