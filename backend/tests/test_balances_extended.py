"""Extended balance and report tests."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest


async def _seed_ticket(db_session, payer, consumer, price, project_id=None):
    from app.models.allocation import Allocation
    from app.models.item import Item
    from app.models.ticket import Ticket

    ticket = Ticket(
        store_name="Ext Store",
        purchased_at=datetime.now(timezone.utc),
        paid_by_id=payer.id,
        total_price=price,
        discount_total=Decimal("0.00"),
        project_id=project_id,
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(
        ticket_id=ticket.id,
        name="ExtItem",
        price=price,
        discounted_price=price,
        position=0,
    )
    db_session.add(item)
    await db_session.flush()

    alloc = Allocation(item_id=item.id, member_id=consumer.id)
    db_session.add(alloc)
    await db_session.flush()
    return ticket


@pytest.mark.asyncio
async def test_balances_single_direction(client, auth_headers, db_session, portugal_project):
    from app.models.family_member import FamilyMember

    alice = FamilyMember(name="ExtAlice")
    bob = FamilyMember(name="ExtBob")
    db_session.add(alice)
    db_session.add(bob)
    await db_session.flush()

    await _seed_ticket(db_session, alice, bob, Decimal("50.00"), project_id=portugal_project.id)

    resp = await client.get("/balances", headers=auth_headers)
    assert resp.status_code == 200
    balances = [b for b in resp.json()["balances"] if b["debtor"]["name"] == "ExtBob"]
    assert len(balances) == 1
    assert Decimal(balances[0]["amount"]) == Decimal("50.00")


@pytest.mark.asyncio
async def test_report_summary_correct_split(client, auth_headers, db_session, portugal_project):
    from app.models.allocation import Allocation
    from app.models.family_member import FamilyMember
    from app.models.item import Item
    from app.models.ticket import Ticket

    alice = FamilyMember(name="SumAlice")
    bob = FamilyMember(name="SumBob")
    db_session.add(alice)
    db_session.add(bob)
    await db_session.flush()

    ticket = Ticket(
        store_name="Sum Store",
        purchased_at=datetime(2026, 5, 15, tzinfo=timezone.utc),
        paid_by_id=alice.id,
        total_price=Decimal("30.00"),
        discount_total=Decimal("0.00"),
        project_id=portugal_project.id,
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(
        ticket_id=ticket.id,
        name="Shared",
        price=Decimal("30.00"),
        discounted_price=Decimal("30.00"),
        position=0,
    )
    db_session.add(item)
    await db_session.flush()

    for mid in [alice.id, bob.id]:
        alloc = Allocation(item_id=item.id, member_id=mid)
        db_session.add(alloc)
    await db_session.flush()

    resp = await client.get(
        "/reports/summary",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    totals = {m["member"]["name"]: Decimal(m["total"]) for m in resp.json()["members"]}
    assert totals.get("SumAlice") == Decimal("15.00")
    assert totals.get("SumBob") == Decimal("15.00")


@pytest.mark.asyncio
async def test_report_itemized(client, auth_headers, db_session, member, portugal_project):
    from app.models.allocation import Allocation
    from app.models.item import Item
    from app.models.ticket import Ticket

    ticket = Ticket(
        store_name="Itm Store",
        purchased_at=datetime(2026, 5, 10, tzinfo=timezone.utc),
        paid_by_id=member.id,
        total_price=Decimal("20.00"),
        discount_total=Decimal("0.00"),
        project_id=portugal_project.id,
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(
        ticket_id=ticket.id,
        name="My Item",
        price=Decimal("20.00"),
        discounted_price=Decimal("20.00"),
        position=0,
    )
    db_session.add(item)
    await db_session.flush()

    alloc = Allocation(item_id=item.id, member_id=member.id)
    db_session.add(alloc)
    await db_session.flush()

    resp = await client.get(
        "/reports/itemized",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31", "member_id": str(member.id)},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert Decimal(data["grand_total"]) == Decimal("20.00")
    assert len(data["tickets"]) == 1


@pytest.mark.asyncio
async def test_report_categories_uncategorized(client, auth_headers, db_session, member, portugal_project):
    from app.models.allocation import Allocation
    from app.models.item import Item
    from app.models.ticket import Ticket

    ticket = Ticket(
        store_name="Uncat Store",
        purchased_at=datetime(2026, 5, 12, tzinfo=timezone.utc),
        paid_by_id=member.id,
        total_price=Decimal("15.00"),
        discount_total=Decimal("0.00"),
        project_id=portugal_project.id,
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(
        ticket_id=ticket.id,
        name="Uncategorized Item",
        price=Decimal("15.00"),
        discounted_price=Decimal("15.00"),
        category_id=None,
        position=0,
    )
    db_session.add(item)
    await db_session.flush()

    alloc = Allocation(item_id=item.id, member_id=member.id)
    db_session.add(alloc)
    await db_session.flush()

    resp = await client.get(
        "/reports/categories",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert Decimal(data["uncategorized"]) >= Decimal("15.00")
