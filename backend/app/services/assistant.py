"""AI Farming Assistant service.

Architecture
------------
The assistant answers agricultural questions using a configurable AI backend.
Like the Crop Doctor, it uses the adapter pattern:

* When ``AI_PROVIDER=none`` it returns a polite "not configured" message.
* When ``AI_PROVIDER=openai`` it calls an OpenAI-compatible chat completion
  API with a system prompt grounded in Indian agriculture, optionally
  injecting the user's farm context (RAG-lite).

All responses clearly distinguish: AI-generated advice, verified facts, and
"consult a local agricultural officer" guidance.

The service is stateless (no server-side session storage). The client sends
a conversation history list and receives the next assistant message.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from ..config import settings

logger = logging.getLogger("agrodoc.assistant")

SYSTEM_PROMPT = """\
You are AgroDoc's AI Farming Assistant, helping Indian smallholder farmers.
You answer questions about:
- Crop care (sowing, fertilization, pest and disease management)
- Irrigation and soil health
- Government schemes and subsidies
- Mandi prices and market timing
- Farm record keeping and profitability
- Post-harvest handling
- Weather impact on farming

Guidelines:
1. Give practical, safe advice relevant to Indian conditions (especially Kerala and South India when state is known).
2. Clearly say when advice is general / uncertain and recommend consulting a local Krishi Vigyan Kendra (KVK) or agricultural officer.
3. Cite sources when you know them (e.g. ICAR recommendations, state agriculture department guidelines).
4. Never invent drug names, pesticide doses, or government scheme details you are unsure of — say "verify with your local agriculture office".
5. Respond in the language the user writes in (English, Malayalam, or Hindi).
6. Be concise but thorough. Prefer bullet points for steps.
"""


@dataclass
class ChatMessage:
    role: str   # "user" | "assistant" | "system"
    content: str


@dataclass
class AssistantResponse:
    message: str
    configured: bool
    provider: str


def _build_context_injection(farm_context: dict | None) -> str:
    """Build a brief farm context string to inject before the user question."""
    if not farm_context:
        return ""
    parts = []
    if farm_context.get("farm_name"):
        parts.append(f"Farm: {farm_context['farm_name']}")
    if farm_context.get("state"):
        parts.append(f"State: {farm_context['state']}")
    if farm_context.get("crop"):
        parts.append(f"Current crop: {farm_context['crop']}")
    if farm_context.get("growth_stage"):
        parts.append(f"Growth stage: {farm_context['growth_stage']}")
    if parts:
        return "[Farmer context: " + ", ".join(parts) + "]\n"
    return ""


def ask_assistant(
    history: list[ChatMessage],
    farm_context: dict | None = None,
) -> AssistantResponse:
    """Call the configured AI backend and return the assistant's reply."""
    if settings.AI_PROVIDER == "none" or not settings.OPENAI_API_KEY:
        return AssistantResponse(
            message=(
                "The AI Farming Assistant is not configured. "
                "To enable it, set `AI_PROVIDER=openai` and `OPENAI_API_KEY` "
                "in the backend `.env` file, then restart the backend server."
            ),
            configured=False,
            provider="none",
        )

    context_str = _build_context_injection(farm_context)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for i, msg in enumerate(history):
        content = msg.content
        # Prepend farm context to the first user message.
        if msg.role == "user" and i == 0 and context_str:
            content = context_str + content
        messages.append({"role": msg.role, "content": content})

    payload = {
        "model": settings.OPENAI_VISION_MODEL,
        "messages": messages,
        "max_tokens": 700,
        "temperature": 0.4,
    }
    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=45.0) as client:
            resp = client.post(
                f"{settings.OPENAI_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
        if resp.status_code != 200:
            logger.warning("Assistant API returned %s", resp.status_code)
            return AssistantResponse(
                message="The AI service returned an error. Please try again later.",
                configured=True,
                provider="openai",
            )
        reply = resp.json()["choices"][0]["message"]["content"]
        return AssistantResponse(message=reply, configured=True, provider="openai")
    except Exception as exc:
        logger.warning("Assistant request failed: %s", exc)
        return AssistantResponse(
            message="Could not reach the AI service. Check your connection and try again.",
            configured=True,
            provider="openai",
        )
