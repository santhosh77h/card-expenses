"""
Vector API — privacy-first credit card statement parser.

All PDF processing happens in-memory. No financial data is ever stored.
"""

import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager

from app.auth import APIKeyMiddleware
from app.auth_routes import router as auth_router
from app.config import settings
from app.blog_db import init_blog_db
from app.blog_routes import router as blog_router
from app.dashboard_db import init_dashboard_db
from app.dashboard_routes import router as dashboard_router
from app.exceptions import register_exception_handlers
from app.mongo import close_mongo
from app.rate_limiter import close_redis
from app.routes import router
from app.subscription_routes import router as subscription_router
from app.user_db import init_user_db
from app.webhook_routes import router as webhook_router


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

    # LLM parser, consensus engine, and pipeline stages get debug-level logging
    logging.getLogger("app.llm_parser").setLevel(logging.DEBUG)
    logging.getLogger("app.consensus").setLevel(logging.DEBUG)
    logging.getLogger("app.stages.intelligence").setLevel(logging.DEBUG)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup/shutdown resources."""
    # Initialize storage
    init_dashboard_db()
    init_blog_db()
    init_user_db()
    yield
    # Cleanup
    close_mongo()
    await close_redis()


def create_app() -> FastAPI:
    """Application factory."""
    _configure_logging()

    app = FastAPI(
        title="Vector API",
        description="Privacy-first credit card statement parser. No data stored.",
        version="1.0.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(APIKeyMiddleware)

    register_exception_handlers(app)
    app.include_router(router)
    app.include_router(auth_router)
    app.include_router(subscription_router)
    app.include_router(webhook_router)
    app.include_router(dashboard_router)
    app.include_router(blog_router)

    return app


app = create_app()
