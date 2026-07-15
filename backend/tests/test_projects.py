"""Tests for project management endpoints: US1 create/update/close/reopen/suggest-colors, US2 members."""
import uuid
from unittest.mock import MagicMock, patch

import pytest


# ── US1: Create and manage projects ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_project(client, auth_headers, portugal_project):
    resp = await client.post(
        "/projects",
        json={"name": "France-2026", "default_language": "fr", "bg_color": "#003189", "text_color": "#FFFFFF", "accent_color": "#ED2939"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "France-2026"
    assert data["default_language"] == "fr"
    assert data["status"] == "open"


@pytest.mark.asyncio
async def test_create_project_duplicate_name(client, auth_headers, portugal_project):
    resp = await client.post(
        "/projects",
        json={"name": "Portugal-2026"},
        headers=auth_headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_create_project_admin_only(client, user_auth_headers, portugal_project):
    resp = await client.post(
        "/projects",
        json={"name": "New Project"},
        headers=user_auth_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_projects(client, auth_headers, portugal_project):
    resp = await client.get("/projects", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    names = [p["name"] for p in data["items"]]
    assert "Portugal-2026" in names


@pytest.mark.asyncio
async def test_list_projects_admin_only(client, user_auth_headers, portugal_project):
    resp = await client.get("/projects", headers=user_auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_public_list_no_auth(client, portugal_project):
    resp = await client.get("/projects/public-list")
    assert resp.status_code == 200
    data = resp.json()
    items = data["items"]
    assert any(p["name"] == "Portugal-2026" for p in items)
    first = items[0]
    assert "id" in first
    assert "name" in first
    assert "bg_color" in first
    assert "text_color" in first
    assert "accent_color" in first
    assert "status" in first


@pytest.mark.asyncio
async def test_update_project(client, auth_headers, portugal_project):
    resp = await client.put(
        f"/projects/{portugal_project.id}",
        json={"name": "Portugal-2026-Updated"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Portugal-2026-Updated"


@pytest.mark.asyncio
async def test_update_project_not_found(client, auth_headers, portugal_project):
    resp = await client.put(
        f"/projects/{uuid.uuid4()}",
        json={"name": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_close_project(client, auth_headers, portugal_project):
    resp = await client.post(f"/projects/{portugal_project.id}/close", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "closed"


@pytest.mark.asyncio
async def test_close_already_closed(client, auth_headers, portugal_project):
    await client.post(f"/projects/{portugal_project.id}/close", headers=auth_headers)
    resp = await client.post(f"/projects/{portugal_project.id}/close", headers=auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_reopen_project(client, auth_headers, portugal_project):
    await client.post(f"/projects/{portugal_project.id}/close", headers=auth_headers)
    resp = await client.post(f"/projects/{portugal_project.id}/reopen", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "open"


@pytest.mark.asyncio
async def test_reopen_already_open(client, auth_headers, portugal_project):
    resp = await client.post(f"/projects/{portugal_project.id}/reopen", headers=auth_headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_closed_project_blocks_ticket_creation(client, auth_headers, portugal_project, member):
    # Close the project
    await client.post(f"/projects/{portugal_project.id}/close", headers=auth_headers)

    # Attempt to create a ticket — must return 403
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
        headers=auth_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_suggest_colors(client, auth_headers, portugal_project):
    from unittest.mock import AsyncMock

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"bg_color": "#003189", "text_color": "#FFFFFF", "accent_color": "#ED2939"}'
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("openai.AsyncOpenAI", return_value=mock_client):
        resp = await client.post(
            "/projects/suggest-colors",
            json={"query": "France"},
            headers=auth_headers,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "bg_color" in data
    assert "text_color" in data
    assert "accent_color" in data


@pytest.mark.asyncio
async def test_suggest_colors_service_unavailable(client, auth_headers, portugal_project):
    with patch("openai.AsyncOpenAI", side_effect=Exception("service down")):
        resp = await client.post(
            "/projects/suggest-colors",
            json={"query": "France"},
            headers=auth_headers,
        )
    assert resp.status_code == 503


# ── US2: Member management ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_add_member_to_project(client, auth_headers, portugal_project, member):
    # member fixture now automatically links Alice to portugal_project
    # add another member and test the add endpoint
    resp_create = await client.post("/members", json={"name": "Bob"}, headers=auth_headers)
    assert resp_create.status_code == 201
    bob_id = resp_create.json()["id"]

    resp = await client.post(
        f"/projects/{portugal_project.id}/members",
        json={"member_id": bob_id},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["member_id"] == bob_id
    assert data["project_id"] == str(portugal_project.id)


@pytest.mark.asyncio
async def test_add_member_duplicate(client, auth_headers, portugal_project, member):
    # Alice is already a member (added by fixture)
    resp = await client.post(
        f"/projects/{portugal_project.id}/members",
        json={"member_id": str(member.id)},
        headers=auth_headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_add_member_not_found(client, auth_headers, portugal_project):
    resp = await client.post(
        f"/projects/{portugal_project.id}/members",
        json={"member_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_remove_member(client, auth_headers, portugal_project, member):
    resp = await client.delete(
        f"/projects/{portugal_project.id}/members/{member.id}",
        headers=auth_headers,
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_remove_member_not_in_project(client, auth_headers, portugal_project):
    resp = await client.delete(
        f"/projects/{portugal_project.id}/members/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_project_members(client, auth_headers, portugal_project, member):
    resp = await client.get(f"/projects/{portugal_project.id}/members", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    names = [m["name"] for m in data["items"]]
    assert "Alice" in names


@pytest.mark.asyncio
async def test_add_member_closed_project(client, auth_headers, portugal_project):
    from app.models.family_member import FamilyMember
    from sqlalchemy import select

    # Close project first
    await client.post(f"/projects/{portugal_project.id}/close", headers=auth_headers)

    resp_create = await client.post("/members", json={"name": "Carol"}, headers=auth_headers)
    carol_id = resp_create.json()["id"]

    resp = await client.post(
        f"/projects/{portugal_project.id}/members",
        json={"member_id": carol_id},
        headers=auth_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_remove_member_closed_project(client, auth_headers, portugal_project, member):
    await client.post(f"/projects/{portugal_project.id}/close", headers=auth_headers)

    resp = await client.delete(
        f"/projects/{portugal_project.id}/members/{member.id}",
        headers=auth_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_members_only_from_active_project(client, auth_headers, portugal_project, member, db_session):
    """Members list returns only those linked to the active project via project_members."""
    from app.models.family_member import FamilyMember

    # Create a member NOT in portugal_project
    orphan = FamilyMember(name="Orphan")
    db_session.add(orphan)
    await db_session.flush()

    # GET /members scoped to Portugal-2026 must not include orphan
    resp = await client.get("/members", headers=auth_headers)
    assert resp.status_code == 200
    names = [m["name"] for m in resp.json()["items"]]
    assert "Alice" in names
    assert "Orphan" not in names
