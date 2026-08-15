import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")
os.environ.setdefault(
    "EMAIL_ENCRYPTION_KEY",
    "0000000000000000000000000000000000000000000000000000000000000000",
)
os.environ.setdefault(
    "MONGODB_URI", "mongodb://localhost:27017/diaryarchive_test"
)

import asyncio

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.database import DatabaseManager

TEST_MONGODB_URI = "mongodb://localhost:27017"
TEST_DB_NAME = "diaryarchive_test"


@pytest_asyncio.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    client = AsyncIOMotorClient(TEST_MONGODB_URI)
    DatabaseManager._client = client
    yield
    await client.drop_database(TEST_DB_NAME)
    DatabaseManager._client = None


@pytest.fixture(autouse=True)
def reset_fallback_rate_limit():
    """Clear the in-process rate-limit fallback between tests.

    The fallback limiter is a module-level dict keyed by client IP; tests all
    run from 127.0.0.1, so without a reset the per-window counters would leak
    across tests and spuriously trip low limits (e.g. register 5/min).
    """
    from app.core import security

    security._fallback_hits.clear()
    yield
    security._fallback_hits.clear()
