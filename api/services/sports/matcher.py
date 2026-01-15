"""
Market Matcher Service
Matches sports game outcomes to Polymarket markets.
"""

import re
from typing import Optional
from dataclasses import dataclass
from .espn import GameResult


@dataclass
class MarketMatch:
    """Represents a matched market opportunity."""
    market_slug: str
    market_question: str
    condition_id: str
    winning_token_id: str  # The token that should pay out $1
    winning_side: str  # "YES" or "NO"
    game_result: GameResult
    confidence: float  # 0.0 to 1.0
    current_price: float  # Current price of winning token
    expected_profit_pct: float  # If bought at current price


class MarketMatcher:
    """
    Matches completed sports games to active Polymarket markets.
    
    Looks for markets like:
    - "Will the Lakers beat the Warriors?"
    - "Lakers vs Warriors: Who will win?"
    - "Will [Team] win their game on [Date]?"
    """
    
    # Patterns for extracting team names from questions
    PATTERNS = [
        # "Will the Lakers beat the Warriors?"
        r"will (?:the )?(.+?) (?:beat|defeat|win against) (?:the )?(.+?)\??$",
        
        # "Lakers vs Warriors: Who will win?"
        r"(.+?) vs\.? (.+?)[:.]? who will win",
        
        # "Will [Team] win [their game / against / etc.]"
        r"will (?:the )?(.+?) win",
        
        # "[Team] to win"
        r"(.+?) to win",
        
        # "Will [Team] beat [Team] on [Date]"
        r"will (?:the )?(.+?) beat (?:the )?(.+?) on",
    ]
    
    def __init__(self):
        pass
    
    def extract_teams_from_question(self, question: str) -> tuple[Optional[str], Optional[str]]:
        """
        Extract team names from a market question.
        
        Returns:
            Tuple of (team1, team2) or (team1, None) if only one team found
        """
        question_lower = question.lower().strip()
        
        for pattern in self.PATTERNS:
            match = re.search(pattern, question_lower, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) >= 2:
                    return groups[0].strip(), groups[1].strip()
                elif len(groups) == 1:
                    return groups[0].strip(), None
        
        return None, None
    
    def teams_match(self, game_team: str, question_team: str) -> bool:
        """
        Check if a team from the game matches a team in the question.
        Uses fuzzy matching for team names/aliases.
        """
        game_lower = game_team.lower()
        question_lower = question_team.lower()
        
        # Direct match
        if game_lower in question_lower or question_lower in game_lower:
            return True
        
        # Check city names
        cities = [
            ("los angeles", ["la", "lakers", "clippers", "rams", "chargers", "dodgers", "angels"]),
            ("new york", ["ny", "knicks", "nets", "giants", "jets", "yankees", "mets", "rangers"]),
            ("golden state", ["gs", "warriors", "gsw"]),
            ("san francisco", ["sf", "49ers", "giants"]),
            ("kansas city", ["kc", "chiefs", "royals"]),
            ("boston", ["celtics", "bruins", "red sox", "patriots"]),
            ("miami", ["heat", "dolphins", "marlins"]),
            ("chicago", ["bulls", "bears", "cubs", "white sox", "blackhawks"]),
            ("dallas", ["cowboys", "mavericks", "mavs", "stars", "rangers"]),
            ("houston", ["rockets", "texans", "astros"]),
            ("phoenix", ["suns", "cardinals", "coyotes", "diamondbacks"]),
            ("denver", ["nuggets", "broncos", "avalanche", "rockies"]),
            ("philadelphia", ["sixers", "76ers", "eagles", "phillies", "flyers"]),
            ("milwaukee", ["bucks", "brewers"]),
            ("minnesota", ["timberwolves", "wolves", "vikings", "twins", "wild"]),
            ("cleveland", ["cavaliers", "cavs", "browns", "guardians"]),
            ("atlanta", ["hawks", "falcons", "braves"]),
            ("toronto", ["raptors", "blue jays", "maple leafs"]),
            ("detroit", ["pistons", "lions", "tigers", "red wings"]),
            ("sacramento", ["kings"]),
            ("orlando", ["magic"]),
            ("indiana", ["pacers", "colts"]),
            ("memphis", ["grizzlies"]),
            ("san antonio", ["spurs"]),
            ("oklahoma city", ["thunder", "okc"]),
            ("utah", ["jazz"]),
            ("portland", ["trail blazers", "blazers"]),
            ("new orleans", ["pelicans", "saints"]),
            ("charlotte", ["hornets", "panthers"]),
            ("washington", ["wizards", "commanders", "nationals", "capitals"]),
            ("brooklyn", ["nets"]),
            ("seattle", ["seahawks", "mariners", "kraken"]),
            ("green bay", ["packers"]),
            ("baltimore", ["ravens", "orioles"]),
            ("cincinnati", ["bengals", "reds"]),
            ("pittsburgh", ["steelers", "pirates", "penguins"]),
            ("jacksonville", ["jaguars"]),
            ("tennessee", ["titans"]),
            ("carolina", ["panthers", "hurricanes"]),
            ("tampa bay", ["buccaneers", "bucs", "rays", "lightning"]),
            ("arizona", ["cardinals", "diamondbacks", "coyotes"]),
            ("las vegas", ["raiders"]),
        ]
        
        for city, nicknames in cities:
            # Check if game team matches this city
            if city in game_lower or any(nick in game_lower for nick in nicknames):
                # Check if question team also matches
                if city in question_lower or any(nick in question_lower for nick in nicknames):
                    return True
        
        return False
    
    def match_game_to_market(self, game: GameResult, market: dict) -> Optional[MarketMatch]:
        """
        Attempt to match a completed game to a Polymarket market.
        
        Args:
            game: Completed game result from ESPN
            market: Polymarket market data
            
        Returns:
            MarketMatch if matched, None otherwise
        """
        question = market.get("question", "")
        
        # Extract teams from question
        team1, team2 = self.extract_teams_from_question(question)
        
        if not team1:
            return None
        
        # Check if this market is about our game
        home_match = self.teams_match(game.home_team, team1) or (team2 and self.teams_match(game.home_team, team2))
        away_match = self.teams_match(game.away_team, team1) or (team2 and self.teams_match(game.away_team, team2))
        
        if not (home_match or away_match):
            return None
        
        # Determine confidence based on matching
        confidence = 0.5
        if home_match and away_match:
            confidence = 0.95  # Both teams mentioned
        elif team2 is None and (home_match or away_match):
            confidence = 0.7  # Only one team mentioned, could be wrong game
        
        # Determine which token wins
        # If question asks "Will [Team1] beat [Team2]?" 
        # YES wins if Team1 is the winner
        winning_side = "YES"
        
        if team1:
            # Check if team1 is the winner
            if self.teams_match(game.winner, team1):
                winning_side = "YES"
            elif team2 and self.teams_match(game.winner, team2):
                winning_side = "NO"
            else:
                # Winner doesn't match either team - wrong game
                return None
        
        # Get token IDs
        try:
            import json
            token_ids = json.loads(market.get("clobTokenIds", "[]"))
            outcomes = json.loads(market.get("outcomes", "[]"))
            
            if len(token_ids) != 2 or len(outcomes) != 2:
                return None
            
            # Find the winning token
            winning_idx = 0 if winning_side == "YES" else 1
            winning_token_id = token_ids[winning_idx]
            
            # Get current price
            outcome_prices = json.loads(market.get("outcomePrices", "[]"))
            current_price = float(outcome_prices[winning_idx]) if outcome_prices else 0.0
            
        except (json.JSONDecodeError, KeyError, IndexError):
            return None
        
        # Calculate expected profit
        # If we buy at current_price and it resolves to $1, profit = (1 - current_price) / current_price
        expected_profit_pct = ((1.0 - current_price) / current_price) * 100 if current_price > 0 else 0
        
        return MarketMatch(
            market_slug=market.get("slug", ""),
            market_question=question,
            condition_id=market.get("conditionId", ""),
            winning_token_id=winning_token_id,
            winning_side=winning_side,
            game_result=game,
            confidence=confidence,
            current_price=current_price,
            expected_profit_pct=expected_profit_pct,
        )
    
    def find_snipe_opportunities(
        self, 
        games: list[GameResult], 
        markets: list[dict],
        min_price: float = 0.90,
        max_price: float = 0.97,
        min_confidence: float = 0.8,
    ) -> list[MarketMatch]:
        """
        Find all snipeable opportunities from completed games.
        
        Args:
            games: List of completed game results
            markets: List of active Polymarket markets
            min_price: Minimum price to consider (avoid low-prob markets)
            max_price: Maximum price (need room for profit)
            min_confidence: Minimum matching confidence
            
        Returns:
            List of matched opportunities sorted by profit potential
        """
        opportunities = []
        
        for game in games:
            if not game.is_final:
                continue
            
            for market in markets:
                match = self.match_game_to_market(game, market)
                
                if not match:
                    continue
                
                # Filter by our criteria
                if match.confidence < min_confidence:
                    continue
                
                if match.current_price < min_price or match.current_price > max_price:
                    continue
                
                opportunities.append(match)
        
        # Sort by expected profit (highest first)
        opportunities.sort(key=lambda x: x.expected_profit_pct, reverse=True)
        
        return opportunities


# Singleton instance
matcher = MarketMatcher()


def find_snipe_opportunities(
    games: list[GameResult], 
    markets: list[dict],
    **kwargs
) -> list[MarketMatch]:
    """Convenience function to find snipe opportunities."""
    return matcher.find_snipe_opportunities(games, markets, **kwargs)
