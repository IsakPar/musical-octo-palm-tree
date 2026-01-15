"""
Database query service for fetching historical logs.
"""

from datetime import datetime, timedelta
from typing import Optional
from .connection import fetch, fetchone


async def get_trades(
    bot: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    since: Optional[datetime] = None,
) -> list[dict]:
    """
    Get trades from the database.
    
    Args:
        bot: Filter by bot name (optional)
        limit: Max rows to return
        offset: Offset for pagination
        since: Only return trades after this timestamp
        
    Returns:
        List of trade dictionaries
    """
    query = """
        SELECT 
            id, timestamp, bot, market_slug, asset, outcome,
            action, side, price, quantity, value, pnl, reason, metadata
        FROM trades
        WHERE 1=1
    """
    params = []
    param_idx = 1
    
    if bot:
        query += f" AND bot = ${param_idx}"
        params.append(bot)
        param_idx += 1
    
    if since:
        query += f" AND timestamp > ${param_idx}"
        params.append(since)
        param_idx += 1
    
    query += f" ORDER BY timestamp DESC LIMIT ${param_idx} OFFSET ${param_idx + 1}"
    params.extend([limit, offset])
    
    rows = await fetch(query, *params)
    
    return [
        {
            "id": r["id"],
            "timestamp": r["timestamp"].isoformat(),
            "bot": r["bot"],
            "market_slug": r["market_slug"],
            "asset": r["asset"],
            "outcome": r["outcome"],
            "action": r["action"],
            "side": r["side"],
            "price": float(r["price"]) if r["price"] else 0,
            "quantity": float(r["quantity"]) if r["quantity"] else 0,
            "value": float(r["value"]) if r["value"] else 0,
            "pnl": float(r["pnl"]) if r["pnl"] else 0,
            "reason": r["reason"],
            "metadata": r["metadata"],
        }
        for r in rows
    ]


