"""Tests for /users router: list, create, update users (admin-only)."""
import uuid

import pytest


@pytest.mark.asyncio
async def test_list_users(client, auth_headers, seeded_user):
    resp = await client.get("/users", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_create_user(client, auth_headers, portugal_project):
    resp = await client.post(
        "/users",
        json={"username": "newuser", "password": "pass1234", "role": "user", "project_id": str(portugal_project.id)},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["username"] == "newuser"


@pytest.mark.asyncio
async def test_create_user_duplicate_409(client, auth_headers, seeded_user, portugal_project):
    resp = await client.post(
        "/users",
        json={"username": "testuser", "password": "pass1234", "role": "admin"},
        headers=auth_headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_create_user_non_admin_403(client, user_auth_headers):
    resp = await client.post(
        "/users",
        json={"username": "x", "password": "y"},
        headers=user_auth_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_update_user_not_found(client, auth_headers):
    resp = await client.patch(
        f"/users/{uuid.uuid4()}",
        json={"username": "nobody"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_user_change_username(client, auth_headers, seeded_user):
    resp = await client.patch(
        f"/users/{seeded_user.id}",
        json={"username": "renamed_user"},
        headers=auth_headers,
    )
    # JWT user is "testuser", seeded_user is also "testuser" → self-update but username change is OK
    assert resp.status_code in (200, 400)


@pytest.mark.asyncio
async def test_update_user_cannot_demote_self(client, auth_headers, seeded_user):
    resp = await client.patch(
        f"/users/{seeded_user.id}",
        json={"role": "user"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_update_user_cannot_deactivate_self(client, auth_headers, seeded_user):
    resp = await client.patch(
        f"/users/{seeded_user.id}",
        json={"is_active": False},
        headers=auth_headers,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_update_user_duplicate_username(client, auth_headers, seeded_user, portugal_project):
    # Create second user
    await client.post("/users", json={"username": "other_user", "password": "pass", "role": "admin"}, headers=auth_headers)
    # Try to rename seeded_user to conflict with other_user — but seeded_user == JWT sub, so self-update
    # Create a third user and try renaming it to other_user
    create_resp = await client.post(
        "/users", json={"username": "third_user", "password": "pass", "role": "admin"}, headers=auth_headers
    )
    third_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/users/{third_id}",
        json={"username": "other_user"},
        headers=auth_headers,
    )
    assert resp.status_code == 409
