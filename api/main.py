"""
Poly Trading Bots - FastAPI Backend
Real-time WebSocket server for bot monitoring.
"""

import asyncio
import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
import csv
import io
from pathlib import Path
import httpx

from websocket_manager import manager

# Optional Redis for synth-arb real-time updates
try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    print("[WARN] redis package not installed, synth-arb real-time updates disabled")
from bots.gabagool import GabagoolBot
from bots.clipper import ClipperBot
from bots.sniper import SniperBot
from auth import (
    OTPRequest, OTPVerify, TokenResponse,
    request_otp, authenticate, verify_token
)
from services.database import (
    start_logger, stop_logger, get_logger,
    get_trades, get_decisions, get_events, get_stats,
    get_pnl_history, get_win_rate_stats, get_top_trades,
    get_decision_breakdown, get_hourly_performance, get_portfolio_history,
)

# =============================================================================
# BOT INSTANCES
# =============================================================================

gabagool_bot = None
clipper_bot = None
sniper_bot = None
bot_tasks = []

# Synth-arb state (updated via Redis subscription)
synth_arb_state = {
    "status": "unknown",
    "cash": "0",
    "total_value": "0",
    "realized_pnl": "0",
    "total_exposure": "0",
    "open_positions": [],
    "trades_count": 0,
    "wins": 0,
    "losses": 0,
    "win_rate": 0.0,
}

# Synth-arb Rust bot URL
SYNTH_ARB_URL = os.getenv("SYNTH_ARB_URL", "http://localhost:8001")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


async def broadcast_event(event_type: str, data: dict):
    """Broadcast an event to all connected WebSocket clients."""
    await manager.broadcast({
        "type": event_type,
        **data
    })


async def synth_arb_redis_subscriber():
    """Subscribe to Rust trading engine Redis channels for real-time updates.

    Rust engine publishes to:
    - poly:state   - Engine state updates (every minute)
    - poly:signals - Trade signals
    - poly:trades  - Executed trades
    - poly:errors  - Error notifications
    """
    global synth_arb_state

    if not REDIS_AVAILABLE:
        print("[POLY-RUST] Redis not available, skipping subscription")
        return

    try:
        redis = await aioredis.from_url(REDIS_URL)
        pubsub = redis.pubsub()

        # Subscribe to all Rust engine channels
        channels = ["poly:state", "poly:signals", "poly:trades", "poly:errors"]
        await pubsub.subscribe(*channels)
        print(f"[POLY-RUST] Subscribed to Redis channels: {channels}")

        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    channel = message["channel"]
                    if isinstance(channel, bytes):
                        channel = channel.decode("utf-8")

                    data = json.loads(message["data"])

                    if channel == "poly:state":
                        # Update local state from Rust engine state
                        synth_arb_state = {
                            "status": data.get("status", "unknown"),
                            "markets_tracked": data.get("markets_tracked", 0),
                            "opportunities_found": data.get("opportunities_found", 0),
                            "daily_pnl": str(data.get("daily_pnl", 0)),
                            "daily_trades": data.get("daily_trades", 0),
                            "positions": data.get("positions", []),
                            "timestamp_ms": data.get("timestamp_ms", 0),
                        }
                        # Broadcast to WebSocket clients
                        await manager.broadcast({
                            "type": "state_update",
                            "bot": "poly-rust",
                            "data": synth_arb_state
                        })

                    elif channel == "poly:signals":
                        # Broadcast signal to WebSocket clients
                        await manager.broadcast({
                            "type": "signal",
                            "bot": "poly-rust",
                            "data": data
                        })

                    elif channel == "poly:trades":
                        # Broadcast trade to WebSocket clients
                        await manager.broadcast({
                            "type": "trade",
                            "bot": "poly-rust",
                            "data": data
                        })

                    elif channel == "poly:errors":
                        # Broadcast error to WebSocket clients
                        await manager.broadcast({
                            "type": "error",
                            "bot": "poly-rust",
                            "data": data
                        })

                except json.JSONDecodeError:
                    pass
                except Exception as e:
                    print(f"[POLY-RUST] Error processing message: {e}")

    except Exception as e:
        print(f"[POLY-RUST] Redis subscription error: {e}")
        print("[POLY-RUST] Will retry connection in 5 seconds...")
        await asyncio.sleep(5)
        asyncio.create_task(synth_arb_redis_subscriber())


