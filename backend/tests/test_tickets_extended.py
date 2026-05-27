"""Extended ticket tests — covers ticket CRUD (GET, PUT, DELETE)."""
from datetime import datetime, timezone
from decimal import Decimal

import pytest


async def _create_ticket_via_api(client, auth_headers, member):
    payload = {
        "store_name": "TestStore",
        "purchased_at": "2026-05-20T14:30:00Z",
        "paid_by_id": str(member.id),
        "total_price": "10.00",
        "discount_total": "1.00",
        "items": [
            {"name": "Item A", "price": "6.00", "position": 0, "member_ids": [str(member.id)]},
            {"name": "Item B", "price": "4.00", "position": 1, "member_ids": [str(member.id)]},
        ],
    }
    resp = await client.post("/tickets", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_get_ticket_by_id(client, auth_headers, member):
    ticket = await _create_ticket_via_api(client, auth_headers, member)
    resp = await client.get(f"/tickets/{ticket['id']}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["store_name"] == "TestStore"
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_list_tickets(client, auth_headers, member):
    await _create_ticket_via_api(client, auth_headers, member)
    resp = await client.get("/tickets", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_list_tickets_with_filters(client, auth_headers, member):
    await _create_ticket_via_api(client, auth_headers, member)
    resp = await client.get(
        "/tickets",
        params={"from_date": "2026-05-01T00:00:00Z", "to_date": "2026-05-31T23:59:59Z"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_delete_ticket(client, auth_headers, member):
    ticket = await _create_ticket_via_api(client, auth_headers, member)
    resp = await client.delete(f"/tickets/{ticket['id']}", headers=auth_headers)
    assert resp.status_code == 204

    resp = await client.get(f"/tickets/{ticket['id']}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_nonexistent_ticket(client, auth_headers):
    import uuid

    resp = await client.get(f"/tickets/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_zero_discount_preserved(client, auth_headers, member):
    payload = {
        "store_name": "Store",
        "purchased_at": "2026-05-20T14:30:00Z",
        "paid_by_id": str(member.id),
        "total_price": "5.00",
        "discount_total": "0.00",
        "items": [
            {"name": "Item", "price": "5.00", "position": 0, "member_ids": [str(member.id)]},
        ],
    }
    resp = await client.post("/tickets", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert Decimal(data["items"][0]["discounted_price"]) == Decimal("5.00")


@pytest.mark.asyncio
async def test_update_ticket_store_name(client, auth_headers, member):
    ticket = await _create_ticket_via_api(client, auth_headers, member)
    resp = await client.put(
        f"/tickets/{ticket['id']}",
        json={"store_name": "Updated Store"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["store_name"] == "Updated Store"
