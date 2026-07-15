"""Tests for /items router: update item, replace allocations."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest


async def _seed_ticket(db_session, project_id, member_id):
    from app.models.allocation import Allocation
    from app.models.item import Item
    from app.models.ticket import Ticket

    t = Ticket(
        store_name="Shop",
        purchased_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        paid_by_id=member_id,
        total_price=Decimal("10.00"),
        discount_total=Decimal("0.00"),
        project_id=project_id,
    )
    db_session.add(t)
    await db_session.flush()

    item = Item(
        ticket_id=t.id,
        name="Beer",
        price=Decimal("10.00"),
        discounted_price=Decimal("10.00"),
        position=0,
    )
    db_session.add(item)
    await db_session.flush()

    alloc = Allocation(item_id=item.id, member_id=member_id)
    db_session.add(alloc)
    await db_session.flush()
    return t, item


@pytest.mark.asyncio
async def test_update_item_not_found(client, auth_headers, portugal_project, member):
    resp = await client.put(
        f"/items/{uuid.uuid4()}",
        json={"name": "Wine"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_item_name(client, auth_headers, portugal_project, member, db_session):
    t, item = await _seed_ticket(db_session, portugal_project.id, member.id)
    resp = await client.put(
        f"/items/{item.id}",
        json={"name": "Wine"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Wine"


@pytest.mark.asyncio
async def test_update_item_price(client, auth_headers, portugal_project, member, db_session):
    t, item = await _seed_ticket(db_session, portugal_project.id, member.id)
    resp = await client.put(
        f"/items/{item.id}",
        json={"price": "5.00"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["price"] == "5.00"


@pytest.mark.asyncio
async def test_update_item_invalid_price(client, auth_headers, portugal_project, member, db_session):
    t, item = await _seed_ticket(db_session, portugal_project.id, member.id)
    resp = await client.put(
        f"/items/{item.id}",
        json={"price": "not-a-number"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_replace_allocations_empty_member_ids(client, auth_headers, portugal_project, member, db_session):
    t, item = await _seed_ticket(db_session, portugal_project.id, member.id)
    resp = await client.put(
        f"/items/{item.id}/allocations",
        json={"member_ids": []},
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_replace_allocations_item_not_found(client, auth_headers, portugal_project):
    resp = await client.put(
        f"/items/{uuid.uuid4()}/allocations",
        json={"member_ids": [str(uuid.uuid4())]},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_replace_allocations_success(client, auth_headers, portugal_project, member, db_session):
    t, item = await _seed_ticket(db_session, portugal_project.id, member.id)
    resp = await client.put(
        f"/items/{item.id}/allocations",
        json={"member_ids": [str(member.id)]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["item_id"] == str(item.id)
    assert len(data["allocated_members"]) == 1
