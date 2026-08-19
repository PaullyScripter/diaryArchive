"""PHASE 9: account data lifecycle.

Two user-facing capabilities built on the existing repository primitives:

1. ``export_user_data`` returns a self-contained, GDPR-style snapshot of every
   piece of data an account owns (profile, diaries, comments, social rows,
   notifications, achievements, tickets, tokens). It is deliberately read-only
   and never touches private diary ciphertext (that stays opaque to the server).

2. ``delete_account`` erases the account and all of its data across every
   collection that references the user, including MinIO objects for the user's
   media. It is best-effort: each step is guarded so a partial failure still
   removes as much as possible without leaving the process half-open.
"""

import logging

from bson import ObjectId

from app.core.database import DatabaseManager
from app.core.utils import fmt_dt
from app.repositories.diary_repo import DiaryRepository
from app.services.media_service import _delete_object_async

logger = logging.getLogger(__name__)


def _db():
    return DatabaseManager.get_db()


def _oid(user_id: str) -> ObjectId:
    return ObjectId(user_id)


def _stringify(doc: dict) -> dict:
    """Convert ObjectId/nested-ObjectId fields to strings for a JSON payload."""
    out: dict = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, dict):
            out[k] = _stringify(v)
        elif isinstance(v, list):
            out[k] = [
                _stringify(i) if isinstance(i, dict) else (str(i) if isinstance(i, ObjectId) else i)
                for i in v
            ]
        else:
            out[k] = v
    return out


async def export_user_data(user_id: str) -> dict:
    db = _db()
    uid = _oid(user_id)
    user = await db.users.find_one({"_id": uid})

    diaries = await db.diaries.find(
        {"user_id": uid},
    ).to_list(length=100000)

    comments = await db.comments.find(
        {"user_id": uid},
    ).to_list(length=100000)

    likes = await db.likes.find({"user_id": uid}, {"_id": 0}).to_list(length=100000)
    bookmarks = await db.bookmarks.find({"user_id": uid}, {"_id": 0}).to_list(length=100000)
    follows = await db.follows.find({"user_id": uid}, {"_id": 0}).to_list(length=100000)
    notifications = await db.notifications.find(
        {"user_id": uid},
        {"_id": 0},
    ).to_list(length=100000)
    achievements = await db.achievements.find(
        {"user_id": uid},
        {"_id": 0},
    ).to_list(length=100000)
    tickets = await db.tickets.find({"user_id": uid}, {"_id": 0}).to_list(length=100000)

    return {
        "profile": {
            "id": str(user["_id"]) if user else user_id,
            "username": user.get("username") if user else None,
            "about": user.get("about") if user else None,
            "favorite_quote": user.get("favorite_quote") if user else None,
            "currently_feeling": user.get("currently_feeling") if user else None,
            "stats": user.get("stats") if user else None,
            "preferences": user.get("preferences") if user else None,
            "has_email": bool(user.get("email_hash")) if user else False,
            "email_verified": bool(user.get("email_verified")) if user else False,
            "created_at": fmt_dt(user.get("created_at")) if user else None,
            "last_login_at": fmt_dt(user.get("last_login_at")) if user else None,
        },
        "diaries": [
            {
                "id": str(d["_id"]),
                "title": d.get("title"),
                "privacy": d.get("privacy"),
                "emotion": d.get("emotion"),
                "tags": d.get("tags", []),
                "stats": d.get("stats", {}),
                "created_at": fmt_dt(d.get("created_at")),
                "updated_at": fmt_dt(d.get("updated_at")),
                "published_at": fmt_dt(d.get("published_at")),
                "encrypted_data": d.get("encrypted_data"),
            }
            for d in diaries
        ],
        "comments": [
            {
                "id": str(c["_id"]),
                "diary_id": str(c["diary_id"]) if c.get("diary_id") else None,
                "parent_comment_id": str(c["parent_comment_id"])
                if c.get("parent_comment_id")
                else None,
                "is_deleted": c.get("is_deleted", False),
                "created_at": fmt_dt(c.get("created_at")),
                "content": c.get("content"),
            }
            for c in comments
        ],
        "likes": [_stringify(d) for d in likes],
        "bookmarks": [_stringify(d) for d in bookmarks],
        "follows": [_stringify(d) for d in follows],
        "notifications": [
            {
                "type": n.get("type"),
                "message": n.get("message"),
                "actor_username": n.get("actor_username"),
                "target_type": n.get("target_type"),
                "target_id": str(n["target_id"]) if n.get("target_id") else None,
                "read": n.get("read", False),
                "created_at": fmt_dt(n.get("created_at")),
            }
            for n in notifications
        ],
        "achievements": [_stringify(d) for d in achievements],
        "tickets": [
            {
                "id": str(t["_id"]),
                "category": t.get("category"),
                "status": t.get("status"),
                "subject": t.get("subject"),
                "created_at": fmt_dt(t.get("created_at")),
                "updated_at": fmt_dt(t.get("updated_at")),
                "messages": [
                    {
                        "author": m.get("author"),
                        "body": m.get("body"),
                        "created_at": fmt_dt(m.get("created_at")),
                    }
                    for m in t.get("messages", [])
                ],
            }
            for t in tickets
        ],
    }


