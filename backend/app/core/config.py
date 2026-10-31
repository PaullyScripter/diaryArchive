from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "DiaryArchive"
    debug: bool = False

    mongodb_uri: str = "mongodb://mongodb:27017/diaryarchive"
    mongodb_max_pool_size: int = 100
    mongodb_min_pool_size: int = 10

    redis_url: str = "redis://redis:6379/0"

    minio_endpoint: str = "http://minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "diaryarchive"
    minio_region: str = "us-east-1"
    # Public media origin used only for sanitizer/CSP allowlisting. Media
    # responses themselves always use the authorization-aware proxy.
    public_media_base_url: str | None = None

    meilisearch_url: str = "http://meilisearch:7700"
    meilisearch_api_key: str = ""

    secret_key: str = ""
    jwt_issuer: str = "diaryarchive"
    jwt_audience: str = "diaryarchive-api"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    email_encryption_key: str = ""

    # Outbound transactional email (password reset / email verification).
    # Leave SMTP settings empty to disable delivery entirely; the service then
    # logs the would-be email (still keeps auth flows working in dev).
    email_provider: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = True
    email_from: str = "DiaryArchive <no-reply@diaryarchive.local>"
    # Public origin used to build reset/verify links inside emails. Must be the
    # origin the user's browser actually talks to (NOT an internal docker host).
    public_app_url: str = "http://localhost:3000"
    # External, publicly reachable backend/API origin (no trailing path). Used
    # to build absolute media URLs and CSP connect-src/img-src entries. When
    # unset, responses fall back to same-origin relative URLs.
    public_api_url: str | None = None

    cors_origins: list[str] = ["http://localhost:3000"]
    trusted_proxy_cidrs: list[str] = ["127.0.0.1/32", "::1/128"]

    max_media_per_user: int = 500
    max_media_per_diary: int = 20
    max_daily_uploads: int = 50
    # Bound concurrent multipart buffering and image transcoding per backend
    # process. This is intentionally separate from per-user rate limits so a
    # burst of distinct accounts cannot exhaust memory/CPU in one process.
    media_upload_concurrency: int = 4
    media_upload_acquire_timeout_seconds: float = 5.0
    max_export_records_per_collection: int = 10_000
    max_export_archive_bytes: int = 100 * 1024 * 1024
    export_job_retention_hours: int = 24
    export_job_lease_minutes: int = 30
    export_job_poll_interval_seconds: int = 15

    # Privacy: client IP address retention.
    #   - If true, request logs store a truncated/anon IP (first three octets).
    #   - log_retention_days bounds how long request logs are retained by the
    #     retention job (0 disables automatic deletion).
    anonymize_ip_in_logs: bool = True
    log_retention_days: int = 30

    # Backup & restore (see docker/scripts/backup.sh, restore.sh, verify-restore.sh).
    # These are consumed by the ops scripts via the production environment.
    backup_dir: str = "/backups"
    backup_encryption_enabled: bool = True
    # Prometheus is an internal control-plane client. In production the
    # metrics route requires a bearer token read from this mounted secret.
    # Keeping the token in a file avoids exposing it through process listings
    # or ordinary environment inspection.
    metrics_token_file: str = ""
    backup_retention_daily: int = 14
    backup_retention_weekly: int = 8
    backup_retention_monthly: int = 6

    warnings_check_interval_hours: int = 1

    # Orphan sweep + counter reconciliation cadence. Runs as a periodic
    # in-process task (MED-2); 24h is a sensible default for production.
    cleanup_interval_hours: int = 24

    # How often the durable search-sync outbox worker polls for pending entries.
    search_outbox_interval_seconds: int = 30
    # Full search rebuilds are an explicit maintenance action in production;
    # running one on every replica startup causes a thundering herd.
    startup_full_reindex: bool = False

    # Centralized rate limits: key -> (max_attempts, window_seconds). Endpoints
    # read from here via get_rate_limit so policy is tunable in one place rather
    # than being scattered inline across endpoint files.
    rate_limits: dict[str, tuple[int, int]] = {
        # auth
        "register": (5, 60),
        "login": (10, 60),
        "login_user": (5, 300),
        # Per-account failed-login lockout (independent of client IP so rotating
        # IPs cannot brute-force a single account). 5 failures -> 15 min cooldown.
        "login_account": (5, 900),
        "refresh": (20, 60),
        "password_reset_request": (3, 3600),
        "password_reset_submit": (10, 3600),
        "verify_email": (10, 3600),
        "request_email_verification": (3, 3600),
        # appeals
        "appeal_status": (12, 300),
        "appeal_submit": (3, 3600),
        "appeal_reply": (5, 3600),
        "appeal_standing": (5, 900),
        "appeal_status_lockout": (8, 900),
        "appeal_submit_lockout": (5, 3600),
        "appeal_reply_lockout": (8, 3600),
        "appeal_standing_lockout": (5, 900),
        # admin
        "admin_ticket_reply": (30, 60),
        "admin_ticket_close": (30, 60),
        "admin_ticket_resolve": (30, 60),
        "admin_warning": (60, 60),
        # Admin mutations are globally throttled per admin account so a
        # compromised admin token cannot mass-delete/hide/ban at will.
        "admin_action": (120, 60),
        "admin_report_action": (60, 60),
    }

    def get_rate_limit(self, name: str) -> tuple[int, int]:
        return self.rate_limits.get(name, (30, 60))

    # Known weak / committed development values that are acceptable only when
    # debug mode is enabled. Outside debug mode (i.e. in any real deployment)
    # startup fails closed if one of these leaks through.
    _KNOWN_WEAK_SECRETS = {
        "change-me-in-production",
        "dev-secret-for-local-development-only-not-production",
        "dev-secret-key-only-for-local-development",
    }

    _model_validator_mode = "after"

    @model_validator(mode="after")
    def enforce_secrets(self):
        # In debug mode allow the documented development values (gitignored
        # overrides normally replace them). Outside debug mode, fail closed.
        if self.debug:
            return self

        if not self.secret_key or self.secret_key.lower() in self._KNOWN_WEAK_SECRETS:
            raise ValueError(
                "SECRET_KEY must be a secure random value (development placeholders are "
                "not allowed outside debug mode)"
            )
        if len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")

        if not self.jwt_issuer.strip() or not self.jwt_audience.strip():
            raise ValueError("JWT_ISSUER and JWT_AUDIENCE must be configured")

        if not self.email_encryption_key or len(self.email_encryption_key) != 64:
            raise ValueError("EMAIL_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)")
        if self.email_encryption_key.lower() != self.email_encryption_key or any(
            c not in "0123456789abcdef" for c in self.email_encryption_key.lower()
        ):
            raise ValueError("EMAIL_ENCRYPTION_KEY must be a valid hex string")
        if int(self.email_encryption_key, 16) == 0:
            raise ValueError("EMAIL_ENCRYPTION_KEY must not be all zeros")

        if self.minio_access_key == "minioadmin":
            raise ValueError("MINIO_ACCESS_KEY must not use the default 'minioadmin' value")
        if not self.minio_secret_key or self.minio_secret_key == "minioadmin":
            raise ValueError("MINIO_SECRET_KEY must not use a default value")
        if not self.meilisearch_api_key or self.meilisearch_api_key == "dev-master-key":
            raise ValueError("MEILISEARCH_API_KEY must be configured in production")
        if not self.metrics_token_file.strip():
            raise ValueError("METRICS_TOKEN_FILE must point to a mounted Prometheus token")

        if not self.debug:
            if "*" in self.cors_origins:
                raise ValueError("CORS_ORIGINS must not contain '*' in production")
            for origin in self.cors_origins:
                if origin.startswith("http://") and "localhost" not in origin:
                    raise ValueError(f"CORS_ORIGINS must not use http:// in production: {origin}")
            for name, origin in (
                ("PUBLIC_APP_URL", self.public_app_url),
                ("PUBLIC_API_URL", self.public_api_url),
            ):
                if origin:
                    if not origin.startswith("https://"):
                        raise ValueError(f"{name} must use https:// in production")
                    if "localhost" in origin or "127.0.0.1" in origin:
                        raise ValueError(f"{name} must not point to localhost in production")
            if self.email_provider and not self.smtp_host:
                raise ValueError("SMTP_HOST is required when EMAIL_PROVIDER is configured")

        return self

    model_config = {
        "env_file": (".env.development", ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
