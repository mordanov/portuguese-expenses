"""Tests for the read-only 'user' role.

Read endpoints must return 200; write endpoints must return 403.
"""
import uuid

import pytest


# ── Members ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_user_can_list_members(client, user_auth_headers, member):
    resp = await client.get("/members", headers=user_auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_user_cannot_create_member(client, user_auth_headers):
    resp = await client.post("/members", json={"name": "Hacker"}, headers=user_auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_user_cannot_update_member(client, user_auth_headers, member):
    resp = await client.put(f"/members/{member.id}", json={"name": "New"}, headers=user_auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_user_cannot_delete_member(client, user_auth_headers, member):
    resp = await client.delete(f"/members/{member.id}", headers=user_auth_headers)
    assert resp.status_code == 403


# ── Categories ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_user_can_list_categories(client, user_auth_headers, category):
    resp = await client.get("/categories", headers=user_auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_user_cannot_create_category(client, user_auth_headers):
    resp = await client.post("/categories", json={"name": "Foo", "color": "#123456"}, headers=user_auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_user_cannot_update_category(client, user_auth_headers, category):
    resp = await client.put(f"/categories/{category.id}", json={"name": "Bar"}, headers=user_auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_user_cannot_delete_category(client, user_auth_headers, category):
    resp = await client.delete(f"/categories/{category.id}", headers=user_auth_headers)
    assert resp.status_code == 403


# ── Tickets ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_user_can_list_tickets(client, user_auth_headers):
    resp = await client.get("/tickets", headers=user_auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_user_cannot_upload_receipt(client, user_auth_headers):
    resp = await client.post(
        "/tickets/upload",
        files={"file": ("receipt.jpg", b"fake", "image/jpeg")},
        headers=user_auth_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_user_cannot_create_ticket(client, user_auth_headers, member):
    resp = await client.post(
        "/tickets",
        json={
            "store_name": "Shop",
            "purchased_at": "2026-05-15T10:00:00Z",
            "paid_by_id": str(member.id),
            "total_price": "5.00",
            "discount_total": "0.00",
            "items": [{"name": "Beer", "price": "5.00", "position": 0, "member_ids": [str(member.id)]}],
        },
        headers=user_auth_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_user_cannot_update_ticket(client, user_auth_headers):
    resp = await client.put(f"/tickets/{uuid.uuid4()}", json={"store_name": "X"}, headers=user_auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_user_cannot_delete_ticket(client, user_auth_headers):
    resp = await client.delete(f"/tickets/{uuid.uuid4()}", headers=user_auth_headers)
    assert resp.status_code == 403


# ── Items ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_user_cannot_update_item(client, user_auth_headers):
    resp = await client.put(f"/items/{uuid.uuid4()}", json={"name": "X"}, headers=user_auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_user_cannot_replace_allocations(client, user_auth_headers, member):
    resp = await client.put(
        f"/items/{uuid.uuid4()}/allocations",
        json={"member_ids": [str(member.id)]},
        headers=user_auth_headers,
    )
    assert resp.status_code == 403


# ── Offset rules ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_user_can_list_offset_rules(client, user_auth_headers):
    resp = await client.get("/offset-rules", headers=user_auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_user_cannot_create_offset_rule(client, user_auth_headers, member):
    other_member = member  # just need a valid UUID; 403 fires before DB lookup
    resp = await client.post(
        "/offset-rules",
        json={"type": "absorb", "person_a_id": str(uuid.uuid4()), "person_b_id": str(uuid.uuid4())},
        headers=user_auth_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_user_cannot_delete_offset_rule(client, user_auth_headers):
    resp = await client.delete(f"/offset-rules/{uuid.uuid4()}", headers=user_auth_headers)
    assert resp.status_code == 403


# ── Payments ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_user_cannot_record_payment(client, user_auth_headers, member):
    resp = await client.post(
        "/payments",
        json={"payer_id": str(uuid.uuid4()), "payee_id": str(uuid.uuid4()), "amount": "10.00"},
        headers=user_auth_headers,
    )
    assert resp.status_code == 403


# ── Balances & reports (read-only) ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_user_can_view_balances(client, user_auth_headers):
    resp = await client.get("/balances", headers=user_auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_user_can_view_reports_summary(client, user_auth_headers):
    resp = await client.get(
        "/reports/summary",
        params={"from_date": "2026-01-01", "to_date": "2026-12-31"},
        headers=user_auth_headers,
    )
    assert resp.status_code == 200


# ── Users endpoint (admin-only) ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_user_cannot_list_users(client, user_auth_headers):
    resp = await client.get("/users", headers=user_auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_user_cannot_create_user(client, user_auth_headers):
    resp = await client.post(
        "/users",
        json={"username": "hax", "password": "pass", "role": "admin"},
        headers=user_auth_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_user_cannot_update_user(client, user_auth_headers):
    resp = await client.patch(f"/users/{uuid.uuid4()}", json={"role": "admin"}, headers=user_auth_headers)
    assert resp.status_code == 403
