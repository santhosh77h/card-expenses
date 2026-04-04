"""
Contact form handler — validates input, persists to MongoDB, and sends email via SMTP.

Falls back to logging the message when SMTP is not configured (dev-friendly).
All submissions are saved to the `contact_submissions` collection regardless of SMTP.
"""

import logging
import re
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, field_validator

from app.config import settings
from app.mongo import get_db, nanoid
from app.rate_limiter import check_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contact", tags=["contact"])

VALID_SUBJECTS = {"feedback", "bugReport", "featureRequest", "generalQuery", "other"}

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


# ---------------------------------------------------------------------------
# Collection accessor
# ---------------------------------------------------------------------------

def _submissions():
    return get_db()["contact_submissions"]


def init_contact_db() -> None:
    """Create indexes for the contact_submissions collection."""
    _submissions().create_index("email")
    _submissions().create_index("created_at")
    _submissions().create_index("status")
    logger.info("[contact] Indexes created (MongoDB)")


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------

class ContactRequest(BaseModel):
    name: str
    email: str
    subject: str
    message: str

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        if len(v) > 100:
            raise ValueError("Name must be 100 characters or fewer")
        return v

    @field_validator("subject")
    @classmethod
    def valid_subject(cls, v: str) -> str:
        if v not in VALID_SUBJECTS:
            raise ValueError(f"Subject must be one of: {', '.join(VALID_SUBJECTS)}")
        return v

    @field_validator("message")
    @classmethod
    def message_length(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Message must be at least 10 characters")
        if len(v) > 5000:
            raise ValueError("Message must be 5000 characters or fewer")
        return v


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _save_submission(data: ContactRequest, ip: str) -> str:
    """Persist a contact form submission to MongoDB. Returns the document ID."""
    doc_id = nanoid()
    _submissions().insert_one({
        "_id": doc_id,
        "name": data.name,
        "email": data.email,
        "subject": data.subject,
        "message": data.message,
        "ip": ip,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return doc_id


def _send_email(data: ContactRequest, submission_id: str) -> None:
    """Send the contact form submission via SMTP."""
    msg = MIMEMultipart()
    msg["From"] = settings.SMTP_USER or data.email
    msg["To"] = settings.CONTACT_RECIPIENT_EMAIL
    msg["Reply-To"] = data.email
    msg["Subject"] = f"[Vector Contact] {data.subject} — {data.name}"

    body = (
        f"Submission ID: {submission_id}\n"
        f"Name: {data.name}\n"
        f"Email: {data.email}\n"
        f"Subject: {data.subject}\n"
        f"{'—' * 40}\n\n"
        f"{data.message}"
    )
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


def _get_client_ip(request: Request) -> str:
    """Extract client IP, respecting X-Forwarded-For behind a proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("")
async def submit_contact(request: Request, data: ContactRequest):
    """Receive a contact form submission."""
    await check_rate_limit(request)

    ip = _get_client_ip(request)

    # Always persist to MongoDB
    submission_id = _save_submission(data, ip)
    logger.info("Contact submission saved: %s (email: %s, subject: %s)", submission_id, data.email, data.subject)

    # Send email if SMTP is configured
    smtp_configured = all([
        settings.SMTP_HOST,
        settings.SMTP_USER,
        settings.SMTP_PASSWORD,
    ])

    if smtp_configured:
        try:
            _send_email(data, submission_id)
            logger.info("Contact email sent for submission %s", submission_id)
        except Exception:
            logger.exception("Failed to send contact email for submission %s", submission_id)
            # Don't fail the request — submission is already saved
    else:
        logger.info("SMTP not configured — submission %s saved to DB only", submission_id)

    return {"status": "ok", "message": "Your message has been received."}
