import asyncio

from fastapi import APIRouter, Response

from app.core.config import settings
from app.core.database import DatabaseManager
from app.core.metrics import render_metrics
from app.core.minio_client import get_minio_client

router = APIRouter()


@router.get("/metrics")
async def metrics(response: Response):
    response.headers["Content-Type"] = "text/plain; version=0.0.4"
    return render_metrics()


@router.get("/startup")
async def startup_probe(response: Response):
    """Kubernetes/Docker startup probe.

    Returns 200 only after the backend has fully initialized (MongoDB, Redis,
    Meilisearch, MinIO all reachable). Liveness/readiness probes should use
    ``/health`` instead.
    """
    from app.core.metrics import _STARTUP_COMPLETE
    if not _STARTUP_COMPLETE:
        response.status_code = 503
        return {"status": "initializing"}
    return {"status": "ready"}


@router.get("/health")
async def health_check(response: Response):
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

    try:
        import meilisearch

        meili = meilisearch.Client(
            settings.meilisearch_url, api_key=settings.meilisearch_api_key or None
        )
        meili.health()
        checks["meilisearch"] = "ok"
    except Exception:
        checks["meilisearch"] = "unreachable"

    overall = "healthy" if all(v == "ok" for v in checks.values()) else "degraded"

    if overall != "healthy":
        response.status_code = 503

    return {
        "status": overall,
        "checks": checks,
    }
