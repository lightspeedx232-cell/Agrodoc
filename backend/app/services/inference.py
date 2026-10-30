"""AI inference adapter for the Crop Doctor.

Design goals (from the project spec)
------------------------------------
* Never fabricate a diagnosis. If no provider is configured, return a clear
  "AI diagnosis is unavailable" result instead of a fake disease/confidence.
* Use an **adapter** so a real model or authorized AI vision API can be plugged
  in without rewriting the scanner or the API endpoint.
* Keep image analysis independent of the physical camera so webcam captures,
  phone uploads, and future drone imports all flow through the same pipeline.

The active adapter is chosen by the ``AI_PROVIDER`` setting:

  * ``none``   -> safe default; diagnosis reported unavailable.
  * ``openai`` -> OpenAI-compatible vision API (needs ``OPENAI_API_KEY``).
  * ``local``  -> a local model file (needs ``LOCAL_MODEL_PATH`` + torch).

Add a new provider by implementing ``InferenceAdapter.analyze`` and registering
it in :func:`get_inference_adapter`.
"""

from __future__ import annotations

import base64
import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Literal, Protocol

import httpx

from ..config import settings
from ..schemas.diagnosis import DiagnosisAlternative, DiagnosisOutcome

logger = logging.getLogger("agrodoc.inference")


@dataclass
class InferenceResult:
    status: Literal["ok", "unavailable", "error"]
    outcome: DiagnosisOutcome | None
    message: str | None
    provider: str
    model_version: str

    @classmethod
    def unavailable(cls, provider: str, message: str) -> "InferenceResult":
        return cls(status="unavailable", outcome=None, message=message,
                    provider=provider, model_version="n/a")

    @classmethod
    def error(cls, provider: str, message: str) -> "InferenceResult":
        return cls(status="error", outcome=None, message=message,
                    provider=provider, model_version="n/a")


class InferenceAdapter(Protocol):
    """Interface every provider must implement."""

    provider: str
    model_version: str

    def analyze(
        self,
        image_bytes: bytes,
        mime_type: str,
        context: dict[str, str | None],
    ) -> InferenceResult:
        ...


# --------------------------------------------------------------------------- #
# Provider: none (safe default)
# --------------------------------------------------------------------------- #
class NoneAdapter:
    provider = "none"
    model_version = "n/a"

    def analyze(self, image_bytes, mime_type, context) -> InferenceResult:  # noqa: ANN001
        return InferenceResult.unavailable(
            "none",
            "AI diagnosis is not configured. Set AI_PROVIDER and the relevant "
            "credentials in your backend .env file to enable crop analysis.",
        )


# --------------------------------------------------------------------------- #
# Provider: OpenAI-compatible vision API
# --------------------------------------------------------------------------- #
_VISION_SYSTEM_PROMPT = (
    "You are AgroDoc's AI Crop Doctor, an agricultural assistant for Indian "
    "farmers. Analyze the supplied plant/leaf image and any farmer-provided "
    "context. Respond ONLY with a single JSON object (no markdown, no prose "
    "outside the JSON) using exactly these keys:\n"
    "{\n"
    '  "crop_identification": string or null,\n'
    '  "suspected_condition": string,\n'
    '  "confidence": number between 0 and 1,\n'
    '  "uncertainty_label": string,\n'
    '  "supporting_symptoms": [string],\n'
    '  "alternative_possibilities": [{"name": string, "confidence": number, "notes": string|null}],\n'
    '  "suggested_next_steps": [string],\n'
    '  "prevention_advice": [string],\n'
    '  "agricultural_references": [string],\n'
    '  "follow_up_monitoring": string or null\n'
    "}\n"
    "Rules:\n"
    "- If you cannot make a reliable assessment from the image, set "
    '"suspected_condition" to "Unable to determine from image" and confidence '
    "to a low value; do not invent diseases.\n"
    "- confidence must reflect your actual certainty, never 1.0 unless certain.\n"
    "- Keep advice practical and safe for Indian smallholder farming.\n"
)


