"""
Apple Sign In — identity token (JWT) verification.

Fetches Apple's public keys (JWKS) and verifies the RS256-signed
identity token returned by Sign in with Apple on the client.
"""

import logging
import time
from typing import Optional

import httpx
import jwt
from jwt import PyJWK

from app.config import settings

logger = logging.getLogger(__name__)

APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"

# In-memory JWKS cache
_jwks_cache: dict = {}
_jwks_fetched_at: float = 0.0
_JWKS_TTL_SECONDS = 24 * 60 * 60  # 24 hours


async def _fetch_apple_keys(force: bool = False) -> dict:
    """Fetch Apple's JWKS, with 24h in-memory cache."""
    global _jwks_cache, _jwks_fetched_at

    now = time.time()
    if not force and _jwks_cache and (now - _jwks_fetched_at) < _JWKS_TTL_SECONDS:
        return _jwks_cache

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(APPLE_JWKS_URL)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_fetched_at = now
        logger.info("[apple_auth] Fetched %d Apple public keys", len(_jwks_cache.get("keys", [])))

    return _jwks_cache


def _find_key(jwks: dict, kid: str) -> Optional[dict]:
    """Find a key in the JWKS by kid."""
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


async def verify_identity_token(identity_token: str) -> dict:
    """
    Verify an Apple identity token (JWT).

    Returns:
        {
            "apple_user_id": str,   # The stable 'sub' claim
            "email": str | None,
            "email_verified": bool,
        }

    Raises:
        ValueError: If the token is invalid, expired, or cannot be verified.
    """
    # Decode header to get kid (without verification)
    try:
        unverified_header = jwt.get_unverified_header(identity_token)
    except jwt.exceptions.DecodeError as e:
        raise ValueError(f"Malformed identity token: {e}") from e

    kid = unverified_header.get("kid")
    if not kid:
        raise ValueError("Identity token missing 'kid' in header")

    # Fetch Apple's public keys
    jwks = await _fetch_apple_keys()
    key_data = _find_key(jwks, kid)

    # If kid not found, refetch once (Apple may have rotated keys)
    if not key_data:
        logger.info("[apple_auth] kid '%s' not in cache, refetching JWKS", kid)
        jwks = await _fetch_apple_keys(force=True)
        key_data = _find_key(jwks, kid)

    if not key_data:
        raise ValueError(f"Apple public key not found for kid '{kid}'")

    # Build the public key and verify the token
    try:
        public_key = PyJWK(key_data).key
        payload = jwt.decode(
            identity_token,
            public_key,
            algorithms=["RS256"],
            audience=settings.APPLE_BUNDLE_ID,
            issuer=APPLE_ISSUER,
        )
    except jwt.ExpiredSignatureError:
        raise ValueError("Identity token has expired")
    except jwt.InvalidAudienceError:
        raise ValueError(
            f"Identity token audience mismatch (expected {settings.APPLE_BUNDLE_ID})"
        )
    except jwt.InvalidIssuerError:
        raise ValueError("Identity token issuer is not Apple")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid identity token: {e}") from e

    apple_user_id = payload.get("sub")
    if not apple_user_id:
        raise ValueError("Identity token missing 'sub' claim")

    return {
        "apple_user_id": apple_user_id,
        "email": payload.get("email"),
        "email_verified": payload.get("email_verified", False),
    }
