"""MED-3: durable search-sync outbox — enqueue, worker processing, retry/backoff,
and reconciliation driven by the diary's current persisted state."""

from datetime import UTC, datetime, timedelta

import pytest
from bson import ObjectId

from app.core.database import DatabaseManager
from app.search import sync


@pytest.fixture(autouse=True)
async def clear_db():
    db = DatabaseManager.get_db()
    for coll in ["users", "diaries", "search_sync_outbox", "refresh_tokens"]:
        try:
            await db[coll].delete_many({})
        except Exception:
            pass


async def _seed_user_and_diary(user_banned=False, privacy="public"):
    db = DatabaseManager.get_db()
    user = ObjectId()
    await db.users.insert_one(
        {"_id": user, "username": "owner", "stats": {}, "is_banned": user_banned}
    )
    diary = ObjectId()
    await db.diaries.insert_one(
        {
            "_id": diary,
            "user_id": user,
            "privacy": privacy,
            "title": "t",
            "content_text": "c",
            "stats": {},
            "created_at": datetime.now(UTC),
        }
    )
    return user, diary


async def test_enqueue_is_idempotent_and_durable():
    db = DatabaseManager.get_db()
    diary = ObjectId()
    await sync.enqueue_sync(str(diary), action="index")
    await sync.enqueue_sync(str(diary), action="remove")

    entries = await db.search_sync_outbox.find({"_id": diary}).to_list(length=10)
    assert len(entries) == 1  # idempotent upsert, no duplicates
    assert entries[0]["status"] == "pending"
    assert entries[0]["action"] == "remove"  # latest intent wins
    assert entries[0]["attempt_count"] == 0


async def test_process_outbox_indexes_public_diary(monkeypatch):
    db = DatabaseManager.get_db()
    _, diary = await _seed_user_and_diary(privacy="public")

    calls = {"indexed": [], "removed": []}

    class FakeIndexer:
        async def index_diary(self, doc):
            calls["indexed"].append(str(doc["_id"]))

        async def remove_diary(self, diary_id):
            calls["removed"].append(diary_id)

    monkeypatch.setattr(sync, "DiaryIndexer", lambda: FakeIndexer())

    await sync.enqueue_sync(str(diary), action="index")
    summary = await sync.process_outbox()

    assert summary["processed"] == 1
    assert summary["succeeded"] == 1
    assert calls["indexed"] == [str(diary)]
    assert calls["removed"] == []
    entry = await db.search_sync_outbox.find_one({"_id": diary})
    assert entry["status"] == "done"


async def test_process_outbox_removes_non_public_or_banned(monkeypatch):
    db = DatabaseManager.get_db()
    _, private_diary = await _seed_user_and_diary(privacy="private")
    user, banned_diary = await _seed_user_and_diary(user_banned=True, privacy="public")

    calls = {"indexed": [], "removed": []}

    class FakeIndexer:
        async def index_diary(self, doc):
            calls["indexed"].append(str(doc["_id"]))

        async def remove_diary(self, diary_id):
            calls["removed"].append(diary_id)

    monkeypatch.setattr(sync, "DiaryIndexer", lambda: FakeIndexer())

    await sync.enqueue_sync(str(private_diary), action="index")
    await sync.enqueue_sync(str(banned_diary), action="index")
    await sync.process_outbox()

    assert sorted(calls["removed"]) == sorted([str(private_diary), str(banned_diary)])
    assert calls["indexed"] == []
    assert await db.search_sync_outbox.count_documents({"status": "done"}) == 2


async def test_process_outbox_removes_missing_diary(monkeypatch):
    db = DatabaseManager.get_db()
    missing = ObjectId()
    calls = {"removed": []}

    class FakeIndexer:
        async def index_diary(self, doc):
            pass

        async def remove_diary(self, diary_id):
            calls["removed"].append(diary_id)

    monkeypatch.setattr(sync, "DiaryIndexer", lambda: FakeIndexer())

    await sync.enqueue_sync(str(missing), action="index")
    await sync.process_outbox()
    assert calls["removed"] == [str(missing)]
    assert await db.search_sync_outbox.count_documents({"status": "done"}) == 1


async def test_process_outbox_retries_then_marks_failed(monkeypatch):
    db = DatabaseManager.get_db()
    _, diary = await _seed_user_and_diary(privacy="public")

    async def _fail(action, diary_id):
        return False

    monkeypatch.setattr(sync, "_run_index_op", _fail)

    await sync.enqueue_sync(str(diary), action="index")

    # First attempt: should back off, stay pending, attempt_count bumped.
    s1 = await sync.process_outbox()
    assert s1["failed"] == 1
    entry = await db.search_sync_outbox.find_one({"_id": diary})
    assert entry["status"] == "pending"
    assert entry["attempt_count"] == 1
    assert entry["next_attempt_at"] > datetime.now(UTC).replace(tzinfo=None)

    # Force next_attempt_at into the past so the retry is eligible.
    await db.search_sync_outbox.update_one(
        {"_id": diary},
        {"$set": {"next_attempt_at": datetime.now(UTC) - timedelta(seconds=1)}},
    )
    s2 = await sync.process_outbox()
    assert s2["failed"] == 1
    entry = await db.search_sync_outbox.find_one({"_id": diary})
    assert entry["attempt_count"] == 2


async def test_process_outbox_success_after_transient_failure(monkeypatch):
    db = DatabaseManager.get_db()
    _, diary = await _seed_user_and_diary(privacy="public")
    fail_then_succeed = {"fail": True}

    async def _flaky(action, diary_id):
        if fail_then_succeed["fail"]:
            fail_then_succeed["fail"] = False
            return False
        return True

    monkeypatch.setattr(sync, "_run_index_op", _flaky)

    await sync.enqueue_sync(str(diary), action="index")
    await sync.process_outbox()
    entry = await db.search_sync_outbox.find_one({"_id": diary})
    assert entry["status"] == "pending"
    assert entry["attempt_count"] == 1

    await db.search_sync_outbox.update_one(
        {"_id": diary}, {"$set": {"next_attempt_at": datetime.now(UTC) - timedelta(seconds=1)}}
    )
    s2 = await sync.process_outbox()
    assert s2["succeeded"] == 1
    entry = await db.search_sync_outbox.find_one({"_id": diary})
    assert entry["status"] == "done"
