"""FastAPI dependencies: database session, current user, role checks."""

from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models.user import User, UserRole
from . import security

# Re-export for convenient imports.
DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    """Resolve the user from a ``Bearer <token>`` Authorization header."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not authorization or not authorization.lower().startswith("bearer "):
        raise credentials_exception

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = security.decode_token(token)
    except jwt.PyJWTError:
        raise credentials_exception from None

    if payload.get("type") != "access":
        raise credentials_exception

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception

    user = db.scalar(select(User).where(User.id == int(user_id)))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User inactive or not found",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole):
    """Dependency factory that enforces the user has one of the given roles."""

    def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return checker


def get_optional_user(
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> User | None:
    """Like get_current_user but returns None instead of raising (for public routes)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        return get_current_user(db=db, authorization=authorization)
    except HTTPException:
        return None


# Silence the unused-import warning while keeping settings importable here.
__all__ = ["settings", "DbSession", "CurrentUser", "require_role", "get_optional_user"]
