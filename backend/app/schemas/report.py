report_indexes: list[tuple[dict, dict]] = [
    (
        {"status": 1, "created_at": 1},
        {"name": "idx_status_created_at"},
    ),
    (
        {"reporter_id": 1, "created_at": -1},
        {"name": "idx_reporter_id_created_at"},
    ),
    (
        {"target_type": 1, "target_id": 1},
        {"name": "idx_target_type_target_id"},
    ),
]
