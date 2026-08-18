import logging
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.config import settings
from app.core.metrics import record_request

logger = logging.getLogger(__name__)


def _normalize_origin(origin: str | None) -> str | None:
    """Normalize a configured origin (e.g. 'https://api.example.com/api/v1')
    to a plain origin ('https://api.example.com') or None."""
    if not origin or not origin.strip():
        return None
    origin = origin.strip().rstrip("/")
    if "://" not in origin:
        # A relative path (e.g. '/api/v1') means same-origin: not an extra host.
        return None
    return origin


def _origin_host(origin: str) -> str:
    """Return scheme+host (no path) for a normalized origin."""
    return origin.split("://", 1)[0] + "://" + origin.split("://", 1)[1].split("/", 1)[0]


def _build_csp() -> str:
    """Build the Content-Security-Policy from production configuration.

    Only origins derived from settings are allowed. Development origins
    (localhost / internal MinIO) are added ONLY in debug mode so they never
    leak into production responses.
    """
    media_hosts: set[str] = set()
    connect_hosts: set[str] = set()

    # Resource sources for API responses are the media origin and the API
    # origin only. The frontend origin (public_app_url) is served by 'self' and
    # is NOT a media/connect source.
    for origin in (
        settings.public_media_base_url,
        settings.public_api_url,
    ):
        norm = _normalize_origin(origin)
        if norm:
            host = _origin_host(norm)
            # Media images come from the media base or the API origin.
            media_hosts.add(host)
            connect_hosts.add(host)

    if settings.debug:
        # Development-only origins: local MinIO (dev) and local API host.
        media_hosts.add("http://localhost:9000")
        media_hosts.add("http://minio:9000")
        connect_hosts.add("http://localhost:9000")
        connect_hosts.add("http://minio:9000")
        connect_hosts.add("http://localhost:8000")

    img_src = " ".join(["'self'", "data:", "blob:", *sorted(media_hosts)])
    connect_src = " ".join(["'self'", *sorted(connect_hosts)])

    return (
        f"default-src 'self'; script-src 'self'; style-src 'self'; "
        f"img-src {img_src}; connect-src {connect_src}; font-src 'self'; "
        "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
    )


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Structured request logging with timing, method, path, status, and client IP."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        request_id = request.headers.get("X-Request-ID", "unknown")
        client_ip = getattr(request.client, "host", "unknown")
        if settings.anonymize_ip_in_logs:
            client_ip = _anonymize_ip(client_ip)
        try:
            response: Response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - start) * 1000
            record_request(request.url.path, 500, elapsed_ms / 1000)
            logger.warning(
                "request error | id=%s method=%s path=%s ip=%s elapsed_ms=%.1f",
                request_id,
                request.method,
                request.url.path,
                client_ip,
                elapsed_ms,
            )
            raise
        elapsed_ms = (time.perf_counter() - start) * 1000
        record_request(request.url.path, response.status_code, elapsed_ms / 1000)
        logger.info(
            "request | id=%s method=%s path=%s status=%s ip=%s elapsed_ms=%.1f",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            client_ip,
            elapsed_ms,
        )
        return response


def _anonymize_ip(ip: str) -> str:
    """Truncate the last octet of IPv4 (and best-effort for IPv6) so logs do
    not retain a full client IP, while preserving enough for coarse security
    analysis. Never touches IPv4-mapped or invalid values."""
    ip = ip.strip()
    if not ip or ip == "unknown":
        return ip
    if ":" in ip and ip.count(".") == 0:
        # IPv6 - retain the first hextet and mark the rest.
        return ip.split(":")[0] + ":xxxx"
    if "." in ip:
        parts = ip.split(".")
        if len(parts) == 4:
            parts[3] = "x"
            return ".".join(parts)
    return ip


class CSPSecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # HSTS is only appropriate over HTTPS. When the request arrived over
        # plain HTTP (e.g. a dev load balancer or direct backend access) it is
        # omitted so the header is never emitted for insecure channels.
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = _build_csp()
        return response
