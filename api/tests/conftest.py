"""
Pytest configuration and fixtures for Poly Trading Bots tests.
"""

import os
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime

# Set test environment variables before importing app modules
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only-do-not-use-in-prod")
os.environ.setdefault("ALLOWED_EMAIL", "")  # Allow all in tests


@pytest.fixture
def mock_polymarket_client():
    """Mock Polymarket API client."""
    client = MagicMock()
    client.get_markets = MagicMock(return_value=[])
    client.get_order_book = MagicMock(return_value={"bids": [], "asks": []})
    client.create_order = AsyncMock(return_value={"order_id": "test-123"})
    client.get_positions = MagicMock(return_value=[])
    return client


@pytest.fixture
def mock_espn_client():
    """Mock ESPN API responses."""
    with patch("requests.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "events": []
        }
        mock_get.return_value = mock_response
        yield mock_get


@pytest.fixture
def mock_slack_webhook():
    """Mock Slack webhook calls."""
    with patch("requests.post") as mock_post:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response
        yield mock_post


@pytest.fixture
def sample_market():
    """Sample Polymarket market data."""
    return {
        "id": "0x123abc",
        "question": "Will Team A win?",
        "slug": "will-team-a-win",
        "outcomes": ["Yes", "No"],
        "outcomePrices": [0.65, 0.35],
        "volume": 100000,
        "liquidity": 50000,
        "endDate": "2024-12-31T00:00:00Z",
        "active": True,
    }


@pytest.fixture
def sample_order_book():
    """Sample order book data."""
    return {
        "bids": [
            {"price": 0.64, "size": 100},
            {"price": 0.63, "size": 200},
        ],
        "asks": [
            {"price": 0.66, "size": 100},
            {"price": 0.67, "size": 150},
        ],
    }


@pytest.fixture
def sample_espn_event():
    """Sample ESPN event data."""
    return {
        "id": "401234567",
        "name": "Team A vs Team B",
        "date": "2024-12-15T20:00:00Z",
        "status": {"type": {"completed": False}},
        "competitions": [
            {
                "competitors": [
                    {
                        "team": {"displayName": "Team A"},
                        "homeAway": "home",
                    },
                    {
                        "team": {"displayName": "Team B"},
                        "homeAway": "away",
                    },
                ],
                "odds": [
                    {
                        "homeTeamOdds": {"winProbability": 0.70},
                        "awayTeamOdds": {"winProbability": 0.30},
                    }
                ],
            }
        ],
    }


@pytest.fixture
def broadcast_callback():
    """Mock broadcast callback for bot testing."""
    return AsyncMock()


# =============================================================================
# Async Test Support
# =============================================================================

@pytest.fixture
def event_loop_policy():
    """Use default event loop policy."""
    import asyncio
    return asyncio.DefaultEventLoopPolicy()


# =============================================================================
# HTTP Client for API Testing
# =============================================================================

@pytest.fixture
def test_client():
    """Create test client for FastAPI app."""
    from httpx import AsyncClient, ASGITransport
    from main import app

    async def _get_client():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

    return _get_client
