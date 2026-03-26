"""
MongoDB connection management and shared helpers.

Provides a lazily-initialised MongoClient, nanoid-based ID generation,
and a document-to-dict converter that renames ``_id`` → ``id`` for API
responses.
"""

import logging

from nanoid import generate as _nanoid
from pymongo import MongoClient
from pymongo.database import Database

from app.config import settings

logger = logging.getLogger(__name__)

_client: MongoClient | None = None
_db: Database | None = None


# ---------------------------------------------------------------------------
# ID generation
# ---------------------------------------------------------------------------

def nanoid(size: int = 21) -> str:
    """Generate a URL-friendly nanoid string for use as MongoDB ``_id``."""
    return _nanoid(size=size)


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def get_db() -> Database:
    """Return the shared MongoDB database handle (lazy connect)."""
    global _client, _db
    if _db is None:
        _client = MongoClient(settings.MONGO_URL)
        _db = _client[settings.MONGO_DB_NAME]
        logger.info("[mongo] Connected to database '%s'", settings.MONGO_DB_NAME)
    return _db


def close_mongo() -> None:
    """Close the MongoDB connection. Safe to call if already closed."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
        logger.info("[mongo] Connection closed")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def doc_to_dict(doc) -> dict | None:
    """Convert a MongoDB document to a plain dict, renaming ``_id`` → ``id``.

    Returns *None* when *doc* is ``None`` (document not found).
    """
    if doc is None:
        return None
    d = dict(doc)
    if "_id" in d:
        d["id"] = d.pop("_id")
    return d
