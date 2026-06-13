import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import auth, balances, categories, health, items, members, offset_rules, payments, reports, tickets, users

settings = get_settings()

_OTHER_NAMES = {"Other", "Разное", "Outro"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure at least one "Other"-family category exists
    from app.database import _async_session_factory
    from app.models.category import Category
    from sqlalchemy import select, func

    async with _async_session_factory() as session:
        result = await session.execute(
            select(func.count()).where(Category.name.in_(list(_OTHER_NAMES)))
        )
        count = result.scalar_one()
        if count == 0:
            session.add(Category(name="Other", color="#9E9E9E"))
            await session.commit()
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
app.include_router(members.router)
app.include_router(categories.router)
app.include_router(tickets.router)
app.include_router(items.router)
app.include_router(balances.router)
app.include_router(offset_rules.router)
app.include_router(payments.router)
app.include_router(reports.router)
app.include_router(users.router)
