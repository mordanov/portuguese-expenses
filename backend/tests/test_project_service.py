"""Direct unit tests for project service to ensure coverage of business logic."""
import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.schemas.project import ProjectCreate, ProjectUpdate
from app.services.project_service import ProjectService


@pytest.mark.asyncio
async def test_create_project_success(db_session, portugal_project):
    service = ProjectService(db_session)
    data = ProjectCreate(
        name="Spain-2026",
        default_language="es",
        bg_color="#AA151B",
        text_color="#F1BF00",
        accent_color="#AA151B",
    )
    project = await service.create_project(data)
    assert project.name == "Spain-2026"
    assert project.default_language == "es"
    assert project.status == "open"
    await db_session.commit()


@pytest.mark.asyncio
async def test_create_project_duplicate_raises(db_session, portugal_project):
    from fastapi import HTTPException

    service = ProjectService(db_session)
    data = ProjectCreate(name="Portugal-2026")
    with pytest.raises(HTTPException) as exc_info:
        await service.create_project(data)
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_get_by_id_not_found_raises(db_session, portugal_project):
    from fastapi import HTTPException

    service = ProjectService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await service.get_by_id(uuid.uuid4())
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_update_project_success(db_session, portugal_project):
    service = ProjectService(db_session)
    updated = await service.update_project(
        portugal_project.id,
        ProjectUpdate(name="Portugal-2027", bg_color="#007000", text_color="#000000", accent_color="#FFDD00"),
    )
    assert updated.name == "Portugal-2027"
    assert updated.bg_color == "#007000"


@pytest.mark.asyncio
async def test_update_project_duplicate_name(db_session, portugal_project):
    from fastapi import HTTPException

    service = ProjectService(db_session)
    # Create another project
    other = await service.create_project(ProjectCreate(name="Other-2026"))
    await db_session.flush()

    with pytest.raises(HTTPException) as exc_info:
        await service.update_project(other.id, ProjectUpdate(name="Portugal-2026"))
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_close_and_reopen_project(db_session, portugal_project):
    service = ProjectService(db_session)

    closed = await service.close_project(portugal_project.id)
    assert closed.status == "closed"

    reopened = await service.reopen_project(portugal_project.id)
    assert reopened.status == "open"


@pytest.mark.asyncio
async def test_close_already_closed_raises(db_session, portugal_project):
    from fastapi import HTTPException

    service = ProjectService(db_session)
    await service.close_project(portugal_project.id)
    with pytest.raises(HTTPException) as exc_info:
        await service.close_project(portugal_project.id)
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_reopen_already_open_raises(db_session, portugal_project):
    from fastapi import HTTPException

    service = ProjectService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await service.reopen_project(portugal_project.id)
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_add_member_success(db_session, portugal_project):
    from app.models.family_member import FamilyMember

    service = ProjectService(db_session)
    bob = FamilyMember(name="Bob")
    db_session.add(bob)
    await db_session.flush()

    pm = await service.add_member_to_project(portugal_project.id, bob.id)
    assert pm.member_id == bob.id
    assert pm.project_id == portugal_project.id


@pytest.mark.asyncio
async def test_add_member_not_found_raises(db_session, portugal_project):
    from fastapi import HTTPException

    service = ProjectService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await service.add_member_to_project(portugal_project.id, uuid.uuid4())
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_add_member_duplicate_raises(db_session, portugal_project, member):
    from fastapi import HTTPException

    service = ProjectService(db_session)
    # member fixture links Alice to portugal_project already
    with pytest.raises(HTTPException) as exc_info:
        await service.add_member_to_project(portugal_project.id, member.id)
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_add_member_closed_project_raises(db_session, portugal_project):
    from app.models.family_member import FamilyMember
    from fastapi import HTTPException

    service = ProjectService(db_session)
    await service.close_project(portugal_project.id)

    carol = FamilyMember(name="Carol")
    db_session.add(carol)
    await db_session.flush()

    with pytest.raises(HTTPException) as exc_info:
        await service.add_member_to_project(portugal_project.id, carol.id)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_remove_member_success(db_session, portugal_project, member):
    service = ProjectService(db_session)
    # Should not raise
    await service.remove_member_from_project(portugal_project.id, member.id)


@pytest.mark.asyncio
async def test_remove_member_not_found_raises(db_session, portugal_project):
    from fastapi import HTTPException

    service = ProjectService(db_session)
    with pytest.raises(HTTPException) as exc_info:
        await service.remove_member_from_project(portugal_project.id, uuid.uuid4())
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_remove_member_closed_project_raises(db_session, portugal_project, member):
    from fastapi import HTTPException

    service = ProjectService(db_session)
    await service.close_project(portugal_project.id)

    with pytest.raises(HTTPException) as exc_info:
        await service.remove_member_from_project(portugal_project.id, member.id)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_suggest_colors_success(db_session, portugal_project):
    from unittest.mock import AsyncMock

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"bg_color": "#003189", "text_color": "#FFFFFF", "accent_color": "#ED2939"}'
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    service = ProjectService(db_session)
    with patch("openai.AsyncOpenAI", return_value=mock_client):
        result = await service.suggest_colors("France")
    assert result.bg_color == "#003189"
    assert result.text_color == "#FFFFFF"
    assert result.accent_color == "#ED2939"


@pytest.mark.asyncio
async def test_suggest_colors_failure_raises_503(db_session, portugal_project):
    from fastapi import HTTPException

    service = ProjectService(db_session)
    with patch("openai.AsyncOpenAI", side_effect=Exception("down")):
        with pytest.raises(HTTPException) as exc_info:
            await service.suggest_colors("France")
    assert exc_info.value.status_code == 503
