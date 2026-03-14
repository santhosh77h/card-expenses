"""
Redis-backed rate limiter using a sliding window counter.
"""

import logging

import redis.asyncio as redis
from fastapi import HTTPException, Request

from app.config import settings

logger = logging.getLogger(__name__)

_redis_client: redis.Redis | None = None


async def get_redis() -> redis.Redis | None:
    """Lazy-initialize and return the async Redis client."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    if not settings.REDIS_URL:
        logger.warning("REDIS_URL not set — rate limiting disabled")
        return None

    try:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
        )
        await _redis_client.ping()
        logger.info("Redis connected for rate limiting")
        return _redis_client
    except Exception:
        logger.warning("Redis unavailable — rate limiting disabled", exc_info=True)
        _redis_client = None
        return None


def _get_client_ip(request: Request) -> str:
    """Extract client IP, respecting X-Forwarded-For behind a proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def check_rate_limit(request: Request) -> None:
    """
    Enforce a sliding window rate limit per IP.

    Raises HTTPException 429 if the limit is exceeded.
    """
    r = await get_redis()
    if r is None:
        return  # fail open — no Redis means no rate limiting

    client_ip = _get_client_ip(request)
    key = f"rate_limit:parse:{client_ip}"
    window = settings.RATE_LIMIT_WINDOW
    max_requests = settings.RATE_LIMIT_REQUESTS

    try:
        current = await r.get(key)

        if current is not None and int(current) >= max_requests:
            ttl = await r.ttl(key)
            logger.warning("Rate limit exceeded for %s (%s/%s)", client_ip, current, max_requests)
            raise HTTPException(
                status_code=429,
                detail={
                    "error_code": "rate_limit_exceeded",
                    "message": f"Too many requests. Try again in {max(ttl, 1)} seconds.",
                    "retry_after": max(ttl, 1),
                },
                headers={"Retry-After": str(max(ttl, 1))},
            )

        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, window, nx=True)
        await pipe.execute()

    except HTTPException:
        raise
    except Exception:
        logger.warning("Rate limit check failed — allowing request", exc_info=True)


async def close_redis() -> None:
    """Close the Redis connection on shutdown."""
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None
