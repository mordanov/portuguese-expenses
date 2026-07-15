import uuid

from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.item import Item
from app.repositories.base import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Category, session)

    async def list_all(self, page: int = 1, page_size: int = 20, project_id: uuid.UUID | None = None) -> tuple[list[Category], int]:
        if project_id is not None:
            stmt = select(Category).where(Category.project_id == project_id)
            count_stmt = select(func.count()).select_from(stmt.subquery())
            total = (await self.session.execute(count_stmt)).scalar_one()
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
            rows = (await self.session.execute(stmt)).scalars().all()
            return list(rows), total
        return await self.list(page=page, page_size=page_size)

    async def get_by_id(self, id: uuid.UUID) -> Category | None:
        return await super().get_by_id(id)

    async def get_by_name(self, name: str, project_id: uuid.UUID | None = None) -> Category | None:
        stmt = select(Category).where(Category.name == name)
        if project_id is not None:
            stmt = stmt.where(Category.project_id == project_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def has_items(self, category_id: uuid.UUID) -> bool:
        result = await self.session.execute(
            select(exists().where(Item.category_id == category_id))
        )
        return result.scalar_one()
