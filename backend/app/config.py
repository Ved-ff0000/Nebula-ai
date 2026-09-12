"""NEBULA configuration. All settings are environment-driven (12-factor)."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", env_prefix="NEBULA_")

    # App
    app_name: str = "NEBULA"
    version: str = "1.0.0"
    environment: str = "development"
    cors_origins: List[str] = ["*"]  # tighten in production deployments

    # Database (PostgreSQL in docker-compose; SQLite fallback for local dev)
    database_url: str = "sqlite:///./data/nebula.db"

    # Auth
    jwt_secret: str = "change-me-nebula-development-secret-0123456789abcdef"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    seed_demo_user: bool = True
    demo_user_email: str = "demo@nebula.ai"
    demo_user_password: str = "nebula-demo-2024"

    # Agent limits
    max_steps: int = 25
    max_task_minutes: int = 10
    max_retries: int = 2
    step_timeout_seconds: int = 45
    approval_timeout_seconds: int = 600
    observation_text_limit: int = 4000
    max_interactive_elements: int = 80

    # Browser
    browser_headless: bool = True
    browser_viewport_width: int = 1280
    browser_viewport_height: int = 800

    # Security: default global domain allowlist (origins or domains)
    allowed_domains: List[str] = [
        "localhost",
        "127.0.0.1",
        "example.com",
        "www.example.com",
        "en.wikipedia.org",
    ]

    # LLM provider: heuristic | openai | anthropic  (heuristic = deterministic offline agent)
    llm_provider: str = "heuristic"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-sonnet-latest"

    # Demo site base (served by this backend itself for deterministic demos/tests)
    demo_site_origin: str = "http://localhost:8000"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
