"""
Async Logger Service with Batched Writes

This is the core of our non-blocking logging system.
- Logs are added to an in-memory queue (instant, O(1))
- A background task flushes to DB every N seconds
- Bot performance is NEVER affected by DB writes
"""

import asyncio
import json
from datetime import datetime, timezone
from collections import deque
from typing import Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

from .connection import get_pool, init_pool, close_pool


# =============================================================================
# CONFIGURATION
# =============================================================================

FLUSH_INTERVAL_SECONDS = 5  # Flush every 5 seconds
MAX_QUEUE_SIZE = 100        # Flush if queue exceeds this size
MAX_BATCH_SIZE = 50         # Max rows per batch insert


# =============================================================================
# LOG TYPES
# =============================================================================

class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    TRADE = "TRADE"
    ALERT = "ALERT"
    ERROR = "ERROR"


@dataclass
class TradeLog:
    """A trade execution log."""
    bot: str
    action: str
    market_slug: str = ""
    asset: str = ""
    outcome: str = ""
    side: str = ""
    price: float = 0.0
    quantity: float = 0.0
    value: float = 0.0
    pnl: float = 0.0
    reason: str = ""
    metadata: dict = None
    timestamp: str = ""
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()
        if self.metadata is None:
            self.metadata = {}


@dataclass
class DecisionLog:
    """A market evaluation decision log."""
    bot: str
    decision: str  # "TAKEN" or "SKIPPED"
    market_slug: str = ""
    question: str = ""
    reason: str = ""
    price: float = 0.0
    arb_pct: float = 0.0
    metadata: dict = None
    timestamp: str = ""
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()
        if self.metadata is None:
            self.metadata = {}


@dataclass
class PortfolioSnapshot:
    """A portfolio value snapshot."""
    bot: str
    cash: float = 0.0
    positions_value: float = 0.0
    total_value: float = 0.0
    realized_pnl: float = 0.0
    open_positions: int = 0
    timestamp: str = ""
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()


@dataclass
class EventLog:
    """A bot event log (start, stop, error, etc.)."""
    bot: str
    event_type: str
    level: str = "INFO"
    message: str = ""
    metadata: dict = None
    timestamp: str = ""
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()
        if self.metadata is None:
            self.metadata = {}


# =============================================================================
# ASYNC LOGGER
# =============================================================================

