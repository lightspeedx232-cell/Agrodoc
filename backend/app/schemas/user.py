"""User schemas."""

from pydantic import BaseModel, EmailStr, Field

from ..models.user import UserRole


class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    phone: str | None = Field(default=None, max_length=20)
    preferred_language: str = Field(default="en", max_length=10)
    state: str | None = Field(default=None, max_length=100)


class UserOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    phone: str | None = None
    preferred_language: str
    state: str | None = None
    role: UserRole
    is_active: bool
    is_verified: bool

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    preferred_language: str | None = Field(default=None, max_length=10)
    state: str | None = Field(default=None, max_length=100)
