import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.dependencies import get_current_user
from app.repositories.offset_rule_repository import OffsetRuleRepository
from app.schemas.offset_rule import OffsetRuleCreateRequest, OffsetRuleResponse, OffsetRulesListResponse

router = APIRouter(prefix="/offset-rules", tags=["offset-rules"])


@router.get("", response_model=OffsetRulesListResponse)
async def list_offset_rules(
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(get_current_user),
) -> OffsetRulesListResponse:
    repo = OffsetRuleRepository(session)
    rules = await repo.list_all()
    return OffsetRulesListResponse(items=[OffsetRuleResponse.model_validate(r) for r in rules])


@router.post("", response_model=OffsetRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_offset_rule(
    body: OffsetRuleCreateRequest,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(get_current_user),
) -> OffsetRuleResponse:
    repo = OffsetRuleRepository(session)
    rule = await repo.create(type=body.type, person_a_id=body.person_a_id, person_b_id=body.person_b_id)
    return OffsetRuleResponse.model_validate(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_offset_rule(
    rule_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    _: str = Depends(get_current_user),
) -> None:
    repo = OffsetRuleRepository(session)
    rule = await repo.get_by_id(rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offset rule not found")
    await repo.delete(rule)
