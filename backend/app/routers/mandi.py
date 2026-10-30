"""Mandi price endpoints (public — prices are public information)."""

from fastapi import APIRouter, Query

from ..services.mandi import MandiResponse, fetch_mandi_prices

router = APIRouter(prefix="/mandi", tags=["mandi"])


@router.get("/prices", response_model=MandiResponse)
def get_prices(
    limit: int = Query(50, ge=1, le=200),
    commodity: str | None = Query(None, description="Filter by commodity name"),
) -> MandiResponse:
    """Return mandi prices with their source date and unit.

    When the data.gov.in API is not configured, returns a clear message and the
    official source links instead of fabricated prices.
    """
    return fetch_mandi_prices(limit=limit, commodity=commodity)
