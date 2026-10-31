"""PHASE 9: account data lifecycle.

Two user-facing capabilities built on the existing repository primitives:

1. ``export_user_data`` returns a self-contained, GDPR-style snapshot of every
   piece of data an account owns (profile, diaries, comments, social rows,
   notifications, achievements, tickets, tokens, media metadata and files).
   It is deliberately read-only and never touches private diary ciphertext
   (that stays opaque to the server).

2. ``delete_account`` erases the account and all of its data across every
   collection that references the user, including MinIO objects for the user's
   media. It is best-effort: each step is guarded so a partial failure still
   removes as much as possible without leaving the process half-open.
   A structured audit log entry is written for the deletion event.
"""

import asyncio
import json
import logging
import re
import tarfile
from datetime import UTC, datetime, timedelta
from io import BytesIO

from bson import ObjectId
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.database import DatabaseManager
from app.core.exceptions import NotFoundException, ValidationException
from app.core.minio_client import get_minio_client
from app.core.utils import fmt_dt
from app.repositories.audit_log_repo import AuditLogRepository
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

    # Keep the synchronous compatibility endpoint bounded. Large accounts
    # must use the future asynchronous export worker rather than exhausting
    # backend memory with a single request.
    collections = (
        "diaries",
        "comments",
        "likes",
        "bookmarks",
        "follows",
        "notifications",
        "achievements",
        "tickets",
        "media",
    )
    counts = {
        name: await db[name].count_documents({"user_id": uid})
        for name in collections
    }
    over_limit = [
        name for name, count in counts.items() if count > settings.max_export_records_per_collection
    ]
    if over_limit:
        raise ValidationException(
            "This account is too large for an inline export. Please use the "
            "asynchronous export workflow."
        )

    diaries = await db.diaries.find(
        {"user_id": uid},
    ).to_list(length=settings.max_export_records_per_collection)

    comments = await db.comments.find(
        {"user_id": uid},
    ).to_list(length=settings.max_export_records_per_collection)

    likes = await db.likes.find({"user_id": uid}, {"_id": 0}).to_list(
        length=settings.max_export_records_per_collection
    )
    bookmarks = await db.bookmarks.find({"user_id": uid}, {"_id": 0}).to_list(
        length=settings.max_export_records_per_collection
    )
    follows = await db.follows.find({"user_id": uid}, {"_id": 0}).to_list(
        length=settings.max_export_records_per_collection
    )
    notifications = await db.notifications.find(
        {"user_id": uid},
        {"_id": 0},
    ).to_list(length=settings.max_export_records_per_collection)
    achievements = await db.achievements.find(
        {"user_id": uid},
        {"_id": 0},
    ).to_list(length=settings.max_export_records_per_collection)
    tickets = await db.tickets.find({"user_id": uid}, {"_id": 0}).to_list(
        length=settings.max_export_records_per_collection
    )

    # P2.7: Include media metadata and download actual files from MinIO.
    media_records = await db.media.find(
        {"user_id": uid},
        {"_id": 0},
    ).to_list(length=settings.max_export_records_per_collection)
    media_tar_bytes = await _download_media_files(uid, media_records)

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
        "media": [
            {
                "id": str(m.get("_id", "")) if m.get("_id") else None,
                "filename": m.get("filename"),
                "mime_type": m.get("mime_type"),
                "size_bytes": m.get("size_bytes"),
                "is_private": m.get("is_private", False),
                "diary_id": str(m["diary_id"]) if m.get("diary_id") else None,
                "created_at": fmt_dt(m.get("created_at")),
            }
            for m in media_records
        ],
        "media_files": media_tar_bytes,
        "export_metadata": {
            "exported_at": datetime.now(UTC).isoformat(),
            "format_version": 2,
            "includes_media_files": media_tar_bytes is not None,
        },
    }


async def create_export_job(user_id: str) -> dict:
    """Queue a bounded, authenticated export for background processing."""
    db = _db()
    now = datetime.now(UTC)
    result = await db.account_export_jobs.insert_one(
        {
            "user_id": _oid(user_id),
            "status": "queued",
            "created_at": now,
            "updated_at": now,
            "expires_at": now + timedelta(hours=settings.export_job_retention_hours),
        }
    )
    return {"id": str(result.inserted_id), "status": "queued", "created_at": now.isoformat()}


