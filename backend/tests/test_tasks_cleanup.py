"""MED-2: orphan sweeps + counter reconciliation + diary-delete cascade."""
from bson import ObjectId

from app.core.database import DatabaseManager
from app.repositories.diary_repo import DiaryRepository
from app.tasks.cleanup import (
    reconcile_diary_counters,
    reconcile_user_counters,
    run_cleanup,
    sweep_orphaned_bookmarks,
    sweep_orphaned_comments,
    sweep_orphaned_follows,
    sweep_orphaned_likes,
)


async def test_sweep_orphaned_likes_removes_refs_to_missing_diary_and_user():
    db = DatabaseManager.get_db()
    keep_user = ObjectId()
    keep_diary = ObjectId()
    missing_diary = ObjectId()
    missing_user = ObjectId()

    await db.users.insert_one({"_id": keep_user, "username": "keeps", "stats": {}})
    await db.diaries.insert_one(
        {"_id": keep_diary, "user_id": keep_user, "privacy": "public", "stats": {}}
    )
    await db.likes.insert_many([
        {"user_id": keep_user, "diary_id": keep_diary},  # keep
        {"user_id": keep_user, "diary_id": missing_diary},  # orphan (diary gone)
        {"user_id": missing_user, "diary_id": keep_diary},  # orphan (user gone)
    ])

    result = await sweep_orphaned_likes()
    assert result["orphans_removed"] == 2
    assert await db.likes.count_documents({}) == 1


async def test_sweep_orphaned_bookmarks_and_follows():
    db = DatabaseManager.get_db()
    keep_user = ObjectId()
    keep_diary = ObjectId()
    await db.users.insert_one({"_id": keep_user, "username": "keeps", "stats": {}})
    await db.diaries.insert_one(
        {"_id": keep_diary, "user_id": keep_user, "privacy": "public", "stats": {}}
    )
    missing = ObjectId()

    await db.bookmarks.insert_many([
        {"user_id": keep_user, "diary_id": keep_diary},
        {"user_id": keep_user, "diary_id": missing},
    ])
    await db.follows.insert_many([
        {"follower_id": keep_user, "following_id": keep_user},
        {"follower_id": missing, "following_id": keep_user},
    ])

    assert (await sweep_orphaned_bookmarks())["orphans_removed"] == 1
    assert (await sweep_orphaned_follows())["orphans_removed"] == 1


async def test_sweep_orphaned_comments_removes_comment_likes():
    db = DatabaseManager.get_db()
    keep_user = ObjectId()
    keep_diary = ObjectId()
    missing_comment = ObjectId()
    await db.users.insert_one({"_id": keep_user, "username": "keeps", "stats": {}})
    await db.diaries.insert_one(
        {"_id": keep_diary, "user_id": keep_user, "privacy": "public", "stats": {}}
    )

    # A comment whose diary is gone -> hard delete it and its likes.
    await db.comments.insert_one(
        {"_id": missing_comment, "diary_id": ObjectId(), "user_id": keep_user}
    )
    await db.comment_likes.insert_many([
        {"comment_id": missing_comment, "user_id": keep_user},
        {"comment_id": ObjectId(), "user_id": keep_user},  # orphan directly
    ])

    result = await sweep_orphaned_comments()
    assert result["orphan_comments_removed"] == 1
    assert result["orphan_comment_likes_removed"] == 2
    assert await db.comment_likes.count_documents({}) == 0


