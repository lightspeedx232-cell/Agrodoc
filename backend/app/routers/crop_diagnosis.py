"""Crop Doctor endpoints: image upload, AI analysis, report retrieval.

This is the backend the webcam scanner talks to. It validates every upload,
persists the image privately, runs the configured inference adapter, and stores
the report. When no AI provider is configured it returns a clear "unavailable"
result instead of fabricating a diagnosis.
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.deps import CurrentUser, DbSession
from ..core.limiter import limiter
from ..models.diagnosis import CropImage, DiagnosisReport
from ..schemas.diagnosis import DiagnosisResponse
from ..services.audit import log_audit_event
from ..services.images import ImageStore, ImageValidationError, ImageValidator
from ..services.inference import get_inference_adapter

router = APIRouter(prefix="/crop-diagnosis", tags=["crop-diagnosis"])


@router.post("/analyze", response_model=DiagnosisResponse)
@limiter.limit("20 per minute")
async def analyze_image(
    user: CurrentUser,
    db: DbSession,
    request: Request,
    file: UploadFile = File(..., description="Leaf/plant image (JPEG, PNG, or WebP)"),
    crop: str | None = Form(None),
    variety: str | None = Form(None),
    growth_stage: str | None = Form(None),
    plot_id: int | None = Form(None),
    symptoms: str | None = Form(None),
) -> DiagnosisResponse:
    """Accept an uploaded leaf image and return a structured diagnosis."""
    # 1. Read + validate the upload.
    raw = await file.read()
    declared_mime = file.content_type or "application/octet-stream"

    validator = ImageValidator()
    try:
        image = validator.validate(raw, declared_mime)
    except ImageValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    # 2. Store privately with an unguessable filename.
    store = ImageStore()
    stored_filename = store.save(image)

    # If a plot_id was given, make sure it belongs to the user.
    linked_plot = None
    if plot_id is not None:
        from ..models.farm import Plot
        linked_plot = db.get(Plot, plot_id)
        if linked_plot is None or linked_plot.farm.owner_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected plot was not found.",
            )

    crop_image = CropImage(
        uploader_id=user.id,
        plot_id=linked_plot.id if linked_plot else None,
        stored_filename=stored_filename,
        original_filename=file.filename,
        mime_type=image.mime_type,
        size_bytes=len(image.bytes),
        width=image.width,
        height=image.height,
        crop=crop,
        variety=variety,
        growth_stage=growth_stage,
        symptoms=symptoms,
    )
    db.add(crop_image)
    db.commit()
    db.refresh(crop_image)

    # 3. Run the configured inference adapter (never fabricates results).
    adapter = get_inference_adapter()
    context = {
        "crop": crop,
        "variety": variety,
        "growth_stage": growth_stage,
        "symptoms": symptoms,
    }
    result = adapter.analyze(image.bytes, image.mime_type, context)

    # 4. Persist the report.
    report = DiagnosisReport(
        image_id=crop_image.id,
        provider=result.provider,
        model_version=result.model_version,
        status=result.status,
        result_json=json.dumps(
            result.outcome.model_dump() if result.outcome else {"message": result.message}
        ),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    log_audit_event(
        db, actor_id=user.id, action="crop_diagnosis",
        target=f"image:{crop_image.id}",
        detail=f"provider={result.provider},status={result.status}",
    )

    return DiagnosisResponse(
        status=result.status,
        image_id=crop_image.id,
        provider=result.provider,
        model_version=result.model_version,
        analyzed_at=datetime.now(timezone.utc),
        outcome=result.outcome,
        message=result.message,
    )


@router.get("/reports", response_model=list[DiagnosisResponse])
def list_reports(user: CurrentUser, db: DbSession) -> list[DiagnosisResponse]:
    """Return the current user's recent diagnosis reports (newest first)."""
    rows = db.execute(
        select(DiagnosisReport, CropImage)
        .join(CropImage, DiagnosisReport.image_id == CropImage.id)
        .where(CropImage.uploader_id == user.id)
        .order_by(DiagnosisReport.created_at.desc())
        .limit(50)
    ).all()
    out: list[DiagnosisResponse] = []
    for report, _img in rows:
        outcome = None
        if report.status == "ok":
            try:
                outcome = __import__(
                    "app.schemas.diagnosis", fromlist=["DiagnosisOutcome"]
                ).DiagnosisOutcome.model_validate_json(report.result_json)
            except Exception:
                outcome = None
        message = None
        if report.status != "ok":
            try:
                message = json.loads(report.result_json).get("message")
            except Exception:
                message = None
        out.append(
            DiagnosisResponse(
                status=report.status,
                image_id=report.image_id,
                provider=report.provider,
                model_version=report.model_version,
                analyzed_at=report.created_at,
                outcome=outcome,
                message=message,
            )
        )
    return out


@router.get("/images/{image_id}")
def get_image(image_id: int, user: CurrentUser, db: DbSession) -> FileResponse:
    """Serve a stored crop image to its owner (private access control)."""
    img = db.get(CropImage, image_id)
    if not img or img.uploader_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.")
    store = ImageStore()
    path = store.path_for(img.stored_filename)
    return FileResponse(path, media_type=img.mime_type, filename=img.original_filename or "leaf.jpg")
