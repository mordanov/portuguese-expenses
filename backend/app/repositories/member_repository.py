import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.family_member import FamilyMember
from app.repositories.base import BaseRepository


def _import_project_member():
    from app.models.project import ProjectMember
    return ProjectMember


class MemberRepository(BaseRepository[FamilyMember]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(FamilyMember, session)

    async def list_all(self, page: int = 1, page_size: int = 20) -> tuple[list[FamilyMember], int]:
        return await self.list(page=page, page_size=page_size)

    async def list_active(self, page: int = 1, page_size: int = 20) -> tuple[list[FamilyMember], int]:
        stmt = select(FamilyMember).where(FamilyMember.is_active == True)  # noqa: E712
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), total

    async def list_can_pay(self, page: int = 1, page_size: int = 20) -> tuple[list[FamilyMember], int]:
        stmt = select(FamilyMember).where(
            FamilyMember.is_active == True,  # noqa: E712
            FamilyMember.can_pay == True,  # noqa: E712
        )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), total

    async def get_by_id(self, id: uuid.UUID) -> FamilyMember | None:
        return await super().get_by_id(id)

    async def get_by_name(self, name: str) -> FamilyMember | None:
        result = await self.session.execute(select(FamilyMember).where(FamilyMember.name == name))
        return result.scalar_one_or_none()

    async def get_by_name_in_project(self, name: str, project_id: uuid.UUID) -> FamilyMember | None:
        ProjectMember = _import_project_member()
        result = await self.session.execute(
            select(FamilyMember)
            .join(ProjectMember, ProjectMember.member_id == FamilyMember.id)
            .where(ProjectMember.project_id == project_id, FamilyMember.name == name)
        )
        return result.scalar_one_or_none()

    async def create(self, instance: FamilyMember) -> FamilyMember:
        return await super().create(instance)

    async def get_name_by_id(self, id: uuid.UUID) -> str | None:
        result = await self.session.execute(select(FamilyMember.name).where(FamilyMember.id == id))
        return result.scalar_one_or_none()

    async def list_for_project(
        self,
        project_id: uuid.UUID,
        active_only: bool = False,
        can_pay_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[FamilyMember], int]:
        ProjectMember = _import_project_member()
        stmt = (
            select(FamilyMember)
            .join(ProjectMember, ProjectMember.member_id == FamilyMember.id)
            .where(ProjectMember.project_id == project_id)
        )
        if active_only or can_pay_only:
            stmt = stmt.where(FamilyMember.is_active == True)  # noqa: E712
        if can_pay_only:
            stmt = stmt.where(FamilyMember.can_pay == True)  # noqa: E712
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), total

    async def soft_delete(self, member: FamilyMember) -> FamilyMember:
        member.is_active = False
        await self.session.flush()
        await self.session.refresh(member)
        return member
