import uuid

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.item import Item
from app.repositories.base import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Category, session)

    async def list_all(self, page: int = 1, page_size: int = 20) -> tuple[list[Category], int]:
        return await self.list(page=page, page_size=page_size)

    async def get_by_id(self, id: uuid.UUID) -> Category | None:
        return await super().get_by_id(id)

    async def get_by_name(self, name: str) -> Category | None:
        result = await self.session.execute(select(Category).where(Category.name == name))
        return result.scalar_one_or_none()

    async def has_items(self, category_id: uuid.UUID) -> bool:
        result = await self.session.execute(
            select(exists().where(Item.category_id == category_id))
        )
        return result.scalar_one()
