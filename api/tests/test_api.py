"""
Tests for API endpoints.
"""

import os
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

# Set test env before imports
os.environ["SECRET_KEY"] = "test-secret-key-for-testing"
os.environ["ALLOWED_EMAIL"] = ""

from httpx import AsyncClient, ASGITransport
from auth import create_token


@pytest.fixture
def auth_token():
    """Create a valid auth token for testing."""
    token, _ = create_token("test@example.com")
    return token


@pytest.fixture
def mock_bots():
    """Mock bot instances."""
    mock_gabagool = MagicMock()
    mock_gabagool.get_state.return_value = {
        "total_value": 1050.0,
        "realized_pnl": 50.0,
        "positions": [],
        "running": True,
    }
    mock_gabagool.running = True

    mock_clipper = MagicMock()
    mock_clipper.get_state.return_value = {
        "total_value": 1020.0,
        "realized_pnl": 20.0,
        "positions": [],
        "running": True,
    }
    mock_clipper.running = True

    mock_sniper = MagicMock()
    mock_sniper.get_state.return_value = {
        "total_value": 980.0,
        "realized_pnl": -20.0,
        "positions": [],
        "running": True,
    }
    mock_sniper.running = True

    return mock_gabagool, mock_clipper, mock_sniper


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    @pytest.mark.asyncio
    async def test_health_check(self):
        """Health endpoint should return ok."""
        # Import here to avoid bot initialization
        with patch("main.start_logger", new_callable=AsyncMock), \
             patch("main.stop_logger", new_callable=AsyncMock), \
             patch("main.GabagoolBot"), \
             patch("main.ClipperBot"), \
             patch("main.SniperBot"):

            from main import app

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/health")

            assert response.status_code == 200
            assert response.json() == {"status": "ok"}


class TestAuthEndpoints:
    """Tests for authentication endpoints."""

    @pytest.mark.asyncio
    async def test_request_otp_valid_email(self):
        """Should successfully request OTP for valid email."""
        with patch("main.start_logger", new_callable=AsyncMock), \
             patch("main.stop_logger", new_callable=AsyncMock), \
             patch("main.GabagoolBot"), \
             patch("main.ClipperBot"), \
             patch("main.SniperBot"):

            from main import app

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/auth/request-otp",
                    json={"email": "test@example.com"}
                )

            assert response.status_code == 200
            assert "message" in response.json()

    @pytest.mark.asyncio
    async def test_request_otp_invalid_email(self):
        """Should reject invalid email format."""
        with patch("main.start_logger", new_callable=AsyncMock), \
             patch("main.stop_logger", new_callable=AsyncMock), \
             patch("main.GabagoolBot"), \
             patch("main.ClipperBot"), \
             patch("main.SniperBot"):

            from main import app

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/auth/request-otp",
                    json={"email": "not-an-email"}
                )

            assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_verify_otp_wrong_code(self):
        """Should reject wrong OTP."""
        with patch("main.start_logger", new_callable=AsyncMock), \
             patch("main.stop_logger", new_callable=AsyncMock), \
             patch("main.GabagoolBot"), \
             patch("main.ClipperBot"), \
             patch("main.SniperBot"):

            from main import app

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.post(
                    "/api/auth/verify-otp",
                    json={"email": "test@example.com", "otp": "000000"}
                )

            assert response.status_code == 401


class TestBotStateEndpoints:
    """Tests for bot state endpoints."""

    @pytest.mark.asyncio
    async def test_get_combined_state(self, mock_bots):
        """Should return combined state of all bots."""
        mock_gabagool, mock_clipper, mock_sniper = mock_bots

        with patch("main.start_logger", new_callable=AsyncMock), \
             patch("main.stop_logger", new_callable=AsyncMock), \
             patch("main.GabagoolBot", return_value=mock_gabagool), \
             patch("main.ClipperBot", return_value=mock_clipper), \
             patch("main.SniperBot", return_value=mock_sniper), \
             patch("main.gabagool_bot", mock_gabagool), \
             patch("main.clipper_bot", mock_clipper), \
             patch("main.sniper_bot", mock_sniper):

            from main import app
            import main
            main.gabagool_bot = mock_gabagool
            main.clipper_bot = mock_clipper
            main.sniper_bot = mock_sniper

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/state")

            assert response.status_code == 200
            data = response.json()
            assert "gabagool" in data
            assert "clipper" in data
            assert "sniper" in data
            assert "combined" in data
            # Combined total value should be sum of individual bots
            assert data["combined"]["total_value"] == 3050.0
            assert data["combined"]["realized_pnl"] == 50.0
