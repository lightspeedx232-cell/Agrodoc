"""Weather adapter built on the free Open-Meteo API (no API key required).

Open-Meteo provides gridded forecasts for any latitude/longitude, which lets us
show weather for a specific farm plot rather than just the nearest city. The
service never fabricates data: every response carries the upstream source name
and the time it was fetched.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger("agrodoc.weather")

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
SOURCE_NAME = "Open-Meteo (open-meteo.com)"


class CurrentWeather(BaseModel):
    time: str
    temperature_c: float
    apparent_temperature_c: float | None = None
    relative_humidity_pct: int | None = None
    precipitation_mm: float | None = None
    precipitation_probability_pct: int | None = None
    wind_speed_kmh: float | None = None
    wind_direction_deg: int | None = None
    weather_code: int | None = None
    is_day: bool | None = None


class HourlyPoint(BaseModel):
    time: str
    temperature_c: float | None = None
    precipitation_mm: float | None = None
    precipitation_probability_pct: int | None = None
    wind_speed_kmh: float | None = None
    relative_humidity_pct: int | None = None


class DailyPoint(BaseModel):
    date: str
    weather_code: int | None = None
    temp_max_c: float | None = None
    temp_min_c: float | None = None
    precipitation_sum_mm: float | None = None
    precipitation_probability_max_pct: int | None = None
    wind_speed_max_kmh: float | None = None
    sunrise: str | None = None
    sunset: str | None = None


class WeatherResponse(BaseModel):
    source: str = SOURCE_NAME
    fetched_at: str
    latitude: float
    longitude: float
    current: CurrentWeather | None = None
    hourly: list[HourlyPoint] = []
    daily: list[DailyPoint] = []
    advice: dict | None = None


# WMO weather code -> short human description (Open-Meteo uses WMO codes).
WMO_CODES: dict[int, str] = {
    0: "Clear sky",
    1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    56: "Freezing drizzle", 57: "Dense freezing drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Heavy freezing rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers", 81: "Moderate showers", 82: "Violent showers",
    85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail",
}


def describe_weather_code(code: int | None) -> str:
    if code is None:
        return "Unknown"
    return WMO_CODES.get(code, "Unknown")


def generate_crop_advice(
    current: CurrentWeather | None,
    daily: list[DailyPoint],
    crop: str | None = None,
) -> dict:
    """Generate practical irrigation and spray-suitability advice based on the
    forecast. This is general guidance based on public meteorology, not a
    claim that sensors measured anything on the plot."""
    advice: list[str] = []
    rain_risk = "low"
    spray_suitable = True

    if current and current.precipitation_probability_pct is not None:
        prob = current.precipitation_probability_pct
        if prob >= 70:
            rain_risk = "high"
            advice.append(
                f"High chance of rain ({prob}%) in the next hour — consider "
                "delaying irrigation and any pesticide/fungicide spray "
                "(rain can wash away chemicals)."
            )
            spray_suitable = False
        elif prob >= 40:
            rain_risk = "moderate"
            advice.append(
                f"Moderate rain chance ({prob}%). Monitor the sky before "
                "spraying; light rain reduces spray effectiveness."
            )
        else:
            advice.append(
                f"Low rain chance ({prob}%) — good conditions for field work "
                "and spray application."
            )

    # Daily rainfall totals
    rain_days = [d for d in daily if (d.precipitation_sum_mm or 0) > 1.0]
    if rain_days:
        advice.append(
            f"Rain expected on {len(rain_days)} day(s) in the next 7 days, "
            f"totaling up to "
            f"{sum(d.precipitation_sum_mm or 0 for d in rain_days):.1f} mm. "
            "Plan irrigation accordingly."
        )
    else:
        advice.append(
            "Little to no rain expected in the next 7 days — "
            "monitor soil moisture and irrigate as needed, especially for "
            "young or shallow-rooted crops."
        )

    # Heat stress
    hot_days = [d for d in daily if (d.temp_max_c or 0) >= 37]
    if hot_days:
        advice.append(
            f"Heat alert: {len(hot_days)} day(s) above 37°C expected. "
            "Provide shade/mulch, irrigate early morning or evening, and "
            "avoid midday field work."
        )

    # Crop-specific hints
    crop_lower = (crop or "").lower()
    if crop_lower in ("paddy", "rice"):
        advice.append(
            "Paddy: maintain 2–5 cm standing water during tillering to "
            "panicle initiation; drain 1–2 weeks before harvest."
        )
    elif crop_lower in ("tomato",):
        advice.append(
            "Tomato: avoid overhead irrigation to reduce blight; drip or "
            "furrow irrigation preferred, especially in humid weather."
        )
    elif crop_lower in ("banana",):
        advice.append(
            "Banana: needs 150–200 mm water/month; irrigate twice a week "
            "in dry periods."
        )
    elif crop_lower in ("coconut",):
        advice.append(
            "Coconut: ~50 mm per week is ideal; basin irrigation or drip "
            "recommended."
        )

    return {
        "rain_risk": rain_risk,
        "spray_suitable": spray_suitable,
        "tips": advice,
    }


def fetch_weather(latitude: float, longitude: float) -> WeatherResponse:
    """Fetch current + hourly + daily forecast for a coordinate."""
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "temperature_2m,apparent_temperature,relative_humidity_2m,"
            "precipitation,precipitation_probability,weather_code,wind_speed_10m,"
            "wind_direction_10m,is_day"
        ),
        "hourly": "temperature_2m,precipitation,precipitation_probability,wind_speed_10m,relative_humidity_2m",
        "daily": (
            "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,"
            "precipitation_probability_max,wind_speed_10m_max,sunrise,sunset"
        ),
        "timezone": "auto",
        "forecast_days": 7,
        "wind_speed_unit": "kmh",
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(OPEN_METEO_URL, params=params)
        if resp.status_code != 200:
            logger.warning("Open-Meteo returned %s", resp.status_code)
            return WeatherResponse(
                fetched_at=datetime.now(timezone.utc).isoformat(),
                latitude=latitude, longitude=longitude,
            )
        data = resp.json()
    except httpx.RequestError as exc:
        logger.warning("Weather fetch failed: %s", exc)
        return WeatherResponse(
            fetched_at=datetime.now(timezone.utc).isoformat(),
            latitude=latitude, longitude=longitude,
        )

    cur = data.get("current", {})
    current = CurrentWeather(
        time=cur.get("time", ""),
        temperature_c=cur.get("temperature_2m", 0.0),
        apparent_temperature_c=cur.get("apparent_temperature"),
        relative_humidity_pct=cur.get("relative_humidity_2m"),
        precipitation_mm=cur.get("precipitation"),
        precipitation_probability_pct=cur.get("precipitation_probability"),
        wind_speed_kmh=cur.get("wind_speed_10m"),
        wind_direction_deg=cur.get("wind_direction_10m"),
        weather_code=cur.get("weather_code"),
        is_day=cur.get("is_day"),
    )

    hourly_raw = data.get("hourly", {})
    hours = hourly_raw.get("time", [])
    hourly = [
        HourlyPoint(
            time=t,
            temperature_c=hourly_raw.get("temperature_2m", [None] * len(hours))[i],
            precipitation_mm=hourly_raw.get("precipitation", [None] * len(hours))[i],
            precipitation_probability_pct=hourly_raw.get("precipitation_probability", [None] * len(hours))[i],
            wind_speed_kmh=hourly_raw.get("wind_speed_10m", [None] * len(hours))[i],
            relative_humidity_pct=hourly_raw.get("relative_humidity_2m", [None] * len(hours))[i],
        )
        for i, t in enumerate(hours[:48])  # next 48h
    ]

    daily_raw = data.get("daily", {})
    days = daily_raw.get("time", [])
    daily = [
        DailyPoint(
            date=d,
            weather_code=daily_raw.get("weather_code", [None] * len(days))[i],
            temp_max_c=daily_raw.get("temperature_2m_max", [None] * len(days))[i],
            temp_min_c=daily_raw.get("temperature_2m_min", [None] * len(days))[i],
            precipitation_sum_mm=daily_raw.get("precipitation_sum", [None] * len(days))[i],
            precipitation_probability_max_pct=daily_raw.get("precipitation_probability_max", [None] * len(days))[i],
            wind_speed_max_kmh=daily_raw.get("wind_speed_10m_max", [None] * len(days))[i],
            sunrise=daily_raw.get("sunrise", [None] * len(days))[i],
            sunset=daily_raw.get("sunset", [None] * len(days))[i],
        )
        for i, d in enumerate(days[:7])
    ]

    return WeatherResponse(
        fetched_at=datetime.now(timezone.utc).isoformat(),
        latitude=data.get("latitude", latitude),
        longitude=data.get("longitude", longitude),
        current=current,
        hourly=hourly,
        daily=daily,
    )
