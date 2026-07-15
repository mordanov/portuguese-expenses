import json
import logging
import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.project import Project
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import ColorSuggestResponse, EmojiSuggestResponse, ProjectCreate, ProjectUpdate

log = logging.getLogger(__name__)

_DEFAULT_CATEGORIES = [
    ("Wine", "#722F37"),
    ("Meals", "#FF8C00"),
    ("Entertainment", "#4B0082"),
    ("Gifts", "#FF69B4"),
    ("Parking", "#708090"),
    ("Other", "#9E9E9E"),
]


class ProjectService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = ProjectRepository(session)
        self.session = session

    async def list_projects(self) -> list[Project]:
        return await self.repo.get_all()

    async def get_public_list(self) -> list[Project]:
        return await self.repo.get_public_list()

    async def get_by_id(self, project_id: uuid.UUID) -> Project:
        project = await self.repo.get_by_id(project_id)
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return project

    async def create_project(self, data: ProjectCreate) -> Project:
        existing = await self.repo.get_by_name(data.name)
        if existing:
            raise HTTPException(status_code=409, detail="Project name already exists")
        project = Project(
            name=data.name,
            description=data.description,
            emoji=data.emoji,
            default_language=data.default_language,
            bg_color=data.bg_color,
            text_color=data.text_color,
            accent_color=data.accent_color,
            status="open",
        )
        project = await self.repo.create(project)
        # Seed default categories for the new project
        for cat_name, cat_color in _DEFAULT_CATEGORIES:
            self.session.add(Category(name=cat_name, color=cat_color, project_id=project.id))
        await self.session.flush()
        return project

    async def update_project(self, project_id: uuid.UUID, data: ProjectUpdate) -> Project:
        project = await self.get_by_id(project_id)
        if data.name is not None:
            conflict = await self.repo.get_by_name(data.name)
            if conflict and conflict.id != project_id:
                raise HTTPException(status_code=409, detail="Project name already exists")
            project.name = data.name
        if "description" in data.model_fields_set:
            project.description = data.description
        if "emoji" in data.model_fields_set:
            project.emoji = data.emoji
        if data.default_language is not None:
            project.default_language = data.default_language
        if data.bg_color is not None:
            project.bg_color = data.bg_color
        if data.text_color is not None:
            project.text_color = data.text_color
        if data.accent_color is not None:
            project.accent_color = data.accent_color
        return await self.repo.update(project)

    async def close_project(self, project_id: uuid.UUID) -> Project:
        project = await self.get_by_id(project_id)
        if project.status == "closed":
            raise HTTPException(status_code=409, detail="Project already closed")
        return await self.repo.set_status(project, "closed")

    async def reopen_project(self, project_id: uuid.UUID) -> Project:
        project = await self.get_by_id(project_id)
        if project.status == "open":
            raise HTTPException(status_code=409, detail="Project already open")
        return await self.repo.set_status(project, "open")

    async def add_member_to_project(self, project_id: uuid.UUID, member_id: uuid.UUID) -> "ProjectMember":  # noqa: F821
        from app.models.family_member import FamilyMember
        from sqlalchemy import select

        project = await self.get_by_id(project_id)
        if project.status == "closed":
            raise HTTPException(status_code=403, detail="Project is closed")

        result = await self.session.execute(select(FamilyMember).where(FamilyMember.id == member_id))
        member = result.scalar_one_or_none()
        if member is None:
            raise HTTPException(status_code=404, detail="Member not found")

        existing = await self.repo.get_member_link(project_id, member_id)
        if existing:
            raise HTTPException(status_code=409, detail="Member already in project")

        return await self.repo.add_member(project_id, member_id)

    async def remove_member_from_project(self, project_id: uuid.UUID, member_id: uuid.UUID) -> None:
        project = await self.get_by_id(project_id)
        if project.status == "closed":
            raise HTTPException(status_code=403, detail="Project is closed")

        removed = await self.repo.remove_member(project_id, member_id)
        if not removed:
            raise HTTPException(status_code=404, detail="Member not in project")

    async def suggest_emoji(self, query: str) -> EmojiSuggestResponse:
        from app.config import get_settings

        settings = get_settings()
        try:
            import openai

            client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a flag and emoji selector. Given a country or project name, "
                            "return the single most fitting flag emoji or relevant emoji. "
                            "Return ONLY valid JSON with key 'emoji'. One emoji character only. No markdown."
                        ),
                    },
                    {"role": "user", "content": f"Project name: {query}"},
                ],
                max_tokens=20,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content or ""
            data = json.loads(raw)
            return EmojiSuggestResponse(emoji=data.get("emoji", "🌍"))
        except Exception as exc:
            log.error("Emoji suggestion failed: %s", exc)
            raise HTTPException(status_code=503, detail="Emoji suggestion service unavailable") from exc

    async def suggest_colors(self, query: str) -> ColorSuggestResponse:
        from app.config import get_settings

        settings = get_settings()
        try:
            import openai

            client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a colour palette designer. Given a trip or project name, "
                            "suggest a visually appealing colour palette. "
                            "Return ONLY valid JSON with keys bg_color, text_color, accent_color "
                            "as 6-digit hex strings (e.g. #003189). No markdown, no explanation."
                        ),
                    },
                    {"role": "user", "content": f"Project name: {query}"},
                ],
                max_tokens=100,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content or ""
            data = json.loads(raw)
            return ColorSuggestResponse(
                bg_color=data.get("bg_color", "#1A1A2E"),
                text_color=data.get("text_color", "#FFFFFF"),
                accent_color=data.get("accent_color", "#E94560"),
            )
        except Exception as exc:
            log.error("Color suggestion failed: %s", exc)
            raise HTTPException(status_code=503, detail="Color suggestion service unavailable") from exc
