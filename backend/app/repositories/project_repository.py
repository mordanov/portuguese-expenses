import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.family_member import FamilyMember
from app.models.project import Project, ProjectMember


class ProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_all(self) -> list[Project]:
        result = await self.session.execute(select(Project).order_by(Project.created_at))
        return list(result.scalars().all())

    async def get_by_id(self, project_id: uuid.UUID) -> Project | None:
        result = await self.session.execute(select(Project).where(Project.id == project_id))
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Project | None:
        result = await self.session.execute(select(Project).where(Project.name == name))
        return result.scalar_one_or_none()

    async def get_public_list(self) -> list[Project]:
        result = await self.session.execute(select(Project).order_by(Project.name))
        return list(result.scalars().all())

    async def create(self, project: Project) -> Project:
        self.session.add(project)
        await self.session.flush()
        await self.session.refresh(project)
        return project

    async def update(self, project: Project) -> Project:
        await self.session.flush()
        await self.session.refresh(project)
        return project

    async def set_status(self, project: Project, status: str) -> Project:
        project.status = status
        await self.session.flush()
        await self.session.refresh(project)
        return project

    async def add_member(self, project_id: uuid.UUID, member_id: uuid.UUID) -> ProjectMember:
        pm = ProjectMember(project_id=project_id, member_id=member_id)
        self.session.add(pm)
        await self.session.flush()
        await self.session.refresh(pm)
        return pm

    async def remove_member(self, project_id: uuid.UUID, member_id: uuid.UUID) -> bool:
        result = await self.session.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.member_id == member_id,
            )
        )
        pm = result.scalar_one_or_none()
        if pm is None:
            return False
        await self.session.delete(pm)
        await self.session.flush()
        return True

    async def get_member_link(self, project_id: uuid.UUID, member_id: uuid.UUID) -> ProjectMember | None:
        result = await self.session.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.member_id == member_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_members(self, project_id: uuid.UUID) -> list[tuple[FamilyMember, datetime]]:
        result = await self.session.execute(
            select(FamilyMember, ProjectMember.joined_at)
            .join(ProjectMember, ProjectMember.member_id == FamilyMember.id)
            .where(ProjectMember.project_id == project_id)
            .order_by(FamilyMember.name)
        )
        return list(result.all())

    async def get_active_project_member_ids(self, project_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self.session.execute(
            select(FamilyMember.id)
            .join(ProjectMember, ProjectMember.member_id == FamilyMember.id)
            .where(
                ProjectMember.project_id == project_id,
                FamilyMember.is_active == True,  # noqa: E712
            )
        )
        return list(result.scalars().all())
