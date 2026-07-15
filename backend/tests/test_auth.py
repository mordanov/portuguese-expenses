import pytest


@pytest.mark.asyncio
async def test_login_valid(client, seeded_user, portugal_project):
    resp = await client.post("/auth/login", json={"username": "testuser", "password": "testpass"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "project_id" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client, seeded_user):
    resp = await client.post("/auth/login", json={"username": "testuser", "password": "wrongpass"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_user(client):
    resp = await client.post("/auth/login", json={"username": "nobody", "password": "pass"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_unauthenticated_members(client):
    resp = await client.get("/members")
    # FastAPI HTTPBearer returns 403 when no auth header is present
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_invalid_token_rejected(client):
    resp = await client.get("/members", headers={"Authorization": "Bearer invalid.token.here"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_switch_project(client, auth_headers, portugal_project):
    """Admin can switch to a valid project."""
    resp = await client.post(
        "/auth/switch-project",
        json={"project_id": str(portugal_project.id)},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] == str(portugal_project.id)
    assert data["role"] == "admin"
    assert "access_token" in data


@pytest.mark.asyncio
async def test_switch_project_not_found(client, auth_headers, portugal_project):
    import uuid
    resp = await client.post(
        "/auth/switch-project",
        json={"project_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_switch_project_non_admin(client, user_auth_headers, portugal_project):
    resp = await client.post(
        "/auth/switch-project",
        json={"project_id": str(portugal_project.id)},
        headers=user_auth_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_login_with_project_id(client, seeded_user, portugal_project):
    """Admin can specify project_id at login."""
    resp = await client.post(
        "/auth/login",
        json={"username": "testuser", "password": "testpass", "project_id": str(portugal_project.id)},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] == str(portugal_project.id)
