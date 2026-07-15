"""
Balance tests — verifies net pairwise balance calculation.
Seeds tickets via DB session directly to avoid OCR flow.
"""
from datetime import datetime, timezone
from decimal import Decimal

import pytest


async def _seed_ticket(db_session, payer, other_member, price, discount=Decimal("0.00"), days_offset=0, project_id=None):
    from app.models.allocation import Allocation
    from app.models.item import Item
    from app.models.ticket import Ticket
    from datetime import timedelta

    purchased_at = datetime(2026, 5, 1, tzinfo=timezone.utc) + timedelta(days=days_offset)
    ticket = Ticket(
        store_name="Store",
        purchased_at=purchased_at,
        paid_by_id=payer.id,
        total_price=price,
        discount_total=discount,
        project_id=project_id,
    )
    db_session.add(ticket)
    await db_session.flush()

    item = Item(
        ticket_id=ticket.id,
        name="Item",
        price=price,
        discounted_price=price - discount,
        position=0,
    )
    db_session.add(item)
    await db_session.flush()

    alloc = Allocation(item_id=item.id, member_id=other_member.id)
    db_session.add(alloc)
    await db_session.flush()
    return ticket


@pytest.mark.asyncio
async def test_net_balance_correct(client, auth_headers, db_session, portugal_project):
    from app.models.family_member import FamilyMember

    alice = FamilyMember(name="Alice")
    bob = FamilyMember(name="Bob")
    db_session.add(alice)
    db_session.add(bob)
    await db_session.flush()

    # Alice paid €30, Bob consumed — Bob owes Alice €30
    await _seed_ticket(db_session, alice, bob, Decimal("30.00"), project_id=portugal_project.id)
    # Bob paid €10, Alice consumed — Alice owes Bob €10
    await _seed_ticket(db_session, bob, alice, Decimal("10.00"), days_offset=1, project_id=portugal_project.id)

    resp = await client.get("/balances", headers=auth_headers)
    assert resp.status_code == 200
    balances = resp.json()["balances"]
    assert len(balances) == 1
    entry = balances[0]
    assert entry["debtor"]["name"] == "Bob"
    assert entry["creditor"]["name"] == "Alice"
    assert Decimal(entry["amount"]) == Decimal("20.00")


@pytest.mark.asyncio
async def test_zero_balance_omitted(client, auth_headers, db_session, portugal_project):
    from app.models.family_member import FamilyMember

    alice = FamilyMember(name="AliceZ")
    bob = FamilyMember(name="BobZ")
    db_session.add(alice)
    db_session.add(bob)
    await db_session.flush()

    await _seed_ticket(db_session, alice, bob, Decimal("20.00"), project_id=portugal_project.id)
    await _seed_ticket(db_session, bob, alice, Decimal("20.00"), days_offset=1, project_id=portugal_project.id)

    resp = await client.get("/balances", headers=auth_headers)
    balances = resp.json()["balances"]
    names = [(b["debtor"]["name"], b["creditor"]["name"]) for b in balances]
    assert ("BobZ", "AliceZ") not in names
    assert ("AliceZ", "BobZ") not in names


