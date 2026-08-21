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

_BATCH_SIZE = 1000


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
    cursor = db.likes.find({}, {"user_id": 1, "diary_id": 1}).batch_size(_BATCH_SIZE)
    while True:
        docs = await cursor.to_list(length=_BATCH_SIZE)
        if not docs:
            break
        user_ids = {d["user_id"] for d in docs}
        diary_ids = {d["diary_id"] for d in docs}
        valid_users = await _valid_ids(db.users, list(user_ids))
        valid_diaries = await _valid_ids(db.diaries, list(diary_ids))
        orphan_ids = [
            d["_id"]
            for d in docs
            if d["user_id"] not in valid_users or d["diary_id"] not in valid_diaries
        ]
        if orphan_ids:
            res = await db.likes.delete_many({"_id": {"$in": orphan_ids}})
            removed += res.deleted_count
    return {"orphans_removed": removed}


async def sweep_orphaned_bookmarks() -> dict:
    db = _db()
    removed = 0
    cursor = db.bookmarks.find({}, {"user_id": 1, "diary_id": 1}).batch_size(_BATCH_SIZE)
    while True:
        docs = await cursor.to_list(length=_BATCH_SIZE)
        if not docs:
            break
        valid_users = await _valid_ids(db.users, list({d["user_id"] for d in docs}))
        valid_diaries = await _valid_ids(db.diaries, list({d["diary_id"] for d in docs}))
        orphan_ids = [
            d["_id"]
            for d in docs
            if d["user_id"] not in valid_users or d["diary_id"] not in valid_diaries
        ]
        if orphan_ids:
            res = await db.bookmarks.delete_many({"_id": {"$in": orphan_ids}})
            removed += res.deleted_count
    return {"orphans_removed": removed}


async def sweep_orphaned_follows() -> dict:
    db = _db()
    removed = 0
    cursor = db.follows.find({}, {"follower_id": 1, "following_id": 1}).batch_size(_BATCH_SIZE)
    while True:
        docs = await cursor.to_list(length=_BATCH_SIZE)
        if not docs:
            break
        all_ids = list({i for d in docs for i in (d["follower_id"], d["following_id"])})
        valid = await _valid_ids(db.users, all_ids)
        orphan_ids = [
            d["_id"]
            for d in docs
            if d["follower_id"] not in valid or d["following_id"] not in valid
        ]
        if orphan_ids:
            res = await db.follows.delete_many({"_id": {"$in": orphan_ids}})
            removed += res.deleted_count
    return {"orphans_removed": removed}


async def sweep_orphaned_comments() -> dict:
    """Remove comment_likes whose comment is gone, and comments whose parent
    diary or author is gone."""
    db = _db()
    removed_comments = 0
    removed_comment_likes = 0

    # Sweep comments in batches.
    cursor = db.comments.find({}, {"user_id": 1, "diary_id": 1}).batch_size(_BATCH_SIZE)
    all_orphan_comment_ids: list[ObjectId] = []
    while True:
        docs = await cursor.to_list(length=_BATCH_SIZE)
        if not docs:
            break
        valid_users = await _valid_ids(db.users, list({d["user_id"] for d in docs}))
        valid_diaries = await _valid_ids(db.diaries, list({d["diary_id"] for d in docs}))
        orphan_ids = [
            d["_id"]
            for d in docs
            if d["user_id"] not in valid_users or d["diary_id"] not in valid_diaries
        ]
        all_orphan_comment_ids.extend(orphan_ids)

    if all_orphan_comment_ids:
        # Batch-delete in chunks to avoid huge $in operators.
        for i in range(0, len(all_orphan_comment_ids), _BATCH_SIZE):
            chunk = all_orphan_comment_ids[i : i + _BATCH_SIZE]
            removed_comment_likes += (
                await db.comment_likes.delete_many({"comment_id": {"$in": chunk}})
            ).deleted_count
            removed_comments += (
                await db.comments.delete_many({"_id": {"$in": chunk}})
            ).deleted_count

    # Sweep comment_likes pointing at already-hard-deleted comments.
    cl_cursor = db.comment_likes.find({}, {"comment_id": 1}).batch_size(_BATCH_SIZE)
    all_cl_orphan_ids: list[ObjectId] = []
    while True:
        docs = await cl_cursor.to_list(length=_BATCH_SIZE)
        if not docs:
            break
        valid_comments = await _valid_ids(db.comments, list({c["comment_id"] for c in docs}))
        all_cl_orphan_ids.extend(
            c["_id"] for c in docs if c["comment_id"] not in valid_comments
        )
    if all_cl_orphan_ids:
        for i in range(0, len(all_cl_orphan_ids), _BATCH_SIZE):
            chunk = all_cl_orphan_ids[i : i + _BATCH_SIZE]
            removed_comment_likes += (
                await db.comment_likes.delete_many({"_id": {"$in": chunk}})
            ).deleted_count

    return {
        "orphan_comments_removed": removed_comments,
        "orphan_comment_likes_removed": removed_comment_likes,
    }


