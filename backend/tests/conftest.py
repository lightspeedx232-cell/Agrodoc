"""Shared test fixtures.

Environment is configured here *before* importing the app so the rate limiter
is disabled and tests use an isolated SQLite database.
"""

import io
import os

# Configure a test environment BEFORE any app module is imported.
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["AI_PROVIDER"] = "none"
os.environ["DATABASE_URL"] = "sqlite:///./test_agrodoc.db"
os.environ["MAX_IMAGE_UPLOAD_MB"] = "10"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import *  # noqa: E402, F401, F403  (register models on metadata)
from app.core.deps import get_db  # noqa: E402


@pytest.fixture()
def client():
    """Fresh TestClient with a clean database for each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def auth_client(client):
    """A TestClient that is registered and logged in, with the bearer set."""
    client.post("/api/auth/register", json={
        "full_name": "Test Farmer",
        "email": "farmer@example.com",
        "password": "supersecret",
        "preferred_language": "en",
        "state": "Kerala",
    })
    resp = client.post("/api/auth/login", json={
        "email": "farmer@example.com",
        "password": "supersecret",
    })
    token = resp.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


def make_test_image(color=(34, 139, 34), size=(400, 400)) -> bytes:
    """Return bytes of a small valid JPEG (a plain colored leaf-like square)."""
    from PIL import Image

    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


@pytest.fixture()
def leaf_jpeg() -> bytes:
    return make_test_image()
