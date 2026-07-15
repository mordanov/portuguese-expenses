import pytest


@pytest.mark.asyncio
async def test_create_member(client, auth_headers, portugal_project):
    resp = await client.post("/members", json={"name": "Bob"}, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Bob"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_list_members(client, auth_headers, member):
    resp = await client.get("/members", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(m["name"] == "Alice" for m in data["items"])


@pytest.mark.asyncio
async def test_rename_member(client, auth_headers, member):
    resp = await client.put(f"/members/{member.id}", json={"name": "Alicia"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Alicia"


@pytest.mark.asyncio
async def test_deactivate_member(client, auth_headers, member):
    resp = await client.delete(f"/members/{member.id}", headers=auth_headers)
    assert resp.status_code == 204

    resp = await client.get("/members", params={"active_only": "true"}, headers=auth_headers)
    names = [m["name"] for m in resp.json()["items"]]
    assert "Alice" not in names


@pytest.mark.asyncio
async def test_deactivated_member_in_all_list(client, auth_headers, member):
    await client.delete(f"/members/{member.id}", headers=auth_headers)
    resp = await client.get("/members", headers=auth_headers)
    assert any(m["name"] == "Alice" for m in resp.json()["items"])


@pytest.mark.asyncio
async def test_duplicate_member_name(client, auth_headers, member):
    resp = await client.post("/members", json={"name": "Alice"}, headers=auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_member_not_found(client, auth_headers):
    import uuid

    resp = await client.put(f"/members/{uuid.uuid4()}", json={"name": "X"}, headers=auth_headers)
    assert resp.status_code == 404


# ── T067: Independent US5 verification ─────────────────────────────────────


@pytest.mark.asyncio
async def test_deactivated_member_excluded_from_active_selectors(client, auth_headers, member):
    """T067: Deactivated member must not appear in active_only=true list (used by allocation selectors)."""
    # member "Alice" is active — confirm present
    resp = await client.get("/members", params={"active_only": "true"}, headers=auth_headers)
    assert any(m["name"] == "Alice" for m in resp.json()["items"])

    # deactivate
    resp = await client.delete(f"/members/{member.id}", headers=auth_headers)
    assert resp.status_code == 204

    # must be absent from active selectors
    resp = await client.get("/members", params={"active_only": "true"}, headers=auth_headers)
    assert resp.status_code == 200
    names = [m["name"] for m in resp.json()["items"]]
    assert "Alice" not in names, "Deactivated member must be excluded from active selector"


@pytest.mark.asyncio
async def test_deactivated_member_present_in_historical_allocation(client, auth_headers, db_session, member, portugal_project):
    """T067: Deactivated member's name must still appear on historical ticket allocations after deactivation."""
    from decimal import Decimal
    from app.models.allocation import Allocation
    from app.models.item import Item
    from app.models.ticket import Ticket
    from datetime import datetime, timezone

    import uuid as _uuid

    payer_resp = await client.post("/members", json={"name": "Payer"}, headers=auth_headers)
    assert payer_resp.status_code == 201
    payer_id = _uuid.UUID(payer_resp.json()["id"])

    # Seed ticket directly with Alice (still active) as allocated member
    ticket = Ticket(
        store_name="History Store",
        purchased_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
        paid_by_id=payer_id,
        total_price=Decimal("10.00"),
        discount_total=Decimal("0.00"),
        project_id=portugal_project.id,
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(
        ticket_id=ticket.id,
        name="Wine",
        price=Decimal("10.00"),
        discounted_price=Decimal("10.00"),
        position=0,
    )
    db_session.add(item)
    await db_session.flush()

    alloc = Allocation(item_id=item.id, member_id=member.id)
    db_session.add(alloc)
    await db_session.flush()

    # Now deactivate Alice
    resp = await client.delete(f"/members/{member.id}", headers=auth_headers)
    assert resp.status_code == 204

    # Historical ticket detail must still show Alice in allocations
    resp = await client.get(f"/tickets/{ticket.id}", headers=auth_headers)
    assert resp.status_code == 200
    ticket_data = resp.json()
    allocated_names = [
        alloc["name"]
        for it in ticket_data["items"]
        for alloc in it["allocated_members"]
    ]
    assert "Alice" in allocated_names, (
        "Deactivated member must remain visible in historical ticket allocations"
    )


@pytest.mark.asyncio
async def test_inactive_member_rejected_in_new_ticket(client, auth_headers, member):
    """T067: Saving a new ticket with a deactivated member in member_ids returns 422."""
    payer_resp = await client.post("/members", json={"name": "ActivePayer"}, headers=auth_headers)
    assert payer_resp.status_code == 201
    payer_id = payer_resp.json()["id"]

    # Deactivate Alice
    await client.delete(f"/members/{member.id}", headers=auth_headers)

    # Attempt to create ticket with inactive member in allocation
    resp = await client.post(
        "/tickets",
        json={
            "store_name": "Shop",
            "purchased_at": "2026-05-15T10:00:00Z",
            "paid_by_id": payer_id,
            "total_price": "5.00",
            "discount_total": "0.00",
            "items": [
                {
                    "name": "Beer",
                    "price": "5.00",
                    "position": 0,
                    "member_ids": [str(member.id)],
                }
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422, "Inactive member in member_ids must be rejected with 422"