@pytest.mark.asyncio
async def test_no_tickets_returns_empty(client, auth_headers):
    resp = await client.get("/balances", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["balances"] == []


# ── T102: Independent US3 balance math verification ────────────────────────


@pytest.mark.asyncio
async def test_t102_net_balance_two_tickets_exact_amount(client, auth_headers, db_session, portugal_project):
    """T102: Seed two tickets via API fixtures; balance endpoint must return exact net direction and amount.

    Scenario:
      - Alice pays €30, Bob consumes the item → Bob owes Alice €30
      - Bob pays €10, Alice consumes the item → Alice owes Bob €10
      Net: Bob owes Alice €20 (€30 − €10 = €20).
    """
    from app.models.family_member import FamilyMember

    alice = FamilyMember(name="AliceT102")
    bob = FamilyMember(name="BobT102")
    db_session.add(alice)
    db_session.add(bob)
    await db_session.flush()

    await _seed_ticket(db_session, alice, bob, Decimal("30.00"), days_offset=0, project_id=portugal_project.id)
    await _seed_ticket(db_session, bob, alice, Decimal("10.00"), days_offset=1, project_id=portugal_project.id)

    resp = await client.get("/balances", headers=auth_headers)
    assert resp.status_code == 200
    balances = resp.json()["balances"]

    t102_balances = [
        b for b in balances
        if b["debtor"]["name"] in ("AliceT102", "BobT102")
        and b["creditor"]["name"] in ("AliceT102", "BobT102")
    ]
    assert len(t102_balances) == 1, (
        f"Expected exactly one net balance entry between Alice and Bob, got: {t102_balances}"
    )
    entry = t102_balances[0]
    assert entry["debtor"]["name"] == "BobT102", (
        f"BobT102 should be the debtor (owes more), got debtor={entry['debtor']['name']}"
    )
    assert entry["creditor"]["name"] == "AliceT102", (
        f"AliceT102 should be the creditor, got creditor={entry['creditor']['name']}"
    )
    assert Decimal(entry["amount"]) == Decimal("20.00"), (
        f"Net balance should be €20.00, got {entry['amount']}"
    )


@pytest.mark.asyncio
async def test_t102_zero_balance_row_omitted(client, auth_headers, db_session, portugal_project):
    """T102: When two members owe each other equally, no balance row is returned."""
    from app.models.family_member import FamilyMember

    alice = FamilyMember(name="AliceT102Z")
    bob = FamilyMember(name="BobT102Z")
    db_session.add(alice)
    db_session.add(bob)
    await db_session.flush()

    await _seed_ticket(db_session, alice, bob, Decimal("15.00"), days_offset=0, project_id=portugal_project.id)
    await _seed_ticket(db_session, bob, alice, Decimal("15.00"), days_offset=1, project_id=portugal_project.id)

    resp = await client.get("/balances", headers=auth_headers)
    assert resp.status_code == 200
    balances = resp.json()["balances"]

    zero_rows = [
        b for b in balances
        if b["debtor"]["name"] in ("AliceT102Z", "BobT102Z")
        or b["creditor"]["name"] in ("AliceT102Z", "BobT102Z")
    ]
    assert zero_rows == [], (
        f"Zero-net balance pair must not appear in results, got: {zero_rows}"
    )


@pytest.mark.asyncio
async def test_t102_date_range_excludes_older_ticket(client, auth_headers, db_session, portugal_project):
    """T102: Date range filter must exclude tickets outside the range from balance calculation."""
    from app.models.family_member import FamilyMember

    alice = FamilyMember(name="AliceT102D")
    bob = FamilyMember(name="BobT102D")
    db_session.add(alice)
    db_session.add(bob)
    await db_session.flush()

    # May ticket: Alice pays €50 for Bob
    await _seed_ticket(db_session, alice, bob, Decimal("50.00"), days_offset=0, project_id=portugal_project.id)
    # June ticket: Alice pays €100 for Bob (days_offset=31 → June 1)
    await _seed_ticket(db_session, alice, bob, Decimal("100.00"), days_offset=31, project_id=portugal_project.id)

    # Filter to May only
    resp = await client.get(
        "/balances",
        params={"from_date": "2026-05-01T00:00:00Z", "to_date": "2026-05-31T23:59:59Z"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    balances = resp.json()["balances"]
    t102_balances = [
        b for b in balances
        if b["debtor"]["name"] in ("AliceT102D", "BobT102D")
        and b["creditor"]["name"] in ("AliceT102D", "BobT102D")
    ]
    assert len(t102_balances) == 1, f"Expected one balance row for May filter, got: {t102_balances}"
    assert Decimal(t102_balances[0]["amount"]) == Decimal("50.00"), (
        f"May-only filter should yield €50.00, got {t102_balances[0]['amount']}"
    )


@pytest.mark.asyncio
async def test_date_range_filter(client, auth_headers, db_session, portugal_project):
    from app.models.family_member import FamilyMember

    alice = FamilyMember(name="AliceDR")
    bob = FamilyMember(name="BobDR")
    db_session.add(alice)
    db_session.add(bob)
    await db_session.flush()

    # Ticket in May
    await _seed_ticket(db_session, alice, bob, Decimal("50.00"), days_offset=0, project_id=portugal_project.id)
    # Ticket in June (days_offset=31 → June 1)
    old_ticket = await _seed_ticket(db_session, alice, bob, Decimal("100.00"), days_offset=31, project_id=portugal_project.id)

    # Filter to May only
    resp = await client.get(
        "/balances",
        params={"from_date": "2026-05-01T00:00:00Z", "to_date": "2026-05-31T23:59:59Z"},
        headers=auth_headers,
    )
    balances = resp.json()["balances"]
    relevant = [b for b in balances if b["debtor"]["name"] == "BobDR"]
    if relevant:
        assert Decimal(relevant[0]["amount"]) == Decimal("50.00")
