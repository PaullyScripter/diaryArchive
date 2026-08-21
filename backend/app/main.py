import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import DatabaseManager
from app.core.error_handlers import diaryarchive_exception_handler, generic_exception_handler
from app.core.exceptions import DiaryArchiveException
from app.core.indexes import create_indexes
from app.core.middleware import (
    CSPSecurityMiddleware,
    RequestIDMiddleware,
    RequestLoggingMiddleware,
)
from app.core.minio_client import initialize_minio
from app.search.config import initialize_search_indexes
from app.search.sync import full_reindex

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _run_warning_checks():
    from app.tasks.warnings import check_bio_warnings, check_username_warnings

    logger.info("Running warning deadline checks...")
    try:
        bio_count = await check_bio_warnings()
        logger.info("Bio warnings processed: %d", bio_count)
    except Exception:
        logger.warning("Bio warning check failed", exc_info=True)

    try:
        user_count = await check_username_warnings()
        logger.info("Username warnings processed: %d", user_count)
    except Exception:
        logger.warning("Username warning check failed", exc_info=True)


async def _run_cleanup():
    from app.tasks.cleanup import run_cleanup

    logger.info("Running orphan sweep + counter reconciliation (MED-2)...")
    try:
        summary = await run_cleanup()
        from app.core.metrics import record_task_run

        record_task_run("cleanup", summary)
        logger.info("Cleanup summary: %s", summary)
    except Exception:
        logger.warning("Cleanup run failed", exc_info=True)


async def _warning_check_loop():
    interval = settings.warnings_check_interval_hours * 3600
    while True:
        await asyncio.sleep(interval)
        await _run_warning_checks()


async def _cleanup_loop():
    interval = settings.cleanup_interval_hours * 3600
    while True:
        await asyncio.sleep(interval)
        await _run_cleanup()


async def _search_outbox_loop():
    while True:
        await asyncio.sleep(settings.search_outbox_interval_seconds)
        from app.search.sync import process_outbox

        try:
            summary = await process_outbox()
            if summary["processed"]:
                from app.core.metrics import record_task_run

                record_task_run("search_outbox", summary)
                logger.info("Search outbox processed: %s", summary)
        except Exception:
            logger.warning("Search outbox processing failed", exc_info=True)


async def _init_replica_set():
    """Initialize a single-member replica set if configured.

    This enables MongoDB transactions. On a fresh database the first startup
    performs ``rs.initiate``; subsequent startups detect the existing set and
    skip. If the URI does not include ``replicaSet=``, this is a no-op.
    """
    try:
        client = DatabaseManager._client
        if client is None:
            return
        # Check whether the URI requests a replica set.
        uri = settings.mongodb_uri
        if "replicaSet=" not in uri:
            return
        admin_db = client.admin
        status = await admin_db.command("replSetGetStatus").catch(
            lambda _: None
        )
        if status and status.get("ok") == 1:
            return
        # Not yet initialized; initiate with the current member.
        import re
        match = re.search(r"replicaSet=([^&]+)", uri)
        rs_name = match.group(1) if match else "diaryarchive"
        # Derive the hostname:port from the URI (first host in the list).
        host_part = uri.split("://", 1)[1].split("/")[0].split("?")[0]
        # Strip credentials if present (host part is after @).
        if "@" in host_part:
            host_part = host_part.split("@", 1)[1]
        host = host_part.split(",")[0]  # take first member
        await admin_db.command("replSetInitiate", {
            "_id": rs_name,
            "members": [{"_id": 0, "host": host}],
        })
        logger.info("Replica set '%s' initialized with member %s", rs_name, host)
    except Exception:
        # Replica set may already be initialized or not configured; non-fatal.
        logger.debug("Replica set init skipped or failed", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    await DatabaseManager.connect_mongo()
    await _init_replica_set()
    await DatabaseManager.connect_redis()
    await create_indexes()
    await initialize_search_indexes()
    await initialize_minio()

    async def _initial_reindex():
        try:
            count = await full_reindex()
            logger.info("Initial Meilisearch re-index complete: %d diaries indexed", count)
        except Exception:
            logger.warning("Initial Meilisearch re-index skipped (search unavailable)")

    asyncio.create_task(_initial_reindex())

    asyncio.create_task(_run_warning_checks())
    warning_task = asyncio.create_task(_warning_check_loop())
    cleanup_task = asyncio.create_task(_cleanup_loop())
    outbox_task = asyncio.create_task(_search_outbox_loop())

    from app.core.metrics import mark_startup_complete
    mark_startup_complete()
    logger.info("Startup complete")
    yield
    logger.info("Shutting down...")
    warning_task.cancel()
    cleanup_task.cancel()
    outbox_task.cancel()
    await DatabaseManager.close_mongo()
    await DatabaseManager.close_redis()
    logger.info("Shutdown complete")


# FastAPI interactive docs (/docs, /redoc, /openapi.json) are development-only.
# In production (debug disabled) the routes must NOT exist at all so the full
# API schema is never exposed to unauthenticated clients.
def create_app() -> FastAPI:
    """Build the FastAPI application.

    Kept as a factory so tests can construct the app with a given debug mode
    and assert that docs are gated on development only.
    """
    docs_enabled = settings.debug
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_middleware(RequestIDMiddleware)
    application.add_middleware(RequestLoggingMiddleware)
    application.add_middleware(CSPSecurityMiddleware)

    application.add_exception_handler(DiaryArchiveException, diaryarchive_exception_handler)
    application.add_exception_handler(Exception, generic_exception_handler)

    @application.get("/")
    async def root():
        return {
            "app": settings.app_name,
            "version": "0.1.0",
            "api": "/api/v1",
        }

    application.include_router(api_router, prefix="/api/v1")
    return application


app = create_app()