async def get_decisions(
    bot: Optional[str] = None,
    decision: Optional[str] = None,  # "TAKEN" or "SKIPPED"
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """Get decisions from the database."""
    query = """
        SELECT 
            id, timestamp, bot, market_slug, question,
            decision, reason, price, arb_pct, metadata
        FROM decisions
        WHERE 1=1
    """
    params = []
    param_idx = 1
    
    if bot:
        query += f" AND bot = ${param_idx}"
        params.append(bot)
        param_idx += 1
    
    if decision:
        query += f" AND decision = ${param_idx}"
        params.append(decision)
        param_idx += 1
    
    query += f" ORDER BY timestamp DESC LIMIT ${param_idx} OFFSET ${param_idx + 1}"
    params.extend([limit, offset])
    
    rows = await fetch(query, *params)
    
    return [
        {
            "id": r["id"],
            "timestamp": r["timestamp"].isoformat(),
            "bot": r["bot"],
            "market_slug": r["market_slug"],
            "question": r["question"],
            "decision": r["decision"],
            "reason": r["reason"],
            "price": float(r["price"]) if r["price"] else 0,
            "arb_pct": float(r["arb_pct"]) if r["arb_pct"] else 0,
            "metadata": r["metadata"],
        }
        for r in rows
    ]


async def get_portfolio_history(
    bot: Optional[str] = None,
    hours: int = 24,
    limit: int = 500,
) -> list[dict]:
    """Get portfolio snapshots from the database."""
    since = datetime.utcnow() - timedelta(hours=hours)
    
    query = """
        SELECT 
            id, timestamp, bot, cash, positions_value,
            total_value, realized_pnl, open_positions
        FROM portfolio_snapshots
        WHERE timestamp > $1
    """
    params = [since]
    param_idx = 2
    
    if bot:
        query += f" AND bot = ${param_idx}"
        params.append(bot)
        param_idx += 1
    
    query += f" ORDER BY timestamp ASC LIMIT ${param_idx}"
    params.append(limit)
    
    rows = await fetch(query, *params)
    
    return [
        {
            "id": r["id"],
            "timestamp": r["timestamp"].isoformat(),
            "bot": r["bot"],
            "cash": float(r["cash"]) if r["cash"] else 0,
            "positions_value": float(r["positions_value"]) if r["positions_value"] else 0,
            "total_value": float(r["total_value"]) if r["total_value"] else 0,
            "realized_pnl": float(r["realized_pnl"]) if r["realized_pnl"] else 0,
            "open_positions": r["open_positions"],
        }
        for r in rows
    ]


async def get_events(
    bot: Optional[str] = None,
    level: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """Get bot events from the database."""
    query = """
        SELECT 
            id, timestamp, bot, event_type, level, message, metadata
        FROM bot_events
        WHERE 1=1
    """
    params = []
    param_idx = 1
    
    if bot:
        query += f" AND bot = ${param_idx}"
        params.append(bot)
        param_idx += 1
    
    if level:
        query += f" AND level = ${param_idx}"
        params.append(level)
        param_idx += 1
    
    query += f" ORDER BY timestamp DESC LIMIT ${param_idx} OFFSET ${param_idx + 1}"
    params.extend([limit, offset])
    
    rows = await fetch(query, *params)
    
    return [
        {
            "id": r["id"],
            "timestamp": r["timestamp"].isoformat(),
            "bot": r["bot"],
            "event_type": r["event_type"],
            "level": r["level"],
            "message": r["message"],
            "metadata": r["metadata"],
        }
        for r in rows
    ]


async def get_stats() -> dict:
    """Get aggregate stats from the database."""
    # Total trades
    trades_row = await fetchone("SELECT COUNT(*) as count, COALESCE(SUM(pnl), 0) as total_pnl FROM trades")

    # Trades by bot
    trades_by_bot = await fetch("""
        SELECT bot, COUNT(*) as count, COALESCE(SUM(pnl), 0) as pnl
        FROM trades
        GROUP BY bot
    """)

    # Total decisions
    decisions_row = await fetchone("""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN decision = 'TAKEN' THEN 1 ELSE 0 END) as taken,
            SUM(CASE WHEN decision = 'SKIPPED' THEN 1 ELSE 0 END) as skipped
        FROM decisions
    """)

    return {
        "trades": {
            "count": trades_row["count"] if trades_row else 0,
            "total_pnl": float(trades_row["total_pnl"]) if trades_row else 0,
            "by_bot": {
                r["bot"]: {"count": r["count"], "pnl": float(r["pnl"])}
                for r in trades_by_bot
            } if trades_by_bot else {},
        },
        "decisions": {
            "total": decisions_row["total"] if decisions_row else 0,
            "taken": decisions_row["taken"] if decisions_row else 0,
            "skipped": decisions_row["skipped"] if decisions_row else 0,
        } if decisions_row else {},
    }


async def get_pnl_history(
    bot: Optional[str] = None,
    hours: int = 24,
) -> list[dict]:
    """
    Get cumulative P&L over time from portfolio snapshots.
    Returns data points suitable for charting.
    """
    since = datetime.utcnow() - timedelta(hours=hours)

    query = """
        SELECT
            timestamp, bot, total_value, realized_pnl
        FROM portfolio_snapshots
        WHERE timestamp > $1
    """
    params = [since]
    param_idx = 2

    if bot:
        query += f" AND bot = ${param_idx}"
        params.append(bot)

    query += " ORDER BY timestamp ASC"

    rows = await fetch(query, *params)

    return [
        {
            "timestamp": r["timestamp"].isoformat(),
            "bot": r["bot"],
            "total_value": float(r["total_value"]) if r["total_value"] else 1000,
            "realized_pnl": float(r["realized_pnl"]) if r["realized_pnl"] else 0,
        }
        for r in rows
    ]


async def get_win_rate_stats(bot: Optional[str] = None) -> dict:
    """
    Calculate win rate statistics from trades.
    A 'win' is a trade with positive P&L.
    """
    query = """
        SELECT
            bot,
            COUNT(*) as total_trades,
            SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
            SUM(CASE WHEN pnl = 0 THEN 1 ELSE 0 END) as breakeven,
            COALESCE(SUM(pnl), 0) as total_pnl,
            COALESCE(AVG(pnl), 0) as avg_pnl,
            COALESCE(MAX(pnl), 0) as best_trade,
            COALESCE(MIN(pnl), 0) as worst_trade,
            COALESCE(SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0) as gross_profit,
            COALESCE(SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END), 0) as gross_loss
        FROM trades
        WHERE action IN ('EXIT', 'SETTLE', 'SNIPE_FILL')
    """
    params = []

    if bot:
        query += " AND bot = $1"
        params.append(bot)

    query += " GROUP BY bot"

    rows = await fetch(query, *params)

    result = {}
    for r in rows:
        total = r["total_trades"] or 0
        wins = r["wins"] or 0
        win_rate = (wins / total * 100) if total > 0 else 0

        # Calculate profit factor (gross profit / abs(gross loss))
        gross_profit = float(r["gross_profit"]) if r["gross_profit"] else 0
        gross_loss = abs(float(r["gross_loss"])) if r["gross_loss"] else 0
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else gross_profit

        result[r["bot"]] = {
            "total_trades": total,
            "wins": wins,
            "losses": r["losses"] or 0,
            "breakeven": r["breakeven"] or 0,
            "win_rate": round(win_rate, 2),
            "total_pnl": round(float(r["total_pnl"]), 2) if r["total_pnl"] else 0,
            "avg_pnl": round(float(r["avg_pnl"]), 2) if r["avg_pnl"] else 0,
            "best_trade": round(float(r["best_trade"]), 2) if r["best_trade"] else 0,
            "worst_trade": round(float(r["worst_trade"]), 2) if r["worst_trade"] else 0,
            "profit_factor": round(profit_factor, 2),
        }

    return result


async def get_top_trades(
    bot: Optional[str] = None,
    limit: int = 5,
) -> dict:
    """Get best and worst trades."""
    base_query = """
        SELECT
            timestamp, bot, market_slug, asset, outcome,
            action, price, quantity, value, pnl, reason
        FROM trades
        WHERE action IN ('EXIT', 'SETTLE', 'SNIPE_FILL')
    """
    params = []
    param_idx = 1

    if bot:
        base_query += f" AND bot = ${param_idx}"
        params.append(bot)
        param_idx += 1

    # Best trades
    best_query = base_query + f" ORDER BY pnl DESC LIMIT ${param_idx}"
    best_rows = await fetch(best_query, *params, limit)

    # Worst trades
    worst_query = base_query + f" ORDER BY pnl ASC LIMIT ${param_idx}"
    worst_rows = await fetch(worst_query, *params, limit)

    def format_trade(r):
        return {
            "timestamp": r["timestamp"].isoformat(),
            "bot": r["bot"],
            "market_slug": r["market_slug"],
            "asset": r["asset"],
            "outcome": r["outcome"],
            "action": r["action"],
            "price": float(r["price"]) if r["price"] else 0,
            "pnl": float(r["pnl"]) if r["pnl"] else 0,
            "reason": r["reason"],
        }

    return {
        "best": [format_trade(r) for r in best_rows],
        "worst": [format_trade(r) for r in worst_rows],
    }


async def get_decision_breakdown(bot: Optional[str] = None) -> dict:
    """Get breakdown of decisions by reason."""
    query = """
        SELECT
            bot,
            decision,
            reason,
            COUNT(*) as count
        FROM decisions
        WHERE 1=1
    """
    params = []
    param_idx = 1

    if bot:
        query += f" AND bot = ${param_idx}"
        params.append(bot)

    query += " GROUP BY bot, decision, reason ORDER BY count DESC"

    rows = await fetch(query, *params)

    result = {}
    for r in rows:
        bot_name = r["bot"]
        if bot_name not in result:
            result[bot_name] = {"taken": {}, "skipped": {}}

        decision_type = "taken" if r["decision"] == "TAKEN" else "skipped"
        reason = r["reason"] or "unknown"
        result[bot_name][decision_type][reason] = r["count"]

    return result


async def get_hourly_performance() -> list[dict]:
    """Get P&L performance by hour of day."""
    query = """
        SELECT
            EXTRACT(HOUR FROM timestamp) as hour,
            COUNT(*) as trade_count,
            COALESCE(SUM(pnl), 0) as total_pnl,
            COALESCE(AVG(pnl), 0) as avg_pnl
        FROM trades
        WHERE action IN ('EXIT', 'SETTLE', 'SNIPE_FILL')
        GROUP BY EXTRACT(HOUR FROM timestamp)
        ORDER BY hour
    """

    rows = await fetch(query)

    return [
        {
            "hour": int(r["hour"]),
            "trade_count": r["trade_count"],
            "total_pnl": round(float(r["total_pnl"]), 2) if r["total_pnl"] else 0,
            "avg_pnl": round(float(r["avg_pnl"]), 4) if r["avg_pnl"] else 0,
        }
        for r in rows
    ]
