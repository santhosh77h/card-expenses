"""
Cardlytics API — privacy-first credit card statement parser.

All PDF processing happens in-memory. No financial data is ever stored.
"""

import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.exceptions import register_exception_handlers
from app.routes import router


def _configure_logging() -> None:
    """Set up application logging based on configuration."""
    log_format = "%(asctime)s %(name)s %(levelname)s %(message)s"

    if settings.LOG_JSON:
        # Structured JSON for production log aggregation (ELK, CloudWatch, etc.)
        import json as _json

        class JSONFormatter(logging.Formatter):
            def format(self, record: logging.LogRecord) -> str:
                return _json.dumps({
                    "timestamp": self.formatTime(record),
                    "level": record.levelname,
                    "logger": record.name,
                    "message": record.getMessage(),
                    **({"exc_info": self.formatException(record.exc_info)} if record.exc_info else {}),
                })

        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        logging.root.handlers = [handler]
    else:
        logging.basicConfig(format=log_format, stream=sys.stdout)

    logging.root.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

    # LLM parser gets debug-level logging for observability
    logging.getLogger("app.llm_parser").setLevel(logging.DEBUG)


def create_app() -> FastAPI:
    """Application factory."""
    _configure_logging()

    app = FastAPI(
        title="Cardlytics API",
        description="Privacy-first credit card statement parser. No data stored.",
        version="1.0.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(router)

    return app


app = create_app()