# =============================================================================
# LIFESPAN
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    global gabagool_bot, clipper_bot, sniper_bot, bot_tasks

    print("=" * 60)
    print("  POLY TRADING BOTS - BACKEND SERVER")
    print("=" * 60)

    # Start async logger
    await start_logger()

    # Initialize bots with broadcast callback
    gabagool_bot = GabagoolBot(broadcast_callback=broadcast_event)
    clipper_bot = ClipperBot(broadcast_callback=broadcast_event)
    sniper_bot = SniperBot(broadcast_callback=broadcast_event)

    # Start bot tasks
    gabagool_task = asyncio.create_task(gabagool_bot.run())
    clipper_task = asyncio.create_task(clipper_bot.run())
    sniper_task = asyncio.create_task(sniper_bot.run())
    bot_tasks = [gabagool_task, clipper_task, sniper_task]

    # Start synth-arb Redis subscriber (hot path for real-time updates)
    asyncio.create_task(synth_arb_redis_subscriber())

    print("[SERVER] Bots started (Gabagool, Clipper, Sniper)")
    print("[SERVER] Poly-Rust Redis subscriber started")
    print("=" * 60)

    yield

    # Shutdown
    print("[SERVER] Shutting down...")
    gabagool_bot.stop()
    clipper_bot.stop()
    sniper_bot.stop()

    for task in bot_tasks:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    # Stop logger (flushes remaining logs to DB)
    await stop_logger()

    print("[SERVER] Shutdown complete")


# =============================================================================
# APP
# =============================================================================

app = FastAPI(
    title="Poly Trading Bots",
    description="Real-time trading bot monitoring API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# REST API ENDPOINTS
# =============================================================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


# =============================================================================
# AUTH ENDPOINTS
# =============================================================================

@app.post("/api/auth/request-otp")
async def api_request_otp(request: OTPRequest):
    """Request OTP for email."""
    try:
        print(f"[AUTH] OTP request received for: {request.email}")
        success, message = request_otp(request.email)

        if not success:
            print(f"[AUTH] OTP request failed: {message}")
            raise HTTPException(status_code=400, detail=message)

        print(f"[AUTH] OTP request successful")
        return {"message": message}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH] Unexpected error in request-otp: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/auth/verify-otp", response_model=TokenResponse)
async def api_verify_otp(request: OTPVerify):
    """Verify OTP and return token."""
    try:
        print(f"[AUTH] OTP verification for: {request.email}")
        success, token, error = authenticate(request.email, request.otp)

        if not success:
            print(f"[AUTH] OTP verification failed: {error}")
            raise HTTPException(status_code=401, detail=error)

        from datetime import datetime, timedelta
        expires_at = datetime.utcnow() + timedelta(days=30)

        print(f"[AUTH] OTP verification successful, token issued")
        return TokenResponse(token=token, expires_at=expires_at.isoformat())
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH] Unexpected error in verify-otp: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/state")
async def get_combined_state():
    """Get combined state of all bots."""
    gab_state = gabagool_bot.get_state() if gabagool_bot else {}
    clip_state = clipper_bot.get_state() if clipper_bot else {}
    snipe_state = sniper_bot.get_state() if sniper_bot else {}

    gab_value = gab_state.get("total_value", 1000)
    clip_value = clip_state.get("total_value", 1000)
    snipe_value = snipe_state.get("total_value", 1000)
    gab_pnl = gab_state.get("realized_pnl", 0)
    clip_pnl = clip_state.get("realized_pnl", 0)
    snipe_pnl = snipe_state.get("realized_pnl", 0)

    # Include synth-arb
    synth_value = float(synth_arb_state.get("total_value", "0") or "0")
    synth_pnl = float(synth_arb_state.get("realized_pnl", "0") or "0")

    return {
        "gabagool": gab_state,
        "clipper": clip_state,
        "sniper": snipe_state,
        "synth_arb": synth_arb_state,
        "combined": {
            "total_value": gab_value + clip_value + snipe_value + synth_value,
            "realized_pnl": gab_pnl + clip_pnl + snipe_pnl + synth_pnl
        }
    }



