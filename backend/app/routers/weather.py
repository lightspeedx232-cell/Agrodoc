"""Weather endpoints for a farm plot coordinate."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.deps import CurrentUser, DbSession
from ..models.farm import Plot
from ..services.weather import (
    WeatherResponse, describe_weather_code, fetch_weather, generate_crop_advice,
)

router = APIRouter(prefix="/weather", tags=["weather"])


def _resolve_coords(
    db: Session, user: CurrentUser,
    plot_id: int | None, lat: float | None, lon: float | None,
) -> tuple[float, float, str | None]:
    """Return (lat, lon, crop) — crop comes from the plot if available."""
    if lat is not None and lon is not None:
        return lat, lon, None
    if plot_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either plot_id or latitude/longitude.",
        )
    plot = db.get(Plot, plot_id)
    if not plot or plot.farm.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found.")
    if plot.latitude is None or plot.longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This plot has no coordinates. Draw a boundary or set a location first.",
        )
    return plot.latitude, plot.longitude, plot.crop


@router.get("", response_model=WeatherResponse)
def get_weather(
    user: CurrentUser,
    db: DbSession,
    plot_id: int | None = Query(None),
    latitude: float | None = Query(None, alias="lat"),
    longitude: float | None = Query(None, alias="lon"),
) -> WeatherResponse:
    lat, lon, crop = _resolve_coords(db, user, plot_id, latitude, longitude)
    weather = fetch_weather(lat, lon)
    # Attach crop-specific advice (irrigation, spray, rain risk).
    weather.advice = generate_crop_advice(weather.current, weather.daily, crop)
    return weather


@router.get("/describe/{code}")
def describe_code(code: int) -> dict:
    return {"code": code, "description": describe_weather_code(code)}
