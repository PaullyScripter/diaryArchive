from unittest.mock import patch

import pytest
from pymongo.errors import OperationFailure

from app.core.config import settings
from app.core.database import DatabaseManager
from app.main import _init_replica_set


class _FakeAdmin:
    def __init__(self, initialized: bool):
        self.initialized = initialized
        self.commands: list[str] = []

    async def command(self, name: str, *args, **kwargs):
        self.commands.append(name)
        if name == "ping":
            return {"ok": 1}
        if name == "replSetGetStatus":
            if self.initialized:
                return {"ok": 1}
            raise OperationFailure("not yet initialized", 94, {})
        if name == "replSetInitiate":
            self.initialized = True
            return {"ok": 1}
        raise AssertionError(f"unexpected command: {name}")


class _FakeClient:
    def __init__(self, admin):
        self.admin = admin
        self.closed = False

    def close(self):
        self.closed = True


@pytest.mark.asyncio
async def test_replica_init_is_noop_without_replica_set(monkeypatch):
    monkeypatch.setattr(settings, "mongodb_uri", "mongodb://localhost:27017/diaryarchive")
    DatabaseManager._client = None
    await _init_replica_set()


@pytest.mark.asyncio
@pytest.mark.parametrize("initialized", [False, True])
async def test_replica_init_is_idempotent(monkeypatch, initialized):
    monkeypatch.setattr(
        settings,
        "mongodb_uri",
        "mongodb://admin:pass@mongodb:27017/diaryarchive?authSource=admin&replicaSet=diaryarchive",
    )
    normal_admin = _FakeAdmin(initialized=True)
    normal_client = _FakeClient(normal_admin)
    bootstrap_admin = _FakeAdmin(initialized=initialized)
    bootstrap_client = _FakeClient(bootstrap_admin)
    DatabaseManager._client = normal_client

    with patch("motor.motor_asyncio.AsyncIOMotorClient", return_value=bootstrap_client):
        await _init_replica_set()

    assert bootstrap_client.closed is True
    assert "ping" in bootstrap_admin.commands
    assert "replSetGetStatus" in bootstrap_admin.commands
    if initialized:
        assert "replSetInitiate" not in bootstrap_admin.commands
    else:
        assert "replSetInitiate" in bootstrap_admin.commands
