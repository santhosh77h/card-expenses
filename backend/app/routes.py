"""
API route handlers.
"""

import base64
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from app.auth_deps import get_optional_user
from app.config import settings
from app.parser import parse_pdf
from app.rate_limiter import check_rate_limit
from app.user_db import get_subscription, get_usage, increment_usage, get_credit_balance, use_credit

logger = logging.getLogger(__name__)

router = APIRouter()

DEBUG_DIR = Path(__file__).resolve().parent.parent / "debug"


def _save_debug(filename: str, response: dict) -> None:
    """Save filename + API response to debug/ for inspection."""
    try:
        DEBUG_DIR.mkdir(exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        stem = Path(filename).stem if filename else "unknown"
        debug_path = DEBUG_DIR / f"{ts}_{stem}.json"

        debug_data = {
            "timestamp": datetime.now().isoformat(),
            "filename": filename,
            "response": response,
        }

        debug_path.write_text(json.dumps(debug_data, indent=2, default=str), encoding="utf-8")
        logger.debug("[debug] Saved response to %s", debug_path)
    except Exception:
        logger.warning("[debug] Failed to save debug response", exc_info=True)


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "privacy": "no-data-stored",
        "llm_enabled": settings.llm_enabled,
        "consensus_enabled": settings.consensus_capable,
    }


@router.post("/parse-statement/json")
async def parse_statement(
    request: Request,
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    user: Optional[dict] = Depends(get_optional_user),
):
    await check_rate_limit(request)
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    file_bytes = await file.read()

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    if len(file_bytes) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.MAX_FILE_SIZE_MB} MB limit.",
        )

    # Server-side usage enforcement for authenticated users
    # Priority: subscription allowance first, then purchased credits
    debit_type: Optional[str] = None  # "subscription" | "credit" | None
    if user:
        apple_user_id = user["apple_user_id"]
        subscription = get_subscription(apple_user_id)
        usage = get_usage(apple_user_id)
        credit_balance = get_credit_balance(apple_user_id)

        sub_active = subscription and subscription.get("status") == "active"
        max_parses = subscription.get("max_parses", 0) if sub_active else 0
        parses_used = usage.get("parses_used", 0)
        sub_remaining = max(0, max_parses - parses_used)

        if sub_active and sub_remaining > 0:
            debit_type = "subscription"
        elif credit_balance > 0:
            debit_type = "credit"
        else:
            raise HTTPException(
                status_code=403,
                detail="No subscription allowance or credits available",
            )

    result = await parse_pdf(file_bytes, password=password, filename=file.filename or "")

    # Debit after successful parse
    remaining_info = {}
    if user:
        try:
            apple_uid = user["apple_user_id"]
            if debit_type == "subscription":
                new_count = increment_usage(apple_uid)
                sub = get_subscription(apple_uid)
                mp = sub.get("max_parses", 0) if sub else 0
                remaining_info = {
                    "debited": "subscription",
                    "subscription_remaining": max(0, mp - new_count),
                    "credit_balance": get_credit_balance(apple_uid),
                }
            elif debit_type == "credit":
                new_balance = use_credit(apple_uid)
                remaining_info = {
                    "debited": "credit",
                    "subscription_remaining": 0,
                    "credit_balance": new_balance,
                }
        except Exception:
            logger.warning("[routes] Failed to debit usage/credit", exc_info=True)

    if settings.DEBUG_RESPONSES:
        _save_debug(file.filename, result)

    if remaining_info:
        result["usage"] = remaining_info

    return result


@router.post("/scan-card")
async def scan_card(
    request: Request,
    file: UploadFile = File(...),
):
    """
    Extract card details from a photo using GPT-4o vision.

    Privacy guarantees:
    - The image is processed in-memory only — never written to disk.
    - Only structured text fields are returned (last4, issuer, network).
    - No card numbers, CVV, or expiry dates are stored or returned.
    """
    await check_rate_limit(request)

    if not settings.llm_enabled:
        raise HTTPException(status_code=503, detail="LLM not configured on server.")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image uploaded.")
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image exceeds 10 MB limit.")

    # Detect MIME type from extension
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename else "jpg"
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "heic": "image/heic"}
    mime = mime_map.get(ext, "image/jpeg")

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime};base64,{b64}"

    try:
        import openai

        client = openai.AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=settings.OPENAI_TIMEOUT,
        )

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You extract credit/debit card details from a photo. "
                        "Return ONLY a JSON object with these fields:\n"
                        '- "last4": last 4 digits of the card number (string, exactly 4 digits, or null)\n'
                        '- "issuer": the bank/issuer name printed on the card (string or null)\n'
                        '- "network": the card network — one of "Visa", "Mastercard", "American Express", "RuPay" (string or null)\n'
                        '- "cardholder_name": name printed on the card (string or null)\n'
                        "\nIMPORTANT PRIVACY RULES:\n"
                        "- NEVER return the full card number. Only the LAST 4 digits.\n"
                        "- NEVER return CVV, expiry date, or any security codes.\n"
                        "- If you cannot read a field, return null for it.\n"
                        "- Return ONLY the JSON object, no markdown or explanation."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extract card details from this photo:"},
                        {"type": "image_url", "image_url": {"url": data_url, "detail": "low"}},
                    ],
                },
            ],
            max_tokens=200,
            temperature=0,
        )

        raw = response.choices[0].message.content or "{}"
        # Strip markdown code fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        raw = raw.strip()

        result = json.loads(raw)

        # Sanitize — enforce only allowed fields, never leak full number
        sanitized = {
            "last4": None,
            "issuer": result.get("issuer"),
            "network": result.get("network"),
            "cardholder_name": result.get("cardholder_name"),
        }

        # Validate last4 is exactly 4 digits
        last4_raw = result.get("last4")
        if isinstance(last4_raw, str) and len(last4_raw) == 4 and last4_raw.isdigit():
            sanitized["last4"] = last4_raw
        elif isinstance(last4_raw, str) and len(last4_raw) > 4:
            # LLM might have returned more digits — only take last 4
            digits = "".join(c for c in last4_raw if c.isdigit())
            if len(digits) >= 4:
                sanitized["last4"] = digits[-4:]

        return sanitized

    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Failed to parse card details from image.")
    except Exception as e:
        logger.error("Card scan failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Card scan failed. Please try again.")
