"""Additional auth router coverage: user-role login, inactive account, no-project edge cases."""
import uuid

import bcrypt
import pytest


@pytest.mark.asyncio
async def test_login_inactive_account_403(client, db_session, portugal_project):
    from app.models.app_user import AppUser

    password_hash = bcrypt.hashpw(b"testpass", bcrypt.gensalt()).decode("utf-8")
    user = AppUser(username="inactive_user", password_hash=password_hash, is_active=False)
    db_session.add(user)
    await db_session.flush()

    resp = await client.post("/auth/login", json={"username": "inactive_user", "password": "testpass"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_login_user_role_no_project_403(client, db_session, portugal_project):
    """User with role='user' and no project_id assigned gets 403."""
    from app.models.app_user import AppUser

    password_hash = bcrypt.hashpw(b"testpass", bcrypt.gensalt()).decode("utf-8")
    user = AppUser(username="unassigned_user", password_hash=password_hash, role="user", project_id=None)
    db_session.add(user)
    await db_session.flush()

    resp = await client.post("/auth/login", json={"username": "unassigned_user", "password": "testpass"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_login_user_role_with_project(client, db_session, portugal_project):
    """User with role='user' and project_id assigned gets JWT with that project_id."""
    from app.models.app_user import AppUser

    password_hash = bcrypt.hashpw(b"testpass", bcrypt.gensalt()).decode("utf-8")
    user = AppUser(
        username="project_user",
        password_hash=password_hash,
        role="user",
        project_id=portugal_project.id,
    )
    db_session.add(user)
    await db_session.flush()

    resp = await client.post("/auth/login", json={"username": "project_user", "password": "testpass"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] == str(portugal_project.id)
    assert data["role"] == "user"


@pytest.mark.asyncio
async def test_login_admin_invalid_project_id_404(client, db_session, portugal_project, seeded_user):
    """Admin specifying a non-existent project_id at login gets 404."""
    resp = await client.post(
        "/auth/login",
        json={"username": "testuser", "password": "testpass", "project_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_login_admin_no_projects_returns_null_project(client, db_session, seeded_user):
    """Admin login when no projects exist returns project_id as None."""
    resp = await client.post("/auth/login", json={"username": "testuser", "password": "testpass"})
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("project_id") is None