class OpenAIVisionAdapter:
    provider = "openai"
    model_version: str = settings.OPENAI_VISION_MODEL

    def __init__(self) -> None:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not set")

    def analyze(self, image_bytes, mime_type, context) -> InferenceResult:  # noqa: ANN001
        b64 = base64.b64encode(image_bytes).decode("ascii")
        data_url = f"data:{mime_type};base64,{b64}"

        context_text = ", ".join(
            f"{k}: {v}" for k, v in context.items() if v
        ) or "No additional context provided."

        payload = {
            "model": settings.OPENAI_VISION_MODEL,
            "max_tokens": 900,
            "messages": [
                {"role": "system", "content": _VISION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Analyze this plant/leaf image and return the JSON "
                                f"object. Farmer context: {context_text}"
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                    ],
                },
            ],
        }
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(
                    f"{settings.OPENAI_BASE_URL}/chat/completions",
                    json=payload,
                    headers=headers,
                )
        except httpx.RequestError as exc:
            logger.warning("OpenAI vision request failed: %s", exc)
            return InferenceResult.error(
                "openai", "Could not reach the AI vision service. Try again later."
            )

        if resp.status_code != 200:
            logger.warning("OpenAI vision API returned %s: %s",
                           resp.status_code, resp.text[:300])
            return InferenceResult.error(
                "openai",
                "The AI vision service returned an error. Check the API key "
                "and model configuration.",
            )

        try:
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, json.JSONDecodeError) as exc:
            logger.warning("Malformed vision response: %s", exc)
            return InferenceResult.error("openai", "The AI response was malformed.")

        outcome = _parse_outcome_json(content)
        if outcome is None:
            return InferenceResult.error("openai", "Could not parse a valid diagnosis.")

        return InferenceResult(
            status="ok",
            outcome=outcome,
            message=None,
            provider="openai",
            model_version=settings.OPENAI_VISION_MODEL,
        )


def _parse_outcome_json(content: str) -> DiagnosisOutcome | None:
    """Extract a JSON object from a model response (tolerates code fences)."""
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        return None
    try:
        raw = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None

    try:
        alts = [
            DiagnosisAlternative(
                name=str(a.get("name", "Unknown")),
                confidence=float(a.get("confidence", 0.0)),
                notes=a.get("notes"),
            )
            for a in raw.get("alternative_possibilities", [])
        ]
        return DiagnosisOutcome(
            crop_identification=raw.get("crop_identification"),
            suspected_condition=str(raw.get("suspected_condition", "Unknown")),
            confidence=float(raw.get("confidence", 0.0)),
            uncertainty_label=raw.get("uncertainty_label"),
            supporting_symptoms=list(raw.get("supporting_symptoms", [])),
            alternative_possibilities=alts,
            suggested_next_steps=list(raw.get("suggested_next_steps", [])),
            prevention_advice=list(raw.get("prevention_advice", [])),
            agricultural_references=list(raw.get("agricultural_references", [])),
            follow_up_monitoring=raw.get("follow_up_monitoring"),
        )
    except (TypeError, ValueError) as exc:
        logger.warning("Outcome mapping failed: %s", exc)
        return None


# --------------------------------------------------------------------------- #
# Provider: local model (placeholder for a self-hosted CV model)
# --------------------------------------------------------------------------- #
class LocalModelAdapter:
    provider = "local"
    model_version = "not-loaded"

    def __init__(self) -> None:
        if not settings.LOCAL_MODEL_PATH:
            raise RuntimeError("LOCAL_MODEL_PATH is not set")

    def analyze(self, image_bytes, mime_type, context) -> InferenceResult:  # noqa: ANN001
        # A real implementation would load a torch/onnx model and run inference.
        # Until a model file is available we report unavailable rather than fake.
        return InferenceResult.unavailable(
            "local",
            "A local model path is configured but no compatible inference "
            "runtime/model is loaded yet. Install the model runtime and "
            "implement local inference to enable offline diagnosis.",
        )


# --------------------------------------------------------------------------- #
# Registry / factory
# --------------------------------------------------------------------------- #
def get_inference_adapter() -> InferenceAdapter:
    """Return the configured inference adapter (a safe one by default)."""
    provider = settings.AI_PROVIDER
    try:
        if provider == "openai":
            return OpenAIVisionAdapter()
        if provider == "local":
            return LocalModelAdapter()
    except RuntimeError as exc:
        logger.warning("Falling back to NoneAdapter: %s", exc)
    return NoneAdapter()
