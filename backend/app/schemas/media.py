media_indexes: list[tuple[dict, dict]] = [
    ({"diary_id": 1}, {"name": "idx_diary_id"}),
    (
        {"user_id": 1, "created_at": -1},
        {"name": "idx_user_id_created_at"},
    ),
    (
        {"diary_id": 1, "created_at": 1},
        {
            "name": "idx_orphan_ttl",
            "expireAfterSeconds": 86400,
            "partialFilterExpression": {"diary_id": None},
        },
    ),
]
