"""Farm and plot management."""

import json
import math

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.deps import CurrentUser, DbSession
from ..models.farm import Farm, Plot
from ..schemas.farm import FarmCreate, FarmOut, PlotCreate, PlotOut

router = APIRouter(prefix="/farms", tags=["farms"])


def _own_farm(db: Session, farm_id: int, user_id: int) -> Farm:
    farm = db.get(Farm, farm_id)
    if not farm or farm.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found.")
    return farm


def _own_plot(db: Session, farm_id: int, plot_id: int, user_id: int) -> tuple[Farm, Plot]:
    farm = _own_farm(db, farm_id, user_id)
    plot = db.get(Plot, plot_id)
    if not plot or plot.farm_id != farm.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found.")
    return farm, plot


def _geojson_area_acres(geojson_str: str) -> float | None:
    """Calculate approximate area from a GeoJSON Polygon string using the
    spherical excess formula. Returns acres, or None if the geometry is invalid.
    This is a good approximation for small farm plots (< a few km²)."""
    try:
        gj = json.loads(geojson_str)
        coords: list[list[float]] = []
        if gj.get("type") == "Polygon":
            coords = gj["coordinates"][0]
        elif gj.get("type") == "Feature" and gj.get("geometry", {}).get("type") == "Polygon":
            coords = gj["geometry"]["coordinates"][0]
        if len(coords) < 4:
            return None
        # Shoelace formula on the sphere using WGS84 mean radius.
        R = 6_371_008.8  # metres
        area_m2 = 0.0
        n = len(coords) - 1  # last point == first point for a closed ring
        for i in range(n):
            lng1, lat1 = math.radians(coords[i][0]), math.radians(coords[i][1])
            lng2, lat2 = math.radians(coords[(i + 1) % n][0]), math.radians(coords[(i + 1) % n][1])
            area_m2 += (lng2 - lng1) * (2 + math.sin(lat1) + math.sin(lat2))
        area_m2 = abs(area_m2) * R * R / 2
        return area_m2 / 4046.856  # m² → acres
    except Exception:
        return None


# ---- Farms ----
@router.get("", response_model=list[FarmOut])
def list_farms(user: CurrentUser, db: DbSession) -> list[Farm]:
    return list(db.scalars(select(Farm).where(Farm.owner_id == user.id)).all())


@router.post("", response_model=FarmOut, status_code=status.HTTP_201_CREATED)
def create_farm(payload: FarmCreate, user: CurrentUser, db: DbSession) -> Farm:
    farm = Farm(owner_id=user.id, **payload.model_dump())
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return farm


@router.get("/{farm_id}", response_model=FarmOut)
def get_farm(farm_id: int, user: CurrentUser, db: DbSession) -> Farm:
    return _own_farm(db, farm_id, user.id)


@router.put("/{farm_id}", response_model=FarmOut)
def update_farm(farm_id: int, payload: FarmCreate, user: CurrentUser, db: DbSession) -> Farm:
    farm = _own_farm(db, farm_id, user.id)
    for key, value in payload.model_dump().items():
        setattr(farm, key, value)
    db.commit()
    db.refresh(farm)
    return farm


@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_farm(farm_id: int, user: CurrentUser, db: DbSession) -> None:
    farm = _own_farm(db, farm_id, user.id)
    db.delete(farm)
    db.commit()


# ---- Plots ----
@router.post("/{farm_id}/plots", response_model=PlotOut, status_code=status.HTTP_201_CREATED)
def create_plot(farm_id: int, payload: PlotCreate, user: CurrentUser, db: DbSession) -> Plot:
    farm = _own_farm(db, farm_id, user.id)
    plot = Plot(farm_id=farm.id, **payload.model_dump())
    db.add(plot)
    db.commit()
    db.refresh(plot)
    return plot


@router.put("/{farm_id}/plots/{plot_id}", response_model=PlotOut)
def update_plot(farm_id: int, plot_id: int, payload: PlotCreate,
                user: CurrentUser, db: DbSession) -> Plot:
    _farm, plot = _own_plot(db, farm_id, plot_id, user.id)
    for key, value in payload.model_dump().items():
        setattr(plot, key, value)
    db.commit()
    db.refresh(plot)
    return plot


class BoundaryUpdate(BaseModel):
    boundary_geojson: str | None = None
    latitude: float | None = None
    longitude: float | None = None


@router.patch("/{farm_id}/plots/{plot_id}/boundary", response_model=PlotOut)
def update_plot_boundary(
    farm_id: int, plot_id: int, payload: BoundaryUpdate,
    user: CurrentUser, db: DbSession
) -> Plot:
    """Update only a plot's boundary GeoJSON and auto-calculate area.
    This is the endpoint the map calls after drawing or editing a polygon."""
    _farm, plot = _own_plot(db, farm_id, plot_id, user.id)
    if payload.boundary_geojson is not None:
        # Validate JSON before storing.
        try:
            gj = json.loads(payload.boundary_geojson)
            if gj.get("type") not in ("Polygon", "Feature"):
                raise HTTPException(status_code=422, detail="boundary_geojson must be a GeoJSON Polygon.")
        except (json.JSONDecodeError, AttributeError):
            raise HTTPException(status_code=422, detail="boundary_geojson is not valid JSON.")
        plot.boundary_geojson = payload.boundary_geojson
        # Auto-calculate area.
        area = _geojson_area_acres(payload.boundary_geojson)
        if area is not None:
            plot.area_acres = round(area, 4)
    if payload.latitude is not None:
        plot.latitude = payload.latitude
    if payload.longitude is not None:
        plot.longitude = payload.longitude
    db.commit()
    db.refresh(plot)
    return plot


@router.delete("/{farm_id}/plots/{plot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plot(farm_id: int, plot_id: int, user: CurrentUser, db: DbSession) -> None:
    _farm, plot = _own_plot(db, farm_id, plot_id, user.id)
    db.delete(plot)
    db.commit()
