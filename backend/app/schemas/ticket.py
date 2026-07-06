ticket_indexes: list[tuple[dict, dict]] = [
    (
        {"user_id": 1, "created_at": -1},
        {"name": "idx_ticket_user_created_at"},
    ),
    (
        {"status": 1, "created_at": -1},
        {"name": "idx_ticket_status_created_at"},
    ),
    (
        {"assigned_admin_id": 1, "created_at": -1},
        {"name": "idx_ticket_admin_created_at"},
    ),
]
