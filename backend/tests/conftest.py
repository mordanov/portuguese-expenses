"""
Test configuration: async test client, SQLite in-memory session, JWT fixture, mock OCR.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator
from unittest.mock import MagicMock

import bcrypt
import jwt
import pytest
import pytest_asyncio
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


def _generate_rsa_keys():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_pem = (
        private_key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode("utf-8")
    )
    return private_pem, public_pem


TEST_PRIVATE_KEY, TEST_PUBLIC_KEY = _generate_rsa_keys()

# Set required env vars before any app module is imported so pydantic-settings
# validation succeeds at import time (F-04 removed all default fallbacks).
os.environ.setdefault("JWT_PRIVATE_KEY", TEST_PRIVATE_KEY)
os.environ.setdefault("JWT_PUBLIC_KEY", TEST_PUBLIC_KEY)
os.environ.setdefault("JWT_ALGORITHM", "RS256")
os.environ.setdefault("DATABASE_URL", TEST_DB_URL)
os.environ.setdefault("APP_USER_1_USERNAME", "admin")
os.environ.setdefault("APP_USER_1_PASSWORD", "testpass1")
os.environ.setdefault("APP_USER_2_USERNAME", "editor")
os.environ.setdefault("APP_USER_2_PASSWORD", "testpass2")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-dummy")

from app.database import get_async_session  # noqa: E402
from app.main import app  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.models.app_user import AppUser  # noqa: E402
from app.models.family_member import FamilyMember  # noqa: E402
from app.models.category import Category  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def patch_settings():
    from app import config as cfg

    cfg.get_settings.cache_clear()
    os.environ["JWT_PRIVATE_KEY"] = TEST_PRIVATE_KEY
    os.environ["JWT_PUBLIC_KEY"] = TEST_PUBLIC_KEY
    os.environ["DATABASE_URL"] = TEST_DB_URL
    cfg.get_settings.cache_clear()
    yield
    cfg.get_settings.cache_clear()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_session():
        yield db_session

    app.dependency_overrides[get_async_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def jwt_token() -> str:
    payload = {"sub": "testuser", "exp": datetime.now(timezone.utc) + timedelta(hours=1)}
    return jwt.encode(payload, TEST_PRIVATE_KEY, algorithm="RS256")


@pytest.fixture
def auth_headers(jwt_token: str) -> dict:
    return {"Authorization": f"Bearer {jwt_token}"}


@pytest_asyncio.fixture
async def seeded_user(db_session: AsyncSession) -> AppUser:
    password_hash = bcrypt.hashpw(b"testpass", bcrypt.gensalt()).decode("utf-8")
    user = AppUser(username="testuser", password_hash=password_hash)
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def member(db_session: AsyncSession) -> FamilyMember:
    m = FamilyMember(name="Alice")
    db_session.add(m)
    await db_session.flush()
    return m


@pytest_asyncio.fixture
async def category(db_session: AsyncSession) -> Category:
    c = Category(name="Wine", color="#722F37")
    db_session.add(c)
    await db_session.flush()
    return c


@pytest.fixture
def mock_ocr_client():
    client = MagicMock()
    response = MagicMock()
    choice = MagicMock()
    choice.message.content = (
        '{"store_name": "Lidl", "purchased_at": "2026-05-20T14:30:00Z", '
        '"items": [{"name": "Bread", "price": "1.49"}], '
        '"discount_total": "0.50", "total_price": "0.99"}'
    )
    response.choices = [choice]
    client.chat.completions.create.return_value = response
    return client
