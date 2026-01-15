"""
Pydantic models for API responses and WebSocket messages.
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class BotStatus(str, Enum):
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"


class TradeSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class PositionStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


# =============================================================================
# GABAGOOL MODELS
# =============================================================================

class GabagoolPosition(BaseModel):
    id: str
    timestamp: datetime
    market_slug: str
    asset: str
    outcome: str
    entry_price: float
    quantity: float
    status: PositionStatus
    exit_price: Optional[float] = None
    pnl: Optional[float] = None


class GabagoolTrade(BaseModel):
    timestamp: datetime
    market_slug: str
    asset: str
    outcome: str
    side: TradeSide
    price: float
    quantity: float
    value: float
    pnl: float
    reason: str


class GabagoolState(BaseModel):
    status: BotStatus
    cash: float
    positions_value: float
    total_value: float
    realized_pnl: float
    open_positions: List[GabagoolPosition]
    recent_trades: List[GabagoolTrade]
    scan_count: int
    markets_scanned: int


# =============================================================================
# CLIPPER MODELS
# =============================================================================

class ClipperPosition(BaseModel):
    arb_id: str
    timestamp: datetime
    market_slug: str
    question: str
    yes_price: float
    no_price: float
    yes_shares: float
    no_shares: float
    total_cost: float
    expected_payout: float
    expected_pnl: float
    arb_pct: float
    status: str
    actual_pnl: Optional[float] = None
    settled_outcome: Optional[str] = None


class ClipperOpportunity(BaseModel):
    timestamp: datetime
    market_slug: str
    question: str
    yes_ask: float
    no_ask: float
    total: float
    arb_pct: float
    yes_liquidity: float
    no_liquidity: float
    action: str


class ClipperTrade(BaseModel):
    timestamp: datetime
    arb_id: str
    market_slug: str
    action: str
    yes_price: float
    no_price: float
    total_cost: float
    expected_pnl: float
    actual_pnl: float
    arb_pct: float


class ClipperState(BaseModel):
    status: BotStatus
    cash: float
    locked_in_arbs: float
    total_value: float
    realized_pnl: float
    open_arbs: int
    open_positions: List[ClipperPosition]
    recent_trades: List[ClipperTrade]
    recent_opportunities: List[ClipperOpportunity]
    scan_count: int
    markets_scanned: int


# =============================================================================
# COMBINED MODELS
# =============================================================================

class PortfolioSnapshot(BaseModel):
    timestamp: datetime
    total_value: float
    realized_pnl: float


class CombinedState(BaseModel):
    gabagool: GabagoolState
    clipper: ClipperState
    combined_value: float
    combined_pnl: float
    portfolio_history: List[PortfolioSnapshot]


# =============================================================================
# WEBSOCKET MESSAGE MODELS
# =============================================================================

class WSMessage(BaseModel):
    type: str
    bot: str
    timestamp: datetime
    data: dict