async def process_export_job() -> dict | None:
    """Claim and complete one export job.

    The lease makes this safe when multiple backend replicas run the periodic
    worker. The archive is written to MinIO, never returned through the API
    response, and is deleted by the retention sweep after expiry.
    """
    db = _db()
    now = datetime.now(UTC)
    await db.account_export_jobs.update_many(
        {"status": "running", "lease_until": {"$lt": now}},
        {"$set": {"status": "queued", "updated_at": now}, "$unset": {"lease_until": ""}},
    )
    job = await db.account_export_jobs.find_one_and_update(
        {"status": "queued"},
        {
            "$set": {
                "status": "running",
                "updated_at": now,
                "lease_until": now + timedelta(minutes=settings.export_job_lease_minutes),
            }
        },
        sort=[("created_at", 1)],
        return_document=ReturnDocument.AFTER,
    )
    if not job:
        return None

    job_id = job["_id"]
    user_id = job["user_id"]
    try:
        data = await export_user_data(str(user_id))
        media_files = data.pop("media_files", None)
        json_payload = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")

        archive_buffer = BytesIO()
        with tarfile.open(fileobj=archive_buffer, mode="w:gz") as archive:
            metadata = tarfile.TarInfo(name="data.json")
            metadata.size = len(json_payload)
            archive.addfile(metadata, BytesIO(json_payload))
            if media_files:
                media_entry = tarfile.TarInfo(name="media.tar.gz")
                media_entry.size = len(media_files)
                archive.addfile(media_entry, BytesIO(media_files))
        archive_bytes = archive_buffer.getvalue()
        if len(archive_bytes) > settings.max_export_archive_bytes:
            raise ValidationException("The export is too large to prepare safely")

        if not await db.account_export_jobs.find_one(
            {"_id": job_id, "status": "running"}, {"_id": 1}
        ):
            return {"id": str(job_id), "status": "cancelled"}

        object_path = f"exports/{user_id}/{job_id}.tar.gz"
        client = get_minio_client()
        await asyncio.to_thread(
            client.put_object,
            settings.minio_bucket,
            object_path,
            BytesIO(archive_bytes),
            len(archive_bytes),
            "application/gzip",
        )
        completed_at = datetime.now(UTC)
        update_result = await db.account_export_jobs.update_one(
            {"_id": job_id, "status": "running"},
            {
                "$set": {
                    "status": "completed",
                    "object_path": object_path,
                    "size_bytes": len(archive_bytes),
                    "completed_at": completed_at,
                    "updated_at": completed_at,
                    "expires_at": completed_at
                    + timedelta(hours=settings.export_job_retention_hours),
                },
                "$unset": {"lease_until": ""},
            },
        )
        if update_result.modified_count == 0:
            await _delete_object_async(object_path)
            return {"id": str(job_id), "status": "cancelled"}
        return {"id": str(job_id), "status": "completed"}
    except Exception as exc:
        logger.warning("Account export job %s failed", job_id, exc_info=True)
        await db.account_export_jobs.update_one(
            {"_id": job_id, "status": "running"},
            {
                "$set": {
                    "status": "failed",
                    "error": str(exc)[:500],
                    "updated_at": datetime.now(UTC),
                },
                "$unset": {"lease_until": ""},
            },
        )
        return {"id": str(job_id), "status": "failed"}


async def get_export_job(user_id: str, job_id: str) -> dict:
    if not ObjectId.is_valid(job_id):
        raise NotFoundException("Export job not found")
    job = await _db().account_export_jobs.find_one(
        {"_id": ObjectId(job_id), "user_id": _oid(user_id)},
        {"user_id": 0, "_id": 0, "object_path": 0, "error": 0},
    )
    if not job:
        raise NotFoundException("Export job not found or expired")
    for key in ("created_at", "updated_at", "completed_at", "expires_at"):
        if isinstance(job.get(key), datetime):
            job[key] = job[key].isoformat()
    return job


