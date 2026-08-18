"""MED-2: periodic data-integrity maintenance.

Two responsibilities:

1. ``sweep_orphaned_relationships`` removes social rows that point at
   documents that no longer exist (deleted users or diaries/comments). These
   can accumulate when a deletion path is skipped or a hard-delete happens out
   of band, so a periodic sweep guarantees eventual consistency regardless of
   which code path removed the parent.

2. ``reconcile_counters`` rewrites the denormalised ``stats`` counters on
   diaries and users to match the true row counts in the relationship
   collections, correcting any drift that $inc races or orphaned rows cause.

Both are idempotent and safe to run at any frequency; they are wired into the
in-process periodic loop in ``app/main.py`` (single-backend architecture).
"""

import logging

from bson import ObjectId

from app.core.database import DatabaseManager

logger = logging.getLogger(__name__)

_SWEEP_BATCH = 10000


def _db():
    return DatabaseManager.get_db()


async def _valid_ids(collection, ids: list[ObjectId]) -> set[ObjectId]:
    """Return the subset of ``ids`` that still exist in ``collection``."""
    if not ids:
        return set()
    docs = await collection.find({"_id": {"$in": ids}}, {"_id": 1}).to_list(length=len(ids))
    return {d["_id"] for d in docs}


async def sweep_orphaned_likes() -> dict:
    db = _db()
    removed = 0
    cursor = db.likes.find({}, {"user_id": 1, "diary_id": 1}).batch_size(1000)
    batch: list[ObjectId] = []
    user_ids: set[ObjectId] = set()
    diary_ids: set[ObjectId] = set()
    docs = await cursor.to_list(length=_SWEEP_BATCH)
    for like in docs:
        user_ids.add(like["user_id"])
        diary_ids.add(like["diary_id"])
        batch.append(like["_id"])
    valid_users = await _valid_ids(db.users, list(user_ids))
    valid_diaries = await _valid_ids(db.diaries, list(diary_ids))
    orphan_ids = [
        like["_id"]
        for like in docs
        if like["user_id"] not in valid_users or like["diary_id"] not in valid_diaries
    ]
    if orphan_ids:
        res = await db.likes.delete_many({"_id": {"$in": orphan_ids}})
        removed = res.deleted_count
    return {"orphans_removed": removed}


async def sweep_orphaned_bookmarks() -> dict:
    db = _db()
    docs = await db.bookmarks.find({}, {"user_id": 1, "diary_id": 1}).to_list(length=_SWEEP_BATCH)
    valid_users = await _valid_ids(db.users, list({d["user_id"] for d in docs}))
    valid_diaries = await _valid_ids(db.diaries, list({d["diary_id"] for d in docs}))
    orphan_ids = [
        d["_id"]
        for d in docs
        if d["user_id"] not in valid_users or d["diary_id"] not in valid_diaries
    ]
    removed = 0
    if orphan_ids:
        removed = (await db.bookmarks.delete_many({"_id": {"$in": orphan_ids}})).deleted_count
    return {"orphans_removed": removed}


async def sweep_orphaned_follows() -> dict:
    db = _db()
    docs = await db.follows.find({}, {"follower_id": 1, "following_id": 1}).to_list(
        length=_SWEEP_BATCH
    )
    valid = await _valid_ids(
        db.users, list({i for d in docs for i in (d["follower_id"], d["following_id"])})
    )
    orphan_ids = [
        d["_id"] for d in docs if d["follower_id"] not in valid or d["following_id"] not in valid
    ]
    removed = 0
    if orphan_ids:
        removed = (await db.follows.delete_many({"_id": {"$in": orphan_ids}})).deleted_count
    return {"orphans_removed": removed}


