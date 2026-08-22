import logging
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

QUERY_PATTERNS: list[tuple[str, dict[str, Any], list[tuple[str, int]], str]] = [
    ("diaries", {"privacy": "public"}, [("created_at", -1)], "public feed"),
    ("diaries", {"privacy": "public", "tags": {"$in": ["test"]}}, [("created_at", -1)], "feed by tag"),
    ("diaries", {"privacy": "public", "emotion": "happy"}, [("created_at", -1)], "feed by emotion"),
    ("diaries", {"user_id": "placeholder"}, [("created_at", -1)], "user diaries"),
    ("diaries", {"_id": "placeholder"}, [], "diary by id"),
    ("comments", {"diary_id": "placeholder"}, [("created_at", 1)], "comments by diary"),
    ("likes", {"diary_id": "placeholder"}, [], "likes by diary"),
    ("likes", {"user_id": "placeholder", "diary_id": "placeholder"}, [], "user like check"),
    ("bookmarks", {"diary_id": "placeholder"}, [], "bookmarks by diary"),
    ("bookmarks", {"user_id": "placeholder", "diary_id": "placeholder"}, [], "user bookmark check"),
    ("follows", {"follower_id": "placeholder", "following_id": "placeholder"}, [], "follow check"),
    ("notifications", {"user_id": "placeholder"}, [("created_at", -1)], "user notifications"),
    ("notifications", {"user_id": "placeholder", "read_at": None}, [], "unread count"),
    ("reports", {"status": "pending"}, [("created_at", -1)], "pending reports"),
    ("audit_logs", [], [("created_at", -1)], "audit log listing"),
    ("media", {"user_id": "placeholder"}, [("created_at", -1)], "user media"),
    ("media", {"diary_id": "placeholder"}, [], "diary media"),
    ("users", {"username": "placeholder"}, [], "user by username"),
]


def _extract_winning_stage(explain_result: dict[str, Any]) -> str | None:
    try:
        stage = explain_result["queryPlanner"]["winningPlan"]["stage"]
        return stage
    except (KeyError, TypeError):
        return None


def _has_index_stage(explain_result: dict[str, Any]) -> bool:
    try:
        winning = explain_result["queryPlanner"]["winningPlan"]
        if winning.get("stage") in ("IXSCAN", "IDHACK"):
            return True
        if winning.get("stage") == "FETCH":
            input_stage = winning.get("inputStage", {})
            return input_stage.get("stage") in ("IXSCAN", "IDHACK", "OR")
        return False
    except (KeyError, TypeError):
        return False


async def verify_indexes(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    results: dict[str, Any] = {}
    collscan_count = 0

    for collection_name, filter_query, sort, description in QUERY_PATTERNS:
        collection = db[collection_name]
        query_filter = filter_query if filter_query else {}

        try:
            cursor = collection.find(query_filter)
            if sort:
                cursor = cursor.sort(sort)
            explain_result = await cursor.explain()
            stage = _extract_winning_stage(explain_result)

            if stage == "COLLSCAN":
                logger.warning(
                    "COLLSCAN detected for query: %s on collection '%s' (%s)",
                    filter_query,
                    collection_name,
                    description,
                )
                collscan_count += 1
                results[description] = {"status": "COLLSCAN", "collection": collection_name}
            elif _has_index_stage(explain_result):
                results[description] = {"status": "OK", "stage": stage, "collection": collection_name}
            else:
                logger.warning(
                    "Unexpected plan stage '%s' for query: %s on collection '%s' (%s)",
                    stage,
                    filter_query,
                    collection_name,
                    description,
                )
                results[description] = {"status": "UNEXPECTED", "stage": stage, "collection": collection_name}
        except Exception as exc:
            logger.warning(
                "Failed to explain query for '%s' on '%s': %s",
                description,
                collection_name,
                exc,
            )
            results[description] = {"status": "ERROR", "error": str(exc), "collection": collection_name}

    return {
        "total": len(QUERY_PATTERNS),
        "collscan_count": collscan_count,
        "results": results,
    }


async def run_index_check(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    summary = await verify_indexes(db)

    if summary["collscan_count"] > 0:
        logger.warning(
            "Index check: %d of %d queries use COLLSCAN",
            summary["collscan_count"],
            summary["total"],
        )
    else:
        logger.info("Index check: all %d queries use indexes", summary["total"])

    return summary
