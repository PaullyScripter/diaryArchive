report_indexes: list[tuple[dict, dict]] = [
    (
        {"status": 1, "created_at": -1},
        {"name": "idx_status_created_at"},
    ),
    (
        {"reporter_id": 1, "target_type": 1, "target_id": 1, "status": 1},
        {
            "name": "idx_pending_target_unique",
            "unique": True,
            # MongoDB partial indexes do not support $ne/$not. Enumerate the
            # supported report targets so bug reports remain unconstrained.
            "partialFilterExpression": {
                "status": "pending",
                "target_type": {"$in": ["user", "diary", "comment"]},
            },
        },
    ),
    (
        {
            "reporter_id": 1,
            "target_type": 1,
            "reason": 1,
            "description": 1,
            "url": 1,
            "status": 1,
        },
        {
            "name": "idx_pending_bug_unique",
            "unique": True,
            "partialFilterExpression": {"status": "pending", "target_type": "bug"},
        },
    ),
    (
        {"created_at": -1},
        {"name": "idx_created_at"},
    ),
]