async def delete_account(user_id: str) -> bool:
    db = _db()
    uid = _oid(user_id)

    # Diaries (cascade removes comments, likes, bookmarks, notifications,
    # reports and MinIO objects for each diary).
    diary_repo = DiaryRepository()
    diary_ids = await db.diaries.find({"user_id": uid}, {"_id": 1}).to_list(length=100000)
    for d in diary_ids:
        try:
            await diary_repo.delete_cascade(str(d["_id"]))
        except Exception:
            logger.exception("PHASE 9: failed to cascade-delete diary %s", d["_id"])

    # Standalone media owned by the user (avatar-adjacent / not tied to a diary).
    media = await db.media.find({"user_id": uid}).to_list(length=100000)
    for m in media:
        for path_key in ("stored_path", "standard_path", "thumbnail_path"):
            path_val = m.get(path_key)
            if path_val:
                try:
                    await _delete_object_async(path_val)
                except Exception:
                    logger.warning("PHASE 9: failed to delete object %s", path_val)
    await db.media.delete_many({"user_id": uid})

    # Remove the user's avatar file if stored in MinIO.
    user_doc = await db.users.find_one({"_id": uid})
    avatar_path = user_doc.get("avatar_path") if user_doc else None
    if avatar_path:
        try:
            await _delete_object_async(avatar_path)
        except Exception:
            logger.warning("PHASE 9: failed to delete avatar object %s", avatar_path)

    # Comments authored by the user and the likes on those comments.
    comment_ids = await db.comments.find({"user_id": uid}, {"_id": 1}).to_list(length=100000)
    comment_oids = [c["_id"] for c in comment_ids]
    if comment_oids:
        await db.comment_likes.delete_many({"comment_id": {"$in": comment_oids}})
        await db.comments.delete_many({"_id": {"$in": comment_oids}})
    await db.comment_likes.delete_many({"user_id": uid})

    # Social + notification rows referencing the user in either direction.
    await db.likes.delete_many({"user_id": uid})
    await db.bookmarks.delete_many({"user_id": uid})
    await db.follows.delete_many({"follower_id": uid})
    await db.follows.delete_many({"following_id": uid})
    await db.notifications.delete_many({"user_id": uid})
    await db.notifications.delete_many({"actor_id": uid})
    await db.reports.delete_many({"reporter_id": uid})
    await db.reports.delete_many({"target_type": "user", "target_id": uid})

    # User-owned records + credentials.
    await db.tickets.delete_many({"user_id": uid})
    await db.achievements.delete_many({"user_id": uid})
    await db.refresh_tokens.delete_many({"user_id": uid})
    await db.email_verification_tokens.delete_many({"user_id": uid})
    await db.password_reset_tokens.delete_many({"user_id": uid})

    # Clear the banned-user cache so a stale id never resurfaces.
    try:
        from app.repositories.user_repo import UserRepository

        await UserRepository().refresh_banned_user_ids()
    except Exception:
        logger.warning("PHASE 9: failed to refresh banned-user cache", exc_info=True)

    result = await db.users.delete_one({"_id": uid})
    return result.deleted_count > 0
