import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.services.auth_service import decode_access_token

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> str:
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        username: str = payload.get("sub", "")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return username
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_role(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> str:
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        username: str = payload.get("sub", "")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return payload.get("role", "user")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_admin(
    role: Annotated[str, Depends(get_current_user_role)],
) -> None:
    if role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


async def get_current_project_id(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> uuid.UUID:
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        pid = payload.get("project_id")
        if not pid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active project. Use POST /auth/switch-project to select one.",
            )
        return uuid.UUID(pid)
    except HTTPException:
        raise
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_open_project(
    project_id: Annotated[uuid.UUID, Depends(get_current_project_id)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> "Project":  # noqa: F821
    from app.models.project import Project
    from sqlalchemy import select

    result = await session.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.status == "closed":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project is closed")
    return project


# Re-export session dependency for convenience
AsyncSessionDep = Annotated[AsyncSession, Depends(get_async_session)]
CurrentUserDep = Annotated[str, Depends(get_current_user)]
AdminDep = Annotated[None, Depends(require_admin)]
ProjectIdDep = Annotated[uuid.UUID, Depends(get_current_project_id)]
