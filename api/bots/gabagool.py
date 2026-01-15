"""
The Gabagool - Reversion Scalping Bot (WebSocket Edition)
Detects panic crashes in Polymarket 15-min crypto markets and buys the dip.
"""

import os
import asyncio
import json
import time
import requests
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from typing import Optional, Callable, Awaitable

from services.database import get_logger, TradeLog, DecisionLog, PortfolioSnapshot, EventLog

# =============================================================================
# CONFIGURATION
# =============================================================================

CLOB_API_BASE = "https://clob.polymarket.com"
GAMMA_API_BASE = "https://gamma-api.polymarket.com"

ASSETS = ["btc", "eth", "sol", "xrp"]
POLL_INTERVAL = 1
LOOKBACK_SECONDS = 120
NO_BUY_WINDOW_SECONDS = 180

CRASH_THRESHOLD = 0.20
RECENT_HIGH_MIN = 0.35
MIN_DROP_PCT = 0.40

PROFIT_TARGET_PCT = 0.50
STOP_LOSS_PCT = 0.30

STARTING_CASH = 1000.0
MAX_POSITION_SIZE = 50.0
MAX_OPEN_POSITIONS = 3

AGGRESSIVE_MODE = False
STABILIZATION_TICKS = 3
REQUIRE_BOUNCE = True
STOP_LOSS_COOLDOWN = 120

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")


