"""
Polymarket Client Service
Wrapper around py-clob-client for the Sniper bot.
"""

import os
import json
import requests
from typing import Optional
from dataclasses import dataclass


# Try to import py_clob_client, but gracefully handle if not installed
try:
    from py_clob_client.client import ClobClient
    from py_clob_client.clob_types import OrderArgs, OrderType, Side
    HAS_CLOB_CLIENT = True
except ImportError:
    HAS_CLOB_CLIENT = False
    print("[POLYMARKET] py-clob-client not installed. Running in simulation mode.")


GAMMA_API_BASE = "https://gamma-api.polymarket.com"
CLOB_API_BASE = "https://clob.polymarket.com"

# Polymarket chain IDs
POLYGON_MAINNET = 137


@dataclass
class OrderResult:
    """Result of placing an order."""
    success: bool
    order_id: Optional[str]
    filled_amount: float
    avg_price: float
    error: Optional[str] = None


class PolymarketClient:
    """
    Client for interacting with Polymarket's CLOB.
    
    Supports:
    - Fetching markets
    - Placing limit orders (GTC)
    - Checking order status
    - Redeeming positions
    """
    
    def __init__(
        self,
        private_key: Optional[str] = None,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        api_passphrase: Optional[str] = None,
    ):
        """
        Initialize the Polymarket client.
        
        For read-only operations (fetching markets), no credentials needed.
        For trading, you need either:
        - private_key (for on-chain transactions)
        - api_key + api_secret + api_passphrase (for CLOB API)
        """
        self.private_key = private_key or os.getenv("POLY_PRIVATE_KEY")
        self.api_key = api_key or os.getenv("POLY_API_KEY")
        self.api_secret = api_secret or os.getenv("POLY_API_SECRET")
        self.api_passphrase = api_passphrase or os.getenv("POLY_API_PASSPHRASE")
        
        self.session = requests.Session()
        self.clob_client = None
        
        # Initialize CLOB client if credentials available
        if HAS_CLOB_CLIENT and self.api_key:
            try:
                self.clob_client = ClobClient(
                    host=CLOB_API_BASE,
                    key=self.api_key,
                    secret=self.api_secret,
                    passphrase=self.api_passphrase,
                    chain_id=POLYGON_MAINNET,
                )
                print("[POLYMARKET] CLOB client initialized")
            except Exception as e:
                print(f"[POLYMARKET] Failed to init CLOB client: {e}")
    
    # -------------------------------------------------------------------------
    # Market Data (Read-Only)
    # -------------------------------------------------------------------------
    
    def get_active_markets(self, limit: int = 100, offset: int = 0) -> list[dict]:
        """
        Fetch active markets from Gamma API.
        
        Returns:
            List of market dictionaries
        """
        try:
            resp = self.session.get(
                f"{GAMMA_API_BASE}/markets",
                params={
                    "closed": "false",
                    "active": "true",
                    "limit": limit,
                    "offset": offset,
                },
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"[POLYMARKET] Error fetching markets: {e}")
            return []
    
    def get_sports_markets(self, league: Optional[str] = None) -> list[dict]:
        """
        Fetch markets that appear to be sports-related.
        
        Filters for:
        - NBA, NFL, MLB, NHL keywords
        - "win", "beat", "score" keywords
        """
        all_markets = []
        offset = 0
        
        while True:
            batch = self.get_active_markets(limit=100, offset=offset)
            if not batch:
                break
            all_markets.extend(batch)
            offset += 100
            if offset > 2000:  # Safety limit
                break
        
        # Filter for sports
        sports_keywords = [
            "nba", "nfl", "mlb", "nhl", "ncaa",
            "lakers", "warriors", "celtics", "heat", "knicks",
            "chiefs", "49ers", "eagles", "cowboys", "bills",
            "yankees", "dodgers", "mets", "red sox",
            "basketball", "football", "baseball", "hockey",
            "will win", "beat", "to win", "vs",
        ]
        
        league_keywords = {
            "NBA": ["nba", "basketball", "lakers", "warriors", "celtics", "nets", "knicks", "heat", "bucks", "76ers", "suns", "nuggets"],
            "NFL": ["nfl", "football", "chiefs", "49ers", "eagles", "cowboys", "bills", "dolphins", "ravens", "bengals"],
            "MLB": ["mlb", "baseball", "yankees", "dodgers", "mets", "red sox", "astros", "braves", "phillies"],
            "NHL": ["nhl", "hockey", "rangers", "bruins", "penguins", "maple leafs", "oilers"],
        }
        
        sports_markets = []
        for market in all_markets:
            question = market.get("question", "").lower()
            
            # Filter by league if specified
            if league:
                if not any(kw in question for kw in league_keywords.get(league, [])):
                    continue
            else:
                # General sports filter
                if not any(kw in question for kw in sports_keywords):
                    continue
            
            sports_markets.append(market)
        
        return sports_markets
    
    def get_orderbook(self, token_id: str) -> dict:
        """
        Fetch the order book for a token.
        
        Returns:
            Dict with 'bids' and 'asks' lists
        """
        try:
            resp = self.session.get(
                f"{CLOB_API_BASE}/book",
                params={"token_id": token_id},
                timeout=10,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"[POLYMARKET] Error fetching orderbook: {e}")
            return {"bids": [], "asks": []}
    
    def get_best_bid(self, token_id: str) -> float:
        """Get the best bid price for a token."""
        book = self.get_orderbook(token_id)
        bids = book.get("bids", [])
        if not bids:
            return 0.0
        sorted_bids = sorted(bids, key=lambda x: float(x.get("price", 0)), reverse=True)
        return float(sorted_bids[0].get("price", 0))
    
    def get_best_ask(self, token_id: str) -> float:
        """Get the best ask price for a token."""
        book = self.get_orderbook(token_id)
        asks = book.get("asks", [])
        if not asks:
            return 1.0
        sorted_asks = sorted(asks, key=lambda x: float(x.get("price", 999)))
        return float(sorted_asks[0].get("price", 1.0))
    
    # -------------------------------------------------------------------------
    # Trading (Requires Credentials)
    # -------------------------------------------------------------------------
    
    def place_limit_order(
        self,
        token_id: str,
        side: str,  # "BUY" or "SELL"
        price: float,
        size: float,
    ) -> OrderResult:
        """
        Place a limit order (GTC - Good Till Cancelled).
        This is a MAKER order with 0% fees.
        
        Args:
            token_id: The token to trade
            side: "BUY" or "SELL"
            price: Limit price (0.01 - 0.99)
            size: Amount in shares
            
        Returns:
            OrderResult with order details
        """
        if not self.clob_client:
            return OrderResult(
                success=False,
                order_id=None,
                filled_amount=0,
                avg_price=0,
                error="CLOB client not initialized. Add API credentials.",
            )
        
        try:
            order_args = OrderArgs(
                price=price,
                size=size,
                side=Side.BUY if side == "BUY" else Side.SELL,
                token_id=token_id,
                order_type=OrderType.GTC,
            )
            
            result = self.clob_client.create_and_post_order(order_args)
            
            return OrderResult(
                success=True,
                order_id=result.get("orderID"),
                filled_amount=float(result.get("amountFilled", 0)),
                avg_price=price,
            )
            
        except Exception as e:
            return OrderResult(
                success=False,
                order_id=None,
                filled_amount=0,
                avg_price=0,
                error=str(e),
            )
    
    def get_order_status(self, order_id: str) -> dict:
        """Get the status of an order."""
        if not self.clob_client:
            return {"error": "CLOB client not initialized"}
        
        try:
            return self.clob_client.get_order(order_id)
        except Exception as e:
            return {"error": str(e)}
    
    def cancel_order(self, order_id: str) -> bool:
        """Cancel an open order."""
        if not self.clob_client:
            return False
        
        try:
            self.clob_client.cancel(order_id)
            return True
        except Exception as e:
            print(f"[POLYMARKET] Error cancelling order: {e}")
            return False
    
    # -------------------------------------------------------------------------
    # Position Management
    # -------------------------------------------------------------------------
    
    def get_positions(self) -> list[dict]:
        """Get current positions (requires auth)."""
        if not self.clob_client:
            return []
        
        try:
            # This would use the CLOB client's position endpoints
            # For now, return empty as this needs proper implementation
            return []
        except Exception as e:
            print(f"[POLYMARKET] Error fetching positions: {e}")
            return []
    
    def redeem_positions(self, condition_id: str) -> bool:
        """
        Redeem winning positions after market resolution.
        
        Args:
            condition_id: The condition ID of the resolved market
            
        Returns:
            True if successful
        """
        # This requires on-chain transaction
        # Will need web3 integration for actual implementation
        print(f"[POLYMARKET] Redeem positions for {condition_id} - requires on-chain tx")
        return False


# Singleton instance (read-only by default)
client = PolymarketClient()


def get_sports_markets(league: Optional[str] = None) -> list[dict]:
    """Convenience function to get sports markets."""
    return client.get_sports_markets(league)


def get_best_ask(token_id: str) -> float:
    """Convenience function to get best ask."""
    return client.get_best_ask(token_id)
