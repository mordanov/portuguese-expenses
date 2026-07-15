import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.dependencies import get_current_user, require_admin
from app.schemas.project import (
    ColorSuggestRequest,
    ColorSuggestResponse,
    EmojiSuggestRequest,
    EmojiSuggestResponse,
    ProjectCreate,
    ProjectListResponse,
    ProjectMemberAdd,
    ProjectMemberJoinResponse,
    ProjectMemberListResponse,
    ProjectMemberResponse,
    ProjectPublicListResponse,
    ProjectPublicResponse,
    ProjectResponse,
    ProjectStatusResponse,
    ProjectUpdate,
)
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/public-list", response_model=ProjectPublicListResponse)
async def public_list(
    session: AsyncSession = Depends(get_async_session),
) -> ProjectPublicListResponse:
    service = ProjectService(session)
    projects = await service.get_public_list()
    return ProjectPublicListResponse(
        items=[ProjectPublicResponse.model_validate(p) for p in projects]
    )


@router.get("", response_model=ProjectListResponse, dependencies=[Depends(require_admin)])
async def list_projects(
    session: AsyncSession = Depends(get_async_session),
) -> ProjectListResponse:
    service = ProjectService(session)
    projects = await service.list_projects()
    return ProjectListResponse(
        items=[ProjectResponse.model_validate(p) for p in projects],
        total=len(projects),
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_project(
    body: ProjectCreate,
    session: AsyncSession = Depends(get_async_session),
) -> ProjectResponse:
    service = ProjectService(session)
    project = await service.create_project(body)
    await session.commit()
    await session.refresh(project)
    return ProjectResponse.model_validate(project)


@router.put("/{project_id}", response_model=ProjectResponse, dependencies=[Depends(require_admin)])
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    session: AsyncSession = Depends(get_async_session),
) -> ProjectResponse:
    service = ProjectService(session)
    project = await service.update_project(project_id, body)
    await session.commit()
    await session.refresh(project)
    return ProjectResponse.model_validate(project)


@router.post("/{project_id}/close", response_model=ProjectStatusResponse, dependencies=[Depends(require_admin)])
async def close_project(
    project_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
) -> ProjectStatusResponse:
    service = ProjectService(session)
    project = await service.close_project(project_id)
    await session.commit()
    return ProjectStatusResponse(id=project.id, status=project.status)


@router.post("/{project_id}/reopen", response_model=ProjectStatusResponse, dependencies=[Depends(require_admin)])
async def reopen_project(
    project_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
) -> ProjectStatusResponse:
    service = ProjectService(session)
    project = await service.reopen_project(project_id)
    await session.commit()
    return ProjectStatusResponse(id=project.id, status=project.status)


@router.post("/suggest-emoji", response_model=EmojiSuggestResponse, dependencies=[Depends(require_admin)])
async def suggest_emoji(
    body: EmojiSuggestRequest,
    session: AsyncSession = Depends(get_async_session),
) -> EmojiSuggestResponse:
    service = ProjectService(session)
    return await service.suggest_emoji(body.query)


@router.post("/suggest-colors", response_model=ColorSuggestResponse, dependencies=[Depends(require_admin)])
async def suggest_colors(
    body: ColorSuggestRequest,
    session: AsyncSession = Depends(get_async_session),
) -> ColorSuggestResponse:
    service = ProjectService(session)
    return await service.suggest_colors(body.query)


@router.get("/{project_id}/members", response_model=ProjectMemberListResponse, dependencies=[Depends(require_admin)])
async def get_project_members(
    project_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
) -> ProjectMemberListResponse:
    service = ProjectService(session)
    await service.get_by_id(project_id)  # 404 if not found
    members_with_dates = await service.repo.get_members(project_id)
    items = [
        ProjectMemberResponse(
            id=m.id,
            name=m.name,
            is_active=m.is_active,
            joined_at=joined_at,
        )
        for m, joined_at in members_with_dates
    ]
    return ProjectMemberListResponse(items=items, total=len(items))


@router.post("/{project_id}/members", response_model=ProjectMemberJoinResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def add_project_member(
    project_id: uuid.UUID,
    body: ProjectMemberAdd,
    session: AsyncSession = Depends(get_async_session),
) -> ProjectMemberJoinResponse:
    service = ProjectService(session)
    pm = await service.add_member_to_project(project_id, body.member_id)
    await session.commit()
    await session.refresh(pm)
    return ProjectMemberJoinResponse(
        member_id=pm.member_id,
        project_id=pm.project_id,
        joined_at=pm.joined_at,
    )


@router.delete("/{project_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def remove_project_member(
    project_id: uuid.UUID,
    member_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
) -> None:
    service = ProjectService(session)
    await service.remove_member_from_project(project_id, member_id)
    await session.commit()
