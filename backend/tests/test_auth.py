import pytest


@pytest.mark.asyncio
async def test_login_valid(client, seeded_user):
    resp = await client.post("/auth/login", json={"username": "testuser", "password": "testpass"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


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
