import asyncio

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
    DatabaseManager._client.diaryarchive = client[TEST_DB_NAME]
    yield
    await client.drop_database(TEST_DB_NAME)
    DatabaseManager._client = None