async def sweep_orphaned_notifications() -> dict:
    """Remove notifications whose recipient user no longer exists, or whose
    referenced target (diary, comment, user) has been deleted."""
    db = _db()
    removed = 0
    cursor = db.notifications.find(
        {}, {"user_id": 1, "actor_id": 1, "target_id": 1, "target_type": 1}
    ).batch_size(_BATCH_SIZE)
    while True:
        docs = await cursor.to_list(length=_BATCH_SIZE)
        if not docs:
            break
        # Collect all referenced user IDs.
        user_ids = set()
        for d in docs:
            user_ids.add(d["user_id"])
            if d.get("actor_id"):
                user_ids.add(d["actor_id"])
        valid_users = await _valid_ids(db.users, list(user_ids))

        # Collect target IDs by type for existence checks.
        diary_targets = {
            d["target_id"]
            for d in docs
            if d.get("target_type") == "diary" and d.get("target_id")
        }
        comment_targets = {
            d["target_id"]
            for d in docs
            if d.get("target_type") == "comment" and d.get("target_id")
        }
        user_targets = {
            d["target_id"]
            for d in docs
            if d.get("target_type") == "user" and d.get("target_id")
        }

        valid_diaries = await _valid_ids(db.diaries, list(diary_targets)) if diary_targets else set()
        valid_comments = (
            await _valid_ids(db.comments, list(comment_targets)) if comment_targets else set()
        )
        valid_target_users = (
            await _valid_ids(db.users, list(user_targets)) if user_targets else set()
        )

        orphan_ids = []
        for d in docs:
            # Recipient must exist.
            if d["user_id"] not in valid_users:
                orphan_ids.append(d["_id"])
                continue
            # Actor must exist (for non-admin notifications).
            if d.get("actor_id") and d["actor_id"] not in valid_users:
                orphan_ids.append(d["_id"])
                continue
            # Target must exist if referenced.
            target_id = d.get("target_id")
            if target_id:
                target_type = d.get("target_type", "diary")
                if target_type == "diary" and target_id not in valid_diaries:
                    orphan_ids.append(d["_id"])
                elif target_type == "comment" and target_id not in valid_comments:
                    orphan_ids.append(d["_id"])
                elif target_type == "user" and target_id not in valid_target_users:
                    orphan_ids.append(d["_id"])

        if orphan_ids:
            res = await db.notifications.delete_many({"_id": {"$in": orphan_ids}})
            removed += res.deleted_count
    return {"orphans_removed": removed}


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
        summary["notifications"] = await sweep_orphaned_notifications()
        summary["diaries"] = await reconcile_diary_counters()
        summary["users"] = await reconcile_user_counters()
    except Exception:
        logger.exception("MED-2 cleanup run failed")
        raise
    logger.info("MED-2 cleanup complete: %s", summary)
    return summary
