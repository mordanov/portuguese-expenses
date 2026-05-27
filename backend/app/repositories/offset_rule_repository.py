import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.offset_rule import OffsetRule


class OffsetRuleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_all(self) -> list[OffsetRule]:
        result = await self.session.execute(select(OffsetRule).order_by(OffsetRule.created_at))
        return list(result.scalars().all())

    async def create(self, type: str, person_a_id: uuid.UUID, person_b_id: uuid.UUID) -> OffsetRule:
        rule = OffsetRule(type=type, person_a_id=person_a_id, person_b_id=person_b_id)
        self.session.add(rule)
        await self.session.flush()
        await self.session.refresh(rule)
        return rule

    async def get_by_id(self, id: uuid.UUID) -> OffsetRule | None:
        result = await self.session.execute(select(OffsetRule).where(OffsetRule.id == id))
        return result.scalar_one_or_none()

    async def delete(self, rule: OffsetRule) -> None:
        await self.session.delete(rule)
        await self.session.flush()
