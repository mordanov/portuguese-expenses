import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.dependencies import get_current_user, get_current_user_role, require_admin
from app.repositories.auth_repository import get_user_by_username
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.project import SwitchProjectRequest
from app.services.auth_service import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    session: AsyncSession = Depends(get_async_session),
) -> TokenResponse:
    from app.models.project import Project
    from sqlalchemy import select

    user = await get_user_by_username(session, request.username)
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    # Determine project_id for JWT
    project_id: uuid.UUID | None = None
    if user.role == "user":
        # Non-admin users are always scoped to their assigned project
        if user.project_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No project assigned to this account",
            )
        project_id = user.project_id
    else:
        # Admin: use provided project_id or default to the first available project
        if request.project_id is not None:
            result = await session.execute(select(Project).where(Project.id == request.project_id))
            proj = result.scalar_one_or_none()
            if proj is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
            project_id = request.project_id
        else:
            result = await session.execute(select(Project).order_by(Project.created_at).limit(1))
            first_project = result.scalar_one_or_none()
            if first_project is not None:
                project_id = first_project.id

    user.last_login_at = datetime.now(timezone.utc)
    await session.commit()
    token = create_access_token(user.username, user.role, project_id=project_id)
    return TokenResponse(access_token=token, role=user.role, project_id=project_id)


@router.post("/switch-project", response_model=TokenResponse)
async def switch_project(
    body: SwitchProjectRequest,
    session: AsyncSession = Depends(get_async_session),
    username: str = Depends(get_current_user),
    role: str = Depends(get_current_user_role),
) -> TokenResponse:
    from app.models.project import Project
    from sqlalchemy import select

    if role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    result = await session.execute(select(Project).where(Project.id == body.project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    token = create_access_token(username, role, project_id=body.project_id)
    return TokenResponse(access_token=token, role=role, project_id=body.project_id)
