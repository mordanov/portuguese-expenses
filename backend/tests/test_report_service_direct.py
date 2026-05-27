"""Direct unit tests for report_service — bypasses HTTP layer to maximize coverage."""
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest


async def _seed_data(db_session):
    from app.models.allocation import Allocation
    from app.models.category import Category
    from app.models.family_member import FamilyMember
    from app.models.item import Item
    from app.models.ticket import Ticket

    alice = FamilyMember(name="SvcAlice")
    bob = FamilyMember(name="SvcBob")
    wine_cat = Category(name="SvcWine", color="#722F37")
    db_session.add(alice)
    db_session.add(bob)
    db_session.add(wine_cat)
    await db_session.flush()

    ticket = Ticket(
        store_name="SvcStore",
        purchased_at=datetime(2026, 5, 15, tzinfo=timezone.utc),
        paid_by_id=alice.id,
        total_price=Decimal("20.00"),
        discount_total=Decimal("0.00"),
    )
    db_session.add(ticket)
    await db_session.flush()

    item1 = Item(
        ticket_id=ticket.id,
        name="SharedItem",
        price=Decimal("12.00"),
        discounted_price=Decimal("12.00"),
        category_id=wine_cat.id,
        position=0,
    )
    item2 = Item(
        ticket_id=ticket.id,
        name="UncatItem",
        price=Decimal("8.00"),
        discounted_price=Decimal("8.00"),
        category_id=None,
        position=1,
    )
    db_session.add(item1)
    db_session.add(item2)
    await db_session.flush()

    for mid in [alice.id, bob.id]:
        alloc = Allocation(item_id=item1.id, member_id=mid)
        db_session.add(alloc)
    alloc2 = Allocation(item_id=item2.id, member_id=alice.id)
    db_session.add(alloc2)
    await db_session.flush()

    return alice, bob, wine_cat, ticket


@pytest.mark.asyncio
async def test_report_service_summary_direct(db_session):
    alice, bob, _, _ = await _seed_data(db_session)
    from app.services.report_service import ReportService

    service = ReportService(db_session)
    result = await service.get_summary(date(2026, 5, 1), date(2026, 5, 31))
    totals = {m.member.name: Decimal(m.total) for m in result.members}
    assert totals["SvcAlice"] == Decimal("14.00")
    assert totals["SvcBob"] == Decimal("6.00")


@pytest.mark.asyncio
async def test_report_service_itemized_direct(db_session):
    alice, _, _, ticket = await _seed_data(db_session)
    from app.services.report_service import ReportService

    service = ReportService(db_session)
    result = await service.get_itemized(date(2026, 5, 1), date(2026, 5, 31), alice.id)
    assert Decimal(result.grand_total) == Decimal("14.00")
    assert len(result.tickets) == 1
    assert result.member.name == "SvcAlice"


@pytest.mark.asyncio
async def test_report_service_category_direct(db_session):
    alice, bob, wine_cat, _ = await _seed_data(db_session)
    from app.services.report_service import ReportService

    service = ReportService(db_session)
    result = await service.get_category_report(date(2026, 5, 1), date(2026, 5, 31))
    assert Decimal(result.total) > Decimal("0.00")
    assert Decimal(result.uncategorized) == Decimal("8.00")
    cat_names = [c.category.name for c in result.categories]
    assert "SvcWine" in cat_names


@pytest.mark.asyncio
async def test_report_service_empty_summary(db_session):
    from app.services.report_service import ReportService

    service = ReportService(db_session)
    result = await service.get_summary(date(2026, 1, 1), date(2026, 1, 31))
    assert result.members == []


@pytest.mark.asyncio
async def test_report_service_itemized_no_data(db_session):
    import uuid

    from app.services.report_service import ReportService

    service = ReportService(db_session)
    result = await service.get_itemized(date(2026, 1, 1), date(2026, 1, 31), uuid.uuid4())
    assert result.grand_total == "0.00"
    assert result.tickets == []