async def open_export_download(user_id: str, job_id: str):
    if not ObjectId.is_valid(job_id):
        raise NotFoundException("Export job not found")
    job = await _db().account_export_jobs.find_one(
        {"_id": ObjectId(job_id), "user_id": _oid(user_id), "status": "completed"}
    )
    if not job or not job.get("object_path"):
        raise NotFoundException("Export is not ready or has expired")
    client = get_minio_client()
    try:
        return await asyncio.to_thread(
            client.get_object, settings.minio_bucket, job["object_path"]
        )
    except Exception as exc:
        raise NotFoundException("Export is no longer available") from exc


async def cleanup_expired_export_jobs() -> int:
    db = _db()
    removed = 0
    cursor = db.account_export_jobs.find(
        {"expires_at": {"$lte": datetime.now(UTC)}}, {"_id": 1, "object_path": 1}
    ).batch_size(100)
    async for job in cursor:
        path = job.get("object_path")
        if path and not await _delete_object_async(path):
            continue
        result = await db.account_export_jobs.delete_one({"_id": job["_id"]})
        removed += result.deleted_count
    return removed


async def delete_account(user_id: str, reason: str = "user_request") -> bool:
    db = _db()
    uid = _oid(user_id)

    job = await db.account_deletion_jobs.insert_one(
        {
            "user_id": uid,
            "status": "running",
            "phase": "storage_preflight",
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
        }
    )
    job_id = job.inserted_id

    async def mark_job(status: str, phase: str, error: str | None = None) -> None:
        fields = {"status": status, "phase": phase, "updated_at": datetime.now(UTC)}
        if error:
            fields["error"] = error[:500]
        await db.account_deletion_jobs.update_one({"_id": job_id}, {"$set": fields})

    # Capture counts before deletion for audit logging.
    diary_count = await db.diaries.count_documents({"user_id": uid})
    comment_count = await db.comments.count_documents({"user_id": uid})
    like_count = await db.likes.count_documents({"user_id": uid})
    media_count = await db.media.count_documents({"user_id": uid})

    # Delete every object before deleting its database metadata. A failed
    # object deletion leaves the account intact and the durable job marked for
    # retry instead of silently creating an unrecoverable privacy leak.
    user_doc = await db.users.find_one({"_id": uid})
    await db.account_export_jobs.update_many(
        {"user_id": uid, "status": {"$in": ["queued", "running"]}},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(UTC)}},
    )
    object_paths: set[str] = set()
    async for media in db.media.find(
        {"user_id": uid},
        {"stored_path": 1, "standard_path": 1, "thumbnail_path": 1},
    ).batch_size(500):
        object_paths.update(
            path
            for path in (
                media.get("stored_path"),
                media.get("standard_path"),
                media.get("thumbnail_path"),
            )
            if path
        )
    async for export_job in db.account_export_jobs.find(
        {"user_id": uid}, {"object_path": 1}
    ).batch_size(100):
        if export_job.get("object_path"):
            object_paths.add(export_job["object_path"])
    avatar_path = user_doc.get("avatar_path") if user_doc else None
    if avatar_path and not str(avatar_path).startswith("/api/v1/media/file/"):
        object_paths.add(str(avatar_path))
    try:
        for path in object_paths:
            if not await _delete_object_async(path):
                raise RuntimeError(f"object deletion failed for {path}")
    except Exception as exc:
        await mark_job("failed", "storage_preflight", str(exc))
        raise ValidationException(
            "Account deletion is temporarily unavailable because media storage "
            "could not be verified. Please retry."
        ) from exc

    await mark_job("running", "database_cleanup")

    # Diaries (cascade removes comments, likes, bookmarks, notifications, and
    # diary rows; media metadata is removed below after all diary rows finish).
    diary_repo = DiaryRepository()
    diary_cursor = db.diaries.find({"user_id": uid}, {"_id": 1})
    async for d in diary_cursor:
        try:
            await diary_repo.delete_cascade(str(d["_id"]))
        except Exception as exc:
            logger.exception("PHASE 9: failed to cascade-delete diary %s", d["_id"])
            await mark_job("failed", "database_cleanup", str(exc))
            raise ValidationException(
                "Account deletion could not complete safely. Please retry."
            ) from exc

    # Standalone and diary-associated media metadata is now safe to remove
    # because all corresponding objects passed the preflight above.
    await db.media.delete_many({"user_id": uid})
    await db.account_export_jobs.delete_many({"user_id": uid})

    # Comments authored by the user and the likes on those comments.
    comment_cursor = db.comments.find({"user_id": uid}, {"_id": 1})
    comment_batch: list[ObjectId] = []
    async for comment in comment_cursor:
        comment_batch.append(comment["_id"])
        if len(comment_batch) >= 1000:
            await db.comment_likes.delete_many({"comment_id": {"$in": comment_batch}})
            await db.comments.delete_many({"_id": {"$in": comment_batch}})
            comment_batch.clear()
    if comment_batch:
        await db.comment_likes.delete_many({"comment_id": {"$in": comment_batch}})
        await db.comments.delete_many({"_id": {"$in": comment_batch}})
    await db.comment_likes.delete_many({"user_id": uid})

    # Social + notification rows referencing the user in either direction.
    await db.likes.delete_many({"user_id": uid})
    await db.bookmarks.delete_many({"user_id": uid})
    await db.follows.delete_many({"follower_id": uid})
    await db.follows.delete_many({"following_id": uid})
    await db.notifications.delete_many({"user_id": uid})
    await db.notifications.delete_many({"actor_id": uid})
    # Preserve moderation reports as anonymized/orphaned evidence rather than
    # allowing account deletion to erase the moderation history.

    # User-owned records + credentials.
    # Moderation tickets and appeals are permanent history. Keep these records
    # after account deletion so administrators retain the audit trail.
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
    await mark_job("completed", "complete")

    # P2.8: Structured audit log entry for account deletion.
    try:
        username = user_doc.get("username", "unknown") if user_doc else "unknown"
        audit_repo = AuditLogRepository()
        await audit_repo.create(
            admin_id="system",
            admin_username="system",
            action="account_deletion",
            target_type="user",
            target_id=user_id,
            details={
                "username": username,
                "reason": reason,
                "diaries_deleted": diary_count,
                "comments_deleted": comment_count,
                "likes_deleted": like_count,
                "media_deleted": media_count,
                "deletion_timestamp": datetime.now(UTC).isoformat(),
            },
        )
    except Exception:
        logger.warning("PHASE 9: failed to write account deletion audit log for user %s", user_id)

    return result.deleted_count > 0