class AsyncLogger:
    """
    Non-blocking async logger with batched database writes.
    
    Usage:
        logger = AsyncLogger()
        await logger.start()
        
        # These are instant - no waiting for DB!
        logger.log_trade(TradeLog(...))
        logger.log_decision(DecisionLog(...))
        logger.log_event(EventLog(...))
        
        await logger.stop()  # Flushes remaining logs
    """
    
    def __init__(self):
        # Separate queues for different log types
        self._trade_queue: deque[TradeLog] = deque(maxlen=1000)
        self._decision_queue: deque[DecisionLog] = deque(maxlen=1000)
        self._portfolio_queue: deque[PortfolioSnapshot] = deque(maxlen=1000)
        self._event_queue: deque[EventLog] = deque(maxlen=1000)
        
        self._running = False
        self._flush_task: Optional[asyncio.Task] = None
        self._db_available = False
        
        # Stats
        self.trades_logged = 0
        self.decisions_logged = 0
        self.events_logged = 0
        self.flush_count = 0
    
    async def start(self):
        """Start the logger and background flush task."""
        # Initialize database pool
        self._db_available = await init_pool()
        
        if not self._db_available:
            print("[LOGGER] Database not available - logs will be in-memory only")
        
        self._running = True
        self._flush_task = asyncio.create_task(self._flush_loop())
        print("[LOGGER] Started")
    
    async def stop(self):
        """Stop the logger and flush remaining logs."""
        self._running = False
        
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        
        # Final flush
        await self._flush_all()
        
        # Close pool
        await close_pool()
        
        print("[LOGGER] Stopped")
    
    # -------------------------------------------------------------------------
    # Public Logging Methods (Instant - Non-blocking!)
    # -------------------------------------------------------------------------
    
    def log_trade(self, trade: TradeLog):
        """Log a trade. Instant, non-blocking."""
        self._trade_queue.append(trade)
        self.trades_logged += 1
    
    def log_decision(self, decision: DecisionLog):
        """Log a decision. Instant, non-blocking."""
        self._decision_queue.append(decision)
        self.decisions_logged += 1
    
    def log_portfolio(self, snapshot: PortfolioSnapshot):
        """Log a portfolio snapshot. Instant, non-blocking."""
        self._portfolio_queue.append(snapshot)
    
    def log_event(self, event: EventLog):
        """Log an event. Instant, non-blocking."""
        self._event_queue.append(event)
        self.events_logged += 1
    
    # Convenience methods
    def trade(self, bot: str, action: str, **kwargs):
        """Convenience method to log a trade."""
        self.log_trade(TradeLog(bot=bot, action=action, **kwargs))
    
    def decision(self, bot: str, decision: str, **kwargs):
        """Convenience method to log a decision."""
        self.log_decision(DecisionLog(bot=bot, decision=decision, **kwargs))
    
    def event(self, bot: str, event_type: str, message: str = "", level: str = "INFO", **kwargs):
        """Convenience method to log an event."""
        self.log_event(EventLog(bot=bot, event_type=event_type, message=message, level=level, **kwargs))
    
    def snapshot(self, bot: str, **kwargs):
        """Convenience method to log a portfolio snapshot."""
        self.log_portfolio(PortfolioSnapshot(bot=bot, **kwargs))
    
    # -------------------------------------------------------------------------
    # Queue Access (for API endpoints)
    # -------------------------------------------------------------------------
    
    def get_recent_trades(self, limit: int = 100) -> list[dict]:
        """Get recent trades from queue."""
        trades = list(self._trade_queue)[-limit:]
        return [asdict(t) for t in trades]
    
    def get_recent_decisions(self, limit: int = 100) -> list[dict]:
        """Get recent decisions from queue."""
        decisions = list(self._decision_queue)[-limit:]
        return [asdict(d) for d in decisions]
    
    def get_recent_events(self, limit: int = 100) -> list[dict]:
        """Get recent events from queue."""
        events = list(self._event_queue)[-limit:]
        return [asdict(e) for e in events]
    
    def get_stats(self) -> dict:
        """Get logger stats."""
        return {
            "trades_logged": self.trades_logged,
            "decisions_logged": self.decisions_logged,
            "events_logged": self.events_logged,
            "flush_count": self.flush_count,
            "db_available": self._db_available,
            "queue_sizes": {
                "trades": len(self._trade_queue),
                "decisions": len(self._decision_queue),
                "portfolios": len(self._portfolio_queue),
                "events": len(self._event_queue),
            }
        }
    
    # -------------------------------------------------------------------------
    # Background Flush Loop
    # -------------------------------------------------------------------------
    
    async def _flush_loop(self):
        """Background task that periodically flushes queues to database."""
        while self._running:
            try:
                await asyncio.sleep(FLUSH_INTERVAL_SECONDS)
                
                # Check if we should flush
                total_queued = (
                    len(self._trade_queue) + 
                    len(self._decision_queue) +
                    len(self._portfolio_queue) +
                    len(self._event_queue)
                )
                
                if total_queued > 0:
                    await self._flush_all()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[LOGGER] Flush error: {e}")
                await asyncio.sleep(FLUSH_INTERVAL_SECONDS)
    
    async def _flush_all(self):
        """Flush all queues to database."""
        if not self._db_available:
            return
        
        pool = get_pool()
        if not pool:
            return
        
        try:
            async with pool.acquire() as conn:
                # Flush trades
                await self._flush_trades(conn)
                
                # Flush decisions
                await self._flush_decisions(conn)
                
                # Flush portfolios
                await self._flush_portfolios(conn)
                
                # Flush events
                await self._flush_events(conn)
            
            self.flush_count += 1
            
        except Exception as e:
            print(f"[LOGGER] Flush all error: {e}")
    
    async def _flush_trades(self, conn):
        """Flush trade queue to database."""
        if not self._trade_queue:
            return
        
        # Get batch
        batch = []
        while self._trade_queue and len(batch) < MAX_BATCH_SIZE:
            batch.append(self._trade_queue.popleft())
        
        if not batch:
            return
        
        try:
            # Batch insert
            await conn.executemany(
                """
                INSERT INTO trades (timestamp, bot, market_slug, asset, outcome, action, side, price, quantity, value, pnl, reason, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                """,
                [
                    (
                        datetime.fromisoformat(t.timestamp.replace('Z', '+00:00')),
                        t.bot, t.market_slug, t.asset, t.outcome, t.action,
                        t.side, t.price, t.quantity, t.value, t.pnl, t.reason,
                        json.dumps(t.metadata) if t.metadata else None,
                    )
                    for t in batch
                ]
            )
        except Exception as e:
            print(f"[LOGGER] Trade flush error: {e}")
            # Put items back in queue
            for t in reversed(batch):
                self._trade_queue.appendleft(t)
    
    async def _flush_decisions(self, conn):
        """Flush decision queue to database."""
        if not self._decision_queue:
            return
        
        batch = []
        while self._decision_queue and len(batch) < MAX_BATCH_SIZE:
            batch.append(self._decision_queue.popleft())
        
        if not batch:
            return
        
        try:
            await conn.executemany(
                """
                INSERT INTO decisions (timestamp, bot, market_slug, question, decision, reason, price, arb_pct, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """,
                [
                    (
                        datetime.fromisoformat(d.timestamp.replace('Z', '+00:00')),
                        d.bot, d.market_slug, d.question, d.decision,
                        d.reason, d.price, d.arb_pct,
                        json.dumps(d.metadata) if d.metadata else None,
                    )
                    for d in batch
                ]
            )
        except Exception as e:
            print(f"[LOGGER] Decision flush error: {e}")
            for d in reversed(batch):
                self._decision_queue.appendleft(d)
    
    async def _flush_portfolios(self, conn):
        """Flush portfolio queue to database."""
        if not self._portfolio_queue:
            return
        
        batch = []
        while self._portfolio_queue and len(batch) < MAX_BATCH_SIZE:
            batch.append(self._portfolio_queue.popleft())
        
        if not batch:
            return
        
        try:
            await conn.executemany(
                """
                INSERT INTO portfolio_snapshots (timestamp, bot, cash, positions_value, total_value, realized_pnl, open_positions)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                [
                    (
                        datetime.fromisoformat(p.timestamp.replace('Z', '+00:00')),
                        p.bot, p.cash, p.positions_value, p.total_value,
                        p.realized_pnl, p.open_positions,
                    )
                    for p in batch
                ]
            )
        except Exception as e:
            print(f"[LOGGER] Portfolio flush error: {e}")
            for p in reversed(batch):
                self._portfolio_queue.appendleft(p)
    
    async def _flush_events(self, conn):
        """Flush event queue to database."""
        if not self._event_queue:
            return
        
        batch = []
        while self._event_queue and len(batch) < MAX_BATCH_SIZE:
            batch.append(self._event_queue.popleft())
        
        if not batch:
            return
        
        try:
            await conn.executemany(
                """
                INSERT INTO bot_events (timestamp, bot, event_type, level, message, metadata)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                [
                    (
                        datetime.fromisoformat(e.timestamp.replace('Z', '+00:00')),
                        e.bot, e.event_type, e.level, e.message,
                        json.dumps(e.metadata) if e.metadata else None,
                    )
                    for e in batch
                ]
            )
        except Exception as e:
            print(f"[LOGGER] Event flush error: {e}")
            for ev in reversed(batch):
                self._event_queue.appendleft(ev)


# =============================================================================
# GLOBAL LOGGER INSTANCE
# =============================================================================

# Singleton logger
_logger: Optional[AsyncLogger] = None


def get_logger() -> AsyncLogger:
    """Get or create the global logger instance."""
    global _logger
    if _logger is None:
        _logger = AsyncLogger()
    return _logger


async def start_logger():
    """Start the global logger."""
    logger = get_logger()
    await logger.start()


async def stop_logger():
    """Stop the global logger."""
    if _logger:
        await _logger.stop()
