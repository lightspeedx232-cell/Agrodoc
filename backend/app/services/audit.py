"""Audit logging helper."""

from sqlalchemy.orm import Session

from ..models.audit import AuditLog


def log_audit_event(
    db: Session,
    *,
    actor_id: int | None,
    action: str,
    target: str | None = None,
    ip_address: str | None = None,
    detail: str | None = None,
) -> None:
    """Persist a single audit record. Failures are swallowed (best-effort)."""
    try:
        db.add(
            AuditLog(
                actor_id=actor_id,
                action=action,
                target=target,
                ip_address=ip_address,
                detail=detail,
            )
        )
        db.commit()
    except Exception:  # pragma: no cover - audit must never break a request
        db.rollback()
