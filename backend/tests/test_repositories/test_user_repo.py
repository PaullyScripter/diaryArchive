import pytest
from bson import ObjectId

from app.core.exceptions import ConflictException
from app.repositories.user_repo import UserRepository


@pytest.fixture
def user_repo():
    return UserRepository()


@pytest.mark.asyncio
async def test_create_user(user_repo: UserRepository):
    user_id = await user_repo.create_user(
        {
            "username": "testuser",
            "password_hash": "hashed_password",
            "is_admin": False,
            "is_banned": False,
            "preferences": {
                "theme": "system",
                "comments_disabled": False,
                "email_notifications": False,
                "notify_on_like": True,
                "notify_on_comment": True,
                "notify_on_follow": True,
                "notify_on_bookmark": False,
            },
            "stats": {
                "diary_count": 0,
                "follower_count": 0,
                "following_count": 0,
            },
            "created_at": None,
            "updated_at": None,
            "last_login_at": None,
        }
    )
    assert ObjectId.is_valid(user_id)


@pytest.mark.asyncio
async def test_create_duplicate_username(user_repo: UserRepository):
    await user_repo.create_user({"username": "dupuser", "password_hash": "hash"})
    with pytest.raises(ConflictException, match="Username is already taken"):
        await user_repo.create_user({"username": "dupuser", "password_hash": "hash"})


@pytest.mark.asyncio
async def test_get_by_username(user_repo: UserRepository):
    await user_repo.create_user({"username": "findme", "password_hash": "hash"})
    user = await user_repo.get_by_username("findme")
    assert user is not None
    assert user["username"] == "findme"


@pytest.mark.asyncio
async def test_get_by_id(user_repo: UserRepository):
    user_id = await user_repo.create_user(
        {"username": "byid", "password_hash": "hash"}
    )
    user = await user_repo.get_by_id(str(user_id))
    assert user is not None
    assert user["username"] == "byid"


@pytest.mark.asyncio
async def test_update_user(user_repo: UserRepository):
    user_id = await user_repo.create_user(
        {"username": "updatable", "password_hash": "hash"}
    )
    updated = await user_repo.update(
        str(user_id), {"about": "Updated bio"}
    )
    assert updated is True
    user = await user_repo.get_by_id(str(user_id))
    assert user["about"] == "Updated bio"


@pytest.mark.asyncio
async def test_delete_user(user_repo: UserRepository):
    user_id = await user_repo.create_user(
        {"username": "deletable", "password_hash": "hash"}
    )
    deleted = await user_repo.delete(str(user_id))
    assert deleted is True
    user = await user_repo.get_by_id(str(user_id))
    assert user is None


@pytest.mark.asyncio
async def test_count_users(user_repo: UserRepository):
    await user_repo.create_user({"username": "count1", "password_hash": "hash"})
    await user_repo.create_user({"username": "count2", "password_hash": "hash"})
    count = await user_repo.count()
    assert count >= 2
