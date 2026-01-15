"""
Database connection pool and schema management.
Uses asyncpg for high-performance async PostgreSQL access.
"""

import os
import asyncio
from typing import Optional
from contextlib import asynccontextmanager

# Try to import asyncpg, gracefully handle if not installed
try:
    import asyncpg
    HAS_ASYNCPG = True
except ImportError:
    HAS_ASYNCPG = False
    print("[DB] asyncpg not installed. Database logging disabled.")


# Database URL from environment
# Handle both postgres:// and postgresql:// formats (Railway uses postgres://)
_raw_url = os.getenv("DATABASE_URL", "")
DATABASE_URL = _raw_url.replace("postgres://", "postgresql://", 1) if _raw_url.startswith("postgres://") else _raw_url

# Global connection pool
_pool: Optional["asyncpg.Pool"] = None


# Schema definitions
SCHEMA = """
-- Trades table: All executed trades
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bot VARCHAR(50) NOT NULL,
    market_slug VARCHAR(255),
    asset VARCHAR(50),
    outcome VARCHAR(50),
    action VARCHAR(50) NOT NULL,
    side VARCHAR(10),
    price DECIMAL(10, 6),
    quantity DECIMAL(16, 6),
    value DECIMAL(16, 2),
    pnl DECIMAL(16, 2),
    reason VARCHAR(255),
    metadata JSONB
);

-- Decisions table: Market evaluations (taken/skipped)
CREATE TABLE IF NOT EXISTS decisions (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bot VARCHAR(50) NOT NULL,
    market_slug VARCHAR(255),
    question TEXT,
    decision VARCHAR(20) NOT NULL,
    reason VARCHAR(255),
    price DECIMAL(10, 6),
    arb_pct DECIMAL(10, 6),
    metadata JSONB
);

-- Portfolio snapshots: Periodic value snapshots
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bot VARCHAR(50) NOT NULL,
    cash DECIMAL(16, 2),
    positions_value DECIMAL(16, 2),
    total_value DECIMAL(16, 2),
    realized_pnl DECIMAL(16, 2),
    open_positions INT
);

-- Bot events: Start, stop, errors, alerts
CREATE TABLE IF NOT EXISTS bot_events (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bot VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    message TEXT,
    metadata JSONB
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_bot ON trades(bot);
CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_bot ON decisions(bot);
CREATE INDEX IF NOT EXISTS idx_portfolio_timestamp ON portfolio_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON bot_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_bot ON bot_events(bot);
"""


async def init_pool() -> bool:
    """
    Initialize the connection pool.
    
    Returns:
        True if successful, False otherwise
    """
    global _pool
    
    if not HAS_ASYNCPG:
        print("[DB] asyncpg not available")
        return False
    
    if not DATABASE_URL:
        print("[DB] DATABASE_URL not set - database logging disabled")
        return False
    
    try:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        
        # Create schema
        async with _pool.acquire() as conn:
            await conn.execute(SCHEMA)
        
        print("[DB] Connection pool initialized")
        return True
        
    except Exception as e:
        print(f"[DB] Failed to initialize pool: {e}")
        _pool = None
        return False


async def close_pool():
    """Close the connection pool."""
    global _pool
    
    if _pool:
        await _pool.close()
        _pool = None
        print("[DB] Connection pool closed")


def get_pool() -> Optional["asyncpg.Pool"]:
    """Get the connection pool."""
    return _pool


@asynccontextmanager
async def get_connection():
    """
    Get a database connection from the pool.
    
    Usage:
        async with get_connection() as conn:
            await conn.execute(...)
    """
    if not _pool:
        yield None
        return
    
    async with _pool.acquire() as conn:
        yield conn


async def execute(query: str, *args) -> Optional[str]:
    """
    Execute a query.
    
    Returns:
        Result status string or None if failed
    """
    if not _pool:
        return None
    
    try:
        async with _pool.acquire() as conn:
            return await conn.execute(query, *args)
    except Exception as e:
        print(f"[DB] Execute error: {e}")
        return None


async def fetch(query: str, *args) -> list:
    """
    Fetch rows from a query.
    
    Returns:
        List of Record objects or empty list if failed
    """
    if not _pool:
        return []
    
    try:
        async with _pool.acquire() as conn:
            return await conn.fetch(query, *args)
    except Exception as e:
        print(f"[DB] Fetch error: {e}")
        return []


async def fetchone(query: str, *args) -> Optional[dict]:
    """
    Fetch a single row.
    
    Returns:
        Record object or None
    """
    if not _pool:
        return None
    
    try:
        async with _pool.acquire() as conn:
            return await conn.fetchrow(query, *args)
    except Exception as e:
        print(f"[DB] Fetchone error: {e}")
        return None
