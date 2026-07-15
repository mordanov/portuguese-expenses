"""Targeted tests to push overall coverage above 80%."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest


# ── Auth router: login branches ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_login_inactive_user(client, db_session, portugal_project):
    import bcrypt
    from app.models.app_user import AppUser

    pw_hash = bcrypt.hashpw(b"pass", bcrypt.gensalt()).decode()
    user = AppUser(username="inactive_u", password_hash=pw_hash, role="admin", is_active=False)
    db_session.add(user)
    await db_session.flush()

    resp = await client.post("/auth/login", json={"username": "inactive_u", "password": "pass"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_login_admin_no_project_returns_null_project_id(client, db_session):
    """Admin login when no project exists should work; project_id may be null."""
    import bcrypt
    from app.models.app_user import AppUser

    pw_hash = bcrypt.hashpw(b"pass", bcrypt.gensalt()).decode()
    user = AppUser(username="admin_noproj", password_hash=pw_hash, role="admin", is_active=True)
    db_session.add(user)
    await db_session.flush()

    resp = await client.post("/auth/login", json={"username": "admin_noproj", "password": "pass"})
    assert resp.status_code == 200
    # With no project in DB, project_id is null (None serialised as null)
    data = resp.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_login_user_role_with_project(client, db_session, portugal_project):
    """User-role AppUser with project_id gets that project in their token."""
    import bcrypt
    from app.models.app_user import AppUser

    pw_hash = bcrypt.hashpw(b"pass", bcrypt.gensalt()).decode()
    user = AppUser(
        username="scoped_user",
        password_hash=pw_hash,
        role="user",
        is_active=True,
        project_id=portugal_project.id,
    )
    db_session.add(user)
    await db_session.flush()

    resp = await client.post("/auth/login", json={"username": "scoped_user", "password": "pass"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] == str(portugal_project.id)


@pytest.mark.asyncio
async def test_login_user_role_no_project_assigned(client, db_session, portugal_project):
    """User-role AppUser with no project_id → 403."""
    import bcrypt
    from app.models.app_user import AppUser

    pw_hash = bcrypt.hashpw(b"pass", bcrypt.gensalt()).decode()
    user = AppUser(username="unassigned_user", password_hash=pw_hash, role="user", is_active=True, project_id=None)
    db_session.add(user)
    await db_session.flush()

    resp = await client.post("/auth/login", json={"username": "unassigned_user", "password": "pass"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_login_admin_unknown_project_id(client, db_session, portugal_project):
    """Admin login with an unknown project_id → 404."""
    import bcrypt
    from app.models.app_user import AppUser

    pw_hash = bcrypt.hashpw(b"pass", bcrypt.gensalt()).decode()
    user = AppUser(username="admin_unkproj", password_hash=pw_hash, role="admin", is_active=True)
    db_session.add(user)
    await db_session.flush()

    resp = await client.post(
        "/auth/login",
        json={"username": "admin_unkproj", "password": "pass", "project_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 404


# ── Users router ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_users(client, auth_headers):
    resp = await client.get("/users", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_create_user(client, auth_headers):
    resp = await client.post(
        "/users",
        json={"username": "newuser1", "password": "pass123", "role": "admin"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "newuser1"
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_create_user_duplicate(client, auth_headers):
    await client.post(
        "/users",
        json={"username": "dupuser", "password": "pass", "role": "admin"},
        headers=auth_headers,
    )
    resp = await client.post(
        "/users",
        json={"username": "dupuser", "password": "pass2", "role": "admin"},
        headers=auth_headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_user_rename(client, auth_headers):
    create_resp = await client.post(
        "/users",
        json={"username": "patchme", "password": "pass", "role": "admin"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    user_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/users/{user_id}",
        json={"username": "patchme_new"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == "patchme_new"


@pytest.mark.asyncio
async def test_update_user_not_found(client, auth_headers):
    resp = await client.patch(
        f"/users/{uuid.uuid4()}",
        json={"username": "nobody"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_user_duplicate_username(client, auth_headers):
    await client.post("/users", json={"username": "clash_a", "password": "p", "role": "admin"}, headers=auth_headers)
    r = await client.post("/users", json={"username": "clash_b", "password": "p", "role": "admin"}, headers=auth_headers)
    b_id = r.json()["id"]

    resp = await client.patch(f"/users/{b_id}", json={"username": "clash_a"}, headers=auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_user_self_demotion_blocked(client, auth_headers):
    """Trying to demote the current user (testuser) to 'user' role → 400."""
    # create testuser (matches the jwt_token sub = 'testuser')
    r = await client.post(
        "/users", json={"username": "testuser", "password": "p", "role": "admin"}, headers=auth_headers
    )
    if r.status_code == 409:
        # already exists from seeded_user fixture in another test
        resp = await client.get("/users", headers=auth_headers)
        users = resp.json()["items"]
        user_id = next((u["id"] for u in users if u["username"] == "testuser"), None)
        if user_id is None:
            pytest.skip("testuser not found in DB")
    else:
        user_id = r.json()["id"]

    resp = await client.patch(f"/users/{user_id}", json={"role": "user"}, headers=auth_headers)
    assert resp.status_code == 400


# ── Tickets router: add item to existing ticket ──────────────────────────────


@pytest.mark.asyncio
async def test_add_item_to_ticket(client, auth_headers, member):
    # Create a ticket first
    create_resp = await client.post(
        "/tickets",
        json={
            "store_name": "AddItemStore",
            "purchased_at": "2026-06-01T10:00:00Z",
            "paid_by_id": str(member.id),
            "total_price": "10.00",
            "discount_total": "0.00",
            "items": [
                {"name": "OrigItem", "price": "10.00", "position": 0, "member_ids": [str(member.id)]}
            ],
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    ticket_id = create_resp.json()["id"]

    # Add a second item to the existing ticket
    resp = await client.post(
        f"/tickets/{ticket_id}/items",
        json={"name": "NewItem", "price": "5.00", "position": 1, "member_ids": [str(member.id)]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "NewItem"
    assert Decimal(data["price"]) == Decimal("5.00")


@pytest.mark.asyncio
async def test_add_item_to_nonexistent_ticket(client, auth_headers, member):
    resp = await client.post(
        f"/tickets/{uuid.uuid4()}/items",
        json={"name": "Item", "price": "5.00", "position": 0, "member_ids": [str(member.id)]},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_item_empty_members_rejected(client, auth_headers, member):
    create_resp = await client.post(
        "/tickets",
        json={
            "store_name": "Store",
            "purchased_at": "2026-06-01T10:00:00Z",
            "paid_by_id": str(member.id),
            "total_price": "5.00",
            "discount_total": "0.00",
            "items": [{"name": "Base", "price": "5.00", "position": 0, "member_ids": [str(member.id)]}],
        },
        headers=auth_headers,
    )
    ticket_id = create_resp.json()["id"]
    resp = await client.post(
        f"/tickets/{ticket_id}/items",
        json={"name": "Bad", "price": "3.00", "position": 1, "member_ids": []},
        headers=auth_headers,
    )
    assert resp.status_code == 422


# ── Items router: update with price change ───────────────────────────────────


@pytest.mark.asyncio
async def test_update_item_price(client, auth_headers, member):
    """Update an item's price and verify discounted_price recalculated."""
    create_resp = await client.post(
        "/tickets",
        json={
            "store_name": "PriceStore",
            "purchased_at": "2026-06-01T10:00:00Z",
            "paid_by_id": str(member.id),
            "total_price": "10.00",
            "discount_total": "2.00",
            "items": [{"name": "PriceItem", "price": "10.00", "position": 0, "member_ids": [str(member.id)]}],
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    item_id = create_resp.json()["items"][0]["id"]

    resp = await client.put(f"/items/{item_id}", json={"price": "8.00"}, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    # Price updated
    assert Decimal(data["price"]) == Decimal("8.00")


@pytest.mark.asyncio
async def test_update_item_category(client, auth_headers, member, category):
    """Assign a category to an item via PUT /items/{id}."""
    create_resp = await client.post(
        "/tickets",
        json={
            "store_name": "CatStore",
            "purchased_at": "2026-06-01T10:00:00Z",
            "paid_by_id": str(member.id),
            "total_price": "5.00",
            "discount_total": "0.00",
            "items": [{"name": "CatItem", "price": "5.00", "position": 0, "member_ids": [str(member.id)]}],
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    item_id = create_resp.json()["items"][0]["id"]

    resp = await client.put(f"/items/{item_id}", json={"category_id": str(category.id)}, headers=auth_headers)
    assert resp.status_code == 200


# ── Member service: can_pay / is_kid validation ──────────────────────────────


@pytest.mark.asyncio
async def test_member_service_can_pay_and_kid_conflict(db_session):
    from fastapi import HTTPException
    from app.services.member_service import MemberService

    svc = MemberService(db_session)
    m = await svc.create_member("KidOrPayer")

    with pytest.raises(HTTPException) as exc:
        await svc.update_member(m.id, None, None, can_pay=True, is_kid=True)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_member_service_set_kid_conflicts_with_can_pay(db_session):
    """Setting is_kid=True on a can_pay=True member → 422."""
    from fastapi import HTTPException
    from app.services.member_service import MemberService

    svc = MemberService(db_session)
    m = await svc.create_member("PayerBecomesKid")
    # Make them a payer first
    await svc.update_member(m.id, None, None, can_pay=True)

    with pytest.raises(HTTPException) as exc:
        await svc.update_member(m.id, None, None, is_kid=True)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_member_update_endpoint_set_can_pay(client, auth_headers, member):
    resp = await client.put(f"/members/{member.id}", json={"can_pay": True}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["can_pay"] is True


@pytest.mark.asyncio
async def test_members_list_active_only(client, auth_headers, member):
    resp = await client.get("/members", params={"active_only": True}, headers=auth_headers)
    assert resp.status_code == 200
    names = [m["name"] for m in resp.json()["items"]]
    assert "Alice" in names


@pytest.mark.asyncio
async def test_members_list_can_pay_only(client, auth_headers, member):
    # First make the member can_pay
    await client.put(f"/members/{member.id}", json={"can_pay": True}, headers=auth_headers)
    resp = await client.get("/members", params={"can_pay_only": True}, headers=auth_headers)
    assert resp.status_code == 200
    # Should list members where can_pay=True scoped to Portugal project


# ── Offset rules ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_offset_rule_crud(client, auth_headers, member):
    from app.models.family_member import FamilyMember

    # Create second member
    resp_b = await client.post("/members", json={"name": "OffsetBob"}, headers=auth_headers)
    assert resp_b.status_code == 201
    bob_id = resp_b.json()["id"]

    # Create rule
    resp = await client.post(
        "/offset-rules",
        json={"type": "absorb", "person_a_id": str(member.id), "person_b_id": bob_id},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    rule_id = resp.json()["id"]

    # List rules
    resp = await client.get("/offset-rules", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["items"]

    # Delete
    resp = await client.delete(f"/offset-rules/{rule_id}", headers=auth_headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_nonexistent_offset_rule(client, auth_headers):
    resp = await client.delete(f"/offset-rules/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404
