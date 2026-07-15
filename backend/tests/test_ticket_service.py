"""Unit tests for TicketService business logic coverage."""
import uuid
from decimal import Decimal

import pytest

from app.services.ticket_service import TicketService, compute_discounted_prices


def test_compute_discounted_prices_proportional():
    prices = [Decimal("3.00"), Decimal("7.00")]
    result = compute_discounted_prices(prices, Decimal("1.00"))
    # Total discount is $1. Item1 gets 30% = $0.30 off → $2.70; item2 gets $0.70 off → $6.30
    assert result[0] == Decimal("2.70")
    assert result[1] == Decimal("6.30")


def test_compute_discounted_prices_zero_subtotal():
    prices = [Decimal("0.00"), Decimal("0.00")]
    result = compute_discounted_prices(prices, Decimal("1.00"))
    assert result == [Decimal("0.00"), Decimal("0.00")]


def _make_request(**kwargs):
    from app.schemas.ticket import ItemCreateRequest, TicketCreateRequest

    defaults = dict(
        store_name="Shop",
        purchased_at="2026-05-01T10:00:00Z",
        paid_by_id=None,
        total_price="10.00",
        discount_total="0.00",
        items=[],
    )
    defaults.update(kwargs)
    return TicketCreateRequest(**defaults)


@pytest.mark.asyncio
async def test_save_ticket_invalid_payer(db_session, portugal_project):
    from app.schemas.ticket import ItemCreateRequest

    service = TicketService(db_session)
    req = _make_request(
        paid_by_id=uuid.uuid4(),
        items=[
            ItemCreateRequest(name="Beer", price="10.00", position=0, member_ids=[uuid.uuid4()])
        ],
    )
    with pytest.raises(Exception) as exc_info:
        await service.save_ticket(req, project_id=portugal_project.id)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_save_ticket_item_no_member_ids(db_session, portugal_project, member):
    from app.schemas.ticket import ItemCreateRequest
    from fastapi import HTTPException

    service = TicketService(db_session)
    req = _make_request(
        paid_by_id=member.id,
        total_price="5.00",
        items=[ItemCreateRequest(name="Beer", price="5.00", position=0, member_ids=[])],
    )
    with pytest.raises(HTTPException) as exc_info:
        await service.save_ticket(req, project_id=portugal_project.id)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_save_ticket_invalid_price_string(db_session, portugal_project, member):
    from app.schemas.ticket import ItemCreateRequest
    from fastapi import HTTPException

    service = TicketService(db_session)
    req = _make_request(
        paid_by_id=member.id,
        total_price="not-a-number",
        items=[ItemCreateRequest(name="Beer", price="5.00", position=0, member_ids=[member.id])],
    )
    with pytest.raises(HTTPException) as exc_info:
        await service.save_ticket(req, project_id=portugal_project.id)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_save_ticket_invalid_item_price_string(db_session, portugal_project, member):
    from app.schemas.ticket import ItemCreateRequest
    from fastapi import HTTPException

    service = TicketService(db_session)
    req = _make_request(
        paid_by_id=member.id,
        total_price="5.00",
        items=[ItemCreateRequest(name="Beer", price="bad", position=0, member_ids=[member.id])],
    )
    with pytest.raises(HTTPException) as exc_info:
        await service.save_ticket(req, project_id=portugal_project.id)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_save_ticket_unknown_member_in_items(db_session, portugal_project, member):
    from app.schemas.ticket import ItemCreateRequest
    from fastapi import HTTPException

    service = TicketService(db_session)
    req = _make_request(
        paid_by_id=member.id,
        total_price="5.00",
        items=[
            ItemCreateRequest(
                name="Beer", price="5.00", position=0, member_ids=[uuid.uuid4()]
            )
        ],
    )
    with pytest.raises(HTTPException) as exc_info:
        await service.save_ticket(req, project_id=portugal_project.id)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_save_ticket_inactive_member_in_items(db_session, portugal_project, member):
    from app.models.family_member import FamilyMember
    from app.schemas.ticket import ItemCreateRequest
    from fastapi import HTTPException

    inactive = FamilyMember(name="Inactive", is_active=False)
    db_session.add(inactive)
    await db_session.flush()

    service = TicketService(db_session)
    req = _make_request(
        paid_by_id=member.id,
        total_price="5.00",
        items=[
            ItemCreateRequest(
                name="Beer", price="5.00", position=0, member_ids=[inactive.id]
            )
        ],
    )
    with pytest.raises(HTTPException) as exc_info:
        await service.save_ticket(req, project_id=portugal_project.id)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_get_ticket_not_found(db_session, portugal_project):
    from fastapi import HTTPException

    service = TicketService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await service.get_ticket(uuid.uuid4())
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_ticket_not_found(db_session, portugal_project):
    from fastapi import HTTPException

    service = TicketService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await service.delete_ticket(uuid.uuid4())
    assert exc_info.value.status_code == 404