@app.get("/api/gabagool")
async def get_gabagool_state():
    """Get Gabagool bot state."""
    if gabagool_bot:
        return gabagool_bot.get_state()
    return {"error": "Bot not initialized"}


@app.get("/api/clipper")
async def get_clipper_state():
    """Get Clipper bot state."""
    if clipper_bot:
        return clipper_bot.get_state()
    return {"error": "Bot not initialized"}


@app.get("/api/sniper")
async def get_sniper_state():
    """Get Sniper bot state."""
    if sniper_bot:
        return sniper_bot.get_state()
    return {"error": "Bot not initialized"}


@app.get("/api/synth-arb")
async def get_synth_arb_state():
    """Get Synth-Arb bot state (from Rust bot via proxy or Redis cache)."""
    # Try to get fresh state from Rust bot
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{SYNTH_ARB_URL}/state")
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass

    # Fallback to cached Redis state
    return synth_arb_state


@app.get("/api/synth-arb/positions")
async def get_synth_arb_positions():
    """Get Synth-Arb open positions."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{SYNTH_ARB_URL}/positions")
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass

    return {"positions": synth_arb_state.get("open_positions", [])}


@app.get("/api/synth-arb/metrics")
async def get_synth_arb_metrics():
    """Get Synth-Arb risk metrics."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{SYNTH_ARB_URL}/metrics")
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass

    # Return default metrics if Rust bot unavailable
    return {
        "sharpe_ratio": 0.0,
        "sortino_ratio": 0.0,
        "max_drawdown": "0",
        "max_drawdown_pct": 0.0,
        "current_drawdown": "0",
        "current_drawdown_pct": 0.0,
        "win_rate": 0.0,
        "profit_factor": 0.0,
        "avg_win": "0",
        "avg_loss": "0",
        "largest_win": "0",
        "largest_loss": "0",
        "expectancy": "0",
        "consecutive_wins": 0,
        "consecutive_losses": 0,
        "max_consecutive_wins": 0,
        "max_consecutive_losses": 0,
        "trades_today": 0,
        "pnl_today": "0",
    }


from pydantic import BaseModel

class BacktestRequest(BaseModel):
    """Backtest request parameters."""
    days: int = 7
    markets: int = 20


@app.post("/api/synth-arb/backtest")
async def run_synth_arb_backtest(request: BacktestRequest):
    """Run Synth-Arb backtest with synthetic data."""
    # Validate days
    if request.days not in [7, 14, 30]:
        raise HTTPException(status_code=400, detail="Days must be 7, 14, or 30")

    try:
        # Longer timeout for backtest (can take a few seconds)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{SYNTH_ARB_URL}/backtest",
                json={"days": request.days, "markets": request.markets}
            )
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.text
                )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Backtest timed out")
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Synth-Arb bot unavailable. Make sure it's running."
        )


@app.post("/api/gabagool/stop")
async def stop_gabagool():
    """Stop Gabagool bot."""
    if gabagool_bot:
        gabagool_bot.stop()
        return {"status": "stopped"}
    return {"error": "Bot not initialized"}


@app.post("/api/clipper/stop")
async def stop_clipper():
    """Stop Clipper bot."""
    if clipper_bot:
        clipper_bot.stop()
        return {"status": "stopped"}
    return {"error": "Bot not initialized"}


@app.post("/api/sniper/stop")
async def stop_sniper():
    """Stop Sniper bot."""
    if sniper_bot:
        sniper_bot.stop()
        return {"status": "stopped"}
    return {"error": "Bot not initialized"}



@app.post("/api/gabagool/start")
async def start_gabagool():
    """Start Gabagool bot."""
    global gabagool_bot, bot_tasks
    if gabagool_bot and not gabagool_bot.running:
        task = asyncio.create_task(gabagool_bot.run())
        bot_tasks.append(task)
        return {"status": "started"}
    return {"status": "already_running"}


@app.post("/api/clipper/start")
async def start_clipper():
    """Start Clipper bot."""
    global clipper_bot, bot_tasks
    if clipper_bot and not clipper_bot.running:
        task = asyncio.create_task(clipper_bot.run())
        bot_tasks.append(task)
        return {"status": "started"}
    return {"status": "already_running"}


