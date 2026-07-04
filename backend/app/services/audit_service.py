import logging

from app.repositories.audit_log_repo import AuditLogRepository

logger = logging.getLogger(__name__)


async def log_audit(
    admin_id: str,
    admin_username: str,
    action: str,
    target_type: str,
    target_id: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
) -> str:
    repo = AuditLogRepository()
    doc = {
        "admin_id": admin_id,
        "admin_username": admin_username,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "details": details or {},
        "ip_address": ip_address,
    }
    log_id = await repo.create_log(doc)
    logger.info(
        "Audit: %s performed %s on %s/%s",
        admin_username, action, target_type, target_id,
    )
    return log_id


async def list_audit_logs(
    action: str | None = None,
    admin_id: str | None = None,
    target_type: str | None = None,
    from_date=None,
    to_date=None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    skip = (page - 1) * per_page
    repo = AuditLogRepository()

    logs = await repo.find_logs(
        action=action,
        admin_id=admin_id,
        target_type=target_type,
        from_date=from_date,
        to_date=to_date,
        skip=skip,
        limit=per_page,
    )
    total = await repo.count_logs(
        action=action,
        admin_id=admin_id,
        target_type=target_type,
        from_date=from_date,
        to_date=to_date,
    )

    result = []
    for log in logs:
        result.append({
            "id": str(log["_id"]),
            "admin_id": str(log.get("admin_id", "")),
            "admin_username": log.get("admin_username", "unknown"),
            "action": log.get("action", ""),
            "target_type": log.get("target_type", ""),
            "target_id": log.get("target_id"),
            "details": log.get("details", {}),
            "ip_address": log.get("ip_address"),
            "created_at": log["created_at"],
        })

    has_next = skip + per_page < total
    has_prev = page > 1

    return {
        "data": result,
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "has_next": has_next,
            "has_prev": has_prev,
        },
    }
