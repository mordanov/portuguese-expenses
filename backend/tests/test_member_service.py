"""Unit tests for MemberService business logic — covers no-project-id branches."""
import uuid

import pytest

from app.services.member_service import MemberService


@pytest.mark.asyncio
async def test_list_members_no_project_all(db_session, portugal_project, member):
    """With project_id=None and no filters, uses list_all path."""
    service = MemberService(db_session)
    members, total = await service.list_members(project_id=None)
    assert total >= 1


@pytest.mark.asyncio
async def test_list_members_no_project_active_only(db_session, portugal_project, member):
    service = MemberService(db_session)
    members, total = await service.list_members(active_only=True, project_id=None)
    assert all(m.is_active for m in members)


@pytest.mark.asyncio
async def test_list_members_no_project_can_pay_only(db_session, portugal_project):
    from app.models.family_member import FamilyMember

    payer = FamilyMember(name="Payer", can_pay=True)
    db_session.add(payer)
    await db_session.flush()

    service = MemberService(db_session)
    members, total = await service.list_members(can_pay_only=True, project_id=None)
    assert all(m.can_pay for m in members)


@pytest.mark.asyncio
async def test_update_member_not_found(db_session, portugal_project):
    from fastapi import HTTPException

    service = MemberService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await service.update_member(uuid.uuid4(), name="X", is_active=None)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_update_member_duplicate_name(db_session, portugal_project, member):
    from app.models.family_member import FamilyMember
    from fastapi import HTTPException

    bob = FamilyMember(name="Bob")
    db_session.add(bob)
    await db_session.flush()

    service = MemberService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await service.update_member(bob.id, name="Alice", is_active=None)
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_update_member_can_pay_and_is_kid_conflict(db_session, portugal_project, member):
    from fastapi import HTTPException

    service = MemberService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await service.update_member(member.id, name=None, is_active=None, can_pay=True, is_kid=True)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_update_member_can_pay_on_kid(db_session, portugal_project):
    from app.models.family_member import FamilyMember
    from fastapi import HTTPException

    kid = FamilyMember(name="Kid", is_kid=True, can_pay=False)
    db_session.add(kid)
    await db_session.flush()

    service = MemberService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await service.update_member(kid.id, name=None, is_active=None, can_pay=True)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_update_member_is_kid_on_payer(db_session, portugal_project):
    from app.models.family_member import FamilyMember
    from fastapi import HTTPException

    payer = FamilyMember(name="Payer2", can_pay=True, is_kid=False)
    db_session.add(payer)
    await db_session.flush()

    service = MemberService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await service.update_member(payer.id, name=None, is_active=None, is_kid=True)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_update_member_success(db_session, portugal_project, member):
    service = MemberService(db_session)
    updated = await service.update_member(member.id, name="Alicia", is_active=True)
    assert updated.name == "Alicia"


@pytest.mark.asyncio
async def test_deactivate_member_not_found(db_session, portugal_project):
    from fastapi import HTTPException

    service = MemberService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await service.deactivate_member(uuid.uuid4())
    assert exc_info.value.status_code == 404
