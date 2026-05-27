import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.allocation import Allocation
from app.models.item import Item


class ItemRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id_with_detail(self, item_id: uuid.UUID) -> Item | None:
        result = await self.session.execute(
            select(Item)
            .where(Item.id == item_id)
            .options(
                selectinload(Item.category),
                selectinload(Item.allocations).selectinload(Allocation.member),
            )
        )
        return result.scalar_one_or_none()

    async def get_items_by_ticket(self, ticket_id: uuid.UUID) -> list[Item]:
        result = await self.session.execute(
            select(Item).where(Item.ticket_id == ticket_id).order_by(Item.position)
        )
        return list(result.scalars().all())

    async def update_item(
        self,
        item: Item,
        name: str | None = None,
        price: Decimal | None = None,
        category_id: uuid.UUID | None = None,
        position: int | None = None,
        discounted_price: Decimal | None = None,
    ) -> Item:
        if name is not None:
            item.name = name
        if price is not None:
            item.price = price
        if category_id is not None:
            item.category_id = category_id
        if position is not None:
            item.position = position
        if discounted_price is not None:
            item.discounted_price = discounted_price
        await self.session.flush()
        return await self.get_by_id_with_detail(item.id)

    async def replace_allocations(self, item_id: uuid.UUID, member_ids: list[uuid.UUID]) -> Item:
        result = await self.session.execute(select(Allocation).where(Allocation.item_id == item_id))
        existing = result.scalars().all()
        for alloc in existing:
            await self.session.delete(alloc)
        await self.session.flush()

        for member_id in member_ids:
            allocation = Allocation(item_id=item_id, member_id=member_id)
            self.session.add(allocation)
        await self.session.flush()
        return await self.get_by_id_with_detail(item_id)
