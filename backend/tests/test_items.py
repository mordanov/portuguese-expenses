"""Tests for item update and allocation replacement."""
from datetime import datetime, timezone
from decimal import Decimal

import pytest


async def _create_ticket_with_item(client, auth_headers, db_session, member):
    from app.models.allocation import Allocation
    from app.models.item import Item
    from app.models.ticket import Ticket

    ticket = Ticket(
        store_name="Store",
        purchased_at=datetime.now(timezone.utc),
        paid_by_id=member.id,
        total_price=Decimal("10.00"),
        discount_total=Decimal("0.00"),
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(
        ticket_id=ticket.id,
        name="TestItem",
        price=Decimal("10.00"),
        discounted_price=Decimal("10.00"),
        position=0,
    )
    db_session.add(item)
    await db_session.flush()

    alloc = Allocation(item_id=item.id, member_id=member.id)
    db_session.add(alloc)
    await db_session.flush()

    return ticket, item


@pytest.mark.asyncio
async def test_update_item_name(client, auth_headers, db_session, member):
    _, item = await _create_ticket_with_item(client, auth_headers, db_session, member)
    resp = await client.put(f"/items/{item.id}", json={"name": "Updated"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"


@pytest.mark.asyncio
async def test_replace_allocations(client, auth_headers, db_session, member):
    from app.models.family_member import FamilyMember

    bob = FamilyMember(name="ItemBob")
    db_session.add(bob)
    await db_session.flush()

    _, item = await _create_ticket_with_item(client, auth_headers, db_session, member)
    resp = await client.put(
        f"/items/{item.id}/allocations",
        json={"member_ids": [str(bob.id)]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["allocated_members"]) == 1
    assert data["allocated_members"][0]["name"] == "ItemBob"


@pytest.mark.asyncio
async def test_replace_allocations_empty_rejected(client, auth_headers, db_session, member):
    _, item = await _create_ticket_with_item(client, auth_headers, db_session, member)
    resp = await client.put(
        f"/items/{item.id}/allocations",
        json={"member_ids": []},
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_item_not_found(client, auth_headers):
    import uuid

    resp = await client.put(f"/items/{uuid.uuid4()}", json={"name": "X"}, headers=auth_headers)
    assert resp.status_code == 404
