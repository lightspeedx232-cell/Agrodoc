"""Authentication endpoints: register, login, refresh, current user."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..core import security
from ..core.deps import CurrentUser, DbSession
from ..core.limiter import limiter
from ..models.user import User
from ..schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from ..schemas.user import UserCreate, UserOut
from ..services.audit import log_audit_event

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    # Trust only the immediate connection IP; do not blindly trust forwarded headers.
    return request.client.host if request.client else None


def _issue_tokens(user: User) -> TokenResponse:
    extra = {"role": user.role.value, "name": user.full_name}
    return TokenResponse(
        access_token=security.create_access_token(user.id, extra),
        refresh_token=security.create_refresh_token(user.id, extra),
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5 per minute")
def register(payload: UserCreate, db: DbSession, request: Request) -> User:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        preferred_language=payload.preferred_language,
        state=payload.state,
        hashed_password=security.hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10 per minute")
def login(payload: LoginRequest, db: DbSession, request: Request) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not security.verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )
    log_audit_event(db, actor_id=user.id, action="login",
                    ip_address=_client_ip(request))
    return _issue_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: DbSession) -> TokenResponse:
    import jwt as _jwt
    try:
        token_data = security.decode_token(payload.refresh_token)
    except _jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                             detail="Invalid or expired refresh token.")
    if token_data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                             detail="Invalid refresh token type.")

    user = db.scalar(select(User).where(User.id == int(token_data["sub"])))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                             detail="User not found or inactive.")
    return _issue_tokens(user)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user
