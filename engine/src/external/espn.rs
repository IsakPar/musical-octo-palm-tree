//! ESPN API client for sports data.
//!
//! Polls ESPN for game results to enable time arbitrage on sports markets.

use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::interval;
use tracing::{debug, info, warn};

/// Supported sports leagues.
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum League {
    Nfl,
    Nba,
    Mlb,
    Nhl,
}

impl League {
    /// Get ESPN API path for this league.
    fn api_path(&self) -> &'static str {
        match self {
            League::Nfl => "football/nfl",
            League::Nba => "basketball/nba",
            League::Mlb => "baseball/mlb",
            League::Nhl => "hockey/nhl",
        }
    }
}

/// Game status.
#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GameStatus {
    Scheduled,
    InProgress,
    Final,
    Postponed,
    Cancelled,
}

/// Represents a game from ESPN.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct Game {
    pub id: String,
    pub league: League,
    pub home_team: String,
    pub away_team: String,
    pub home_score: u32,
    pub away_score: u32,
    pub status: GameStatus,
}

#[allow(dead_code)]
impl Game {
    /// Check if home team won.
    pub fn home_won(&self) -> bool {
        self.status == GameStatus::Final && self.home_score > self.away_score
    }

    /// Check if away team won.
    pub fn away_won(&self) -> bool {
        self.status == GameStatus::Final && self.away_score > self.home_score
    }

    /// Get the winner team name.
    pub fn winner(&self) -> Option<&str> {
        if self.status != GameStatus::Final {
            return None;
        }
        if self.home_score > self.away_score {
            Some(&self.home_team)
        } else if self.away_score > self.home_score {
            Some(&self.away_team)
        } else {
            None // Tie
        }
    }
}

/// ESPN API response structures.
#[derive(Debug, Deserialize)]
struct EspnResponse {
    events: Vec<EspnEvent>,
}

#[derive(Debug, Deserialize)]
struct EspnEvent {
    id: String,
    competitions: Vec<EspnCompetition>,
    status: EspnStatus,
}

#[derive(Debug, Deserialize)]
struct EspnCompetition {
    competitors: Vec<EspnCompetitor>,
}

#[derive(Debug, Deserialize)]
struct EspnCompetitor {
    #[serde(rename = "homeAway")]
    home_away: String,
    team: EspnTeam,
    score: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EspnTeam {
    #[serde(rename = "displayName")]
    display_name: String,
}

#[derive(Debug, Deserialize)]
struct EspnStatus {
    #[serde(rename = "type")]
    status_type: EspnStatusType,
}

#[derive(Debug, Deserialize)]
struct EspnStatusType {
    state: String,
    completed: bool,
}

/// ESPN client for fetching game data.
#[allow(dead_code)]
pub struct EspnClient {
    client: Client,
    base_url: String,
    leagues: Vec<League>,
    poll_interval_ms: u64,
    /// Cache of games by league
    games: Arc<RwLock<HashMap<League, Vec<Game>>>>,
    /// Games that have finished (for sniper strategy)
    finished_games: Arc<RwLock<Vec<Game>>>,
}

#[allow(dead_code)]
impl EspnClient {
    /// Create a new ESPN client.
    pub fn new(leagues: Vec<League>, poll_interval_ms: u64) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .context("Failed to create ESPN HTTP client")?;

        Ok(Self {
            client,
            base_url: "https://site.api.espn.com/apis/site/v2/sports".to_string(),
            leagues,
            poll_interval_ms,
            games: Arc::new(RwLock::new(HashMap::new())),
            finished_games: Arc::new(RwLock::new(Vec::new())),
        })
    }

    /// Start the polling loop.
    pub async fn run(&self) {
        info!("ESPN client starting for leagues: {:?}", self.leagues);

        let mut ticker = interval(Duration::from_millis(self.poll_interval_ms));

        loop {
            ticker.tick().await;

            for league in &self.leagues {
                if let Err(e) = self.fetch_league(*league).await {
                    warn!("Failed to fetch {:?}: {}", league, e);
                }
            }
        }
    }

