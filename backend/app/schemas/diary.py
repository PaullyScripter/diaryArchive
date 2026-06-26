diary_indexes: list[tuple[dict, dict]] = [
    ({"privacy": 1, "created_at": -1}, {"name": "idx_privacy_created_at"}),
    ({"privacy": 1, "updated_at": -1}, {"name": "idx_privacy_updated_at"}),
    (
        {"privacy": 1, "tags": 1, "created_at": -1},
        {"name": "idx_privacy_tags_created_at"},
    ),
    (
        {"privacy": 1, "emotion": 1, "created_at": -1},
        {"name": "idx_privacy_emotion_created_at"},
    ),
    (
        {"privacy": 1, "year": -1, "month": -1, "created_at": -1},
        {"name": "idx_privacy_year_month_created_at"},
    ),
    ({"user_id": 1, "created_at": -1}, {"name": "idx_user_id_created_at"}),
    (
        {"user_id": 1, "privacy": 1, "created_at": -1},
        {"name": "idx_user_id_privacy_created_at"},
    ),
    ({"privacy": 1, "_id": 1}, {"name": "idx_privacy_id"}),
    (
        {"privacy": 1, "stats.like_count": -1},
        {"name": "idx_privacy_like_count"},
    ),
]
