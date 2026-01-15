"""
The Clipper - Prediction Market Arbitrage Bot (WebSocket Edition)
Detects and exploits inefficiencies where YES + NO < 100% on Polymarket.
"""

import os
import asyncio
import json
import time
import requests
from datetime import datetime, timezone
from typing import Optional, Callable, Awaitable

from services.database import get_logger, TradeLog, DecisionLog, PortfolioSnapshot, EventLog

# =============================================================================
# CONFIGURATION
# =============================================================================

CLOB_API_BASE = "https://clob.polymarket.com"
GAMMA_API_BASE = "https://gamma-api.polymarket.com"

POLL_INTERVAL = 5
MARKET_FETCH_LIMIT = 100

MIN_ARB_PCT = 0.01
SLIPPAGE_ESTIMATE = 0.001

POSITION_TIERS = [
    (0.01, 50),
    (0.02, 200),
    (0.03, 400),
    (0.04, 600),
    (0.05, 1000),
]

STARTING_CASH = 1000.0
MAX_CONCURRENT_ARBS = 5

FEE_PROTECTED_PATTERNS = [
    "-updown-15m-",
    "-updown-5m-",
    "-updown-1m-",
]

MIN_LIQUIDITY_USD = 50

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")


class ClipperBot:
    """The Clipper - Prediction Market Arbitrage Bot"""

    def __init__(self, broadcast_callback: Optional[Callable[[str, dict], Awaitable[None]]] = None):
        self.broadcast = broadcast_callback
        self.running = False
        self.logger = get_logger()

        # Portfolio state
        self.cash = STARTING_CASH
        self.locked_in_arbs = 0.0
        self.realized_pnl = 0.0
        self.positions = []  # Open arb positions
        self.trades = []     # Trade history
        self.opportunities = []  # Detected opportunities
        self.portfolio_history = []

        # Stats
        self.scan_count = 0
        self.markets_scanned = 0

    def get_state(self) -> dict:
        """Get current bot state for API/WebSocket."""
        open_positions = [p for p in self.positions if p["status"] == "OPEN"]
        return {
            "status": "running" if self.running else "stopped",
            "cash": round(self.cash, 2),
            "locked_in_arbs": round(self.locked_in_arbs, 2),
            "total_value": round(self.cash + self.locked_in_arbs, 2),
            "realized_pnl": round(self.realized_pnl, 2),
            "open_arbs": len(open_positions),
            "open_positions": open_positions,
            "recent_trades": self.trades[-20:],
            "recent_opportunities": self.opportunities[-50:],
            "scan_count": self.scan_count,
            "markets_scanned": self.markets_scanned,
            "portfolio_history": self.portfolio_history[-100:]
        }

    async def _broadcast(self, event_type: str, data: dict):
        """Broadcast an event if callback is set."""
        if self.broadcast:
            await self.broadcast(event_type, {"bot": "clipper", **data})

    def _log(self, msg: str):
        """Log a message."""
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] [CLIPPER] {msg}")

    def _send_slack(self, message: str):
        """Send alert to Slack."""
        if not SLACK_WEBHOOK_URL:
            return
        try:
            requests.post(SLACK_WEBHOOK_URL, json={"text": f"[CLIPPER] {message}"}, timeout=5)
        except Exception:
            pass

    # -------------------------------------------------------------------------
    # Market Data
    # -------------------------------------------------------------------------

    def _is_fee_protected(self, slug: str) -> bool:
        slug_lower = slug.lower()
        return any(pattern in slug_lower for pattern in FEE_PROTECTED_PATTERNS)

    def _fetch_all_markets(self) -> list:
        markets = []
        offset = 0

        while True:
            try:
                resp = requests.get(
                    f"{GAMMA_API_BASE}/markets",
                    params={
                        "closed": "false",
                        "active": "true",
                        "limit": MARKET_FETCH_LIMIT,
                        "offset": offset
                    },
                    timeout=15
                )
                resp.raise_for_status()
                batch = resp.json()

                if not batch:
                    break

                for market in batch:
                    try:
                        outcomes = json.loads(market.get("outcomes", "[]"))
                        token_ids = json.loads(market.get("clobTokenIds", "[]"))
                    except (json.JSONDecodeError, TypeError):
                        continue

                    if len(outcomes) != 2 or len(token_ids) != 2:
                        continue
                    if not market.get("acceptingOrders", False):
                        continue

                    slug = market.get("slug", "")
                    if self._is_fee_protected(slug):
                        continue

                    markets.append({
                        "slug": slug,
                        "question": market.get("question", "Unknown"),
                        "token_ids": token_ids,
                        "outcomes": outcomes,
                        "condition_id": market.get("conditionId", ""),
                        "end_date": market.get("endDate"),
                    })

                offset += MARKET_FETCH_LIMIT
                if offset > 2000:
                    break

            except Exception:
                break

        return markets

    def _fetch_orderbook(self, token_id: str) -> dict:
        try:
            resp = requests.get(f"{CLOB_API_BASE}/book", params={"token_id": token_id}, timeout=10)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return {}

    def _get_best_ask_with_liquidity(self, orderbook: dict) -> tuple[float, float]:
        asks = orderbook.get("asks", [])
        if not asks:
            return 1.0, 0.0

        sorted_asks = sorted(asks, key=lambda x: float(x.get("price", 999)))
        best = sorted_asks[0]
        price = float(best.get("price", 1.0))
        size = float(best.get("size", 0))
        liquidity_usd = size * price

        return price, liquidity_usd

    def _get_market_prices(self, market: dict) -> dict:
        prices = {}
        for token_id, outcome in zip(market["token_ids"], market["outcomes"]):
            book = self._fetch_orderbook(token_id)
            ask_price, liquidity = self._get_best_ask_with_liquidity(book)
            prices[outcome] = {
                "ask": ask_price,
                "liquidity_usd": liquidity,
                "token_id": token_id
            }
        return prices

    # -------------------------------------------------------------------------
    # Arbitrage Logic
    # -------------------------------------------------------------------------

    def _get_position_size(self, arb_pct: float) -> float:
        for min_pct, max_size in reversed(POSITION_TIERS):
            if arb_pct >= min_pct:
                return max_size
        return 0.0

    def _calculate_arb(self, yes_ask: float, no_ask: float,
                       yes_liq: float, no_liq: float) -> dict:
        total_cost_per_share = yes_ask + no_ask
        raw_arb_pct = 1.0 - total_cost_per_share
        slippage_cost = SLIPPAGE_ESTIMATE * 2
        net_arb_pct = raw_arb_pct - slippage_cost

        if net_arb_pct < MIN_ARB_PCT:
            return {
                "raw_arb_pct": raw_arb_pct,
                "net_arb_pct": net_arb_pct,
                "is_profitable": False,
                "skip_reason": "below_threshold"
            }

        max_position = self._get_position_size(net_arb_pct)
        if max_position == 0:
            return {
                "raw_arb_pct": raw_arb_pct,
                "net_arb_pct": net_arb_pct,
                "is_profitable": False,
                "skip_reason": "no_tier"
            }

        min_liquidity = min(yes_liq, no_liq)
        if min_liquidity < MIN_LIQUIDITY_USD:
            return {
                "raw_arb_pct": raw_arb_pct,
                "net_arb_pct": net_arb_pct,
                "is_profitable": False,
                "skip_reason": f"low_liquidity_{min_liquidity:.0f}"
            }

        position_size = min(max_position, min_liquidity * 0.8)
        half_position = position_size / 2
        yes_shares = half_position / (yes_ask + SLIPPAGE_ESTIMATE)
        no_shares = half_position / (no_ask + SLIPPAGE_ESTIMATE)
        total_cost = (yes_shares * (yes_ask + SLIPPAGE_ESTIMATE)) + (no_shares * (no_ask + SLIPPAGE_ESTIMATE))
        min_shares = min(yes_shares, no_shares)
        expected_payout = min_shares
        expected_pnl = expected_payout - total_cost

        return {
            "raw_arb_pct": raw_arb_pct,
            "net_arb_pct": net_arb_pct,
            "is_profitable": True,
            "position_size": position_size,
            "yes_shares": yes_shares,
            "no_shares": no_shares,
            "total_cost": total_cost,
            "expected_payout": expected_payout,
            "expected_pnl": expected_pnl,
            "min_liquidity": min_liquidity
        }

    # -------------------------------------------------------------------------
    # Execution
    # -------------------------------------------------------------------------

    async def _execute_arb_entry(self, market: dict, prices: dict, arb: dict, outcome_a: str, outcome_b: str):
        arb_id = f"ARB_{int(time.time())}_{market['slug'][:20]}"

        position = {
            "arb_id": arb_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "market_slug": market["slug"],
            "question": market["question"][:100],
            "yes_price": round(prices[outcome_a]["ask"], 4),
            "no_price": round(prices[outcome_b]["ask"], 4),
            "yes_shares": round(arb["yes_shares"], 2),
            "no_shares": round(arb["no_shares"], 2),
            "total_cost": round(arb["total_cost"], 4),
            "expected_payout": round(arb["expected_payout"], 4),
            "expected_pnl": round(arb["expected_pnl"], 4),
            "arb_pct": round(arb["net_arb_pct"], 4),
            "status": "OPEN"
        }
        self.positions.append(position)

        trade = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "arb_id": arb_id,
            "market_slug": market["slug"],
            "action": "OPEN_ARB",
            "yes_price": round(prices[outcome_a]["ask"], 4),
            "no_price": round(prices[outcome_b]["ask"], 4),
            "total_cost": round(arb["total_cost"], 4),
            "expected_pnl": round(arb["expected_pnl"], 4),
            "actual_pnl": 0,
            "arb_pct": round(arb["net_arb_pct"], 4)
        }
        self.trades.append(trade)

        self.cash -= arb["total_cost"]
        self.locked_in_arbs += arb["total_cost"]

        self._log(f"ARB OPENED: {market['slug'][:30]} | {outcome_a}=${prices[outcome_a]['ask']:.3f} + {outcome_b}=${prices[outcome_b]['ask']:.3f} | Arb: {arb['net_arb_pct']*100:.2f}%")
        self._send_slack(f"ARB OPENED\nMarket: {market['question'][:50]}...\nArb: {arb['net_arb_pct']*100:.2f}% | Expected P&L: ${arb['expected_pnl']:.2f}")

        # Log trade to database
        self.logger.log_trade(TradeLog(
            bot="clipper",
            action="OPEN_ARB",
            market_slug=market["slug"],
            price=round(arb["total_cost"], 4),
            value=round(arb["total_cost"], 4),
            pnl=0,
            reason=f"ARB_{arb['net_arb_pct']*100:.2f}%",
            metadata={
                "yes_price": round(prices[outcome_a]["ask"], 4),
                "no_price": round(prices[outcome_b]["ask"], 4),
                "arb_pct": round(arb["net_arb_pct"], 4),
                "expected_pnl": round(arb["expected_pnl"], 4),
                "question": market["question"][:100]
            }
        ))

        await self._broadcast("trade", trade)
        await self._broadcast("state_update", self.get_state())

    async def _execute_settlement(self, pos: dict, winning_outcome: str):
        actual_payout = pos["expected_payout"]
        actual_pnl = actual_payout - pos["total_cost"]

        for p in self.positions:
            if p["arb_id"] == pos["arb_id"]:
                p["status"] = "SETTLED"
                p["actual_pnl"] = round(actual_pnl, 4)
                p["settled_outcome"] = winning_outcome
                break

        trade = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "arb_id": pos["arb_id"],
            "market_slug": pos["market_slug"],
            "action": "SETTLE",
            "yes_price": pos["yes_price"],
            "no_price": pos["no_price"],
            "total_cost": pos["total_cost"],
            "expected_pnl": pos["expected_pnl"],
            "actual_pnl": round(actual_pnl, 4),
            "arb_pct": pos["arb_pct"]
        }
        self.trades.append(trade)

        self.cash += actual_payout
        self.locked_in_arbs -= pos["total_cost"]
        self.realized_pnl += actual_pnl

        emoji = "PROFIT" if actual_pnl > 0 else "LOSS"
        self._log(f"ARB SETTLED: {pos['market_slug'][:30]} | P&L: ${actual_pnl:+.2f}")
        self._send_slack(f"{emoji}: ARB SETTLED\nMarket: {pos['question'][:50]}...\nP&L: ${actual_pnl:+.2f} (Expected: ${pos['expected_pnl']:.2f})")

        # Log trade to database
        self.logger.log_trade(TradeLog(
            bot="clipper",
            action="SETTLE",
            market_slug=pos["market_slug"],
            price=round(actual_payout, 4),
            value=round(actual_payout, 4),
            pnl=round(actual_pnl, 4),
            reason="SETTLEMENT",
            metadata={
                "winning_outcome": winning_outcome,
                "expected_pnl": pos["expected_pnl"],
                "arb_pct": pos["arb_pct"]
            }
        ))

        await self._broadcast("trade", trade)
        await self._broadcast("state_update", self.get_state())

    # -------------------------------------------------------------------------
    # Main Loop
    # -------------------------------------------------------------------------

    async def run(self):
        """Main bot loop."""
        self.running = True
        self._log("Starting Clipper bot...")
        self._send_slack("Bot started - scanning for arbitrage opportunities")

        # Log bot start event
        self.logger.log_event(EventLog(
            bot="clipper",
            event_type="START",
            level="INFO",
            message="Bot started - scanning for arbitrage opportunities"
        ))

        await self._broadcast("state_update", self.get_state())

        last_status_log = 0
        last_settlement_check = 0
        last_snapshot = 0

        while self.running:
            try:
                self.scan_count += 1
                now = time.time()

                # Run blocking HTTP calls in thread pool to avoid blocking event loop
                markets = await asyncio.to_thread(self._fetch_all_markets)
                self.markets_scanned = len(markets)

                if not markets:
                    await asyncio.sleep(POLL_INTERVAL * 2)
                    continue

                # Record portfolio history
                self.portfolio_history.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "total_value": round(self.cash + self.locked_in_arbs, 2),
                    "realized_pnl": round(self.realized_pnl, 2)
                })

                # Log portfolio snapshot to database (every 60 seconds)
                if now - last_snapshot >= 60:
                    open_positions = [p for p in self.positions if p["status"] == "OPEN"]
                    self.logger.log_portfolio(PortfolioSnapshot(
                        bot="clipper",
                        cash=round(self.cash, 2),
                        positions_value=round(self.locked_in_arbs, 2),
                        total_value=round(self.cash + self.locked_in_arbs, 2),
                        realized_pnl=round(self.realized_pnl, 2),
                        open_positions=len(open_positions)
                    ))
                    last_snapshot = now

                # Check settlements
                if now - last_settlement_check > 30:
                    open_positions = [p for p in self.positions if p["status"] == "OPEN"]
                    for pos in open_positions:
                        try:
                            # Run blocking HTTP call in thread pool
                            def fetch_market_status(slug):
                                resp = requests.get(
                                    f"{GAMMA_API_BASE}/markets",
                                    params={"slug": slug},
                                    timeout=10
                                )
                                resp.raise_for_status()
                                return resp.json()

                            market_data = await asyncio.to_thread(fetch_market_status, pos["market_slug"])

                            if market_data and (market_data[0].get("closed") or market_data[0].get("resolved")):
                                try:
                                    outcome_prices = json.loads(market_data[0].get("outcomePrices", "[]"))
                                    outcomes = json.loads(market_data[0].get("outcomes", "[]"))
                                    winning = None
                                    for outcome, price in zip(outcomes, outcome_prices):
                                        if float(price) > 0.99:
                                            winning = outcome
                                            break
                                    await self._execute_settlement(pos, winning or "Unknown")
                                except Exception:
                                    pass
                        except Exception:
                            continue
                    last_settlement_check = now

                # Scan for opportunities
                open_positions = [p for p in self.positions if p["status"] == "OPEN"]
                if len(open_positions) < MAX_CONCURRENT_ARBS and self.cash >= 50:
                    position_slugs = {p["market_slug"] for p in open_positions}

                    for market in markets:
                        if market["slug"] in position_slugs:
                            continue

                        prices = await asyncio.to_thread(self._get_market_prices, market)
                        outcome_keys = list(prices.keys())
                        if len(outcome_keys) != 2:
                            continue

                        outcome_a, outcome_b = outcome_keys
                        ask_a = prices[outcome_a]["ask"]
                        ask_b = prices[outcome_b]["ask"]
                        liq_a = prices[outcome_a]["liquidity_usd"]
                        liq_b = prices[outcome_b]["liquidity_usd"]

                        arb = self._calculate_arb(ask_a, ask_b, liq_a, liq_b)

                        # Log opportunity
                        if arb["raw_arb_pct"] > 0:
                            opp = {
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "market_slug": market["slug"],
                                "question": market["question"][:80],
                                "yes_ask": round(ask_a, 4),
                                "no_ask": round(ask_b, 4),
                                "total": round(ask_a + ask_b, 4),
                                "arb_pct": round(arb["raw_arb_pct"], 4),
                                "yes_liquidity": round(liq_a, 2),
                                "no_liquidity": round(liq_b, 2),
                                "action": "TAKEN" if arb["is_profitable"] else f"SKIP:{arb.get('skip_reason', 'unknown')}"
                            }
                            self.opportunities.append(opp)
                            if len(self.opportunities) > 200:
                                self.opportunities = self.opportunities[-100:]

                            await self._broadcast("opportunity", opp)

                            # Log decision to database
                            self.logger.log_decision(DecisionLog(
                                bot="clipper",
                                decision="TAKEN" if arb["is_profitable"] else "SKIPPED",
                                market_slug=market["slug"],
                                question=market["question"][:100],
                                reason=arb.get("skip_reason", "profitable") if not arb["is_profitable"] else "arb_profitable",
                                price=round(ask_a + ask_b, 4),
                                arb_pct=round(arb["raw_arb_pct"], 4),
                                metadata={
                                    "yes_ask": round(ask_a, 4),
                                    "no_ask": round(ask_b, 4),
                                    "yes_liquidity": round(liq_a, 2),
                                    "no_liquidity": round(liq_b, 2)
                                }
                            ))

                        if arb["is_profitable"] and arb["total_cost"] <= self.cash:
                            await self._execute_arb_entry(market, prices, arb, outcome_a, outcome_b)

                            open_positions = [p for p in self.positions if p["status"] == "OPEN"]
                            if len(open_positions) >= MAX_CONCURRENT_ARBS or self.cash < 50:
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
                    bot="clipper",
                    event_type="ERROR",
                    level="ERROR",
                    message=str(e)
                ))
                await asyncio.sleep(POLL_INTERVAL * 3)

        self.running = False
        self._log("Bot stopped")

        # Log bot stop event
        self.logger.log_event(EventLog(
            bot="clipper",
            event_type="STOP",
            level="INFO",
            message="Bot stopped"
        ))

        await self._broadcast("state_update", self.get_state())

    def stop(self):
        """Stop the bot."""
        self.running = False