    /// Fetch games for a specific league.
    async fn fetch_league(&self, league: League) -> Result<()> {
        let url = format!("{}/{}/scoreboard", self.base_url, league.api_path());

        debug!("Fetching {:?} from {}", league, url);

        let response: EspnResponse = self
            .client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch ESPN data")?
            .json()
            .await
            .context("Failed to parse ESPN response")?;

        let mut new_finished = Vec::new();
        let mut games = Vec::new();

        for event in response.events {
            let game = self.parse_event(league, event)?;

            // Check if this is a newly finished game
            if game.status == GameStatus::Final {
                let prev_games = self.games.read().await;
                let was_in_progress = prev_games
                    .get(&league)
                    .and_then(|g| g.iter().find(|g| g.id == game.id))
                    .map(|g| g.status == GameStatus::InProgress)
                    .unwrap_or(false);

                if was_in_progress {
                    info!(
                        "Game finished: {} vs {} - Winner: {:?}",
                        game.home_team,
                        game.away_team,
                        game.winner()
                    );
                    new_finished.push(game.clone());
                }
            }

            games.push(game);
        }

        // Update game cache
        {
            let mut cache = self.games.write().await;
            cache.insert(league, games);
        }

        // Add newly finished games
        if !new_finished.is_empty() {
            let mut finished = self.finished_games.write().await;
            finished.extend(new_finished);

            // Keep only last 100 finished games
            if finished.len() > 100 {
                let drain_count = finished.len() - 100;
                finished.drain(0..drain_count);
            }
        }

        Ok(())
    }

    /// Parse an ESPN event into a Game.
    fn parse_event(&self, league: League, event: EspnEvent) -> Result<Game> {
        let competition = event
            .competitions
            .first()
            .context("No competition in event")?;

        let mut home_team = String::new();
        let mut away_team = String::new();
        let mut home_score = 0u32;
        let mut away_score = 0u32;

        for competitor in &competition.competitors {
            let score: u32 = competitor
                .score
                .as_deref()
                .unwrap_or("0")
                .parse()
                .unwrap_or(0);

            if competitor.home_away == "home" {
                home_team = competitor.team.display_name.clone();
                home_score = score;
            } else {
                away_team = competitor.team.display_name.clone();
                away_score = score;
            }
        }

        let status = match event.status.status_type.state.as_str() {
            "pre" => GameStatus::Scheduled,
            "in" => GameStatus::InProgress,
            "post" if event.status.status_type.completed => GameStatus::Final,
            "postponed" => GameStatus::Postponed,
            _ => GameStatus::Cancelled,
        };

        Ok(Game {
            id: event.id,
            league,
            home_team,
            away_team,
            home_score,
            away_score,
            status,
        })
    }

    /// Get recently finished games (for sniper strategy).
    pub async fn get_finished_games(&self) -> Vec<Game> {
        self.finished_games.read().await.clone()
    }

    /// Clear a finished game (after sniping it).
    pub async fn clear_finished_game(&self, game_id: &str) {
        let mut finished = self.finished_games.write().await;
        finished.retain(|g| g.id != game_id);
    }

    /// Get all games for a league.
    pub async fn get_games(&self, league: League) -> Vec<Game> {
        self.games
            .read()
            .await
            .get(&league)
            .cloned()
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_game_winner() {
        let game = Game {
            id: "1".to_string(),
            league: League::Nba,
            home_team: "Lakers".to_string(),
            away_team: "Celtics".to_string(),
            home_score: 110,
            away_score: 105,
            status: GameStatus::Final,
        };

        assert!(game.home_won());
        assert!(!game.away_won());
        assert_eq!(game.winner(), Some("Lakers"));
    }

    #[test]
    fn test_league_api_path() {
        assert_eq!(League::Nfl.api_path(), "football/nfl");
        assert_eq!(League::Nba.api_path(), "basketball/nba");
        assert_eq!(League::Mlb.api_path(), "baseball/mlb");
        assert_eq!(League::Nhl.api_path(), "hockey/nhl");
    }
}
