user_indexes: list[tuple[dict, dict]] = [
    ({"username": 1}, {"unique": True, "name": "idx_username"}),
    (
        {"email_hash": 1},
        {
            "unique": True,
            "sparse": True,
            "name": "idx_email_hash",
        },
    ),
    ({"created_at": -1}, {"name": "idx_created_at"}),
]
