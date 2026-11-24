from functools import lru_cache
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
import os
load_dotenv()  # Load environment variables from .env file

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Di app/core/config.py (jika pakai os.getenv / dataclass atau BaseSettings)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_SECRET_KEY: str = os.getenv("SUPABASE_SECRET_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()