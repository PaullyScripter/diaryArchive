audit_log_indexes: list[tuple[dict, dict]] = [
    ({"created_at": -1}, {"name": "idx_created_at"}),
    (
        {"actor_id": 1, "created_at": -1},
        {"name": "idx_actor_id_created_at"},
    ),
    (
        {"target_type": 1, "target_id": 1, "created_at": -1},
        {"name": "idx_target_type_target_id_created_at"},
    ),
]