@app.post("/api/sniper/start")
async def start_sniper():
    """Start Sniper bot."""
    global sniper_bot, bot_tasks
    if sniper_bot and not sniper_bot.running:
        task = asyncio.create_task(sniper_bot.run())
        bot_tasks.append(task)
        return {"status": "started"}
    return {"status": "already_running"}


# =============================================================================
# WEBSOCKET ENDPOINT
# =============================================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    """WebSocket endpoint for real-time updates. Requires valid token."""

    # Verify token
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    email = verify_token(token)
    if not email:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(websocket)
    print(f"[WS] Authenticated connection from {email}")

    # Send initial state on connect
    try:
        initial_state = {
            "type": "initial_state",
            "gabagool": gabagool_bot.get_state() if gabagool_bot else {},
            "clipper": clipper_bot.get_state() if clipper_bot else {},
            "sniper": sniper_bot.get_state() if sniper_bot else {},
            "synth_arb": synth_arb_state
        }
        await websocket.send_json(initial_state)

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for any message (ping/pong handled automatically)
                data = await websocket.receive_text()
                # Echo back for ping-pong
                if data == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break

    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(websocket)


# =============================================================================
# HISTORY API (from database)
# =============================================================================

@app.get("/api/history/trades")
async def get_trade_history(
    bot: str = Query(None, description="Filter by bot name"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Get historical trades from database."""
    trades = await get_trades(bot=bot, limit=limit, offset=offset)
    return {"trades": trades, "count": len(trades)}


@app.get("/api/history/decisions")
async def get_decision_history(
    bot: str = Query(None, description="Filter by bot name"),
    decision: str = Query(None, description="Filter by decision (TAKEN/SKIPPED)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Get historical decisions from database."""
    decisions = await get_decisions(bot=bot, decision=decision, limit=limit, offset=offset)
    return {"decisions": decisions, "count": len(decisions)}


@app.get("/api/history/events")
async def get_event_history(
    bot: str = Query(None, description="Filter by bot name"),
    level: str = Query(None, description="Filter by level (INFO/TRADE/ALERT/ERROR)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Get historical bot events from database."""
    events = await get_events(bot=bot, level=level, limit=limit, offset=offset)
    return {"events": events, "count": len(events)}


@app.get("/api/history/stats")
async def get_history_stats():
    """Get aggregate stats from database."""
    stats = await get_stats()
    return stats


@app.get("/api/export/trades")
async def export_trades_csv(
    bot: str = Query(None, description="Filter by bot name"),
    limit: int = Query(10000, ge=1, le=100000),
):
    """Export trades as CSV file."""
    trades = await get_trades(bot=bot, limit=limit, offset=0)

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "timestamp", "bot", "market", "action", "side",
        "price", "quantity", "value", "pnl", "reason"
    ])

    # Data rows
    for trade in trades:
        writer.writerow([
            trade.get("timestamp", ""),
            trade.get("bot", ""),
            trade.get("market_slug", ""),
            trade.get("action", ""),
            trade.get("side", ""),
            trade.get("price", ""),
            trade.get("quantity", ""),
            trade.get("value", ""),
            trade.get("pnl", ""),
            trade.get("reason", ""),
        ])

    output.seek(0)

    from datetime import datetime
    filename = f"trades_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    if bot:
        filename = f"trades_{bot}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/logger/stats")
async def get_logger_stats():
    """Get logger stats (queue sizes, flush count, etc.)."""
    logger = get_logger()
    return logger.get_stats()


# =============================================================================
# ANALYTICS API
# =============================================================================

@app.get("/api/analytics/pnl-history")
async def get_pnl_history_endpoint(
    bot: str = Query(None, description="Filter by bot name"),
    hours: int = Query(24, ge=1, le=168, description="Hours of history"),
):
    """Get P&L history for charting."""
    data = await get_pnl_history(bot=bot, hours=hours)
    return {"data": data, "count": len(data)}


@app.get("/api/analytics/portfolio-history")
async def get_portfolio_history_endpoint(
    bot: str = Query(None, description="Filter by bot name"),
    hours: int = Query(24, ge=1, le=168, description="Hours of history"),
):
    """Get portfolio snapshots for charting."""
    data = await get_portfolio_history(bot=bot, hours=hours)
    return {"data": data, "count": len(data)}


@app.get("/api/analytics/win-rate")
async def get_win_rate_endpoint(
    bot: str = Query(None, description="Filter by bot name"),
):
    """Get win rate statistics per bot."""
    stats = await get_win_rate_stats(bot=bot)
    return stats


@app.get("/api/analytics/top-trades")
async def get_top_trades_endpoint(
    bot: str = Query(None, description="Filter by bot name"),
    limit: int = Query(5, ge=1, le=20),
):
    """Get best and worst trades."""
    trades = await get_top_trades(bot=bot, limit=limit)
    return trades


@app.get("/api/analytics/decision-breakdown")
async def get_decision_breakdown_endpoint(
    bot: str = Query(None, description="Filter by bot name"),
):
    """Get breakdown of decisions by reason."""
    breakdown = await get_decision_breakdown(bot=bot)
    return breakdown


@app.get("/api/analytics/hourly-performance")
async def get_hourly_performance_endpoint():
    """Get trading performance by hour of day."""
    data = await get_hourly_performance()
    return {"data": data}


# =============================================================================
# STRATEGY ENDPOINTS (for Rust Engine strategies)
# =============================================================================

@app.get("/api/strategy/{strategy}/stats")
async def get_strategy_stats(strategy: str):
    """Get strategy-specific statistics from Rust engine."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{SYNTH_ARB_URL}/strategy/{strategy}/stats")
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass

    # Return mock data if Rust engine unavailable
    return {
        "todayPnl": 85.30,
        "totalPnl": 2450.32,
        "trades": 23,
        "winRate": 78.0,
        "avgEdge": 0.8,
        "hitRate": 72.0,
    }


@app.get("/api/strategy/{strategy}/opportunities")
async def get_strategy_opportunities(
    strategy: str,
    limit: int = Query(20, ge=1, le=100),
):
    """Get recent arbitrage opportunities for a strategy."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(
                f"{SYNTH_ARB_URL}/strategy/{strategy}/opportunities",
                params={"limit": limit}
            )
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass

    # Return empty list if unavailable
    return []


