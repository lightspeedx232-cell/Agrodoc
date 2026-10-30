"""Farm and Plot schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class PlotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    crop: str | None = Field(default=None, max_length=150)
    variety: str | None = Field(default=None, max_length=150)
    growth_stage: str | None = Field(default=None, max_length=100)
    planting_date: str | None = Field(default=None, max_length=20)
    soil_type: str | None = Field(default=None, max_length=100)
    irrigation_type: str | None = Field(default=None, max_length=100)
    latitude: float | None = None
    longitude: float | None = None
    boundary_geojson: str | None = None
    area_acres: float | None = Field(default=None, ge=0)


class PlotOut(PlotCreate):
    id: int
    farm_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FarmCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    state: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class FarmOut(FarmCreate):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime
    plots: list[PlotOut] = []

    model_config = {"from_attributes": True}
