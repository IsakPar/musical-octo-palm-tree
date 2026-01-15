"""
Authentication module for Poly Trading Bots.
Simple email OTP authentication with JWT tokens.
"""

import os
import secrets
import hashlib
import time
import requests
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, EmailStr

# JWT-like token (simple implementation)
# In production, use python-jose or similar

# =============================================================================
# CONFIGURATION
# =============================================================================

# The only allowed email (from environment variable)
ALLOWED_EMAIL = os.getenv("ALLOWED_EMAIL", "")

# Secret key for token signing (generate a strong one in production)
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))

# OTP settings
OTP_EXPIRY_SECONDS = 300  # 5 minutes
OTP_LENGTH = 6

# Token settings
TOKEN_EXPIRY_DAYS = 30

# Slack webhook for sending OTP
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")

# In-memory OTP storage (for simplicity)
# In production, use Redis or database
_otp_store: dict[str, dict] = {}


# =============================================================================
# MODELS
# =============================================================================

class OTPRequest(BaseModel):
    email: EmailStr


class OTPVerify(BaseModel):
    email: EmailStr
    otp: str


class TokenResponse(BaseModel):
    token: str
    expires_at: str


# =============================================================================
# OTP FUNCTIONS
# =============================================================================

def generate_otp() -> str:
    """Generate a random 6-digit OTP."""
    return ''.join([str(secrets.randbelow(10)) for _ in range(OTP_LENGTH)])


def store_otp(email: str, otp: str):
    """Store OTP with expiry time."""
    _otp_store[email.lower()] = {
        "otp": otp,
        "expires_at": time.time() + OTP_EXPIRY_SECONDS,
        "attempts": 0
    }


def verify_otp(email: str, otp: str) -> bool:
    """Verify OTP for email. Returns True if valid."""
    email_lower = email.lower()

    if email_lower not in _otp_store:
        return False

    stored = _otp_store[email_lower]

    # Check expiry
    if time.time() > stored["expires_at"]:
        del _otp_store[email_lower]
        return False

    # Check attempts (max 3)
    if stored["attempts"] >= 3:
        del _otp_store[email_lower]
        return False

    # Increment attempts
    stored["attempts"] += 1

    # Verify OTP
    if stored["otp"] == otp:
        del _otp_store[email_lower]
        return True

    return False


def send_otp_slack(email: str, otp: str) -> bool:
    """Send OTP via Slack webhook."""
    if not SLACK_WEBHOOK_URL:
        print(f"[AUTH] No Slack webhook configured. OTP for {email}: {otp}")
        return True

    try:
        message = f"*Poly Trading Bots - Login OTP*\n\nEmail: `{email}`\nCode: `{otp}`\n\nThis code expires in 5 minutes."

        print(f"[AUTH] Sending OTP to Slack for {email}...")
        response = requests.post(
            SLACK_WEBHOOK_URL,
            json={"text": message},
            timeout=5
        )

        if response.status_code != 200:
            print(f"[AUTH] Slack returned status {response.status_code}: {response.text}")
            # Still return True - OTP was generated, just notification failed
            # This prevents blocking login if Slack is down
            return True

        print(f"[AUTH] OTP sent successfully to Slack")
        return True
    except requests.exceptions.Timeout:
        print(f"[AUTH] Slack webhook timed out, but OTP was generated")
        return True  # Don't block login for slow Slack
    except Exception as e:
        print(f"[AUTH] Failed to send Slack OTP: {e}")
        return True  # Don't block login for Slack errors


# =============================================================================
# TOKEN FUNCTIONS
# =============================================================================

def create_token(email: str) -> tuple[str, datetime]:
    """Create a simple signed token. Returns (token, expires_at)."""
    expires_at = datetime.utcnow() + timedelta(days=TOKEN_EXPIRY_DAYS)
    expires_ts = int(expires_at.timestamp())

    # Simple token format: email:expiry:signature
    payload = f"{email}:{expires_ts}"
    signature = hashlib.sha256(f"{payload}:{SECRET_KEY}".encode()).hexdigest()[:16]
    token = f"{payload}:{signature}"

    return token, expires_at


def verify_token(token: str) -> Optional[str]:
    """Verify token and return email if valid, None if invalid."""
    try:
        parts = token.split(":")
        if len(parts) != 3:
            return None

        email, expires_ts, signature = parts

        # Check expiry
        if int(expires_ts) < time.time():
            return None

        # Verify signature
        payload = f"{email}:{expires_ts}"
        expected_sig = hashlib.sha256(f"{payload}:{SECRET_KEY}".encode()).hexdigest()[:16]

        if signature != expected_sig:
            return None

        return email
    except Exception:
        return None


# =============================================================================
# AUTH LOGIC
# =============================================================================

def is_email_allowed(email: str) -> bool:
    """Check if email is allowed to authenticate."""
    if not ALLOWED_EMAIL:
        # If no allowed email is set, allow all (development mode)
        print("[AUTH] WARNING: No ALLOWED_EMAIL set, allowing all emails")
        return True

    return email.lower() == ALLOWED_EMAIL.lower()


def request_otp(email: str) -> tuple[bool, str]:
    """
    Request OTP for email.
    Returns (success, message).
    """
    if not is_email_allowed(email):
        return False, "Email not authorized"

    otp = generate_otp()
    store_otp(email, otp)

    if send_otp_slack(email, otp):
        return True, "OTP sent"
    else:
        return False, "Failed to send OTP"


def authenticate(email: str, otp: str) -> tuple[bool, Optional[str], Optional[str]]:
    """
    Authenticate with email and OTP.
    Returns (success, token, error_message).
    """
    if not is_email_allowed(email):
        return False, None, "Email not authorized"

    if not verify_otp(email, otp):
        return False, None, "Invalid or expired OTP"

    token, expires_at = create_token(email)
    return True, token, None
