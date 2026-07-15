"""Extra report tests: payments report, itemized report."""
from decimal import Decimal
from datetime import datetime, timezone

import pytest


@pytest.mark.asyncio
async def test_payments_report_empty(client, auth_headers, portugal_project):
    resp = await client.get(
        "/reports/payments",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["payments"] == []
    assert data["total"] == "0.00"


@pytest.mark.asyncio
async def test_payments_report_with_data(client, auth_headers, portugal_project, member, db_session):
    from app.models.family_member import FamilyMember
    from app.models.payment import Payment

    bob = FamilyMember(name="PayReportBob")
    db_session.add(bob)
    await db_session.flush()

    payment = Payment(
        payer_id=bob.id,
        payee_id=member.id,
        amount=Decimal("25.00"),
        paid_at=datetime(2026, 5, 15, tzinfo=timezone.utc),
        note="Test payment",
        project_id=portugal_project.id,
    )
    db_session.add(payment)
    await db_session.flush()

    resp = await client.get(
        "/reports/payments",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["payments"]) == 1
    assert Decimal(data["total"]) == Decimal("25.00")
    assert data["payments"][0]["note"] == "Test payment"


@pytest.mark.asyncio
async def test_itemized_report(client, auth_headers, portugal_project, member, db_session):
    from app.models.allocation import Allocation
    from app.models.item import Item
    from app.models.ticket import Ticket

    ticket = Ticket(
        store_name="ReportStore",
        purchased_at=datetime(2026, 5, 10, tzinfo=timezone.utc),
        paid_by_id=member.id,
        total_price=Decimal("15.00"),
        discount_total=Decimal("0.00"),
        project_id=portugal_project.id,
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(
        ticket_id=ticket.id,
        name="Sardines",
        price=Decimal("15.00"),
        discounted_price=Decimal("15.00"),
        position=0,
    )
    db_session.add(item)
    await db_session.flush()

    db_session.add(Allocation(item_id=item.id, member_id=member.id))
    await db_session.flush()

    resp = await client.get(
        "/reports/itemized",
        params={"from_date": "2026-05-01", "to_date": "2026-05-31", "member_id": str(member.id)},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["grand_total"] == "15.00"
    all_item_names = [i["name"] for t in data["tickets"] for i in t["items"]]
    assert "Sardines" in all_item_names
