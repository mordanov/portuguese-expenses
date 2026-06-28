from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/portuguese_expenses"

    # JWT (RS256) — no defaults: missing vars cause startup ValidationError
    jwt_private_key: str
    jwt_public_key: str

    @property
    def jwt_private_key_parsed(self) -> str:
        return self.jwt_private_key.replace("\\n", "\n")

    @property
    def jwt_public_key_parsed(self) -> str:
        return self.jwt_public_key.replace("\\n", "\n")
    jwt_algorithm: str = "RS256"
    jwt_expire_minutes: int = 60

    # App users (seeded via migration) — no defaults: missing vars cause startup ValidationError
    app_user_1_username: str
    app_user_1_password: str
    app_user_2_username: str
    app_user_2_password: str

    # OpenAI — no default: missing var causes startup ValidationError
    openai_api_key: str

    # Upload
    upload_dir: str = "/tmp/uploads"
    max_upload_size_mb: int = 20
    max_total_upload_size_mb: int = 200

    # CORS
    frontend_url: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
