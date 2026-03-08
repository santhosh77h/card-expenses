"""
Application configuration via environment variables.

Uses pydantic-settings for typed, validated config with .env file support.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Application ---
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: list[str] = ["*"]
    MAX_FILE_SIZE_MB: int = 10
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False

    # --- OpenAI ---
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_TIMEOUT: float = 45.0

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.OPENAI_API_KEY)


settings = Settings()
