import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import DatabaseManager
from app.core.error_handlers import diaryarchive_exception_handler
from app.core.exceptions import DiaryArchiveException
from app.core.indexes import create_indexes
from app.core.middleware import CSPSecurityMiddleware, RequestIDMiddleware
from app.search.config import initialize_search_indexes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    await DatabaseManager.connect_mongo()
    await DatabaseManager.connect_redis()
    await create_indexes()
    await initialize_search_indexes()
    logger.info("Startup complete")
    yield
    logger.info("Shutting down...")
    await DatabaseManager.close_mongo()
    await DatabaseManager.close_redis()
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(CSPSecurityMiddleware)

app.add_exception_handler(DiaryArchiveException, diaryarchive_exception_handler)


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
        "api": "/api/v1",
    }


app.include_router(api_router, prefix="/api/v1")
