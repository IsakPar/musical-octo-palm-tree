"""
Tests for authentication module.
"""

import os
import pytest
from unittest.mock import patch, MagicMock
from freezegun import freeze_time
from datetime import datetime, timedelta

# Set test env before imports
os.environ["SECRET_KEY"] = "test-secret-key-for-testing"
os.environ["ALLOWED_EMAIL"] = ""

from auth import (
    generate_otp,
    store_otp,
    verify_otp,
    create_token,
    verify_token,
    is_email_allowed,
    request_otp,
    authenticate,
    _otp_store,
)


class TestOTPGeneration:
    """Tests for OTP generation and storage."""

    def test_generate_otp_length(self):
        """OTP should be 6 digits."""
        otp = generate_otp()
        assert len(otp) == 6
        assert otp.isdigit()

    def test_generate_otp_randomness(self):
        """Each OTP should be unique."""
        otps = [generate_otp() for _ in range(100)]
        # With 6 digits, collisions are possible but 100 should be mostly unique
        assert len(set(otps)) > 90

    def test_store_otp(self):
        """OTP should be stored with expiry."""
        email = "test@example.com"
        otp = "123456"

        store_otp(email, otp)

        assert email.lower() in _otp_store
        assert _otp_store[email.lower()]["otp"] == otp
        assert _otp_store[email.lower()]["attempts"] == 0

        # Cleanup
        del _otp_store[email.lower()]


class TestOTPVerification:
    """Tests for OTP verification."""

    def test_verify_valid_otp(self):
        """Valid OTP should verify successfully."""
        email = "test@example.com"
        otp = "123456"

        store_otp(email, otp)
        result = verify_otp(email, otp)

        assert result is True
        assert email.lower() not in _otp_store  # Should be deleted after use

    def test_verify_wrong_otp(self):
        """Wrong OTP should fail."""
        email = "test@example.com"
        otp = "123456"

        store_otp(email, otp)
        result = verify_otp(email, "000000")

        assert result is False

        # Cleanup
        if email.lower() in _otp_store:
            del _otp_store[email.lower()]

    def test_verify_nonexistent_email(self):
        """Non-existent email should fail."""
        result = verify_otp("nonexistent@example.com", "123456")
        assert result is False

    def test_verify_max_attempts(self):
        """After 3 wrong attempts, OTP should be invalidated."""
        email = "test@example.com"
        otp = "123456"

        store_otp(email, otp)

        # 3 wrong attempts
        verify_otp(email, "000000")
        verify_otp(email, "000001")
        verify_otp(email, "000002")

        # Even correct OTP should fail now
        result = verify_otp(email, otp)
        assert result is False

    @freeze_time("2024-01-01 12:00:00")
    def test_verify_expired_otp(self):
        """Expired OTP should fail."""
        email = "test@example.com"
        otp = "123456"

        store_otp(email, otp)

        # Move time forward past expiry (5 minutes)
        with freeze_time("2024-01-01 12:06:00"):
            result = verify_otp(email, otp)
            assert result is False


class TestJWTTokens:
    """Tests for JWT token creation and verification."""

    def test_create_token(self):
        """Token should be created with correct structure."""
        email = "test@example.com"
        token, expires_at = create_token(email)

        assert isinstance(token, str)
        assert len(token) > 50  # JWT tokens are long
        assert isinstance(expires_at, datetime)
        assert expires_at > datetime.utcnow()

    def test_verify_valid_token(self):
        """Valid token should return email."""
        email = "test@example.com"
        token, _ = create_token(email)

        result = verify_token(token)
        assert result == email

    def test_verify_invalid_token(self):
        """Invalid token should return None."""
        result = verify_token("invalid.token.here")
        assert result is None

    def test_verify_tampered_token(self):
        """Tampered token should return None."""
        email = "test@example.com"
        token, _ = create_token(email)

        # Tamper with the token
        tampered = token[:-5] + "XXXXX"

        result = verify_token(tampered)
        assert result is None

    @freeze_time("2024-01-01 12:00:00")
    def test_verify_expired_token(self):
        """Expired token should return None."""
        email = "test@example.com"
        token, _ = create_token(email)

        # Move time forward past expiry (30 days)
        with freeze_time("2024-02-15 12:00:00"):
            result = verify_token(token)
            assert result is None


class TestEmailAllowlist:
    """Tests for email allowlist."""

    def test_allowed_email_match(self):
        """Matching email should be allowed."""
        with patch.dict(os.environ, {"ALLOWED_EMAIL": "allowed@example.com"}):
            # Need to reload module to pick up new env
            import importlib
            import auth
            importlib.reload(auth)

            assert auth.is_email_allowed("allowed@example.com") is True
            assert auth.is_email_allowed("ALLOWED@EXAMPLE.COM") is True  # Case insensitive

    def test_disallowed_email(self):
        """Non-matching email should be disallowed."""
        with patch.dict(os.environ, {"ALLOWED_EMAIL": "allowed@example.com"}):
            import importlib
            import auth
            importlib.reload(auth)

            assert auth.is_email_allowed("other@example.com") is False

    def test_no_restriction_dev_mode(self):
        """When ALLOWED_EMAIL is empty, all emails allowed (dev mode)."""
        with patch.dict(os.environ, {"ALLOWED_EMAIL": ""}):
            import importlib
            import auth
            importlib.reload(auth)

            assert auth.is_email_allowed("anyone@example.com") is True


class TestAuthenticationFlow:
    """Tests for full authentication flow."""

    def test_request_otp_success(self):
        """OTP request should succeed for allowed email."""
        with patch.dict(os.environ, {"ALLOWED_EMAIL": "", "SLACK_WEBHOOK_URL": ""}):
            import importlib
            import auth
            importlib.reload(auth)

            success, message = auth.request_otp("test@example.com")

            assert success is True
            assert message == "OTP sent"
            # OTP should be stored
            assert "test@example.com" in auth._otp_store

    @patch("auth.send_otp_slack")
    def test_full_auth_flow(self, mock_send):
        """Full flow: request OTP -> verify -> get token."""
        mock_send.return_value = True

        with patch.dict(os.environ, {"ALLOWED_EMAIL": ""}):
            import importlib
            import auth
            importlib.reload(auth)

            email = "test@example.com"

            # Request OTP
            success, _ = auth.request_otp(email)
            assert success is True

            # Get the OTP from store
            stored_otp = auth._otp_store[email.lower()]["otp"]

            # Authenticate
            success, token, error = auth.authenticate(email, stored_otp)

            assert success is True
            assert token is not None
            assert error is None

            # Verify the token works
            verified_email = auth.verify_token(token)
            assert verified_email == email
