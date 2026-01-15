-- =============================================================================
-- Poly Trading System - Database Schema
-- =============================================================================
-- This script runs on first container startup to create the schema.
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Trades Table (executed orders)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Order details
    token_id VARCHAR(255) NOT NULL,
    side VARCHAR(10) NOT NULL,  -- 'BUY' or 'SELL'
    price DECIMAL(20, 8) NOT NULL,
    size DECIMAL(20, 8) NOT NULL,

    -- Execution details
    order_id VARCHAR(255),
    status VARCHAR(50) NOT NULL,  -- 'FILLED', 'PARTIAL', 'REJECTED', 'PAPER'

    -- Strategy info
    strategy VARCHAR(100) NOT NULL,
    signal_reason TEXT,

    -- Paper trading flag
    is_paper BOOLEAN NOT NULL DEFAULT false,

    -- Indexes for common queries
    CONSTRAINT valid_side CHECK (side IN ('BUY', 'SELL'))
);

CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_token_id ON trades(token_id);
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy);
CREATE INDEX IF NOT EXISTS idx_trades_is_paper ON trades(is_paper);

-- ---------------------------------------------------------------------------
-- Arbitrage Trades Table (YES + NO pairs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS arb_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Market info
    market_id VARCHAR(255) NOT NULL,
    yes_token_id VARCHAR(255) NOT NULL,
    no_token_id VARCHAR(255) NOT NULL,

    -- Prices
    yes_price DECIMAL(20, 8) NOT NULL,
    no_price DECIMAL(20, 8) NOT NULL,
    size DECIMAL(20, 8) NOT NULL,

    -- Profit calculation
    total_cost DECIMAL(20, 8) NOT NULL,
    fees DECIMAL(20, 8) NOT NULL,
    gross_profit DECIMAL(20, 8) NOT NULL,
    net_profit DECIMAL(20, 8) NOT NULL,

    -- Order IDs
    yes_order_id VARCHAR(255),
    no_order_id VARCHAR(255),
    status VARCHAR(50) NOT NULL,

    -- Strategy
    strategy VARCHAR(100) NOT NULL DEFAULT 'SumTo100',

    -- Paper trading flag
    is_paper BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_arb_trades_created_at ON arb_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arb_trades_market_id ON arb_trades(market_id);
CREATE INDEX IF NOT EXISTS idx_arb_trades_is_paper ON arb_trades(is_paper);

-- ---------------------------------------------------------------------------
-- Positions Table (current holdings)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    token_id VARCHAR(255) NOT NULL UNIQUE,
    size DECIMAL(20, 8) NOT NULL DEFAULT 0,
    avg_cost DECIMAL(20, 8) NOT NULL DEFAULT 0,
    realized_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_positions_token_id ON positions(token_id);

-- ---------------------------------------------------------------------------
-- Daily Stats Table (P&L tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,

    trades_count INTEGER NOT NULL DEFAULT 0,
    volume DECIMAL(20, 8) NOT NULL DEFAULT 0,
    pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,

    -- Strategy breakdown
    sumto100_trades INTEGER NOT NULL DEFAULT 0,
    sumto100_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
    clipper_trades INTEGER NOT NULL DEFAULT 0,
    clipper_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
    sniper_trades INTEGER NOT NULL DEFAULT 0,
    sniper_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date DESC);

-- ---------------------------------------------------------------------------
-- Signals Table (strategy evaluations - for debugging)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    strategy VARCHAR(100) NOT NULL,
    signal_type VARCHAR(50) NOT NULL,  -- 'BUY', 'SELL', 'ARBITRAGE'

    -- Market data at signal time
    token_id VARCHAR(255),
    yes_token_id VARCHAR(255),
    no_token_id VARCHAR(255),

    -- Prices
    price DECIMAL(20, 8),
    yes_price DECIMAL(20, 8),
    no_price DECIMAL(20, 8),
    size DECIMAL(20, 8),

    -- Edge calculation
    edge DECIMAL(20, 8),
    confidence DECIMAL(5, 4),

    -- Outcome
    action_taken VARCHAR(50) NOT NULL,  -- 'EXECUTED', 'REJECTED_RISK', 'REJECTED_STALE', etc.
    rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_strategy ON signals(strategy);
CREATE INDEX IF NOT EXISTS idx_signals_action ON signals(action_taken);

-- ---------------------------------------------------------------------------
-- Grant permissions
-- ---------------------------------------------------------------------------
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO poly;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO poly;
