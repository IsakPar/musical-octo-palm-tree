"""
ESPN Sports API Service
Fetches live sports data to determine game outcomes.
"""

import requests
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass


@dataclass
class GameResult:
    """Represents a completed game result."""
    game_id: str
    league: str
    home_team: str
    away_team: str
    home_score: int
    away_score: int
    winner: str  # Team name of winner
    status: str  # "Final", "In Progress", etc.
    is_final: bool
    margin: int  # Point difference
    game_date: str


class ESPNService:
    """
    ESPN API client for fetching live sports data.
    ESPN has a free, undocumented API that's widely used.
    """
    
    BASE_URL = "https://site.api.espn.com/apis/site/v2/sports"
    
    # League endpoints
    LEAGUES = {
        "NBA": "basketball/nba",
        "NFL": "football/nfl",
        "MLB": "baseball/mlb",
        "NHL": "hockey/nhl",
        "NCAAF": "football/college-football",
        "NCAAB": "basketball/mens-college-basketball",
        "MLS": "soccer/usa.1",
        "EPL": "soccer/eng.1",
    }
    
    # Team name normalization (ESPN → Common names)
    TEAM_ALIASES = {
        # NBA
        "LA Lakers": ["Lakers", "Los Angeles Lakers"],
        "LA Clippers": ["Clippers", "Los Angeles Clippers"],
        "Golden State Warriors": ["Warriors", "GSW"],
        "Boston Celtics": ["Celtics", "Boston"],
        "Miami Heat": ["Heat", "Miami"],
        "New York Knicks": ["Knicks", "NYK"],
        "Philadelphia 76ers": ["76ers", "Sixers", "Philadelphia"],
        "Phoenix Suns": ["Suns", "Phoenix"],
        "Denver Nuggets": ["Nuggets", "Denver"],
        "Milwaukee Bucks": ["Bucks", "Milwaukee"],
        # NFL
        "Kansas City Chiefs": ["Chiefs", "KC"],
        "San Francisco 49ers": ["49ers", "Niners", "SF"],
        "Dallas Cowboys": ["Cowboys", "Dallas"],
        "Philadelphia Eagles": ["Eagles", "Philly"],
        "Buffalo Bills": ["Bills", "Buffalo"],
        "Miami Dolphins": ["Dolphins", "Miami"],
        # Add more as needed...
    }
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (compatible; PolyBot/1.0)"
        })
    
    def get_scoreboard(self, league: str) -> list[dict]:
        """
        Get today's scoreboard for a league.
        
        Args:
            league: League code (NBA, NFL, etc.)
            
        Returns:
            List of game data dictionaries
        """
        if league not in self.LEAGUES:
            print(f"[ESPN] Unknown league: {league}")
            return []
        
        endpoint = f"{self.BASE_URL}/{self.LEAGUES[league]}/scoreboard"
        
        try:
            resp = self.session.get(endpoint, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            
            return data.get("events", [])
        
        except Exception as e:
            print(f"[ESPN] Error fetching {league} scoreboard: {e}")
            return []
    
    def get_final_games(self, league: str) -> list[GameResult]:
        """
        Get all completed games for a league today.
        
        Args:
            league: League code (NBA, NFL, etc.)
            
        Returns:
            List of GameResult objects for completed games
        """
        events = self.get_scoreboard(league)
        final_games = []
        
        for event in events:
            try:
                status = event.get("status", {})
                status_type = status.get("type", {})
                
                # Check if game is final
                is_completed = status_type.get("completed", False)
                state = status_type.get("state", "")
                
                if not is_completed and state != "post":
                    continue
                
                # Get competitors
                competition = event.get("competitions", [{}])[0]
                competitors = competition.get("competitors", [])
                
                if len(competitors) != 2:
                    continue
                
                home = None
                away = None
                
                for comp in competitors:
                    team_data = {
                        "name": comp.get("team", {}).get("displayName", ""),
                        "short_name": comp.get("team", {}).get("shortDisplayName", ""),
                        "abbreviation": comp.get("team", {}).get("abbreviation", ""),
                        "score": int(comp.get("score", "0")),
                        "is_home": comp.get("homeAway") == "home",
                        "is_winner": comp.get("winner", False),
                    }
                    
                    if team_data["is_home"]:
                        home = team_data
                    else:
                        away = team_data
                
                if not home or not away:
                    continue
                
                # Determine winner
                if home["score"] > away["score"]:
                    winner = home["name"]
                elif away["score"] > home["score"]:
                    winner = away["name"]
                else:
                    winner = "TIE"  # Rare in most sports
                
                margin = abs(home["score"] - away["score"])
                
                game_result = GameResult(
                    game_id=event.get("id", ""),
                    league=league,
                    home_team=home["name"],
                    away_team=away["name"],
                    home_score=home["score"],
                    away_score=away["score"],
                    winner=winner,
                    status=status_type.get("description", "Final"),
                    is_final=True,
                    margin=margin,
                    game_date=event.get("date", ""),
                )
                
                final_games.append(game_result)
                
            except Exception as e:
                print(f"[ESPN] Error parsing event: {e}")
                continue
        
        return final_games
    
    def get_live_games(self, league: str) -> list[dict]:
        """
        Get all in-progress games for a league.
        Returns games that are close to ending (4th quarter, 9th inning, etc.)
        """
        events = self.get_scoreboard(league)
        live_games = []
        
        for event in events:
            try:
                status = event.get("status", {})
                status_type = status.get("type", {})
                
                state = status_type.get("state", "")
                if state != "in":
                    continue
                
                # Get game details
                competition = event.get("competitions", [{}])[0]
                competitors = competition.get("competitors", [])
                
                if len(competitors) != 2:
                    continue
                
                home = None
                away = None
                
                for comp in competitors:
                    team_data = {
                        "name": comp.get("team", {}).get("displayName", ""),
                        "score": int(comp.get("score", "0")),
                        "is_home": comp.get("homeAway") == "home",
                    }
                    
                    if team_data["is_home"]:
                        home = team_data
                    else:
                        away = team_data
                
                if not home or not away:
                    continue
                
                margin = abs(home["score"] - away["score"])
                
                # Parse period/quarter info
                display_clock = status.get("displayClock", "")
                period = status.get("period", 0)
                
                live_games.append({
                    "game_id": event.get("id", ""),
                    "home_team": home["name"],
                    "away_team": away["name"],
                    "home_score": home["score"],
                    "away_score": away["score"],
                    "margin": margin,
                    "leader": home["name"] if home["score"] > away["score"] else away["name"],
                    "period": period,
                    "clock": display_clock,
                    "status": status_type.get("shortDetail", ""),
                })
                
            except Exception as e:
                continue
        
        return live_games
    
    def normalize_team_name(self, team_name: str) -> list[str]:
        """
        Get all possible names/aliases for a team.
        Useful for matching against Polymarket questions.
        """
        names = [team_name.lower()]
        
        for canonical, aliases in self.TEAM_ALIASES.items():
            if team_name.lower() in canonical.lower():
                names.extend([a.lower() for a in aliases])
            for alias in aliases:
                if team_name.lower() in alias.lower():
                    names.append(canonical.lower())
                    names.extend([a.lower() for a in aliases])
        
        return list(set(names))


# Singleton instance
espn = ESPNService()


def get_final_games(league: str) -> list[GameResult]:
    """Convenience function to get final games."""
    return espn.get_final_games(league)


def get_live_games(league: str) -> list[dict]:
    """Convenience function to get live games."""
    return espn.get_live_games(league)


if __name__ == "__main__":
    # Test the service
    print("=" * 60)
    print("Testing ESPN Service")
    print("=" * 60)
    
    for league in ["NBA", "NFL"]:
        print(f"\n--- {league} ---")
        
        print("\nFinal Games:")
        finals = get_final_games(league)
        for game in finals:
            print(f"  {game.away_team} @ {game.home_team}: {game.away_score}-{game.home_score} ({game.winner} wins by {game.margin})")
        
        print("\nLive Games:")
        live = get_live_games(league)
        for game in live:
            print(f"  {game['away_team']} @ {game['home_team']}: {game['away_score']}-{game['home_score']} ({game['status']})")
