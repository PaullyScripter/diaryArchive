import asyncio
import logging

from minio import Minio

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: Minio | None = None
_bucket_initialized: bool = False


def get_minio_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            endpoint=settings.minio_endpoint.replace("http://", "").replace("https://", ""),
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            region=settings.minio_region,
            secure=settings.minio_endpoint.startswith("https"),
        )
    return _client


async def initialize_minio() -> None:
    global _bucket_initialized
    if _bucket_initialized:
        return

    async def _ensure_bucket():
        try:
            client = get_minio_client()
            found = client.bucket_exists(settings.minio_bucket)
            if not found:
                client.make_bucket(settings.minio_bucket, location=settings.minio_region)
                logger.info("Created MinIO bucket '%s'", settings.minio_bucket)
            else:
                logger.info("MinIO bucket '%s' already exists", settings.minio_bucket)
            return True
        except Exception:
            logger.warning("MinIO unavailable - media uploads will fail")
            return False

    result = await asyncio.to_thread(_ensure_bucket)
    _bucket_initialized = result
