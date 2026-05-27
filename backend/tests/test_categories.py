import pytest


@pytest.mark.asyncio
async def test_create_category(client, auth_headers):
    resp = await client.post("/categories", json={"name": "Food", "color": "#00FF00"}, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Food"
    assert data["color"] == "#00FF00"


@pytest.mark.asyncio
async def test_list_categories(client, auth_headers, category):
    resp = await client.get("/categories", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_rename_category(client, auth_headers, category):
    resp = await client.put(f"/categories/{category.id}", json={"name": "Red Wine"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Red Wine"


@pytest.mark.asyncio
async def test_delete_unreferenced_category(client, auth_headers, category):
    resp = await client.delete(f"/categories/{category.id}", headers=auth_headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_referenced_category_blocked(client, auth_headers, db_session, member, category):
    from decimal import Decimal
    from app.models.item import Item
    from app.models.ticket import Ticket

    ticket = Ticket(
        store_name="Store",
        purchased_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        paid_by_id=member.id,
        total_price=Decimal("5.00"),
        discount_total=Decimal("0.00"),
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(
        ticket_id=ticket.id,
        name="Vinho",
        price=Decimal("5.00"),
        discounted_price=Decimal("5.00"),
        category_id=category.id,
    )
    db_session.add(item)
    await db_session.flush()

    resp = await client.delete(f"/categories/{category.id}", headers=auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_invalid_color(client, auth_headers):
    resp = await client.post("/categories", json={"name": "Bad", "color": "notacolor"}, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_duplicate_category_name(client, auth_headers, category):
    resp = await client.post("/categories", json={"name": "Wine", "color": "#000000"}, headers=auth_headers)
    assert resp.status_code == 409


# ── T067: Independent US5 verification ─────────────────────────────────────


@pytest.mark.asyncio
async def test_category_deletion_blocked_when_item_references_it(client, auth_headers, db_session, member, category):
    """T067: DELETE /categories/{id} must return 409 when any item references the category."""
    from decimal import Decimal
    from datetime import datetime, timezone
    from app.models.item import Item
    from app.models.ticket import Ticket

    ticket = Ticket(
        store_name="Referencing Store",
        purchased_at=datetime(2026, 5, 10, tzinfo=timezone.utc),
        paid_by_id=member.id,
        total_price=Decimal("8.00"),
        discount_total=Decimal("0.00"),
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(
        ticket_id=ticket.id,
        name="Port Wine",
        price=Decimal("8.00"),
        discounted_price=Decimal("8.00"),
        category_id=category.id,
        position=0,
    )
    db_session.add(item)
    await db_session.flush()

    resp = await client.delete(f"/categories/{category.id}", headers=auth_headers)
    assert resp.status_code == 409, "Category referenced by an item must not be deletable"


@pytest.mark.asyncio
async def test_unreferenced_category_can_be_deleted(client, auth_headers):
    """T067: DELETE /categories/{id} must succeed (204) when no item references the category."""
    create_resp = await client.post(
        "/categories", json={"name": "Temporary", "color": "#AAAAAA"}, headers=auth_headers
    )
    assert create_resp.status_code == 201
    cat_id = create_resp.json()["id"]

    resp = await client.delete(f"/categories/{cat_id}", headers=auth_headers)
    assert resp.status_code == 204, "Unreferenced category must be deletable"


@pytest.mark.asyncio
async def test_deleted_category_absent_from_list(client, auth_headers):
    """T067: After deletion, category must not appear in GET /categories."""
    create_resp = await client.post(
        "/categories", json={"name": "ToDelete", "color": "#111111"}, headers=auth_headers
    )
    assert create_resp.status_code == 201
    cat_id = create_resp.json()["id"]

    await client.delete(f"/categories/{cat_id}", headers=auth_headers)

    list_resp = await client.get("/categories", headers=auth_headers)
    assert list_resp.status_code == 200
    ids = [c["id"] for c in list_resp.json()["items"]]
    assert cat_id not in ids, "Deleted category must not appear in category list"
