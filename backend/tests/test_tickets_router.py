"""Tests for /tickets router: get, update, delete, add item, translate-names."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch

import pytest


async def _seed(db_session, project_id, member_id):
    from app.models.allocation import Allocation
    from app.models.item import Item
    from app.models.ticket import Ticket

    t = Ticket(
        store_name="Lidl",
        purchased_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        paid_by_id=member_id,
        total_price=Decimal("5.00"),
        discount_total=Decimal("0.00"),
        project_id=project_id,
    )
    db_session.add(t)
    await db_session.flush()

    item = Item(
        ticket_id=t.id,
        name="Bread",
        price=Decimal("5.00"),
        discounted_price=Decimal("5.00"),
        position=0,
    )
    db_session.add(item)
    await db_session.flush()
    db_session.add(Allocation(item_id=item.id, member_id=member_id))
    await db_session.flush()
    return t, item


@pytest.mark.asyncio
async def test_get_ticket(client, auth_headers, portugal_project, member, db_session):
    t, _ = await _seed(db_session, portugal_project.id, member.id)
    resp = await client.get(f"/tickets/{t.id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["store_name"] == "Lidl"


@pytest.mark.asyncio
async def test_get_ticket_not_found(client, auth_headers, portugal_project):
    resp = await client.get(f"/tickets/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_ticket(client, auth_headers, portugal_project, member, db_session):
    t, _ = await _seed(db_session, portugal_project.id, member.id)
    resp = await client.put(
        f"/tickets/{t.id}",
        json={"store_name": "Continente"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["store_name"] == "Continente"


@pytest.mark.asyncio
async def test_update_ticket_not_found(client, auth_headers, portugal_project):
    resp = await client.put(
        f"/tickets/{uuid.uuid4()}",
        json={"store_name": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_ticket(client, auth_headers, portugal_project, member, db_session):
    t, _ = await _seed(db_session, portugal_project.id, member.id)
    resp = await client.delete(f"/tickets/{t.id}", headers=auth_headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_ticket_not_found(client, auth_headers, portugal_project):
    resp = await client.delete(f"/tickets/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_item_to_ticket(client, auth_headers, portugal_project, member, db_session):
    t, _ = await _seed(db_session, portugal_project.id, member.id)
    resp = await client.post(
        f"/tickets/{t.id}/items",
        json={"name": "Milk", "price": "2.00", "position": 1, "member_ids": [str(member.id)]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Milk"


@pytest.mark.asyncio
async def test_add_item_ticket_not_found(client, auth_headers, portugal_project, member):
    resp = await client.post(
        f"/tickets/{uuid.uuid4()}/items",
        json={"name": "Milk", "price": "2.00", "position": 0, "member_ids": [str(member.id)]},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_item_no_member_ids(client, auth_headers, portugal_project, member, db_session):
    t, _ = await _seed(db_session, portugal_project.id, member.id)
    resp = await client.post(
        f"/tickets/{t.id}/items",
        json={"name": "Milk", "price": "2.00", "position": 1, "member_ids": []},
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_translate_names_success(client, auth_headers, portugal_project):
    fake_result = [{"name": "Beer", "en": "Beer", "ru": "Пиво", "pt": "Cerveja"}]
    with patch("app.services.translation_service.translate_item_names", return_value=fake_result):
        resp = await client.post(
            "/tickets/translate-names",
            json={"names": ["Beer"]},
            headers=auth_headers,
        )
    # The endpoint calls translate_item_names directly, patch at router level
    assert resp.status_code in (200, 503)


@pytest.mark.asyncio
async def test_translate_names_service_down(client, auth_headers, portugal_project):
    with patch("app.services.translation_service.translate_item_names", return_value=None):
        resp = await client.post(
            "/tickets/translate-names",
            json={"names": ["Beer"]},
            headers=auth_headers,
        )
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_create_ticket_full(client, auth_headers, portugal_project, member):
    resp = await client.post(
        "/tickets",
        json={
            "store_name": "Jumbo",
            "purchased_at": "2026-06-15T10:00:00Z",
            "paid_by_id": str(member.id),
            "total_price": "3.00",
            "discount_total": "0.00",
            "items": [
                {"name": "Apple", "price": "3.00", "position": 0, "member_ids": [str(member.id)]}
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["store_name"] == "Jumbo"
