"""
Payment tests — verifies debt repayment reduces/reverses outstanding balances.
"""
from decimal import Decimal

import pytest


async def _seed_ticket(db_session, payer, consumer, price, project_id=None):
    from app.models.allocation import Allocation
    from app.models.item import Item
    from app.models.ticket import Ticket
    from datetime import datetime, timezone

    ticket = Ticket(
        store_name="Store",
        purchased_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        paid_by_id=payer.id,
        total_price=price,
        discount_total=Decimal("0.00"),
        project_id=project_id,
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(ticket_id=ticket.id, name="Item", price=price, discounted_price=price, position=0)
    db_session.add(item)
    await db_session.flush()

    alloc = Allocation(item_id=item.id, member_id=consumer.id)
    db_session.add(alloc)
    await db_session.flush()


async def _members(db_session, name_a, name_b):
    from app.models.family_member import FamilyMember

    a = FamilyMember(name=name_a)
    b = FamilyMember(name=name_b)
    db_session.add(a)
    db_session.add(b)
    await db_session.flush()
    return a, b


@pytest.mark.asyncio
async def test_payment_reduces_balance(client, auth_headers, db_session, portugal_project):
    """Partial payment reduces the outstanding balance."""
    alice, bob = await _members(db_session, "AlicePay1", "BobPay1")
    # Bob owes Alice €100
    await _seed_ticket(db_session, alice, bob, Decimal("100.00"), project_id=portugal_project.id)

    resp = await client.post(
        "/payments",
        json={"payer_id": str(bob.id), "payee_id": str(alice.id), "amount": "40.00"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["payer_id"] == str(bob.id)
    assert Decimal(data["amount"]) == Decimal("40.00")

    resp = await client.get("/balances", headers=auth_headers)
    balances = resp.json()["balances"]
    relevant = [
        b for b in balances
        if b["debtor"]["name"] in ("AlicePay1", "BobPay1") and b["creditor"]["name"] in ("AlicePay1", "BobPay1")
    ]
    assert len(relevant) == 1
    assert relevant[0]["debtor"]["name"] == "BobPay1"
    assert Decimal(relevant[0]["amount"]) == Decimal("60.00")


@pytest.mark.asyncio
async def test_payment_clears_balance(client, auth_headers, db_session, portugal_project):
    """Exact payment zeroes the balance — row must disappear."""
    alice, bob = await _members(db_session, "AlicePay2", "BobPay2")
    await _seed_ticket(db_session, alice, bob, Decimal("100.00"), project_id=portugal_project.id)

    await client.post(
        "/payments",
        json={"payer_id": str(bob.id), "payee_id": str(alice.id), "amount": "100.00"},
        headers=auth_headers,
    )

    resp = await client.get("/balances", headers=auth_headers)
    balances = resp.json()["balances"]
    relevant = [
        b for b in balances
        if b["debtor"]["name"] in ("AlicePay2", "BobPay2") or b["creditor"]["name"] in ("AlicePay2", "BobPay2")
    ]
    assert relevant == [], f"Settled balance should not appear, got: {relevant}"


@pytest.mark.asyncio
async def test_overpayment_reverses_direction(client, auth_headers, db_session, portugal_project):
    """Overpayment flips the direction — creditor now owes debtor the excess."""
    alice, bob = await _members(db_session, "AlicePay3", "BobPay3")
    # Bob owes Alice €100
    await _seed_ticket(db_session, alice, bob, Decimal("100.00"), project_id=portugal_project.id)

    # Bob pays €300 — excess of €200 means Alice now owes Bob €200
    await client.post(
        "/payments",
        json={"payer_id": str(bob.id), "payee_id": str(alice.id), "amount": "300.00"},
        headers=auth_headers,
    )

    resp = await client.get("/balances", headers=auth_headers)
    balances = resp.json()["balances"]
    relevant = [
        b for b in balances
        if b["debtor"]["name"] in ("AlicePay3", "BobPay3") and b["creditor"]["name"] in ("AlicePay3", "BobPay3")
    ]
    assert len(relevant) == 1
    assert relevant[0]["debtor"]["name"] == "AlicePay3"
    assert relevant[0]["creditor"]["name"] == "BobPay3"
    assert Decimal(relevant[0]["amount"]) == Decimal("200.00")


@pytest.mark.asyncio
async def test_payment_same_member_rejected(client, auth_headers, db_session):
    """Payment to yourself must be rejected with 422."""
    alice, _ = await _members(db_session, "AlicePay4", "BobPay4")

    resp = await client.post(
        "/payments",
        json={"payer_id": str(alice.id), "payee_id": str(alice.id), "amount": "50.00"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_payment_zero_amount_rejected(client, auth_headers, db_session):
    """Zero-amount payment must be rejected."""
    alice, bob = await _members(db_session, "AlicePay5", "BobPay5")

    resp = await client.post(
        "/payments",
        json={"payer_id": str(alice.id), "payee_id": str(bob.id), "amount": "0.00"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
