"""Farm and Plot models.

Plot boundaries are stored as a GeoJSON string so the schema works on both
SQLite (development) and PostgreSQL+PostGIS (production). In production a real
``geometry`` column can be added for spatial indexing without changing the API.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Farm(Base):
    __tablename__ = "farms"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    owner: Mapped["User"] = relationship(back_populates="farms")
    plots: Mapped[list["Plot"]] = relationship(
        back_populates="farm", cascade="all, delete-orphan"
    )


class Plot(Base):
    __tablename__ = "plots"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    farm_id: Mapped[int] = mapped_column(
        ForeignKey("farms.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    crop: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    variety: Mapped[str | None] = mapped_column(String(150), nullable=True)
    growth_stage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    planting_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    soil_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    irrigation_type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Location
    latitude: Mapped[float | None] = mapped_column(nullable=True)
    longitude: Mapped[float | None] = mapped_column(nullable=True)
    # GeoJSON Polygon of the plot boundary.
    boundary_geojson: Mapped[str | None] = mapped_column(Text, nullable=True)
    area_acres: Mapped[float | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    farm: Mapped["Farm"] = relationship(back_populates="plots")
    crop_images: Mapped[list["CropImage"]] = relationship(
        back_populates="plot", cascade="all, delete-orphan"
    )


from .user import User  # noqa: E402, F401
from .diagnosis import CropImage  # noqa: E402, F401
