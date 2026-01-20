//! Configuration management for the trading engine.

use anyhow::{bail, Result};
use std::env;
use tracing::warn;

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

    /// SumTo100 strategy config
    pub sum_to_100: SumTo100Config,
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

#[allow(dead_code)]
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

#[derive(Clone, Debug)]
pub struct SumTo100Config {
    /// Whether SumTo100 strategy is enabled
    pub enabled: bool,

    /// Minimum edge after fees (default: 0.003 = 0.3%)
    pub min_edge: f64,

    /// Maximum shares per trade
    pub max_position: f64,

    /// Maximum USD per trade
    pub max_notional: f64,

    /// Minimum liquidity required at VWAP
    pub min_liquidity: f64,

    /// Total fee rate (both sides)
    pub fee_rate: f64,

    /// Paper trading mode (simulate fills instead of real orders)
    pub paper_trading: bool,

    /// Maximum age of order book data in milliseconds before rejecting
    pub max_book_age_ms: u64,
}

/// Helper to parse env var with warning on missing/invalid
fn parse_env_or_default<T: std::str::FromStr>(var_name: &str, default: T) -> T {
    match env::var(var_name) {
        Ok(val) => match val.parse() {
            Ok(parsed) => parsed,
            Err(_) => {
                warn!(
                    "{} has invalid value '{}', using default: {:?}",
                    var_name,
                    val,
                    std::any::type_name::<T>()
                );
                default
            }
        },
        Err(_) => {
            warn!("{} not set, using default", var_name);
            default
        }
    }
}

