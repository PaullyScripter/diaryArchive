import os

# ---------------------------------------------------------------------------
# Test environment, applied BEFORE any app module is imported.
#
# The test suite must ONLY ever run against a throwaway test database.
# Previously this used os.environ.setdefault("MONGODB_URI", ...), which is a
# no-op when a real MONGODB_URI is already present in the environment. When
# that happened, every test's clear_db/setup_database fixture ran its
# delete_many({}) cleanup against the LIVE database and wiped all user
# content (see incident in git history).
#
# We now do two things:
#   1. Force MONGODB_URI to a test database (override, NOT setdefault). A
#      stray MONGODB_URI from the shell/CI/IDE can no longer leak in. An
#      existing "*_test" URI is honored; otherwise a dedicated TEST_MONGODB_URI
#      (defaults to diaryarchive_test) is used.
#   2. Refuse to start if the resolved database name does not end in "_test".
# ---------------------------------------------------------------------------
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")
os.environ.setdefault(
    "EMAIL_ENCRYPTION_KEY",
    "0000000000000000000000000000000000000000000000000000000000000000",
)


def _db_name_from_uri(uri: str) -> str | None:
    """Extract the database name from a Mongo URI, or None if absent."""
    if "://" not in uri:
        return None
    _, _, rest = uri.partition("://")
    if "/" not in rest:
        return None
    path = rest.split("/", 1)[1]
    return path.split("?", 1)[0].split("/", 1)[0] or None


def _is_test_db(uri: str) -> bool:
    name = _db_name_from_uri(uri)
    return bool(name) and name.endswith("_test")


_leaked = os.environ.get("MONGODB_URI", "")
if _is_test_db(_leaked):
    # Honor a test URI that was already set (e.g. CI), but never a real one.
    TEST_MONGODB_URI = _leaked
else:
    TEST_MONGODB_URI = os.environ.get(
        "TEST_MONGODB_URI", "mongodb://localhost:27017/diaryarchive_test"
    )
os.environ["MONGODB_URI"] = TEST_MONGODB_URI

TEST_DB_NAME = _db_name_from_uri(TEST_MONGODB_URI) or "diaryarchive_test"


def _assert_safe_test_database() -> str:
    """Refuse to run unless the suite targets a clearly-marked test database."""
    name = _db_name_from_uri(TEST_MONGODB_URI) or ""
    if not name.endswith("_test"):
        raise RuntimeError(
            "Refusing to run the test suite against non-test database "
            f"{name!r} (MONGODB_URI={TEST_MONGODB_URI!r}). The test target "
            "must be a '<name>_test' database. This guard prevents the suite "
            "from wiping real data."
        )
    return name


import asyncio

import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.database import DatabaseManager


@pytest.fixture(scope="session", autouse=True)
def _guard_test_db_isolation():
    """Fail fast before ANY test body runs if the target is not a test DB."""
    _assert_safe_test_database()


@pytest_asyncio.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    db_name = _assert_safe_test_database()
    assert db_name == TEST_DB_NAME, (
        f"Resolved DB {db_name!r} != TEST_DB_NAME {TEST_DB_NAME!r}"
    )
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