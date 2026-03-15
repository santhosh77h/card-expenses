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
    DEBUG_RESPONSES: bool = True

    # --- OpenAI ---
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_TIMEOUT: float = 45.0

    # --- OpenRouter (for Claude + Gemini) ---
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_TIMEOUT: float = 45.0

    # --- Stage 1: Document Intelligence ---
    PROBE_MODEL: str = "gpt-4o-mini"
    PROBE_TIMEOUT: float = 15.0

    # --- Consensus ---
    CONSENSUS_ENABLED: bool = True
    LLM2_MODEL: str = "anthropic/claude-3.5-haiku"
    LLM3_MODEL: str = "google/gemini-2.0-flash-001"

    # --- Redis ---
    REDIS_URL: str = ""

    # --- Rate Limiting ---
    RATE_LIMIT_REQUESTS: int = 10
    RATE_LIMIT_WINDOW: int = 60  # seconds

    # --- Dashboard ---
    DASHBOARD_ENABLED: bool = True
    DASHBOARD_DB_PATH: str = "data/dashboard.db"

    # --- Blog Admin ---
    BLOG_API_KEY: str = ""

    # --- Global API Key ---
    VECTOR_API_KEY: str = ""

    # --- LangSmith ---
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_API_KEY: str = ""
    LANGCHAIN_PROJECT: str = "vector-statement-parser"

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.OPENAI_API_KEY)

    @property
    def openrouter_enabled(self) -> bool:
        return bool(self.OPENROUTER_API_KEY)

    @property
    def consensus_capable(self) -> bool:
        count = int(self.llm_enabled) + (2 * int(self.openrouter_enabled))
        return count >= 2 and self.CONSENSUS_ENABLED


settings = Settings()