/// Helper for boolean env vars with warning
fn parse_bool_env_or_default(var_name: &str, default: bool) -> bool {
    match env::var(var_name) {
        Ok(val) => val == "1" || val.to_lowercase() == "true",
        Err(_) => {
            warn!("{} not set, using default: {}", var_name, default);
            default
        }
    }
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self> {
        let config = Config {
            ws_url: env::var("POLY_WS_URL").unwrap_or_else(|_| {
                warn!("POLY_WS_URL not set, using default WebSocket URL");
                "wss://ws-subscriptions-clob.polymarket.com/ws/market".into()
            }),

            clob_url: env::var("POLY_CLOB_URL").unwrap_or_else(|_| {
                warn!("POLY_CLOB_URL not set, using default CLOB URL");
                "https://clob.polymarket.com".into()
            }),

            // In DRY_RUN mode, keys are optional (use placeholders)
            // This allows running the engine in mock/observation mode
            private_key: env::var("POLY_PRIVATE_KEY").unwrap_or_else(|_| {
                warn!("POLY_PRIVATE_KEY not set, using placeholder (only valid for DRY_RUN mode)");
                "0x0000000000000000000000000000000000000000000000000000000000000000".into()
            }),

            api_key: env::var("POLY_API_KEY").unwrap_or_else(|_| {
                warn!("POLY_API_KEY not set, using mock key (only valid for DRY_RUN mode)");
                "mock-api-key".into()
            }),

            api_secret: env::var("POLY_API_SECRET").unwrap_or_else(|_| {
                warn!("POLY_API_SECRET not set, using mock secret (only valid for DRY_RUN mode)");
                "mock-api-secret".into()
            }),

            dry_run: parse_bool_env_or_default("DRY_RUN", true),

            risk: RiskConfig {
                max_position: parse_env_or_default("RISK_MAX_POSITION", 100.0),
                max_notional: parse_env_or_default("RISK_MAX_NOTIONAL", 500.0),
                max_daily_loss: parse_env_or_default("RISK_MAX_DAILY_LOSS", 200.0),
            },

            sniper: SniperConfig {
                enabled: parse_bool_env_or_default("SNIPER_ENABLED", true),
                min_price: parse_env_or_default("SNIPER_MIN_PRICE", 0.50),
                max_price: parse_env_or_default("SNIPER_MAX_PRICE", 0.95),
                order_size: parse_env_or_default("SNIPER_ORDER_SIZE", 10.0),
                min_profit: parse_env_or_default("SNIPER_MIN_PROFIT", 0.05),
                poll_interval_ms: parse_env_or_default("SNIPER_POLL_MS", 1000),
                leagues: env::var("SNIPER_LEAGUES")
                    .unwrap_or_else(|_| {
                        warn!("SNIPER_LEAGUES not set, using default: nba,nfl,mlb,nhl");
                        "nba,nfl,mlb,nhl".into()
                    })
                    .split(',')
                    .map(|s| s.trim().to_uppercase())
                    .collect(),
            },

            clipper: ClipperConfig {
                enabled: parse_bool_env_or_default("CLIPPER_ENABLED", true),
                min_profit: parse_env_or_default("CLIPPER_MIN_PROFIT", 0.01),
                max_position: parse_env_or_default("CLIPPER_MAX_POSITION", 100.0),
                max_notional: parse_env_or_default("CLIPPER_MAX_NOTIONAL", 100.0),
            },

            sum_to_100: SumTo100Config {
                enabled: parse_bool_env_or_default("SUMTO100_ENABLED", true),
                min_edge: parse_env_or_default("SUMTO100_MIN_EDGE", 0.003),
                max_position: parse_env_or_default("SUMTO100_MAX_POSITION", 100.0),
                max_notional: parse_env_or_default("SUMTO100_MAX_NOTIONAL", 100.0),
                min_liquidity: parse_env_or_default("SUMTO100_MIN_LIQUIDITY", 50.0),
                fee_rate: parse_env_or_default("SUMTO100_FEE_RATE", 0.01),
                paper_trading: parse_bool_env_or_default("SUMTO100_PAPER_TRADING", true),
                max_book_age_ms: parse_env_or_default("SUMTO100_MAX_BOOK_AGE_MS", 500),
            },
        };

        // Validate configuration before returning
        config.validate()?;

        Ok(config)
    }

    /// Validate configuration values
    ///
    /// Returns an error if any configuration value is invalid.
    /// This prevents silent failures from misconfigured trading parameters.
    pub fn validate(&self) -> Result<()> {
        let mut errors: Vec<String> = Vec::new();

        // Risk configuration validation
        if self.risk.max_position <= 0.0 {
            errors.push(format!(
                "RISK_MAX_POSITION must be > 0, got {}",
                self.risk.max_position
            ));
        }
        if self.risk.max_notional <= 0.0 {
            errors.push(format!(
                "RISK_MAX_NOTIONAL must be > 0, got {}",
                self.risk.max_notional
            ));
        }
        if self.risk.max_daily_loss <= 0.0 {
            errors.push(format!(
                "RISK_MAX_DAILY_LOSS must be > 0, got {}",
                self.risk.max_daily_loss
            ));
        }

        // Sniper configuration validation
        if self.sniper.min_price < 0.0 || self.sniper.min_price > 1.0 {
            errors.push(format!(
                "SNIPER_MIN_PRICE must be between 0.0 and 1.0, got {}",
                self.sniper.min_price
            ));
        }
        if self.sniper.max_price < self.sniper.min_price || self.sniper.max_price > 1.0 {
            errors.push(format!(
                "SNIPER_MAX_PRICE must be between SNIPER_MIN_PRICE ({}) and 1.0, got {}",
                self.sniper.min_price, self.sniper.max_price
            ));
        }
        if self.sniper.min_profit < 0.0 {
            errors.push(format!(
                "SNIPER_MIN_PROFIT must be >= 0, got {}",
                self.sniper.min_profit
            ));
        }

        // Clipper configuration validation
        if self.clipper.min_profit < 0.0 {
            errors.push(format!(
                "CLIPPER_MIN_PROFIT must be >= 0, got {}",
                self.clipper.min_profit
            ));
        }

        // SumTo100 configuration validation
        if self.sum_to_100.min_edge < 0.0 {
            errors.push(format!(
                "SUMTO100_MIN_EDGE must be >= 0, got {}",
                self.sum_to_100.min_edge
            ));
        }
        if self.sum_to_100.fee_rate < 0.0 || self.sum_to_100.fee_rate > 1.0 {
            errors.push(format!(
                "SUMTO100_FEE_RATE must be between 0.0 and 1.0, got {}",
                self.sum_to_100.fee_rate
            ));
        }
        if self.sum_to_100.min_liquidity <= 0.0 {
            errors.push(format!(
                "SUMTO100_MIN_LIQUIDITY must be > 0, got {}",
                self.sum_to_100.min_liquidity
            ));
        }

        // Check for placeholder credentials when not in dry run mode
        if !self.dry_run {
            if self.private_key
                == "0x0000000000000000000000000000000000000000000000000000000000000000"
            {
                errors.push(
                    "POLY_PRIVATE_KEY is required when DRY_RUN=false (using placeholder key)"
                        .to_string(),
                );
            }
            if self.api_key == "mock-api-key" {
                errors
                    .push("POLY_API_KEY is required when DRY_RUN=false (using mock key)".to_string());
            }
            if self.api_secret == "mock-api-secret" {
                errors.push(
                    "POLY_API_SECRET is required when DRY_RUN=false (using mock secret)".to_string(),
                );
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            bail!(
                "Configuration validation failed:\n  - {}",
                errors.join("\n  - ")
            )
        }
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

impl Default for SumTo100Config {
    fn default() -> Self {
        Self {
            enabled: true,
            min_edge: 0.003, // 0.3% minimum edge
            max_position: 100.0,
            max_notional: 100.0,
            min_liquidity: 50.0,
            fee_rate: 0.01,       // 1% total fees
            paper_trading: true,  // Safe default
            max_book_age_ms: 500, // 500ms max staleness
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper to create a valid config for testing
    fn valid_config() -> Config {
        Config {
            ws_url: "wss://test.com".into(),
            clob_url: "https://test.com".into(),
            private_key: "0x1234".into(),
            api_key: "test-key".into(),
            api_secret: "test-secret".into(),
            dry_run: true,
            risk: RiskConfig::default(),
            sniper: SniperConfig::default(),
            clipper: ClipperConfig::default(),
            sum_to_100: SumTo100Config::default(),
        }
    }

    #[test]
    fn test_valid_config_passes_validation() {
        let config = valid_config();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_config_validation_rejects_negative_position() {
        let mut config = valid_config();
        config.risk.max_position = -10.0;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("RISK_MAX_POSITION must be > 0"));
    }

    #[test]
    fn test_config_validation_rejects_zero_position() {
        let mut config = valid_config();
        config.risk.max_position = 0.0;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("RISK_MAX_POSITION must be > 0"));
    }

    #[test]
    fn test_config_validation_rejects_negative_notional() {
        let mut config = valid_config();
        config.risk.max_notional = -100.0;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("RISK_MAX_NOTIONAL must be > 0"));
    }

    #[test]
    fn test_config_validation_rejects_negative_daily_loss() {
        let mut config = valid_config();
        config.risk.max_daily_loss = -50.0;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("RISK_MAX_DAILY_LOSS must be > 0"));
    }

    #[test]
    fn test_config_validation_rejects_invalid_price_range() {
        // Test min_price > 1.0
        let mut config = valid_config();
        config.sniper.min_price = 1.5;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("SNIPER_MIN_PRICE must be between 0.0 and 1.0"));

        // Test min_price < 0.0
        let mut config = valid_config();
        config.sniper.min_price = -0.1;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("SNIPER_MIN_PRICE must be between 0.0 and 1.0"));

        // Test max_price > 1.0
        let mut config = valid_config();
        config.sniper.max_price = 1.2;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("SNIPER_MAX_PRICE must be between"));

        // Test max_price < min_price
        let mut config = valid_config();
        config.sniper.min_price = 0.8;
        config.sniper.max_price = 0.5;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("SNIPER_MAX_PRICE must be between SNIPER_MIN_PRICE"));
    }

    #[test]
    fn test_config_validation_rejects_negative_sniper_profit() {
        let mut config = valid_config();
        config.sniper.min_profit = -0.01;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("SNIPER_MIN_PROFIT must be >= 0"));
    }

    #[test]
    fn test_config_validation_rejects_negative_clipper_profit() {
        let mut config = valid_config();
        config.clipper.min_profit = -0.05;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("CLIPPER_MIN_PROFIT must be >= 0"));
    }

    #[test]
    fn test_config_validation_rejects_negative_min_edge() {
        let mut config = valid_config();
        config.sum_to_100.min_edge = -0.001;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("SUMTO100_MIN_EDGE must be >= 0"));
    }

    #[test]
    fn test_config_validation_rejects_invalid_fee_rate() {
        // Test fee_rate > 1.0
        let mut config = valid_config();
        config.sum_to_100.fee_rate = 1.5;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("SUMTO100_FEE_RATE must be between 0.0 and 1.0"));

        // Test fee_rate < 0.0
        let mut config = valid_config();
        config.sum_to_100.fee_rate = -0.1;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("SUMTO100_FEE_RATE must be between 0.0 and 1.0"));
    }

    #[test]
    fn test_config_validation_rejects_zero_min_liquidity() {
        let mut config = valid_config();
        config.sum_to_100.min_liquidity = 0.0;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("SUMTO100_MIN_LIQUIDITY must be > 0"));
    }

    #[test]
    fn test_config_validation_rejects_negative_min_liquidity() {
        let mut config = valid_config();
        config.sum_to_100.min_liquidity = -10.0;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("SUMTO100_MIN_LIQUIDITY must be > 0"));
    }

    #[test]
    fn test_config_validation_requires_credentials_when_not_dry_run() {
        let mut config = valid_config();
        config.dry_run = false;
        config.private_key =
            "0x0000000000000000000000000000000000000000000000000000000000000000".into();
        config.api_key = "mock-api-key".into();
        config.api_secret = "mock-api-secret".into();

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("POLY_PRIVATE_KEY is required when DRY_RUN=false"));
        assert!(err_msg.contains("POLY_API_KEY is required when DRY_RUN=false"));
        assert!(err_msg.contains("POLY_API_SECRET is required when DRY_RUN=false"));
    }

    #[test]
    fn test_config_validation_allows_placeholder_credentials_in_dry_run() {
        let mut config = valid_config();
        config.dry_run = true;
        config.private_key =
            "0x0000000000000000000000000000000000000000000000000000000000000000".into();
        config.api_key = "mock-api-key".into();
        config.api_secret = "mock-api-secret".into();

        // Should pass - dry_run mode allows placeholder credentials
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_config_validation_collects_multiple_errors() {
        let mut config = valid_config();
        config.risk.max_position = -10.0;
        config.risk.max_notional = -100.0;
        config.sniper.min_price = -0.5;

        let result = config.validate();
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();

        // Should contain all three errors
        assert!(err_msg.contains("RISK_MAX_POSITION"));
        assert!(err_msg.contains("RISK_MAX_NOTIONAL"));
        assert!(err_msg.contains("SNIPER_MIN_PRICE"));
    }
}