class GabagoolBot:
    """The Gabagool - Falling Knife / Crash Reversion Bot"""

    def __init__(self, broadcast_callback: Optional[Callable[[str, dict], Awaitable[None]]] = None):
        self.broadcast = broadcast_callback
        self.running = False
        self.logger = get_logger()

        # Portfolio state
        self.cash = STARTING_CASH
        self.positions_value = 0.0
        self.realized_pnl = 0.0
        self.positions = []  # List of open positions
        self.trades = []     # Trade history
        self.portfolio_history = []  # For charts

        # Price tracking
        self.price_history = defaultdict(lambda: defaultdict(list))
        self.stabilization_buffer = defaultdict(list)
        self.stop_loss_cooldowns = {}

        # Stats
        self.scan_count = 0
        self.markets_scanned = 0

    def get_state(self) -> dict:
        """Get current bot state for API/WebSocket."""
        return {
            "status": "running" if self.running else "stopped",
            "cash": round(self.cash, 2),
            "positions_value": round(self.positions_value, 2),
            "total_value": round(self.cash + self.positions_value, 2),
            "realized_pnl": round(self.realized_pnl, 2),
            "open_positions": self.positions.copy(),
            "recent_trades": self.trades[-20:],
            "scan_count": self.scan_count,
            "markets_scanned": self.markets_scanned,
            "portfolio_history": self.portfolio_history[-100:]
        }

    async def _broadcast(self, event_type: str, data: dict):
        """Broadcast an event if callback is set."""
        if self.broadcast:
            await self.broadcast(event_type, {"bot": "gabagool", **data})

    def _log(self, msg: str):
        """Log a message."""
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] [GABAGOOL] {msg}")

    def _send_slack(self, message: str):
        """Send alert to Slack."""
        if not SLACK_WEBHOOK_URL:
            return
        try:
            requests.post(SLACK_WEBHOOK_URL, json={"text": f"[GABAGOOL] {message}"}, timeout=5)
        except Exception:
            pass

    # -------------------------------------------------------------------------
    # Price History
    # -------------------------------------------------------------------------

    def _update_price_history(self, market_slug: str, outcome: str, price: float):
        now = time.time()
        history = self.price_history[market_slug][outcome]
        history.append((now, price))

        cutoff = now - LOOKBACK_SECONDS
        self.price_history[market_slug][outcome] = [(t, p) for t, p in history if t > cutoff]

        key = f"{market_slug}_{outcome}"
        self.stabilization_buffer[key].append(price)
        if len(self.stabilization_buffer[key]) > STABILIZATION_TICKS + 1:
            self.stabilization_buffer[key] = self.stabilization_buffer[key][-(STABILIZATION_TICKS + 1):]

    def _get_recent_high(self, market_slug: str, outcome: str) -> float:
        history = self.price_history[market_slug][outcome]
        return max((p for _, p in history), default=0.0)

    def _get_recent_low(self, market_slug: str, outcome: str) -> float:
        history = self.price_history[market_slug][outcome]
        return min((p for _, p in history), default=1.0)

    def _is_stabilized(self, market_slug: str, outcome: str, current_price: float) -> tuple[bool, str]:
        if AGGRESSIVE_MODE:
            return True, "aggressive_mode"

        key = f"{market_slug}_{outcome}"
        prices = self.stabilization_buffer.get(key, [])

        if len(prices) < STABILIZATION_TICKS + 1:
            return False, f"need_{STABILIZATION_TICKS + 1}_ticks"

        recent = prices[-(STABILIZATION_TICKS + 1):]
        for i in range(1, len(recent)):
            if recent[i] < recent[i-1]:
                return False, "still_falling"

        if REQUIRE_BOUNCE:
            recent_low = self._get_recent_low(market_slug, outcome)
            bounce_pct = (current_price - recent_low) / recent_low if recent_low > 0 else 0
            if bounce_pct < 0.10:
                return False, f"no_bounce_{bounce_pct*100:.0f}%"

        return True, "stabilized"

    def _is_in_cooldown(self, market_slug: str) -> tuple[bool, int]:
        if market_slug not in self.stop_loss_cooldowns:
            return False, 0

        elapsed = time.time() - self.stop_loss_cooldowns[market_slug]
        remaining = STOP_LOSS_COOLDOWN - elapsed

        if remaining <= 0:
            del self.stop_loss_cooldowns[market_slug]
            return False, 0

        return True, int(remaining)

    # -------------------------------------------------------------------------
    # Market Data
    # -------------------------------------------------------------------------

    def _fetch_15m_markets(self) -> list:
        markets = []
        now = int(time.time())
        interval = 15 * 60

        for asset in ASSETS:
            for offset in range(-1, 3):
                interval_end = ((now // interval) + offset + 1) * interval
                slug = f"{asset}-updown-15m-{interval_end}"

                try:
                    resp = requests.get(
                        f"{GAMMA_API_BASE}/events",
                        params={"slug": slug},
                        timeout=10
                    )
                    resp.raise_for_status()
                    events = resp.json()

                    if events:
                        event = events[0]
                        for market in event.get("markets", []):
                            if market.get("acceptingOrders") and not event.get("closed"):
                                try:
                                    token_ids = json.loads(market.get("clobTokenIds", "[]"))
                                    outcomes = json.loads(market.get("outcomes", "[]"))

                                    start_time_str = event.get("startTime", "")
                                    end_time = None
                                    if start_time_str:
                                        end_time = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
                                        end_time = end_time + timedelta(minutes=15)

                                    if len(token_ids) == 2 and len(outcomes) == 2:
                                        markets.append({
                                            "slug": slug,
                                            "asset": asset.upper(),
                                            "question": market.get("question", ""),
                                            "token_ids": token_ids,
                                            "outcomes": outcomes,
                                            "end_time": end_time,
                                        })
                                except (json.JSONDecodeError, ValueError):
                                    continue
                except Exception:
                    continue

        return markets

    def _fetch_orderbook(self, token_id: str) -> dict:
        try:
            resp = requests.get(f"{CLOB_API_BASE}/book", params={"token_id": token_id}, timeout=10)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return {}

    def _get_best_bid(self, orderbook: dict) -> float:
        bids = orderbook.get("bids", [])
        if bids:
            sorted_bids = sorted(bids, key=lambda x: float(x.get("price", 0)), reverse=True)
            return float(sorted_bids[0].get("price", 0))
        return 0.0

    def _get_best_ask(self, orderbook: dict) -> float:
        asks = orderbook.get("asks", [])
        if asks:
            sorted_asks = sorted(asks, key=lambda x: float(x.get("price", 999)))
            return float(sorted_asks[0].get("price", 1.0))
        return 1.0

    def _get_market_prices(self, market: dict) -> dict:
        prices = {}
        for token_id, outcome in zip(market["token_ids"], market["outcomes"]):
            book = self._fetch_orderbook(token_id)
            prices[outcome] = {
                "bid": self._get_best_bid(book),
                "ask": self._get_best_ask(book),
                "token_id": token_id
            }
        return prices

    # -------------------------------------------------------------------------
    # Strategy
    # -------------------------------------------------------------------------

    def _detect_crash(self, market: dict, outcome: str, current_price: float) -> tuple[bool, dict]:
        recent_high = self._get_recent_high(market["slug"], outcome)

        if current_price >= CRASH_THRESHOLD:
            return False, None
        if recent_high < RECENT_HIGH_MIN:
            return False, None

        drop_pct = (recent_high - current_price) / recent_high if recent_high > 0 else 0
        if drop_pct < MIN_DROP_PCT:
            return False, None

        return True, {
            "current_price": current_price,
            "recent_high": recent_high,
            "drop_pct": drop_pct
        }

    def _is_near_settlement(self, market: dict) -> bool:
        end_time = market.get("end_time")
        if not end_time:
            return False
        now = datetime.now(timezone.utc)
        time_to_end = (end_time - now).total_seconds()
        return time_to_end < NO_BUY_WINDOW_SECONDS

    async def _execute_entry(self, market: dict, outcome: str, price: float, crash_info: dict):
        value = min(MAX_POSITION_SIZE, self.cash)
        quantity = value / price
        pos_id = f"{market['asset']}_{outcome}_{int(time.time())}"

        position = {
            "id": pos_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "market_slug": market["slug"],
            "asset": market["asset"],
            "outcome": outcome,
            "entry_price": round(price, 4),
            "quantity": round(quantity, 2),
            "status": "OPEN"
        }
        self.positions.append(position)

        trade = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "market_slug": market["slug"],
            "asset": market["asset"],
            "outcome": outcome,
            "side": "BUY",
            "price": round(price, 4),
            "quantity": round(quantity, 2),
            "value": round(value, 4),
            "pnl": 0,
            "reason": f"CRASH_{crash_info['drop_pct']*100:.0f}%"
        }
        self.trades.append(trade)

        self.cash -= value
        self.positions_value += value

        self._log(f"BUY {market['asset']} {outcome} @ ${price:.2f} | Size: ${value:.2f}")
        self._send_slack(f"BUY {market['asset']} {outcome} @ ${price:.2f} | Crash: {crash_info['drop_pct']*100:.0f}%")

        # Log trade to database
        self.logger.log_trade(TradeLog(
            bot="gabagool",
            action="ENTRY",
            market_slug=market["slug"],
            asset=market["asset"],
            outcome=outcome,
            side="BUY",
            price=round(price, 4),
            quantity=round(quantity, 2),
            value=round(value, 4),
            pnl=0,
            reason=f"CRASH_{crash_info['drop_pct']*100:.0f}%",
            metadata={"crash_info": crash_info}
        ))

        await self._broadcast("trade", trade)
        await self._broadcast("state_update", self.get_state())

    async def _execute_exit(self, pos: dict, exit_price: float, reason: str):
        entry_value = pos["entry_price"] * pos["quantity"]
        exit_value = exit_price * pos["quantity"]
        pnl = exit_value - entry_value
        pnl_pct = (exit_price - pos["entry_price"]) / pos["entry_price"] if pos["entry_price"] > 0 else 0

        # Update position
        for p in self.positions:
            if p["id"] == pos["id"]:
                p["status"] = "CLOSED"
                p["exit_price"] = round(exit_price, 4)
                p["pnl"] = round(pnl, 4)
                break

        # Remove from open positions
        self.positions = [p for p in self.positions if p["status"] == "OPEN"]

        trade = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "market_slug": pos["market_slug"],
            "asset": pos["asset"],
            "outcome": pos["outcome"],
            "side": "SELL",
            "price": round(exit_price, 4),
            "quantity": round(pos["quantity"], 2),
            "value": round(exit_value, 4),
            "pnl": round(pnl, 4),
            "reason": reason
        }
        self.trades.append(trade)

        self.cash += exit_value
        self.positions_value -= entry_value
        self.realized_pnl += pnl

        if reason == "STOP_LOSS":
            self.stop_loss_cooldowns[pos["market_slug"]] = time.time()

        emoji = "PROFIT" if pnl > 0 else "LOSS"
        self._log(f"SELL {pos['asset']} {pos['outcome']} @ ${exit_price:.2f} | P&L: ${pnl:+.2f} ({pnl_pct*100:+.1f}%) | {reason}")
        self._send_slack(f"{emoji}: {pos['asset']} {pos['outcome']} | P&L: ${pnl:+.2f} ({pnl_pct*100:+.1f}%) | {reason}")

        # Log trade to database
        self.logger.log_trade(TradeLog(
            bot="gabagool",
            action="EXIT",
            market_slug=pos["market_slug"],
            asset=pos["asset"],
            outcome=pos["outcome"],
            side="SELL",
            price=round(exit_price, 4),
            quantity=round(pos["quantity"], 2),
            value=round(exit_value, 4),
            pnl=round(pnl, 4),
            reason=reason,
            metadata={"pnl_pct": round(pnl_pct, 4), "entry_price": pos["entry_price"]}
        ))

        await self._broadcast("trade", trade)
        await self._broadcast("state_update", self.get_state())

    # -------------------------------------------------------------------------
    # Main Loop
    # -------------------------------------------------------------------------

    async def run(self):
        """Main bot loop."""
        self.running = True
        self._log("Starting Gabagool bot...")
        self._send_slack("Bot started - scanning for crash opportunities")

        # Log bot start event
        self.logger.log_event(EventLog(
            bot="gabagool",
            event_type="START",
            level="INFO",
            message="Bot started - scanning for crash opportunities"
        ))

        await self._broadcast("state_update", self.get_state())

        last_status_log = 0
        last_snapshot = 0

        while self.running:
            try:
                self.scan_count += 1
                now = time.time()

                # Run blocking HTTP calls in thread pool to avoid blocking event loop
                markets = await asyncio.to_thread(self._fetch_15m_markets)
                self.markets_scanned = len(markets)

                if not markets:
                    await asyncio.sleep(POLL_INTERVAL * 5)
                    continue

                # Record portfolio history
                self.portfolio_history.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "total_value": round(self.cash + self.positions_value, 2),
                    "realized_pnl": round(self.realized_pnl, 2)
                })

                # Log portfolio snapshot to database (every 60 seconds)
                if now - last_snapshot >= 60:
                    self.logger.log_portfolio(PortfolioSnapshot(
                        bot="gabagool",
                        cash=round(self.cash, 2),
                        positions_value=round(self.positions_value, 2),
                        total_value=round(self.cash + self.positions_value, 2),
                        realized_pnl=round(self.realized_pnl, 2),
                        open_positions=len([p for p in self.positions if p["status"] == "OPEN"])
                    ))
                    last_snapshot = now

                # Check exits first
                open_positions = [p for p in self.positions if p["status"] == "OPEN"]
                for market in markets:
                    prices = await asyncio.to_thread(self._get_market_prices, market)

                    for pos in open_positions:
                        if pos["market_slug"] != market["slug"]:
                            continue

                        current_bid = prices.get(pos["outcome"], {}).get("bid", 0)
                        if not current_bid:
                            continue

                        entry_price = pos["entry_price"]
                        pnl_pct = (current_bid - entry_price) / entry_price if entry_price > 0 else 0

                        reason = None
                        if pnl_pct >= PROFIT_TARGET_PCT:
                            reason = "PROFIT_TARGET"
                        elif pnl_pct <= -STOP_LOSS_PCT:
                            reason = "STOP_LOSS"
                        elif market.get("end_time"):
                            time_to_end = (market["end_time"] - datetime.now(timezone.utc)).total_seconds()
                            if time_to_end < 60:
                                reason = "SETTLEMENT"

                        if reason:
                            await self._execute_exit(pos, current_bid, reason)

                # Check entries
                open_positions = [p for p in self.positions if p["status"] == "OPEN"]
                if len(open_positions) < MAX_OPEN_POSITIONS and self.cash >= MAX_POSITION_SIZE:
                    position_slugs = {p["market_slug"] for p in open_positions}

                    for market in markets:
                        if market["slug"] in position_slugs:
                            continue
                        if self._is_near_settlement(market):
                            continue
                        in_cooldown, _ = self._is_in_cooldown(market["slug"])
                        if in_cooldown:
                            continue

                        prices = await asyncio.to_thread(self._get_market_prices, market)

                        for outcome in market["outcomes"]:
                            current_ask = prices[outcome]["ask"]
                            self._update_price_history(market["slug"], outcome, current_ask)

                            is_crash, crash_info = self._detect_crash(market, outcome, current_ask)
                            if is_crash:
                                is_stable, reason = self._is_stabilized(market["slug"], outcome, current_ask)
                                if is_stable:
                                    await self._execute_entry(market, outcome, current_ask, crash_info)
                                    break

                        if len([p for p in self.positions if p["status"] == "OPEN"]) >= MAX_OPEN_POSITIONS:
                            break
                        if self.cash < MAX_POSITION_SIZE:
                            break

                # Periodic status broadcast
                if now - last_status_log > 10:
                    await self._broadcast("state_update", self.get_state())
                    last_status_log = now

                await asyncio.sleep(POLL_INTERVAL)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self._log(f"Error: {e}")
                # Log error to database
                self.logger.log_event(EventLog(
                    bot="gabagool",
                    event_type="ERROR",
                    level="ERROR",
                    message=str(e)
                ))
                await asyncio.sleep(POLL_INTERVAL * 3)

        self.running = False
        self._log("Bot stopped")

        # Log bot stop event
        self.logger.log_event(EventLog(
            bot="gabagool",
            event_type="STOP",
            level="INFO",
            message="Bot stopped"
        ))

        await self._broadcast("state_update", self.get_state())

    def stop(self):
        """Stop the bot."""
        self.running = False
