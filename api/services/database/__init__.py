"""Database services package."""
from .connection import init_pool, close_pool, get_pool, get_connection, execute, fetch, fetchone
from .logger import (
    AsyncLogger, 
    get_logger, 
    start_logger, 
    stop_logger,
    TradeLog,
    DecisionLog,
    PortfolioSnapshot,
    EventLog,
    LogLevel,
)
from .queries import (
    get_trades, get_decisions, get_portfolio_history, get_events, get_stats,
    get_pnl_history, get_win_rate_stats, get_top_trades,
    get_decision_breakdown, get_hourly_performance,
)

__all__ = [
    # Connection
    "init_pool",
    "close_pool",
    "get_pool",
    "get_connection",
    "execute",
    "fetch",
    "fetchone",
    # Logger
    "AsyncLogger",
    "get_logger",
    "start_logger",
    "stop_logger",
    "TradeLog",
    "DecisionLog",
    "PortfolioSnapshot",
    "EventLog",
    "LogLevel",
    # Queries
    "get_trades",
    "get_decisions",
    "get_portfolio_history",
    "get_events",
    "get_stats",
    "get_pnl_history",
    "get_win_rate_stats",
    "get_top_trades",
    "get_decision_breakdown",
    "get_hourly_performance",
]
