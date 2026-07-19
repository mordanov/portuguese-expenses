import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.dependencies import get_current_project_id, get_current_user, require_admin
from app.repositories.offset_rule_repository import OffsetRuleRepository
from app.schemas.offset_rule import OffsetRuleCreateRequest, OffsetRuleResponse, OffsetRulesListResponse

router = APIRouter(prefix="/offset-rules", tags=["offset-rules"])


@router.get("", response_model=OffsetRulesListResponse)
async def list_offset_rules(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(get_current_user),
    project_id: uuid.UUID = Depends(get_current_project_id),
) -> OffsetRulesListResponse:
    repo = OffsetRuleRepository(session)
    rules = await repo.list_all(project_id=project_id)
    return OffsetRulesListResponse(items=[OffsetRuleResponse.model_validate(r) for r in rules])


@router.post("", response_model=OffsetRuleResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_offset_rule(
    body: OffsetRuleCreateRequest,
    session: AsyncSession = Depends(get_async_session),
    project_id: uuid.UUID = Depends(get_current_project_id),
) -> OffsetRuleResponse:
    repo = OffsetRuleRepository(session)
    existing = await repo.get_by_persons(project_id, body.person_a_id, body.person_b_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Offset rule already exists")
    rule = await repo.create(type=body.type, project_id=project_id, person_a_id=body.person_a_id, person_b_id=body.person_b_id)
    await session.commit()
    return OffsetRuleResponse.model_validate(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_offset_rule(
    rule_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    project_id: uuid.UUID = Depends(get_current_project_id),
) -> None:
    repo = OffsetRuleRepository(session)
    rule = await repo.get_by_id(rule_id)
    if rule is None or rule.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offset rule not found")
    await repo.delete(rule)
    await session.commit()
