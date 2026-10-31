account_deletion_job_indexes: list[tuple[dict, dict]] = [
    ({"user_id": 1, "created_at": -1}, {"name": "idx_user_created_at"}),
    ({"status": 1, "updated_at": 1}, {"name": "idx_status_updated_at"}),
]

account_export_job_indexes: list[tuple[dict, dict]] = [
    ({"user_id": 1, "created_at": -1}, {"name": "idx_user_created_at"}),
    ({"status": 1, "created_at": 1}, {"name": "idx_status_created_at"}),
    ({"expires_at": 1}, {"name": "idx_expires_at_ttl", "expireAfterSeconds": 0}),
]
