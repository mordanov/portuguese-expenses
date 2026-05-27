"""Report tests — verifies summary, itemized, and category reports."""
from datetime import datetime, timezone
from decimal import Decimal

import pytest


async def _seed_ticket_with_items(db_session, payer, members_per_item, items_data, days_offset=0):
    from app.models.allocation import Allocation
    from app.models.item import Item
    from app.models.ticket import Ticket

    total = sum(Decimal(str(i["price"])) for i in items_data)
    ticket = Ticket(
        store_name="Store",
        purchased_at=datetime(2026, 5, 1 + days_offset, tzinfo=timezone.utc),
        paid_by_id=payer.id,
        total_price=total,
        discount_total=Decimal("0.00"),
    )
    db_session.add(ticket)
    await db_session.flush()

    for item_data in items_data:
        item = Item(
            ticket_id=ticket.id,
            name=item_data["name"],
            price=Decimal(str(item_data["price"])),
            discounted_price=Decimal(str(item_data["price"])),
            category_id=item_data.get("category_id"),
            position=0,
        )
        db_session.add(item)
        await db_session.flush()

        for mid in members_per_item:
            alloc = Allocation(item_id=item.id, member_id=mid)
            db_session.add(alloc)
    await db_session.flush()
    return ticket


@pytest.mark.asyncio
async def test_summary_report(client, auth_headers, db_session, member):
    from app.models.family_member import FamilyMember

    bob = FamilyMember(name="ReportBob")
    db_session.add(bob)
    await db_session.flush()

    await _seed_ticket_with_items(
        db_session,
        member,
        [member.id, bob.id],
        [{"name": "Shared Item", "price": "20.00"}],
    )

    resp = await client.get(
        "/reports/summary",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    totals = {m["member"]["name"]: Decimal(m["total"]) for m in data["members"]}
    assert totals.get("Alice") == Decimal("10.00")
    assert totals.get("ReportBob") == Decimal("10.00")


@pytest.mark.asyncio
async def test_category_report(client, auth_headers, db_session, member, category):
    await _seed_ticket_with_items(
        db_session,
        member,
        [member.id],
        [{"name": "Wine Item", "price": "30.00", "category_id": category.id}],
    )

    resp = await client.get(
        "/reports/categories",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    cat_names = [c["category"]["name"] for c in data["categories"]]
    assert "Wine" in cat_names


@pytest.mark.asyncio
async def test_summary_missing_params(client, auth_headers):
    resp = await client.get("/reports/summary", headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_itemized_missing_member_id(client, auth_headers):
    resp = await client.get(
        "/reports/itemized",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
