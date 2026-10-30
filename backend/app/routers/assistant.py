"""AI Farming Assistant chat endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..core.deps import CurrentUser, DbSession
from ..services.assistant import AssistantResponse, ChatMessage, ask_assistant

router = APIRouter(prefix="/assistant", tags=["assistant"])


class MessageIn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[MessageIn] = Field(min_length=1, max_length=40)
    farm_context: dict | None = None


class ChatResponse(BaseModel):
    reply: str
    configured: bool
    provider: str


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, user: CurrentUser, db: DbSession) -> ChatResponse:
    """Send a conversation history and receive the next assistant message."""
    history = [ChatMessage(role=m.role, content=m.content) for m in payload.messages]

    # Auto-inject the user's language preference as a hint.
    farm_ctx = dict(payload.farm_context or {})
    farm_ctx.setdefault("preferred_language", user.preferred_language)

    result: AssistantResponse = ask_assistant(history, farm_context=farm_ctx)
    return ChatResponse(
        reply=result.message,
        configured=result.configured,
        provider=result.provider,
    )
