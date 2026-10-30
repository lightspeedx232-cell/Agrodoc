"""System endpoints: root info and health check."""

from fastapi import APIRouter

from ..config import settings

router = APIRouter(tags=["system"])


@router.get("/")
def root() -> dict:
    return {
        "name": settings.APP_NAME,
        "tagline": "Your AI Farming Assistant",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
    }


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "version": settings.APP_VERSION}
