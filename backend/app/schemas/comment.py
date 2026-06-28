comment_indexes: list[tuple[dict, dict]] = [
    (
        {"diary_id": 1, "created_at": 1},
        {"name": "idx_diary_id_created_at"},
    ),
    ({"user_id": 1, "created_at": -1}, {"name": "idx_user_id_created_at"}),
    (
        {"diary_id": 1, "parent_comment_id": 1, "created_at": 1},
        {"name": "idx_diary_id_parent_created_at"},
    ),
    (
        {"parent_comment_id": 1, "created_at": 1},
        {"name": "idx_parent_id_created_at"},
    ),
]

comment_like_indexes: list[tuple[dict, dict]] = [
    (
        {"comment_id": 1, "user_id": 1},
        {"unique": True, "name": "idx_comment_like_user"},
    ),
]