async def _download_media_files(uid: ObjectId, media_records: list[dict]) -> bytes | None:
    """Download all media files for a user from MinIO and return as a tar.gz."""
    if not media_records:
        return None
    try:
        client = get_minio_client()
        bucket = settings.minio_bucket
        tar_buffer = BytesIO()
        total_bytes = 0
        with tarfile.open(fileobj=tar_buffer, mode="w:gz") as tar:
            for m in media_records:
                for key in (m.get("stored_path"), m.get("standard_path"), m.get("thumbnail_path")):
                    if not key:
                        continue
                    try:
                        def _read_object() -> bytes:
                            response = client.get_object(bucket, key)
                            try:
                                return response.read()
                            finally:
                                response.close()
                                response.release_conn()

                        data = await asyncio.to_thread(_read_object)
                        total_bytes += len(data)
                        if total_bytes > settings.max_export_archive_bytes:
                            raise ValidationException(
                                "The export media exceeds the configured size limit"
                            )
                        safe_name = re.sub(r"[^\w.\-/]", "_", key)
                        safe_name = safe_name.replace("/", "_").replace("\\", "_")
                        info = tarfile.TarInfo(name=safe_name)
                        info.size = len(data)
                        tar.addfile(info, BytesIO(data))
                    except ValidationException:
                        raise
                    except Exception as exc:
                        logger.warning("Failed to download MinIO object %s", key)
                        raise ValidationException(
                            "The export could not read all account media"
                        ) from exc
        tar_buffer.seek(0)
        payload = tar_buffer.getvalue()
        return payload or None
    except ValidationException:
        raise
    except Exception as exc:
        logger.warning("Failed to connect to MinIO for media export", exc_info=True)
        raise ValidationException("The export could not read account media") from exc
