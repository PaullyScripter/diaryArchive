import asyncio
import logging
import re
import uuid
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
    RequestBodyLimitMiddleware,
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


async def _run_singleton_job(name: str, job) -> None:
    """Run a maintenance job under a short Redis lease when available."""
    token = uuid.uuid4().hex
    key = f"maintenance:lease:{name}"
    redis = None
    acquired = True
    try:
        redis = DatabaseManager.get_redis()
        acquired = bool(await redis.set(key, token, nx=True, ex=300))
    except Exception:
        logger.warning("Maintenance lease unavailable for %s; running locally", name)
    if not acquired:
        return
    try:
        await job()
    finally:
        if redis is not None:
            try:
                await redis.eval(
                    "if redis.call('GET', KEYS[1]) == ARGV[1] then "
                    "return redis.call('DEL', KEYS[1]) else return 0 end",
                    1,
                    key,
                    token,
                )
            except Exception:
                logger.warning("Failed to release maintenance lease %s", name)


async def _warning_check_loop():
    interval = settings.warnings_check_interval_hours * 3600
    while True:
        await asyncio.sleep(interval)
        await _run_singleton_job("warnings", _run_warning_checks)


async def _cleanup_loop():
    interval = settings.cleanup_interval_hours * 3600
    while True:
        await asyncio.sleep(interval)
        await _run_singleton_job("cleanup", _run_cleanup)


async def _search_outbox_loop():
    while True:
        await asyncio.sleep(settings.search_outbox_interval_seconds)
        from app.search.sync import process_outbox

        try:
            result: dict = {}

            async def _process():
                nonlocal result
                result = await process_outbox()

            await _run_singleton_job("search-outbox", _process)
            summary = result
            if summary["processed"]:
                from app.core.metrics import record_task_run

                record_task_run("search_outbox", summary)
                logger.info("Search outbox processed: %s", summary)
        except Exception:
            logger.warning("Search outbox processing failed", exc_info=True)


async def _run_export_jobs():
    from app.services.account_service import process_export_job

    result = await process_export_job()
    if result:
        logger.info("Account export job processed: %s", result)


async def _export_job_loop():
    while True:
        await asyncio.sleep(settings.export_job_poll_interval_seconds)
        try:
            await _run_singleton_job("account-exports", _run_export_jobs)
        except Exception:
            logger.warning("Account export processing failed", exc_info=True)


async def _init_replica_set():
    """Initialize a single-member replica set if configured.

    This enables MongoDB transactions. On a fresh database the first startup
    performs ``rs.initiate``; subsequent startups detect the existing set and
    skip. If the URI does not include ``replicaSet=``, this is a no-op.
    """
    uri = settings.mongodb_uri
    if "replicaSet=" not in uri:
        return

    client = DatabaseManager._client
    if client is None:
        raise RuntimeError("MongoDB client is not initialized")

    match = re.search(r"(?:[?&])replicaSet=([^&]+)", uri)
    rs_name = match.group(1) if match else "diaryarchive"
    host_part = uri.split("://", 1)[1].split("/", 1)[0].split("?")[0]
    if "@" in host_part:
        host_part = host_part.split("@", 1)[1]
    host = host_part.split(",")[0]

    # A URI containing replicaSet= cannot select a primary before the first
    # rs.initiate call. Use a direct bootstrap connection for that command.
    from motor.motor_asyncio import AsyncIOMotorClient
    from pymongo.errors import OperationFailure

    separator = "&" if "?" in uri else "?"
    bootstrap_uri = f"{uri}{separator}directConnection=true"
    bootstrap = AsyncIOMotorClient(bootstrap_uri, serverSelectionTimeoutMS=5000)
    try:
        admin_db = bootstrap.admin
        await admin_db.command("ping")
        try:
            status = await admin_db.command("replSetGetStatus")
        except OperationFailure as exc:
            if getattr(exc, "code", None) not in (94, 76):
                raise
            status = None

        if status and status.get("ok") == 1:
            logger.info("Replica set '%s' is already initialized", rs_name)
        else:
            try:
                await admin_db.command(
                    "replSetInitiate",
                    {"_id": rs_name, "members": [{"_id": 0, "host": host}]},
                )
                logger.info("Replica set '%s' initialized with member %s", rs_name, host)
            except OperationFailure as exc:
                # A second backend starting concurrently may win the race.
                if getattr(exc, "code", None) not in (23, 93) and "already" not in str(exc).lower():
                    raise
                logger.info("Replica set '%s' was initialized concurrently", rs_name)
    finally:
        bootstrap.close()

    # Wait for the election before migrations/index creation use the normal
    # replica-set client.
    for _ in range(20):
        try:
            await client.admin.command("ping")
            return
        except Exception:
            await asyncio.sleep(0.5)
    raise RuntimeError(f"Replica set '{rs_name}' did not become ready")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    await DatabaseManager.connect_mongo()
    await _init_replica_set()
    await DatabaseManager.connect_redis()
    await create_indexes()
    await initialize_search_indexes()
    await initialize_minio()

    background_tasks: set[asyncio.Task] = set()

    if settings.startup_full_reindex:
        async def _initial_reindex():
            try:
                count = await full_reindex()
                logger.info("Initial Meilisearch re-index complete: %d diaries indexed", count)
            except Exception:
                logger.warning("Initial Meilisearch re-index skipped (search unavailable)")

        background_tasks.add(asyncio.create_task(_initial_reindex()))

    background_tasks.add(asyncio.create_task(_run_warning_checks()))
    warning_task = asyncio.create_task(_warning_check_loop())
    cleanup_task = asyncio.create_task(_cleanup_loop())
    outbox_task = asyncio.create_task(_search_outbox_loop())
    export_task = asyncio.create_task(_export_job_loop())
    background_tasks.update({warning_task, cleanup_task, outbox_task, export_task})

    from app.core.metrics import mark_startup_complete

    mark_startup_complete()
    logger.info("Startup complete")
    yield
    logger.info("Shutting down...")
    for task in background_tasks:
        task.cancel()
    await asyncio.gather(*background_tasks, return_exceptions=True)
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
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    application.add_middleware(RequestIDMiddleware)
    application.add_middleware(RequestBodyLimitMiddleware)
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
