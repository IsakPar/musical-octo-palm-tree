"""
The Sniper - 99¢ Garbage Collector Bot
Exploits time arbitrage by buying near-certain outcomes at a discount.

Strategy:
1. Monitor sports games via ESPN API
2. When a game ends, find matching Polymarket markets
3. Place limit buy orders at 96-97¢ for the winning outcome
4. Wait for impatient sellers to dump into our orders
5. Redeem at $1.00 when market resolves
"""

import os
import asyncio
import time
from datetime import datetime, timezone
from typing import Optional, Callable, Awaitable
from dataclasses import dataclass, field

# Local imports will be relative when running from backend/
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.sports.espn import ESPNService, GameResult
from services.sports.matcher import MarketMatcher, MarketMatch
from services.polymarket.client import PolymarketClient, OrderResult
from services.database import get_logger, TradeLog, DecisionLog, PortfolioSnapshot, EventLog


# =============================================================================
# CONFIGURATION
# =============================================================================

# Leagues to monitor
MONITORED_LEAGUES = ["NBA", "NFL"]

# Scan intervals
GAME_SCAN_INTERVAL = 30  # Check for finished games every 30s
MARKET_SCAN_INTERVAL = 10  # Check market prices every 10s

# Bidding thresholds
MIN_PRICE = 0.90  # Minimum current price to consider
MAX_PRICE = 0.97  # Maximum current price (need room for profit)
BID_PRICE = 0.96  # Our target bid price (4% profit)
MIN_CONFIDENCE = 0.85  # Minimum match confidence

# Position sizing
ORDER_SIZE = 100.0  # $100 per order
MAX_POSITION_PER_MARKET = 500.0  # Max $500 per market
MAX_TOTAL_EXPOSURE = 2000.0  # Max $2000 total across all markets

# Safety
MIN_MARGIN_OF_VICTORY = 5  # Only snipe if margin > 5 points
WAIT_AFTER_GAME_END = 30  # Wait 30s after game ends before bidding

# Slack notifications
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")


@dataclass
class SnipeOpportunity:
    """Tracked snipe opportunity."""
    id: str
    match: MarketMatch
    orders_placed: list[str] = field(default_factory=list)
    total_filled: float = 0.0
    avg_fill_price: float = 0.0
    status: str = "PENDING"  # PENDING, ACTIVE, FILLED, RESOLVED
    created_at: str = ""
    profit_realized: float = 0.0


@dataclass
class ScanResult:
    """Result of a single scan cycle for frontend visibility."""
    scan_number: int
    leagues_checked: list[str]
    games_found: list[dict]
    markets_searched: int
    opportunities_evaluated: list[dict]
    opportunities_taken: int
    opportunities_skipped: int


