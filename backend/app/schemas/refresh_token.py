refresh_token_indexes: list[tuple[dict, dict]] = [
    (
        {"token_hash": 1},
        {"unique": True, "name": "idx_token_hash"},
    ),
    (
        {"expires_at": 1},
        {"name": "idx_expires_at_ttl", "expireAfterSeconds": 0},
    ),
    ({"user_id": 1}, {"name": "idx_user_id"}),
]
