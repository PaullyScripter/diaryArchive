import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.notification_service import create_notification

USER1 = "aaaaaaaaaaaaaaaaaaaaaaaa"
USER2 = "bbbbbbbbbbbbbbbbbbbbbbbb"
DIARY1 = "cccccccccccccccccccccccc"
COMMENT1 = "dddddddddddddddddddddddd"


class TestNotificationCreation:
    @pytest.mark.asyncio
    async def test_self_action_filter(self):
        """Own actions should not create notifications."""
        with patch("app.services.notification_service.UserRepository") as mock_repo_cls:
            result = await create_notification(
                recipient_id=USER1,
                actor_id=USER1,
                notification_type="like",
                target_id=DIARY1,
            )
            mock_repo_cls.assert_not_called()
            assert result is None

    @pytest.mark.asyncio
    async def test_preference_disabled_returns_none(self):
        """When notify_on_X is False, no notification should be created."""
        mock_recipient = {
            "_id": USER1,
            "username": "recipient",
            "preferences": {"notify_on_like": False, "notify_on_bookmark": True},
        }
        mock_user_repo = MagicMock()
        mock_user_repo.get_by_id = AsyncMock(return_value=mock_recipient)

        with patch("app.services.notification_service.UserRepository", return_value=mock_user_repo):
            result = await create_notification(
                recipient_id=USER1,
                actor_id=USER2,
                notification_type="like",
            )
            assert result is None

    @pytest.mark.asyncio
    async def test_preference_enabled_creates_notification(self):
        """When notify_on_X is True, notification should be created."""
        mock_recipient = {
            "_id": USER1,
            "username": "recipient",
            "preferences": {"notify_on_like": True},
        }
        mock_actor = {
            "_id": USER2,
            "username": "actor_user",
        }
        mock_user_repo = MagicMock()
        mock_user_repo.get_by_id = AsyncMock(side_effect=[mock_recipient, mock_actor])

        mock_notif_repo = MagicMock()
        mock_notif_repo.create = AsyncMock(return_value="fake_id_123")

        with patch("app.services.notification_service.UserRepository", return_value=mock_user_repo), \
             patch("app.services.notification_service.NotificationRepository", return_value=mock_notif_repo):
            result = await create_notification(
                recipient_id=USER1,
                actor_id=USER2,
                notification_type="like",
                target_id=DIARY1,
                metadata={"diary_title": "Test Diary"},
            )
            assert result == "fake_id_123"
            mock_notif_repo.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_bookmark_notify_on_bookmark_false_by_default(self):
        """Bookmark notifications should be off by default unless preference says True."""
        mock_recipient = {
            "_id": USER1,
            "username": "recipient",
            "preferences": {},
        }
        mock_user_repo = MagicMock()
        mock_user_repo.get_by_id = AsyncMock(return_value=mock_recipient)

        with patch("app.services.notification_service.UserRepository", return_value=mock_user_repo):
            result = await create_notification(
                recipient_id=USER1,
                actor_id=USER2,
                notification_type="bookmark",
            )
            assert result is None

    @pytest.mark.asyncio
    async def test_message_includes_diary_title(self):
        """Message should include truncated diary title when provided."""
        mock_recipient = {
            "_id": USER1,
            "username": "recipient",
            "preferences": {"notify_on_like": True},
        }
        mock_actor = {
            "_id": USER2,
            "username": "moonwriter",
        }
        mock_user_repo = MagicMock()
        mock_user_repo.get_by_id = AsyncMock(side_effect=[mock_recipient, mock_actor])

        mock_notif_repo = MagicMock()
        mock_notif_repo.create = AsyncMock(return_value="fake_id")

        with patch("app.services.notification_service.UserRepository", return_value=mock_user_repo), \
             patch("app.services.notification_service.NotificationRepository", return_value=mock_notif_repo):
            await create_notification(
                recipient_id=USER1,
                actor_id=USER2,
                notification_type="like",
                target_id=DIARY1,
                metadata={"diary_title": "A Walk in the Rain"},
            )
            call_args = mock_notif_repo.create.call_args[0][0]
            assert "A Walk in the Rain" in call_args["message"]
            assert call_args["actor_username"] == "moonwriter"
            assert call_args["read"] is False

    @pytest.mark.asyncio
    async def test_follow_message_format(self):
        """Follow notification should have correct message format."""
        mock_recipient = {
            "_id": USER1,
            "username": "recipient",
            "preferences": {"notify_on_follow": True},
        }
        mock_actor = {
            "_id": USER2,
            "username": "moonwriter",
        }
        mock_user_repo = MagicMock()
        mock_user_repo.get_by_id = AsyncMock(side_effect=[mock_recipient, mock_actor])

        mock_notif_repo = MagicMock()
        mock_notif_repo.create = AsyncMock(return_value="fake_id")

        with patch("app.services.notification_service.UserRepository", return_value=mock_user_repo), \
             patch("app.services.notification_service.NotificationRepository", return_value=mock_notif_repo):
            await create_notification(
                recipient_id=USER1,
                actor_id=USER2,
                notification_type="follow",
                target_id=USER2,
            )
            call_args = mock_notif_repo.create.call_args[0][0]
            assert "started following you" in call_args["message"]
            assert call_args["target_type"] == "user"

    @pytest.mark.asyncio
    async def test_comment_message_includes_excerpt(self):
        """Comment notification should include excerpt when provided."""
        mock_recipient = {
            "_id": USER1,
            "username": "recipient",
            "preferences": {"notify_on_comment": True},
        }
        mock_actor = {
            "_id": USER2,
            "username": "commenter",
        }
        mock_user_repo = MagicMock()
        mock_user_repo.get_by_id = AsyncMock(side_effect=[mock_recipient, mock_actor])

        mock_notif_repo = MagicMock()
        mock_notif_repo.create = AsyncMock(return_value="fake_id")

        with patch("app.services.notification_service.UserRepository", return_value=mock_user_repo), \
             patch("app.services.notification_service.NotificationRepository", return_value=mock_notif_repo):
            await create_notification(
                recipient_id=USER1,
                actor_id=USER2,
                notification_type="comment",
                target_id=COMMENT1,
                metadata={"comment_excerpt": "beautifully written"},
            )
            call_args = mock_notif_repo.create.call_args[0][0]
            assert "beautifully written" in call_args["message"]

    @pytest.mark.asyncio
    async def test_missing_recipient_returns_none(self):
        """If recipient doesn't exist, return None gracefully."""
        mock_user_repo = MagicMock()
        mock_user_repo.get_by_id = AsyncMock(return_value=None)

        with patch("app.services.notification_service.UserRepository", return_value=mock_user_repo):
            result = await create_notification(
                recipient_id=USER1,
                actor_id=USER2,
                notification_type="like",
            )
            assert result is None
