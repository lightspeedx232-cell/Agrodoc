"""Crop diagnosis (AI Crop Doctor) schemas.

The response structure matches the documented endpoint contract. When no AI
provider is configured, the backend returns a ``DiagnosisUnavailable`` body so
the frontend can show a clear message instead of a fabricated result.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class DiagnosisAlternative(BaseModel):
    """An alternative explanation for the observed symptoms."""

    name: str
    confidence: float = Field(ge=0.0, le=1.0)
    notes: str | None = None


class DiagnosisOutcome(BaseModel):
    """The structured diagnosis produced by a configured AI service."""

    crop_identification: str | None = None
    suspected_condition: str
    confidence: float = Field(ge=0.0, le=1.0)
    uncertainty_label: str | None = None
    supporting_symptoms: list[str] = []
    alternative_possibilities: list[DiagnosisAlternative] = []
    suggested_next_steps: list[str] = []
    prevention_advice: list[str] = []
    agricultural_references: list[str] = []
    follow_up_monitoring: str | None = None
    disclaimer: str = (
        "This AI-assisted diagnosis is informational and not a substitute for "
        "advice from a qualified agricultural officer or plant pathologist."
    )


class DiagnosisResponse(BaseModel):
    """Full response from ``POST /api/crop-diagnosis/analyze``."""

    status: Literal["ok", "unavailable", "error"]
    image_id: int
    provider: str
    model_version: str
    analyzed_at: datetime
    outcome: DiagnosisOutcome | None = None
    message: str | None = None