@app.get("/api/strategy/{strategy}/depth")
async def get_strategy_depth(strategy: str):
    """Get order book depth data for strategy visualization."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{SYNTH_ARB_URL}/strategy/{strategy}/depth")
            if response.status_code == 200:
                return response.json()
    except Exception:
        pass

    # Return mock depth data if Rust engine unavailable
    return {
        "yes": {
            "bids": [
                {"price": 0.45, "size": 150},
                {"price": 0.44, "size": 200},
                {"price": 0.43, "size": 350},
                {"price": 0.42, "size": 500},
                {"price": 0.41, "size": 800},
            ],
            "asks": [
                {"price": 0.46, "size": 120},
                {"price": 0.47, "size": 180},
                {"price": 0.48, "size": 250},
                {"price": 0.49, "size": 400},
                {"price": 0.50, "size": 600},
            ],
        },
        "no": {
            "bids": [
                {"price": 0.52, "size": 180},
                {"price": 0.51, "size": 220},
                {"price": 0.50, "size": 300},
                {"price": 0.49, "size": 450},
                {"price": 0.48, "size": 700},
            ],
            "asks": [
                {"price": 0.53, "size": 100},
                {"price": 0.54, "size": 160},
                {"price": 0.55, "size": 240},
                {"price": 0.56, "size": 380},
                {"price": 0.57, "size": 550},
            ],
        },
        "market": "example-market-slug",
        "timestamp": "2025-01-15T12:00:00Z",
    }


# =============================================================================
# STATIC FILES (FRONTEND)
# =============================================================================

# Check for frontend build in multiple locations
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"  # Dev
static_dir = Path(__file__).parent / "static"  # Production (Docker)

static_path = None
if static_dir.exists():
    static_path = static_dir
elif frontend_dist.exists():
    static_path = frontend_dist

if static_path:
    assets_path = static_path / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/")
    async def serve_index():
        """Serve index.html for root."""
        return FileResponse(static_path / "index.html")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend for all non-API routes."""
        if full_path.startswith("api/") or full_path == "ws":
            return {"error": "Not found"}
        # Try to serve static file first
        file_path = static_path / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # Fallback to index.html for SPA routing
        return FileResponse(static_path / "index.html")


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
