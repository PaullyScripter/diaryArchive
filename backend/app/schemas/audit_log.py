audit_log_indexes: list[tuple[dict, dict]] = [
    (
        {"created_at": -1},
        {"name": "idx_created_at"},
    ),
    (
        {"action": 1, "created_at": -1},
        {"name": "idx_action_created_at"},
    ),
    (
        {"admin_id": 1, "created_at": -1},
        {"name": "idx_admin_id_created_at"},
    ),
    (
        {"created_at": 1},
        {
            "name": "idx_created_at_ttl",
            "expireAfterSeconds": 31536000,
        },
    ),
]
