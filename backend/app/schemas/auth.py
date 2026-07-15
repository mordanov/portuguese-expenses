import uuid

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str
    project_id: uuid.UUID | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    project_id: uuid.UUID | None = None