class SniperBot:
    """
    The Sniper - 99¢ Garbage Collector
    
    Monitors sports games, finds ending games, and bids on winning outcomes
    at a discount before markets resolve.
    """
    
    def __init__(self, broadcast_callback: Optional[Callable[[str, dict], Awaitable[None]]] = None):
        self.broadcast = broadcast_callback
        self.running = False
        self.logger = get_logger()

        # Services
        self.espn = ESPNService()
        self.matcher = MarketMatcher()
        self.polymarket = PolymarketClient()

        # State
        self.active_snipes: dict[str, SnipeOpportunity] = {}
        self.completed_snipes: list[SnipeOpportunity] = []
        self.seen_games: set[str] = set()  # Track games we've already processed

        # Stats
        self.scan_count = 0
        self.games_checked = 0
        self.opportunities_found = 0
        self.orders_placed = 0
        self.total_exposure = 0.0
        self.realized_pnl = 0.0

        # Portfolio
        self.cash = 1000.0
        self.portfolio_history = []
    
    def get_state(self) -> dict:
        """Get current bot state for API/WebSocket."""
        return {
            "status": "running" if self.running else "stopped",
            "cash": round(self.cash, 2),
            "total_exposure": round(self.total_exposure, 2),
            "total_value": round(self.cash + self.total_exposure, 2),
            "realized_pnl": round(self.realized_pnl, 2),
            "active_snipes": len(self.active_snipes),
            "completed_snipes": len(self.completed_snipes),
            "scan_count": self.scan_count,
            "games_checked": self.games_checked,
            "opportunities_found": self.opportunities_found,
            "orders_placed": self.orders_placed,
            "active_positions": [
                {
                    "id": s.id,
                    "market": s.match.market_question[:60],
                    "game": f"{s.match.game_result.away_team} @ {s.match.game_result.home_team}",
                    "winner": s.match.game_result.winner,
                    "bid_price": BID_PRICE,
                    "filled": s.total_filled,
                    "expected_profit": round((1 - s.avg_fill_price) * s.total_filled, 2) if s.avg_fill_price > 0 else 0,
                    "status": s.status,
                }
                for s in self.active_snipes.values()
            ],
            "recent_snipes": [
                {
                    "id": s.id,
                    "market": s.match.market_question[:60],
                    "filled": s.total_filled,
                    "profit": s.profit_realized,
                    "status": s.status,
                }
                for s in self.completed_snipes[-10:]
            ],
            "portfolio_history": self.portfolio_history[-100:],
        }
    
    async def _broadcast(self, event_type: str, data: dict):
        """Broadcast an event if callback is set."""
        if self.broadcast:
            await self.broadcast(event_type, {"bot": "sniper", **data})
    
    def _log(self, msg: str):
        """Log a message."""
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] [SNIPER] {msg}")
    
    def _send_slack(self, message: str):
        """Send alert to Slack."""
        if not SLACK_WEBHOOK_URL:
            return
        try:
            import requests
            requests.post(SLACK_WEBHOOK_URL, json={"text": f"🎯 [SNIPER] {message}"}, timeout=5)
        except Exception:
            pass

    async def _broadcast_scan_activity(self, scan_result: ScanResult):
        """Broadcast scan activity to frontend for visibility."""
        await self._broadcast("scan_activity", {
            "scan_number": scan_result.scan_number,
            "leagues_checked": scan_result.leagues_checked,
            "games_found": scan_result.games_found,
            "markets_searched": scan_result.markets_searched,
            "opportunities_evaluated": scan_result.opportunities_evaluated,
            "opportunities_taken": scan_result.opportunities_taken,
            "opportunities_skipped": scan_result.opportunities_skipped,
        })

    # -------------------------------------------------------------------------
    # Game Monitoring
    # -------------------------------------------------------------------------
    
    def _get_finished_games(self) -> list[GameResult]:
        """Get all finished games across monitored leagues."""
        all_games = []
        
        for league in MONITORED_LEAGUES:
            try:
                games = self.espn.get_final_games(league)
                all_games.extend(games)
                self.games_checked += len(games)
            except Exception as e:
                self._log(f"Error fetching {league} games: {e}")
        
        # Filter out games we've already processed
        new_games = [g for g in all_games if g.game_id not in self.seen_games]
        
        # Filter by margin of victory
        quality_games = [g for g in new_games if g.margin >= MIN_MARGIN_OF_VICTORY]
        
        return quality_games
    
    # -------------------------------------------------------------------------
    # Opportunity Finding
    # -------------------------------------------------------------------------
    
    def _find_opportunities(self, games: list[GameResult]) -> tuple[list[MarketMatch], list[dict]]:
        """Find snipeable market opportunities from finished games.

        Returns:
            Tuple of (opportunities, all_evaluations) for frontend visibility
        """
        # Fetch sports markets
        sports_markets = []
        for league in MONITORED_LEAGUES:
            markets = self.polymarket.get_sports_markets(league)
            sports_markets.extend(markets)

        if not sports_markets:
            return [], []

        opportunities = []
        evaluations = []

        for game in games:
            for market in sports_markets:
                # Try to match this game to this market
                match = self.matcher.match_game_to_market(game, market)

                evaluation = {
                    "market_slug": market.get("slug", "")[:50],
                    "question": market.get("question", "")[:80],
                    "game": f"{game.away_team} @ {game.home_team}",
                    "confidence": 0.0,
                    "current_price": 0.0,
                    "decision": "SKIPPED",
                    "skip_reason": None,
                }

                if not match:
                    evaluation["skip_reason"] = "no_team_match"
                    evaluations.append(evaluation)
                    continue

                evaluation["confidence"] = round(match.confidence, 2)
                evaluation["current_price"] = round(match.current_price, 3)

                if match.confidence < MIN_CONFIDENCE:
                    evaluation["skip_reason"] = f"low_confidence ({match.confidence:.0%})"
                    evaluations.append(evaluation)
                    continue

                if match.current_price < MIN_PRICE:
                    evaluation["skip_reason"] = f"price_too_low (${match.current_price:.2f})"
                    evaluations.append(evaluation)
                    continue

                if match.current_price > MAX_PRICE:
                    evaluation["skip_reason"] = f"price_too_high (${match.current_price:.2f})"
                    evaluations.append(evaluation)
                    continue

                # Valid opportunity!
                evaluation["decision"] = "TAKEN"
                evaluations.append(evaluation)
                opportunities.append(match)

        # Sort by expected profit
        opportunities.sort(key=lambda x: x.expected_profit_pct if hasattr(x, 'expected_profit_pct') else 0, reverse=True)

        return opportunities, evaluations
    
    # -------------------------------------------------------------------------
    # Order Placement
    # -------------------------------------------------------------------------
    
    async def _execute_snipe(self, match: MarketMatch):
        """Place limit buy orders for a snipe opportunity."""
        # Check exposure limits
        if self.total_exposure >= MAX_TOTAL_EXPOSURE:
            self._log(f"Skipping {match.market_slug[:30]} - max exposure reached")
            return
        
        # Calculate order size
        remaining_capacity = min(
            MAX_POSITION_PER_MARKET,
            MAX_TOTAL_EXPOSURE - self.total_exposure,
            self.cash,
        )
        
        if remaining_capacity < ORDER_SIZE:
            self._log(f"Skipping {match.market_slug[:30]} - insufficient capacity")
            return
        
        order_size = min(ORDER_SIZE, remaining_capacity)
        
        # Create snipe opportunity
        snipe_id = f"SNIPE_{int(time.time())}_{match.market_slug[:20]}"
        snipe = SnipeOpportunity(
            id=snipe_id,
            match=match,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        
        # Place limit order
        result = self.polymarket.place_limit_order(
            token_id=match.winning_token_id,
            side="BUY",
            price=BID_PRICE,
            size=order_size / BID_PRICE,  # Convert $ to shares
        )
        
        if result.success:
            snipe.orders_placed.append(result.order_id or "")
            snipe.status = "ACTIVE"
            
            self.active_snipes[snipe_id] = snipe
            self.orders_placed += 1
            self.opportunities_found += 1
            
            # Update accounting (estimate, actual will update on fill)
            self.cash -= order_size
            self.total_exposure += order_size
            
            self._log(f"SNIPE PLACED: {match.game_result.winner} wins | Bid ${BID_PRICE} x {order_size/BID_PRICE:.1f} shares")
            self._send_slack(
                f"SNIPE PLACED\n"
                f"Game: {match.game_result.away_team} @ {match.game_result.home_team}\n"
                f"Winner: {match.game_result.winner} ({match.game_result.margin} pts)\n"
                f"Market: {match.market_question[:50]}...\n"
                f"Bid: ${BID_PRICE} x {order_size:.0f}"
            )

            # Log trade to database
            self.logger.log_trade(TradeLog(
                bot="sniper",
                action="SNIPE_PLACED",
                market_slug=match.market_slug,
                price=BID_PRICE,
                quantity=round(order_size / BID_PRICE, 2),
                value=round(order_size, 4),
                pnl=0,
                reason=f"SNIPE_{match.game_result.winner}",
                metadata={
                    "game": f"{match.game_result.away_team} @ {match.game_result.home_team}",
                    "winner": match.game_result.winner,
                    "margin": match.game_result.margin,
                    "confidence": match.confidence,
                    "question": match.market_question[:100]
                }
            ))

            # Log decision to database
            self.logger.log_decision(DecisionLog(
                bot="sniper",
                decision="TAKEN",
                market_slug=match.market_slug,
                question=match.market_question[:100],
                reason=f"margin_{match.game_result.margin}pts",
                price=match.current_price,
                arb_pct=1.0 - BID_PRICE,  # Expected profit margin
                metadata={
                    "game_id": match.game_result.game_id,
                    "winner": match.game_result.winner,
                    "confidence": match.confidence
                }
            ))

            await self._broadcast("trade", {
                "action": "SNIPE_PLACED",
                "market": match.market_question[:60],
                "winner": match.game_result.winner,
                "bid_price": BID_PRICE,
                "size": order_size,
            })
        else:
            self._log(f"Order failed: {result.error}")
        
        # Mark game as seen
        self.seen_games.add(match.game_result.game_id)
    
    # -------------------------------------------------------------------------
    # Position Monitoring
    # -------------------------------------------------------------------------
    
    async def _check_fills(self):
        """Check for filled orders and update positions."""
        for snipe_id, snipe in list(self.active_snipes.items()):
            for order_id in snipe.orders_placed:
                if not order_id:
                    continue
                
                status = self.polymarket.get_order_status(order_id)
                
                if "error" in status:
                    continue
                
                filled = float(status.get("amountFilled", 0))
                if filled > snipe.total_filled:
                    new_fill = filled - snipe.total_filled
                    snipe.total_filled = filled
                    snipe.avg_fill_price = BID_PRICE  # Simplified

                    self._log(f"FILL: +{new_fill:.1f} shares @ ${BID_PRICE}")

                    # Log fill to database
                    self.logger.log_trade(TradeLog(
                        bot="sniper",
                        action="SNIPE_FILL",
                        market_slug=snipe.match.market_slug,
                        price=BID_PRICE,
                        quantity=round(new_fill, 2),
                        value=round(new_fill * BID_PRICE, 4),
                        pnl=0,
                        reason="ORDER_FILL",
                        metadata={
                            "snipe_id": snipe_id,
                            "total_filled": filled
                        }
                    ))

                    await self._broadcast("trade", {
                        "action": "SNIPE_FILL",
                        "snipe_id": snipe_id,
                        "filled": new_fill,
                        "total_filled": filled,
                    })
    
    async def _check_resolutions(self):
        """Check if any active snipes have resolved."""
        # This would check market resolution status
        # For now, this is a placeholder
        pass
    
    # -------------------------------------------------------------------------
    # Main Loop
    # -------------------------------------------------------------------------
    
    async def run(self):
        """Main bot loop."""
        self.running = True
        self._log("Starting Sniper bot...")
        self._send_slack("Bot started - hunting for 99¢ opportunities")

        # Log bot start event
        self.logger.log_event(EventLog(
            bot="sniper",
            event_type="START",
            level="INFO",
            message="Bot started - hunting for 99¢ opportunities"
        ))

        await self._broadcast("state_update", self.get_state())

        last_game_scan = 0
        last_status_log = 0
        last_snapshot = 0
        
        while self.running:
            try:
                self.scan_count += 1
                now = time.time()
                
                # Scan for finished games periodically
                if now - last_game_scan >= GAME_SCAN_INTERVAL:
                    # Run blocking call in thread
                    games = await asyncio.to_thread(self._get_finished_games)

                    # Prepare scan result for frontend
                    scan_result = ScanResult(
                        scan_number=self.scan_count,
                        leagues_checked=MONITORED_LEAGUES.copy(),
                        games_found=[],
                        markets_searched=0,
                        opportunities_evaluated=[],
                        opportunities_taken=0,
                        opportunities_skipped=0,
                    )

                    # Always log scan activity for visibility
                    if games:
                        self._log(f"Found {len(games)} new finished games with margin >= {MIN_MARGIN_OF_VICTORY}")
                        for game in games:
                            self._log(f"  → {game.away_team} @ {game.home_team}: {game.winner} wins by {game.margin}")
                            scan_result.games_found.append({
                                "game_id": game.game_id,
                                "matchup": f"{game.away_team} @ {game.home_team}",
                                "winner": game.winner,
                                "margin": game.margin,
                                "league": game.league,
                            })

                        # Find opportunities with evaluations
                        opportunities, evaluations = await asyncio.to_thread(self._find_opportunities, games)

                        # Update scan result with evaluation details
                        scan_result.markets_searched = len(evaluations)
                        # Only include interesting evaluations (not no_team_match spam)
                        scan_result.opportunities_evaluated = [
                            e for e in evaluations if e["skip_reason"] != "no_team_match"
                        ][:20]  # Limit to 20 most relevant
                        scan_result.opportunities_taken = len([e for e in evaluations if e["decision"] == "TAKEN"])
                        scan_result.opportunities_skipped = len([e for e in evaluations if e["decision"] == "SKIPPED"])

                        if opportunities:
                            self._log(f"Found {len(opportunities)} snipeable opportunities!")
                            for match in opportunities:
                                self._log(f"  → {match.market_question[:50]}... @ ${match.current_price:.3f}")
                                await self._execute_snipe(match)
                        else:
                            self._log(f"No matching Polymarket markets found for these games")
                    else:
                        # Log that we scanned but found nothing - so user knows bot is alive
                        self._log(f"Scan #{self.scan_count}: No finished games right now (checked {', '.join(MONITORED_LEAGUES)})")

                    # Log scan to database (every 5th scan to avoid spam)
                    if self.scan_count % 5 == 0:
                        self.logger.log_event(EventLog(
                            bot="sniper",
                            event_type="SCAN",
                            level="INFO",
                            message=f"Scan #{self.scan_count}: {len(games)} finished games found, {self.games_checked} total checked",
                            metadata={"leagues": MONITORED_LEAGUES, "games_found": len(games)}
                        ))

                    # Broadcast scan activity to frontend
                    await self._broadcast_scan_activity(scan_result)

                    last_game_scan = now
                
                # Check for fills
                await self._check_fills()
                
                # Check for resolutions
                await self._check_resolutions()
                
                # Record portfolio history
                self.portfolio_history.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "total_value": round(self.cash + self.total_exposure, 2),
                    "realized_pnl": round(self.realized_pnl, 2),
                })

                # Log portfolio snapshot to database (every 60 seconds)
                if now - last_snapshot >= 60:
                    self.logger.log_portfolio(PortfolioSnapshot(
                        bot="sniper",
                        cash=round(self.cash, 2),
                        positions_value=round(self.total_exposure, 2),
                        total_value=round(self.cash + self.total_exposure, 2),
                        realized_pnl=round(self.realized_pnl, 2),
                        open_positions=len(self.active_snipes)
                    ))
                    last_snapshot = now

                # Periodic status broadcast
                if now - last_status_log > 10:
                    await self._broadcast("state_update", self.get_state())
                    last_status_log = now

                await asyncio.sleep(MARKET_SCAN_INTERVAL)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self._log(f"Error: {e}")
                # Log error to database
                self.logger.log_event(EventLog(
                    bot="sniper",
                    event_type="ERROR",
                    level="ERROR",
                    message=str(e)
                ))
                import traceback
                traceback.print_exc()
                await asyncio.sleep(GAME_SCAN_INTERVAL)

        self.running = False
        self._log("Bot stopped")

        # Log bot stop event
        self.logger.log_event(EventLog(
            bot="sniper",
            event_type="STOP",
            level="INFO",
            message="Bot stopped"
        ))

        await self._broadcast("state_update", self.get_state())
    
    def stop(self):
        """Stop the bot."""
        self.running = False


# For testing
if __name__ == "__main__":
    import asyncio
    
    async def main():
        bot = SniperBot()
        
        print("Testing Sniper Bot...")
        print("=" * 60)
        
        # Test ESPN integration
        print("\n--- Testing ESPN ---")
        for league in ["NBA", "NFL"]:
            games = bot.espn.get_final_games(league)
            print(f"{league}: {len(games)} finished games")
            for game in games[:3]:
                print(f"  {game.away_team} @ {game.home_team}: {game.winner} wins by {game.margin}")
        
        # Test market fetching
        print("\n--- Testing Polymarket ---")
        markets = bot.polymarket.get_sports_markets("NBA")
        print(f"Found {len(markets)} NBA-related markets")
        for market in markets[:5]:
            print(f"  {market.get('question', '')[:60]}")
        
        print("\n--- Bot State ---")
        print(bot.get_state())
    
    asyncio.run(main())
