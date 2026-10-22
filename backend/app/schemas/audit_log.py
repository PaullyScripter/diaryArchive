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
        {"target_type": 1, "target_id": 1, "created_at": -1},
        {
            "name": "idx_target_created_at",
        },
    ),
]
