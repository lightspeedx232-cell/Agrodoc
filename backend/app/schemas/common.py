"""Shared schema helpers."""

from pydantic import BaseModel


class MessageResponse(BaseModel):
    message: str
