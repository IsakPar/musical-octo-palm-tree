//! Configuration management for the trading engine.

use anyhow::{Context, Result};
use std::env;

/// Main configuration struct
#[derive(Clone, Debug)]
pub struct Config {
    /// Polymarket WebSocket URL
    pub ws_url: String,

    /// Polymarket CLOB API URL
    pub clob_url: String,

    /// Private key for signing orders
    pub private_key: String,

    /// API credentials
    pub api_key: String,
    pub api_secret: String,

    /// Dry run mode (no real orders)
    pub dry_run: bool,

    /// Risk configuration
    pub risk: RiskConfig,

    /// Sniper strategy config
    pub sniper: SniperConfig,

    /// Clipper strategy config
    pub clipper: ClipperConfig,
}

#[derive(Clone, Debug)]
pub struct RiskConfig {
    /// Maximum position size per token
    pub max_position: f64,

    /// Maximum notional per trade (USD)
    pub max_notional: f64,

    /// Maximum daily loss before stopping (USD)
    pub max_daily_loss: f64,
}

#[derive(Clone, Debug)]
pub struct SniperConfig {
    /// Whether sniper is enabled
    pub enabled: bool,

    /// Minimum price to buy (don't buy if already expensive)
    pub min_price: f64,

    /// Maximum price to buy (don't overpay)
    pub max_price: f64,

    /// Order size in shares
    pub order_size: f64,

    /// Minimum expected profit per share
    pub min_profit: f64,

    /// ESPN poll interval in milliseconds
    pub poll_interval_ms: u64,

    /// Enabled leagues
    pub leagues: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct ClipperConfig {
    /// Whether clipper is enabled
    pub enabled: bool,

    /// Minimum profit per share for arbitrage
    pub min_profit: f64,

    /// Maximum position size for arbitrage trades
    pub max_position: f64,

    /// Maximum notional per arb trade
    pub max_notional: f64,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self> {
        Ok(Config {
            ws_url: env::var("POLY_WS_URL")
                .unwrap_or_else(|_| "wss://ws-subscriptions-clob.polymarket.com/ws/market".into()),

            clob_url: env::var("POLY_CLOB_URL")
                .unwrap_or_else(|_| "https://clob.polymarket.com".into()),

            private_key: env::var("POLY_PRIVATE_KEY")
                .context("POLY_PRIVATE_KEY is required")?,

            api_key: env::var("POLY_API_KEY")
                .context("POLY_API_KEY is required")?,

            api_secret: env::var("POLY_API_SECRET")
                .context("POLY_API_SECRET is required")?,

            dry_run: env::var("DRY_RUN")
                .map(|v| v == "1" || v.to_lowercase() == "true")
                .unwrap_or(true), // Default to dry run for safety

            risk: RiskConfig {
                max_position: env::var("RISK_MAX_POSITION")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(100.0),

                max_notional: env::var("RISK_MAX_NOTIONAL")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(500.0),

                max_daily_loss: env::var("RISK_MAX_DAILY_LOSS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(200.0),
            },

            sniper: SniperConfig {
                enabled: env::var("SNIPER_ENABLED")
                    .map(|v| v == "1" || v.to_lowercase() == "true")
                    .unwrap_or(true),

                min_price: env::var("SNIPER_MIN_PRICE")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0.50),

                max_price: env::var("SNIPER_MAX_PRICE")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0.95),

                order_size: env::var("SNIPER_ORDER_SIZE")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(10.0),

                min_profit: env::var("SNIPER_MIN_PROFIT")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0.05),

                poll_interval_ms: env::var("SNIPER_POLL_MS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(1000),

                leagues: env::var("SNIPER_LEAGUES")
                    .unwrap_or_else(|_| "nba,nfl,mlb,nhl".into())
                    .split(',')
                    .map(|s| s.trim().to_uppercase())
                    .collect(),
            },

            clipper: ClipperConfig {
                enabled: env::var("CLIPPER_ENABLED")
                    .map(|v| v == "1" || v.to_lowercase() == "true")
                    .unwrap_or(true),

                min_profit: env::var("CLIPPER_MIN_PROFIT")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0.01),

                max_position: env::var("CLIPPER_MAX_POSITION")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(100.0),

                max_notional: env::var("CLIPPER_MAX_NOTIONAL")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(100.0),
            },
        })
    }
}

impl Default for RiskConfig {
    fn default() -> Self {
        Self {
            max_position: 100.0,
            max_notional: 500.0,
            max_daily_loss: 200.0,
        }
    }
}

impl Default for SniperConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            min_price: 0.50,
            max_price: 0.95,
            order_size: 10.0,
            min_profit: 0.05,
            poll_interval_ms: 1000,
            leagues: vec!["NBA".into(), "NFL".into(), "MLB".into(), "NHL".into()],
        }
    }
}

impl Default for ClipperConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            min_profit: 0.01,
            max_position: 100.0,
            max_notional: 100.0,
        }
    }
}
