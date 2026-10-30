"""User profile, settings, account deletion, and data export."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.deps import CurrentUser, DbSession
from ..models.diagnosis import CropImage, DiagnosisReport
from ..models.farm import Farm, Plot
from ..schemas.common import MessageResponse
from ..schemas.user import UserOut, UserUpdate
from ..services.audit import log_audit_event

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(user: CurrentUser) -> object:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(payload: UserUpdate, user: CurrentUser, db: DbSession) -> object:
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/me", response_model=MessageResponse)
def delete_me(user: CurrentUser, db: DbSession) -> MessageResponse:
    """Permanently delete the current user's account and all owned data."""
    log_audit_event(db, actor_id=user.id, action="account_delete",
                    target=f"user:{user.id}")
    db.delete(user)
    db.commit()
    return MessageResponse(message="Your account and all related data have been deleted.")


@router.get("/me/export")
def export_my_data(user: CurrentUser, db: DbSession):
    """Return all of the user's data as JSON (GDPR-style data export)."""
    farms = db.scalars(select(Farm).where(Farm.owner_id == user.id)).all()
    export = {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "preferred_language": user.preferred_language,
            "state": user.state,
        },
        "farms": [
            {
                "id": f.id,
                "name": f.name,
                "state": f.state,
                "district": f.district,
                "notes": f.notes,
                "plots": [
                    {
                        "id": p.id, "name": p.name, "crop": p.crop,
                        "variety": p.variety, "growth_stage": p.growth_stage,
                        "latitude": p.latitude, "longitude": p.longitude,
                        "area_acres": p.area_acres,
                    }
                    for p in f.plots
                ],
            }
            for f in farms
        ],
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }
    from fastapi.responses import JSONResponse

    return JSONResponse(
        content=export,
        headers={"Content-Disposition": 'attachment; filename="agrodoc-data-export.json"'},
    )
