notification_indexes: list[tuple[dict, dict]] = [
    (
        {"user_id": 1, "read": 1, "created_at": -1},
        {"name": "idx_user_id_read_created_at"},
    ),
    (
        {"user_id": 1, "read": 1},
        {"name": "idx_user_id_read"},
    ),
    (
        {"created_at": 1},
        {"name": "idx_created_at_ttl", "expireAfterSeconds": 7776000},
    ),
]
