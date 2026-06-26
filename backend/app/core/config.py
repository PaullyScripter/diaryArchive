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

    meilisearch_url: str = "http://meilisearch:7700"
    meilisearch_api_key: str = ""

    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {
        "env_file": (".env.development", ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
