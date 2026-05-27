"""Tests specifically targeting service-layer coverage gaps."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest


@pytest.mark.asyncio
async def test_member_service_create_duplicate(db_session):
    from fastapi import HTTPException

    from app.services.member_service import MemberService

    service = MemberService(db_session)
    await service.create_member("CovAlice")
    with pytest.raises(HTTPException) as exc:
        await service.create_member("CovAlice")
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_member_service_update_name_conflict(db_session):
    from fastapi import HTTPException

    from app.services.member_service import MemberService

    service = MemberService(db_session)
    m1 = await service.create_member("CovAlice2")
    await service.create_member("CovBob2")
    with pytest.raises(HTTPException) as exc:
        await service.update_member(m1.id, "CovBob2", None)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_member_service_deactivate_not_found(db_session):
    from fastapi import HTTPException

    from app.services.member_service import MemberService

    service = MemberService(db_session)
    with pytest.raises(HTTPException) as exc:
        await service.deactivate_member(uuid.uuid4())
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_category_service_create_duplicate(db_session):
    from fastapi import HTTPException

    from app.services.category_service import CategoryService

    service = CategoryService(db_session)
    await service.create_category("CovWine", "#722F37")
    with pytest.raises(HTTPException) as exc:
        await service.create_category("CovWine", "#000000")
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_category_service_update_not_found(db_session):
    from fastapi import HTTPException

    from app.services.category_service import CategoryService

    service = CategoryService(db_session)
    with pytest.raises(HTTPException) as exc:
        await service.update_category(uuid.uuid4(), "New", None)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_category_service_update_name_conflict(db_session):
    from fastapi import HTTPException

    from app.services.category_service import CategoryService

    service = CategoryService(db_session)
    c1 = await service.create_category("CovCat1", "#111111")
    await service.create_category("CovCat2", "#222222")
    with pytest.raises(HTTPException) as exc:
        await service.update_category(c1.id, "CovCat2", None)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_category_service_delete_not_found(db_session):
    from fastapi import HTTPException

    from app.services.category_service import CategoryService

    service = CategoryService(db_session)
    with pytest.raises(HTTPException) as exc:
        await service.delete_category(uuid.uuid4())
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_ticket_service_all_zero_subtotal(db_session):
    """Edge case: all items have price 0 → discount formula uses 0 path."""
    from app.services.ticket_service import compute_discounted_prices

    prices = [Decimal("0.00"), Decimal("0.00")]
    result = compute_discounted_prices(prices, Decimal("0.00"))
    assert result == [Decimal("0.00"), Decimal("0.00")]


@pytest.mark.asyncio
async def test_ticket_service_invalid_paid_by(db_session):
    from fastapi import HTTPException

    from app.schemas.ticket import ItemCreateRequest, TicketCreateRequest
    from app.services.ticket_service import TicketService

    service = TicketService(db_session)
    request = TicketCreateRequest(
        store_name="Store",
        purchased_at=datetime.now(timezone.utc),
        paid_by_id=uuid.uuid4(),
        total_price="10.00",
        discount_total="0.00",
        items=[ItemCreateRequest(name="Item", price="10.00", position=0, member_ids=[uuid.uuid4()])],
    )
    with pytest.raises(HTTPException) as exc:
        await service.save_ticket(request)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_health_endpoint(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
