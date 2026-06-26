comment_indexes: list[tuple[dict, dict]] = [
    (
        {"diary_id": 1, "created_at": 1},
        {"name": "idx_diary_id_created_at"},
    ),
    ({"user_id": 1, "created_at": -1}, {"name": "idx_user_id_created_at"}),
]
