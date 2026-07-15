import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.family_member import FamilyMember
from app.repositories.member_repository import MemberRepository


class MemberService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = MemberRepository(session)

    async def list_members(
        self, active_only: bool = False, can_pay_only: bool = False, page: int = 1, page_size: int = 20,
        project_id: uuid.UUID | None = None,
    ) -> tuple[list[FamilyMember], int]:
        if project_id is not None:
            return await self.repo.list_for_project(project_id=project_id, active_only=active_only, can_pay_only=can_pay_only, page=page, page_size=page_size)
        if can_pay_only:
            return await self.repo.list_can_pay(page=page, page_size=page_size)
        if active_only:
            return await self.repo.list_active(page=page, page_size=page_size)
        return await self.repo.list_all(page=page, page_size=page_size)

    async def create_member(self, name: str) -> FamilyMember:
        existing = await self.repo.get_by_name(name)
        if existing:
            raise HTTPException(status_code=409, detail="Member name already exists")
        member = FamilyMember(name=name)
        return await self.repo.create(member)

    async def update_member(
        self,
        id: uuid.UUID,
        name: str | None,
        is_active: bool | None,
        can_pay: bool | None = None,
        is_kid: bool | None = None,
    ) -> FamilyMember:
        member = await self.repo.get_by_id(id)
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        if name is not None:
            existing = await self.repo.get_by_name(name)
            if existing and existing.id != id:
                raise HTTPException(status_code=409, detail="Member name already exists")
            member.name = name
        if is_active is not None:
            member.is_active = is_active
        if can_pay is not None and is_kid is not None and can_pay and is_kid:
            raise HTTPException(status_code=422, detail="A member cannot be both can_pay and is_kid")
        if can_pay is not None:
            if can_pay and member.is_kid:
                raise HTTPException(status_code=422, detail="A member cannot be both can_pay and is_kid")
            member.can_pay = can_pay
        if is_kid is not None:
            if is_kid and member.can_pay:
                raise HTTPException(status_code=422, detail="A member cannot be both can_pay and is_kid")
            member.is_kid = is_kid
        await self.repo.session.flush()
        await self.repo.session.refresh(member)
        return member

    async def deactivate_member(self, id: uuid.UUID) -> None:
        member = await self.repo.get_by_id(id)
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        await self.repo.soft_delete(member)