async def sweep_orphaned_comments() -> dict:
    """Remove comment_likes whose comment is gone, and comments whose parent
    diary or author is gone."""
    db = _db()
    docs = await db.comments.find({}, {"user_id": 1, "diary_id": 1}).to_list(length=_SWEEP_BATCH)
    valid_users = await _valid_ids(db.users, list({d["user_id"] for d in docs}))
    valid_diaries = await _valid_ids(db.diaries, list({d["diary_id"] for d in docs}))
    orphan_comment_ids = [
        d["_id"]
        for d in docs
        if d["user_id"] not in valid_users or d["diary_id"] not in valid_diaries
    ]
    removed_comments = 0
    removed_comment_likes = 0
    if orphan_comment_ids:
        removed_comment_likes = (
            await db.comment_likes.delete_many({"comment_id": {"$in": orphan_comment_ids}})
        ).deleted_count
        removed_comments = (
            await db.comments.delete_many({"_id": {"$in": orphan_comment_ids}})
        ).deleted_count
    # comment_likes pointing at already-hard-deleted comments (that the comment
    # sweep above could not see because the comment doc is gone).
    cl_docs = await db.comment_likes.find({}, {"comment_id": 1}).to_list(length=_SWEEP_BATCH)
    valid_comments = await _valid_ids(db.comments, list({c["comment_id"] for c in cl_docs}))
    cl_orphan_ids = [c["_id"] for c in cl_docs if c["comment_id"] not in valid_comments]
    if cl_orphan_ids:
        removed_comment_likes += (
            await db.comment_likes.delete_many({"_id": {"$in": cl_orphan_ids}})
        ).deleted_count
    return {
        "orphan_comments_removed": removed_comments,
        "orphan_comment_likes_removed": removed_comment_likes,
    }


async def reconcile_diary_counters() -> dict:
    """Set each diary's like/bookmark/comment counts to the true row counts."""
    db = _db()
    diary_ids = [d["_id"] for d in await db.diaries.find({}, {"_id": 1}).to_list(length=100000)]

    async def _counts(collection, field, match_extra=None):
        query: dict = {field: {"$in": diary_ids}}
        if match_extra:
            query.update(match_extra)
        return {
            row["_id"]: row["count"]
            for row in await collection.aggregate(
                [{"$match": query}, {"$group": {"_id": f"${field}", "count": {"$sum": 1}}}]
            ).to_list(length=len(diary_ids))
        }

    like_map = await _counts(db.likes, "diary_id")
    bookmark_map = await _counts(db.bookmarks, "diary_id")
    comment_map = await _counts(
        db.comments,
        "diary_id",
        {"is_deleted": {"$ne": True}, "parent_comment_id": None},
    )

    updated = 0
    for did in diary_ids:
        patch = {
            "like_count": like_map.get(did, 0),
            "bookmark_count": bookmark_map.get(did, 0),
            "comment_count": comment_map.get(did, 0),
        }
        res = await db.diaries.update_one(
            {"_id": did}, {"$set": {f"stats.{k}": v for k, v in patch.items()}}
        )
        if res.modified_count:
            updated += 1
    return {"diaries_updated": updated}


async def reconcile_user_counters() -> dict:
    """Set each user's follower/following/diary counts to the true row counts."""
    db = _db()
    user_ids = [u["_id"] for u in await db.users.find({}, {"_id": 1}).to_list(length=100000)]

    async def _counts(collection, field):
        match = {field: {"$in": user_ids}}
        pipeline = [
            {"$match": match},
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
        ]
        return {
            row["_id"]: row["count"]
            for row in await collection.aggregate(pipeline).to_list(length=len(user_ids))
        }

    follower_map = await _counts(db.follows, "following_id")
    following_map = await _counts(db.follows, "follower_id")
    diary_map = await _counts(db.diaries, "user_id")

    updated = 0
    for uid in user_ids:
        patch = {
            "follower_count": follower_map.get(uid, 0),
            "following_count": following_map.get(uid, 0),
            "diary_count": diary_map.get(uid, 0),
        }
        res = await db.users.update_one(
            {"_id": uid}, {"$set": {f"stats.{k}": v for k, v in patch.items()}}
        )
        if res.modified_count:
            updated += 1
    return {"users_updated": updated}


async def run_cleanup() -> dict:
    """Run all sweeps and reconciliations, returning a summary (used for logs
    and observability)."""
    summary: dict = {}
    try:
        summary["likes"] = await sweep_orphaned_likes()
        summary["bookmarks"] = await sweep_orphaned_bookmarks()
        summary["follows"] = await sweep_orphaned_follows()
        summary["comments"] = await sweep_orphaned_comments()
        summary["diaries"] = await reconcile_diary_counters()
        summary["users"] = await reconcile_user_counters()
    except Exception:
        logger.exception("MED-2 cleanup run failed")
        raise
    logger.info("MED-2 cleanup complete: %s", summary)
    return summary
