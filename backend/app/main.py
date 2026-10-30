"""AgroDoc FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from .config import settings
from .core.limiter import limiter
from .database import init_db
from .routers import assistant, auth, crop_diagnosis, farms, mandi, marketplace, scam_report, system, tasks, users, weather

logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("agrodoc")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    init_db()
    logger.info("AgroDoc backend started (%s)", settings.ENVIRONMENT)
    yield
    # Shutdown (nothing to clean up here)
    logger.info("AgroDoc backend stopped.")


app = FastAPI(
    title="AgroDoc — Your AI Farming Assistant",
    description=(
        "AI-powered farming platform for Indian farmers: crop disease diagnosis "
        "via webcam, weather, mapping, government schemes, mandi prices and more."
    ),
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# ---- Rate limiting ----
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Catch-all: never leak internal stack traces to the client ----
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


# ---- Routers ----
# Public system endpoints (root + health) sit at the app root.
app.include_router(system.router)
# Everything else lives under /api.
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)
app.include_router(farms.router, prefix=settings.API_V1_PREFIX)
app.include_router(crop_diagnosis.router, prefix=settings.API_V1_PREFIX)
app.include_router(weather.router, prefix=settings.API_V1_PREFIX)
app.include_router(mandi.router, prefix=settings.API_V1_PREFIX)
app.include_router(tasks.router, prefix=settings.API_V1_PREFIX)
app.include_router(tasks.expenses_router, prefix=settings.API_V1_PREFIX)
app.include_router(assistant.router, prefix=settings.API_V1_PREFIX)
app.include_router(marketplace.router, prefix=settings.API_V1_PREFIX)
app.include_router(scam_report.router, prefix=settings.API_V1_PREFIX)
