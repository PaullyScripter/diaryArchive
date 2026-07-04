import asyncio

from fastapi import APIRouter

from app.core.database import DatabaseManager
from app.core.minio_client import get_minio_client

router = APIRouter()


@router.get("/health")
async def health_check():
    checks: dict[str, str] = {}

    try:
        db = DatabaseManager.get_db()
        await db.command("ping")
        checks["mongodb"] = "ok"
    except Exception:
        checks["mongodb"] = "unreachable"

    try:
        redis = DatabaseManager.get_redis()
        await redis.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "unreachable"

    try:
        client = get_minio_client()
        await asyncio.to_thread(client.list_buckets)
        checks["minio"] = "ok"
    except Exception:
        checks["minio"] = "unreachable"

    overall = "healthy" if all(v == "ok" for v in checks.values()) else "degraded"

    return {
        "status": overall,
        "checks": checks,
    }
