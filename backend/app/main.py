import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models.app_user import AppUser
from app.routers import auth, balances, categories, health, items, members, offset_rules, payments, projects, reports, tickets, users
from app.services.auth_service import hash_password

logger = logging.getLogger(__name__)
settings = get_settings()

_engine = create_async_engine(settings.database_url, echo=False, future=True)
_session_factory = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)


@asynccontextmanager
async def lifespan(app: FastAPI):
    users_to_seed = [
        (settings.app_user_1_username, settings.app_user_1_password),
        (settings.app_user_2_username, settings.app_user_2_password),
    ]
    async with _session_factory() as db:
        for username, password in users_to_seed:
            result = await db.execute(select(AppUser).where(AppUser.username == username))
            user = result.scalar_one_or_none()
            if user is None:
                db.add(AppUser(username=username, password_hash=hash_password(password)))
                logger.info("Created user '%s'", username)
            else:
                user.password_hash = hash_password(password)
                logger.info("Updated password for user '%s'", username)
        await db.commit()
    yield


app = FastAPI(title="Portuguese Drunk Sailors", version="1.0.0", lifespan=lifespan)

_upload_dir = settings.upload_dir
os.makedirs(_upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_upload_dir), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(members.router)
app.include_router(categories.router)
app.include_router(tickets.router)
app.include_router(items.router)
app.include_router(balances.router)
app.include_router(offset_rules.router)
app.include_router(payments.router)
app.include_router(reports.router)
app.include_router(users.router)
