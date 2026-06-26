follow_indexes: list[tuple[dict, dict]] = [
    (
        {"follower_id": 1, "following_id": 1},
        {"unique": True, "name": "idx_follower_id_following_id"},
    ),
    (
        {"follower_id": 1, "created_at": -1},
        {"name": "idx_follower_id_created_at"},
    ),
    (
        {"following_id": 1, "created_at": -1},
        {"name": "idx_following_id_created_at"},
    ),
]
