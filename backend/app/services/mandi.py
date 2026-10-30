"""Mandi price adapter for official government open data.

Uses the data.gov.in API (which serves AGMARKNET-style price observations) when
configured. When no API key is set, the endpoint returns the official source
links instead of inventing prices. Every returned record carries its source
date and unit — old observations are never relabeled as "live".
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
from pydantic import BaseModel

logger = logging.getLogger("agrodoc.mandi")

SOURCE_NAME = "data.gov.in (AGMARKNET)"


class MandiPrice(BaseModel):
    commodity: str
    market: str
    state: str | None = None
    price: str
    unit: str
    arrival_date: str
    source: str = SOURCE_NAME


class MandiResponse(BaseModel):
    source: str
    fetched_at: str
    configured: bool
    message: str | None = None
    records: list[MandiPrice] = []


def fetch_mandi_prices(limit: int = 50, commodity: str | None = None) -> MandiResponse:
    from ..config import settings

    now = datetime.now(timezone.utc).isoformat()

    if not settings.MANDI_DATA_GOV_API_KEY or not settings.MANDI_DATA_GOV_RESOURCE_ID:
        return MandiResponse(
            source=SOURCE_NAME,
            fetched_at=now,
            configured=False,
            message=(
                "Live mandi prices are not configured. Set "
                "MANDI_DATA_GOV_API_KEY and MANDI_DATA_GOV_RESOURCE_ID in the "
                "backend .env file (get a free key at data.gov.in), or use the "
                "official portals linked in the Mandi page."
            ),
            records=[],
        )

    url = f"{settings.MANDI_DATA_GOV_BASE_URL}/{settings.MANDI_DATA_GOV_RESOURCE_ID}"
    params = {
        "api-key": settings.MANDI_DATA_GOV_API_KEY,
        "format": "json",
        "limit": str(limit),
    }
    if commodity:
        params["filters[commodity]"] = commodity

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, params=params)
        if resp.status_code != 200:
            logger.warning("data.gov.in returned %s", resp.status_code)
            return MandiResponse(
                source=SOURCE_NAME, fetched_at=now, configured=True,
                message="The price data service returned an error. Try again later.",
            )
        data = resp.json()
    except httpx.RequestError as exc:
        logger.warning("Mandi fetch failed: %s", exc)
        return MandiResponse(
            source=SOURCE_NAME, fetched_at=now, configured=True,
            message="Could not reach the price data service.",
        )

    records: list[MandiPrice] = []
    for row in data.get("records", []):
        # data.gov.in AGMARKNET resource field names vary; map the common ones.
        records.append(
            MandiPrice(
                commodity=row.get("commodity") or row.get("commodity_name") or "—",
                market=row.get("market") or row.get("mandi") or "—",
                state=row.get("state") or row.get("state_name"),
                price=str(row.get("modal_price") or row.get("price") or "—"),
                unit=row.get("unit") or "Rs/Quintal",
                arrival_date=row.get("arrival_date") or row.get("reported_date") or "—",
            )
        )

    return MandiResponse(
        source=SOURCE_NAME, fetched_at=now, configured=True, records=records
    )
