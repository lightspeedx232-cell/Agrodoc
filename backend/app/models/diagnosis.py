"""Crop image and diagnosis report models (AI Crop Doctor)."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class CropImage(Base):
    __tablename__ = "crop_images"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    uploader_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    plot_id: Mapped[int | None] = mapped_column(
        ForeignKey("plots.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Stored filename only (never the full path). Files live under UPLOAD_DIR.
    stored_filename: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(default=0)
    width: Mapped[int | None] = mapped_column(nullable=True)
    height: Mapped[int | None] = mapped_column(nullable=True)

    # Optional farmer-provided context
    crop: Mapped[str | None] = mapped_column(String(150), nullable=True)
    variety: Mapped[str | None] = mapped_column(String(150), nullable=True)
    growth_stage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    symptoms: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    plot: Mapped["Plot | None"] = relationship(back_populates="crop_images")
    reports: Mapped[list["DiagnosisReport"]] = relationship(
        back_populates="image", cascade="all, delete-orphan"
    )


class DiagnosisReport(Base):
    __tablename__ = "diagnosis_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    image_id: Mapped[int] = mapped_column(
        ForeignKey("crop_images.id", ondelete="CASCADE"), index=True
    )

    provider: Mapped[str] = mapped_column(String(50))  # none|openai|local
    model_version: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(30))  # ok|unavailable|error

    # Structured diagnosis stored as JSON string.
    result_json: Mapped[str] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    image: Mapped["CropImage"] = relationship(back_populates="reports")


from .farm import Plot  # noqa: E402, F401
