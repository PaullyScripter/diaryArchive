report_indexes: list[tuple[dict, dict]] = [
    (
        {"status": 1, "created_at": -1},
        {"name": "idx_status_created_at"},
    ),
    (
        {"reporter_id": 1, "target_id": 1, "status": 1},
        {"name": "idx_reporter_target_status"},
    ),
    (
        {"created_at": 1},
        {
            "name": "idx_created_at_ttl",
            "expireAfterSeconds": 31536000,
            "partialFilterExpression": {"status": {"$in": ["resolved", "dismissed"]}},
        },
    ),
]
