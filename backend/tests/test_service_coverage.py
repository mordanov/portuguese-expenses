"""Tests specifically targeting service-layer coverage gaps."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest


@pytest.mark.asyncio
async def test_member_service_create_duplicate(db_session, portugal_project):
    from fastapi import HTTPException

    from app.services.member_service import MemberService

    service = MemberService(db_session)
    await service.create_member("CovAlice", portugal_project.id)
    with pytest.raises(HTTPException) as exc:
        await service.create_member("CovAlice", portugal_project.id)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_member_service_update_name_conflict(db_session, portugal_project):
    from fastapi import HTTPException

    from app.services.member_service import MemberService

    service = MemberService(db_session)
    m1 = await service.create_member("CovAlice2", portugal_project.id)
    await service.create_member("CovBob2", portugal_project.id)
    with pytest.raises(HTTPException) as exc:
        await service.update_member(m1.id, "CovBob2", None, project_id=portugal_project.id)
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
async def test_category_service_create_duplicate(db_session, portugal_project):
    from fastapi import HTTPException

    from app.services.category_service import CategoryService

    service = CategoryService(db_session)
    await service.create_category("CovWine", "#722F37", project_id=portugal_project.id)
    with pytest.raises(HTTPException) as exc:
        await service.create_category("CovWine", "#000000", project_id=portugal_project.id)
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
async def test_category_service_update_name_conflict(db_session, portugal_project):
    from fastapi import HTTPException

    from app.services.category_service import CategoryService

    service = CategoryService(db_session)
    c1 = await service.create_category("CovCat1", "#111111", project_id=portugal_project.id)
    await service.create_category("CovCat2", "#222222", project_id=portugal_project.id)
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


# ── CategoryService: update success path and referenced delete ────────────────


@pytest.mark.asyncio
async def test_category_service_update_success(db_session, portugal_project):
    from app.services.category_service import CategoryService

    service = CategoryService(db_session)
    c = await service.create_category("UpdateMe", "#111111", project_id=portugal_project.id)
    updated = await service.update_category(c.id, "UpdatedName", "#222222")
    assert updated.name == "UpdatedName"
    assert updated.color == "#222222"


@pytest.mark.asyncio
async def test_category_service_delete_referenced_raises(db_session, portugal_project):
    from decimal import Decimal
    from app.models.item import Item
    from app.models.ticket import Ticket
    from app.services.category_service import CategoryService, CategoryReferencedError

    service = CategoryService(db_session)
    c = await service.create_category("RefCat", "#333333", project_id=portugal_project.id)
    await db_session.flush()

    from app.models.family_member import FamilyMember
    m = FamilyMember(name="RefMember")
    db_session.add(m)
    await db_session.flush()

    ticket = Ticket(
        store_name="S",
        purchased_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        paid_by_id=m.id,
        total_price=Decimal("5.00"),
        discount_total=Decimal("0.00"),
        project_id=portugal_project.id,
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(
        ticket_id=ticket.id,
        name="RefItem",
        price=Decimal("5.00"),
        discounted_price=Decimal("5.00"),
        category_id=c.id,
        position=0,
    )
    db_session.add(item)
    await db_session.flush()

    with pytest.raises(CategoryReferencedError):
        await service.delete_category(c.id)


# ── ReportService: get_payments_report ───────────────────────────────────────


@pytest.mark.asyncio
async def test_report_service_payments_report_empty(db_session):
    from datetime import date
    from app.services.report_service import ReportService

    service = ReportService(db_session)
    result = await service.get_payments_report(date(2026, 5, 1), date(2026, 5, 31))
    assert result.payments == []
    assert result.total == "0.00"


@pytest.mark.asyncio
async def test_report_service_payments_report_with_data(db_session, portugal_project):
    from datetime import date, datetime, timezone
    from decimal import Decimal
    from app.models.family_member import FamilyMember
    from app.models.payment import Payment
    from app.services.report_service import ReportService

    alice = FamilyMember(name="PayAlice")
    bob = FamilyMember(name="PayBob")
    db_session.add(alice)
    db_session.add(bob)
    await db_session.flush()

    payment = Payment(
        payer_id=alice.id,
        payee_id=bob.id,
        amount=Decimal("25.00"),
        paid_at=datetime(2026, 5, 15, tzinfo=timezone.utc),
        project_id=portugal_project.id,
    )
    db_session.add(payment)
    await db_session.flush()

    service = ReportService(db_session)
    result = await service.get_payments_report(date(2026, 5, 1), date(2026, 5, 31))
    assert len(result.payments) == 1
    assert Decimal(result.total) == Decimal("25.00")
    assert result.payments[0].payer_name == "PayAlice"


# ── BalanceService: direct call ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_balance_service_direct(db_session, portugal_project):
    from datetime import datetime, timezone
    from decimal import Decimal
    from app.models.allocation import Allocation
    from app.models.family_member import FamilyMember
    from app.models.item import Item
    from app.models.ticket import Ticket
    from app.services.balance_service import BalanceService

    alice = FamilyMember(name="BSvcAlice")
    bob = FamilyMember(name="BSvcBob")
    db_session.add(alice)
    db_session.add(bob)
    await db_session.flush()

    ticket = Ticket(
        store_name="BSvcStore",
        purchased_at=datetime(2026, 5, 10, tzinfo=timezone.utc),
        paid_by_id=alice.id,
        total_price=Decimal("30.00"),
        discount_total=Decimal("0.00"),
        project_id=portugal_project.id,
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(
        ticket_id=ticket.id,
        name="BSvcItem",
        price=Decimal("30.00"),
        discounted_price=Decimal("30.00"),
        position=0,
    )
    db_session.add(item)
    await db_session.flush()

    alloc = Allocation(item_id=item.id, member_id=bob.id)
    db_session.add(alloc)
    await db_session.flush()

    service = BalanceService(db_session)
    result = await service.get_balances(project_id=portugal_project.id)
    assert len(result.balances) == 1
    assert result.balances[0].debtor.name == "BSvcBob"
    assert Decimal(result.balances[0].amount) == Decimal("30.00")
