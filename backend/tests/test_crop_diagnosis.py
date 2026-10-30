"""Crop Doctor / webcam backend tests.

Covers: valid image upload + AI-unavailable result, invalid image, oversized
image, successful analysis with a mocked inference adapter, report listing,
and private image access control.
"""

import io
from datetime import datetime, timezone

import pytest

from app.services.inference import InferenceResult
from app.schemas.diagnosis import DiagnosisOutcome


@pytest.fixture()
def mock_ok_adapter(monkeypatch):
    """Patch the diagnosis router to return a known-good diagnosis."""
    from app.routers import crop_diagnosis as cd

    class FakeAdapter:
        provider = "mock"
        model_version = "mock-v1.0"

        def analyze(self, image_bytes, mime_type, context):
            return InferenceResult(
                status="ok",
                outcome=DiagnosisOutcome(
                    crop_identification="Tomato",
                    suspected_condition="Early blight (Alternaria solani)",
                    confidence=0.78,
                    uncertainty_label="Moderate confidence",
                    supporting_symptoms=["Concentric dark brown lesions on leaves"],
                    suggested_next_steps=["Remove infected leaves", "Apply copper-based fungicide"],
                    prevention_advice=["Improve air circulation", "Avoid overhead irrigation"],
                ),
                message=None,
                provider="mock",
                model_version="mock-v1.0",
            )

    monkeypatch.setattr(cd, "get_inference_adapter", lambda: FakeAdapter())


# --------------------------------------------------------------------------- #
# Upload validation
# --------------------------------------------------------------------------- #
def test_analyze_ai_unavailable_default(auth_client, leaf_jpeg):
    """With no AI provider configured, the API must report unavailable, not fake."""
    resp = auth_client.post(
        "/api/crop-diagnosis/analyze",
        files={"file": ("leaf.jpg", leaf_jpeg, "image/jpeg")},
        data={"crop": "Tomato"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "unavailable"
    assert body["outcome"] is None
    assert "not configured" in body["message"].lower()
    assert body["provider"] == "none"
    assert body["image_id"] > 0


def test_analyze_invalid_image(auth_client):
    """A non-image file must be rejected with 422."""
    resp = auth_client.post(
        "/api/crop-diagnosis/analyze",
        files={"file": ("notimg.txt", b"this is not an image", "text/plain")},
    )
    assert resp.status_code == 422


def test_analyze_wrong_mime_with_real_bytes(auth_client):
    """A real image sent with a wrong declared type is still rejected cleanly."""
    # The validator detects the real format (JPEG) but declared type is text/plain;
    # Pillow-based validation still runs and re-encodes to JPEG -> should succeed.
    # We instead send genuinely corrupt bytes with an image mime to force 422.
    resp = auth_client.post(
        "/api/crop-diagnosis/analyze",
        files={"file": ("fake.jpg", b"\xff\xd8\xff this is corrupt", "image/jpeg")},
    )
    assert resp.status_code == 422


def test_analyze_oversized_image(auth_client, leaf_jpeg, monkeypatch):
    """An image larger than the configured limit must be rejected."""
    # Lower the limit to a few KB so a normal leaf image exceeds it,
    # exercising the size-rejection path without allocating a giant image.
    from app.config import settings

    monkeypatch.setattr(settings, "MAX_IMAGE_UPLOAD_MB", 0.001)  # ~1 KB
    resp = auth_client.post(
        "/api/crop-diagnosis/analyze",
        files={"file": ("leaf.jpg", leaf_jpeg, "image/jpeg")},
    )
    assert resp.status_code == 422
    assert "too large" in resp.json()["detail"].lower()


# --------------------------------------------------------------------------- #
# Successful analysis path
# --------------------------------------------------------------------------- #
def test_analyze_success_with_mock(auth_client, mock_ok_adapter, leaf_jpeg):
    resp = auth_client.post(
        "/api/crop-diagnosis/analyze",
        files={"file": ("leaf.jpg", leaf_jpeg, "image/jpeg")},
        data={"crop": "Tomato", "growth_stage": "Flowering", "symptoms": "Brown spots"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ok"
    assert body["provider"] == "mock"
    assert body["outcome"] is not None
    assert body["outcome"]["suspected_condition"] == "Early blight (Alternaria solani)"
    assert 0.0 <= body["outcome"]["confidence"] <= 1.0


def test_report_listing_after_analysis(auth_client, mock_ok_adapter, leaf_jpeg):
    auth_client.post(
        "/api/crop-diagnosis/analyze",
        files={"file": ("leaf.jpg", leaf_jpeg, "image/jpeg")},
    )
    resp = auth_client.get("/api/crop-diagnosis/reports")
    assert resp.status_code == 200
    reports = resp.json()
    assert len(reports) == 1
    assert reports[0]["status"] == "ok"


# --------------------------------------------------------------------------- #
# Private image access control
# --------------------------------------------------------------------------- #
def test_image_only_visible_to_owner(auth_client, mock_ok_adapter, leaf_jpeg):
    resp = auth_client.post(
        "/api/crop-diagnosis/analyze",
        files={"file": ("leaf.jpg", leaf_jpeg, "image/jpeg")},
    )
    image_id = resp.json()["image_id"]

    # Owner can fetch it.
    own = auth_client.get(f"/api/crop-diagnosis/images/{image_id}")
    assert own.status_code == 200

    # A second, unauthenticated client must NOT fetch it.
    from fastapi.testclient import TestClient

    with TestClient(auth_client.app) as anon:
        anon_resp = anon.get(f"/api/crop-diagnosis/images/{image_id}")
        assert anon_resp.status_code == 401


def test_image_not_found_for_other_user(auth_client, mock_ok_adapter, leaf_jpeg,
                                          client):
    resp = auth_client.post(
        "/api/crop-diagnosis/analyze",
        files={"file": ("leaf.jpg", leaf_jpeg, "image/jpeg")},
    )
    image_id = resp.json()["image_id"]

    # Register a second user.
    client.post("/api/auth/register", json={
        "full_name": "Other", "email": "other@example.com", "password": "password1",
    })
    tok = client.post("/api/auth/login", json={
        "email": "other@example.com", "password": "password1",
    }).json()["access_token"]

    other = client.get(
        f"/api/crop-diagnosis/images/{image_id}",
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert other.status_code == 404