async def test_reconcile_diary_counters_corrects_drift():
    db = DatabaseManager.get_db()
    user = ObjectId()
    diary = ObjectId()
    await db.users.insert_one({"_id": user, "username": "keeps", "stats": {}})
    await db.diaries.insert_one(
        {
            "_id": diary,
            "user_id": user,
            "privacy": "public",
            "stats": {"like_count": 99, "bookmark_count": 99, "comment_count": 99},
        }
    )
    await db.likes.insert_many([
        {"user_id": user, "diary_id": diary},
        {"user_id": ObjectId(), "diary_id": diary},
    ])
    await db.bookmarks.insert_one({"user_id": user, "diary_id": diary})
    await db.comments.insert_many([
        {"diary_id": diary, "user_id": user, "is_deleted": False, "parent_comment_id": None},
        {"diary_id": diary, "user_id": user, "is_deleted": True, "parent_comment_id": None},
    ])

    await reconcile_diary_counters()
    updated = await db.diaries.find_one({"_id": diary})
    assert updated["stats"]["like_count"] == 2
    assert updated["stats"]["bookmark_count"] == 1
    assert updated["stats"]["comment_count"] == 1  # soft-deleted excluded


async def test_reconcile_user_counters_corrects_drift():
    db = DatabaseManager.get_db()
    user = ObjectId()
    other = ObjectId()
    await db.users.insert_one(
        {
            "_id": user,
            "username": "u",
            "stats": {"follower_count": 9, "following_count": 9, "diary_count": 9},
        }
    )
    await db.users.insert_one({"_id": other, "username": "o", "stats": {}})
    await db.follows.insert_one({"follower_id": other, "following_id": user})
    await db.diaries.insert_one(
        {"_id": ObjectId(), "user_id": user, "privacy": "public", "stats": {}}
    )

    await reconcile_user_counters()
    updated = await db.users.find_one({"_id": user})
    assert updated["stats"]["follower_count"] == 1
    assert updated["stats"]["following_count"] == 0
    assert updated["stats"]["diary_count"] == 1


async def test_run_cleanup_is_idempotent_and_returns_summary():
    db = DatabaseManager.get_db()
    user = ObjectId()
    await db.users.insert_one(
        {
            "_id": user,
            "username": "u",
            "stats": {"follower_count": 5, "following_count": 5, "diary_count": 5},
        }
    )
    await db.diaries.insert_one(
        {"_id": ObjectId(), "user_id": user, "privacy": "public", "stats": {}}
    )

    first = await run_cleanup()
    second = await run_cleanup()
    assert first["users"]["users_updated"] >= 1
    assert second["users"]["users_updated"] == 0  # already reconciled


async def test_diary_delete_cascade_removes_notifications_and_reports():
    db = DatabaseManager.get_db()
    owner = ObjectId()
    user = ObjectId()
    await db.users.insert_one({"_id": owner, "username": "owner", "stats": {}})
    await db.users.insert_one({"_id": user, "username": "user", "stats": {}})
    diary = ObjectId()
    await db.diaries.insert_one(
        {"_id": diary, "user_id": owner, "privacy": "public", "stats": {}}
    )
    comment = ObjectId()
    await db.comments.insert_one(
        {"_id": comment, "diary_id": diary, "user_id": user, "is_deleted": False}
    )
    await db.notifications.insert_many([
        {"user_id": user, "target_type": "diary", "target_id": diary},
        {"user_id": user, "target_type": "comment", "target_id": comment},
        {"user_id": user, "target_type": "user", "target_id": user},  # keep
    ])
    await db.reports.insert_many([
        {"reporter_id": user, "target_type": "diary", "target_id": diary},
        {"reporter_id": user, "target_type": "user", "target_id": owner},  # keep
    ])

    deleted = await DiaryRepository().delete_cascade(str(diary))
    assert deleted == 1
    assert await db.diaries.count_documents({}) == 0
    assert await db.likes.count_documents({"diary_id": diary}) == 0
    assert await db.comments.count_documents({}) == 0
    assert await db.notifications.count_documents({"target_id": diary}) == 0
    assert await db.notifications.count_documents({"target_id": comment}) == 0
    # Unrelated notification/report preserved.
    assert await db.notifications.count_documents({"target_type": "user"}) == 1
    assert await db.reports.count_documents({"target_type": "user"}) == 1
