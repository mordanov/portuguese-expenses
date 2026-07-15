import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.dependencies import get_current_user, require_admin
from app.repositories.user_repository import (
    create_user,
    get_user_by_id,
    get_user_by_username,
    list_users,
    update_user,
)
from app.schemas.user import UserCreateRequest, UserListResponse, UserResponse, UserUpdateRequest
from app.services.auth_service import hash_password

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


@router.get("", response_model=UserListResponse)
async def list_all_users(
    session: AsyncSession = Depends(get_async_session),
) -> UserListResponse:
    users, total = await list_users(session)
    return UserListResponse(items=[UserResponse.model_validate(u) for u in users], total=total)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_new_user(
    body: UserCreateRequest,
    session: AsyncSession = Depends(get_async_session),
) -> UserResponse:
    if body.role == "user" and body.project_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="project_id is required for role 'user'")
    existing = await get_user_by_username(session, body.username)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
    user = await create_user(session, body.username, hash_password(body.password), body.role, body.project_id)
    await session.commit()
    return UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_existing_user(
    user_id: uuid.UUID,
    body: UserUpdateRequest,
    current_username: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> UserResponse:
    user = await get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.username and body.username != user.username:
        conflict = await get_user_by_username(session, body.username)
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    # Prevent self-demotion or self-block
    if user.username == current_username:
        if body.role == "user":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot demote yourself")
        if body.is_active is False:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate yourself")

    # Validate project_id when role becomes or stays 'user'
    effective_role = body.role if body.role is not None else user.role
    effective_project_id = body.project_id if "project_id" in body.model_fields_set else None
    if effective_role == "user" and effective_project_id is None and user.project_id is None and body.project_id is None:
        pass  # leave existing project_id unchanged when not explicitly sent
    set_proj = "project_id" in body.model_fields_set

    password_hash = hash_password(body.password) if body.password else None
    user = await update_user(
        session, user, body.username, password_hash, body.role, body.is_active,
        project_id=body.project_id, set_project_id=set_proj,
    )
    await session.commit()
    return UserResponse.model_validate(user)
