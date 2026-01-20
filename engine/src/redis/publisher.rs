//! Redis Publisher - Streams trading data to Python dashboard.
//!
//! Channels:
//! - `poly:state`   - Engine state updates (every 100ms)
//! - `poly:signals` - Trade signals as they happen
//! - `poly:trades`  - Executed trades
//! - `poly:errors`  - Error notifications

use anyhow::{Context, Result};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Safely serialize a value to JSON, logging on failure instead of panicking.
/// Returns None if serialization fails, allowing callers to gracefully skip publishing.
fn serialize_or_log<T: Serialize>(value: &T, context: &str) -> Option<String> {
    match serde_json::to_string(value) {
        Ok(json) => Some(json),
        Err(e) => {
            warn!("[REDIS] Failed to serialize {}: {}", context, e);
            None
        }
    }
}

/// Redis channel names
#[allow(dead_code)]
pub mod channels {
    pub const STATE: &str = "poly:state";
    pub const SIGNALS: &str = "poly:signals";
    pub const TRADES: &str = "poly:trades";
    pub const ERRORS: &str = "poly:errors";
}

/// Engine state message published to Redis
#[derive(Debug, Clone, Serialize)]
pub struct EngineState {
    pub timestamp_ms: u64,
    pub status: String,
    pub markets_tracked: usize,
    pub opportunities_found: usize,
    pub daily_pnl: f64,
    pub daily_trades: u64,
    pub positions: Vec<PositionInfo>,
}

/// Position info for state updates
#[derive(Debug, Clone, Serialize)]
pub struct PositionInfo {
    pub token_id: String,
    pub size: f64,
    pub avg_cost: f64,
    pub unrealized_pnl: f64,
}

/// Trade signal message
#[derive(Debug, Clone, Serialize)]
pub struct SignalMessage {
    pub timestamp_ms: u64,
    pub strategy: String,
    pub signal_type: String, // "BUY", "SELL", "ARBITRAGE"
    pub token_id: Option<String>,
    pub yes_token_id: Option<String>,
    pub no_token_id: Option<String>,
    pub price: Option<f64>,
    pub yes_price: Option<f64>,
    pub no_price: Option<f64>,
    pub size: f64,
    pub edge: Option<f64>,
    pub reason: String,
}

/// Executed trade message
#[derive(Debug, Clone, Serialize)]
pub struct TradeMessage {
    pub timestamp_ms: u64,
    pub strategy: String,
    pub trade_type: String, // "BUY", "SELL", "ARBITRAGE"
    pub token_id: Option<String>,
    pub yes_token_id: Option<String>,
    pub no_token_id: Option<String>,
    pub price: Option<f64>,
    pub yes_price: Option<f64>,
    pub no_price: Option<f64>,
    pub size: f64,
    pub order_id: Option<String>,
    pub yes_order_id: Option<String>,
    pub no_order_id: Option<String>,
    pub status: String,
    pub pnl: Option<f64>,
    pub is_paper: bool,
}

/// Error message
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize)]
pub struct ErrorMessage {
    pub timestamp_ms: u64,
    pub source: String,
    pub error_type: String,
    pub message: String,
    pub details: Option<String>,
}

/// Redis publisher for streaming data to Python dashboard.
pub struct RedisPublisher {
    connection: Arc<RwLock<Option<ConnectionManager>>>,
    enabled: bool,
}

impl RedisPublisher {
    /// Create a new Redis publisher.
    ///
    /// If `redis_url` is None, the publisher will be disabled (no-op).
    pub async fn new(redis_url: Option<&str>) -> Result<Self> {
        match redis_url {
            Some(url) => {
                info!("Connecting to Redis at {}", url);

                let client = redis::Client::open(url).context("Failed to create Redis client")?;

                let connection = ConnectionManager::new(client)
                    .await
                    .context("Failed to connect to Redis")?;

                info!("Redis connection established");

                Ok(Self {
                    connection: Arc::new(RwLock::new(Some(connection))),
                    enabled: true,
                })
            }
            None => {
                info!("Redis URL not configured - publisher disabled");
                Ok(Self {
                    connection: Arc::new(RwLock::new(None)),
                    enabled: false,
                })
            }
        }
    }

    /// Create a disabled publisher (for testing without Redis).
    #[allow(dead_code)]
    pub fn disabled() -> Self {
        Self {
            connection: Arc::new(RwLock::new(None)),
            enabled: false,
        }
    }

    /// Check if the publisher is enabled.
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Publish engine state update.
    pub async fn publish_state(&self, state: &EngineState) -> Result<()> {
        self.publish(channels::STATE, state).await
    }

    /// Publish a trade signal.
    pub async fn publish_signal(&self, signal: &SignalMessage) -> Result<()> {
        self.publish(channels::SIGNALS, signal).await
    }

    /// Publish an executed trade.
    pub async fn publish_trade(&self, trade: &TradeMessage) -> Result<()> {
        self.publish(channels::TRADES, trade).await
    }

    /// Publish an error.
    #[allow(dead_code)]
    pub async fn publish_error(&self, error: &ErrorMessage) -> Result<()> {
        self.publish(channels::ERRORS, error).await
    }

    /// Fire-and-forget state publish. Logs errors instead of returning them.
    /// Safe to call from spawned async tasks where errors would be silently dropped.
    #[allow(dead_code)]
    pub async fn publish_state_logged(&self, state: &EngineState) {
        if let Err(e) = self.publish_with_context(channels::STATE, state, "engine state").await {
            warn!("[REDIS] Failed to publish state: {}", e);
        }
    }

    /// Fire-and-forget signal publish. Logs errors instead of returning them.
    /// Safe to call from spawned async tasks where errors would be silently dropped.
    #[allow(dead_code)]
    pub async fn publish_signal_logged(&self, signal: &SignalMessage) {
        if let Err(e) = self.publish_with_context(channels::SIGNALS, signal, "trade signal").await {
            warn!("[REDIS] Failed to publish signal: {}", e);
        }
    }

    /// Fire-and-forget trade publish. Logs errors instead of returning them.
    /// Safe to call from spawned async tasks where errors would be silently dropped.
    #[allow(dead_code)]
    pub async fn publish_trade_logged(&self, trade: &TradeMessage) {
        if let Err(e) = self.publish_with_context(channels::TRADES, trade, "executed trade").await {
            warn!("[REDIS] Failed to publish trade: {}", e);
        }
    }

    /// Fire-and-forget error publish. Logs errors instead of returning them.
    /// Safe to call from spawned async tasks where errors would be silently dropped.
    #[allow(dead_code)]
    pub async fn publish_error_logged(&self, error: &ErrorMessage) {
        if let Err(e) = self.publish_with_context(channels::ERRORS, error, "error message").await {
            warn!("[REDIS] Failed to publish error: {}", e);
        }
    }

    /// Internal publish method.
    async fn publish<T: Serialize>(&self, channel: &str, message: &T) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let json = serde_json::to_string(message).context("Failed to serialize message")?;

        let mut conn_guard = self.connection.write().await;

        if let Some(ref mut conn) = *conn_guard {
            match conn.publish::<_, _, i32>(channel, &json).await {
                Ok(subscribers) => {
                    debug!("Published to {} ({} subscribers)", channel, subscribers);
                    Ok(())
                }
                Err(e) => {
                    warn!("Failed to publish to {}: {}", channel, e);
                    Err(e.into())
                }
            }
        } else {
            Ok(()) // No connection, silently succeed
        }
    }

    /// Internal publish method using serialize_or_log for defensive serialization.
    /// Used by the fire-and-forget `*_logged` methods.
    async fn publish_with_context<T: Serialize>(
        &self,
        channel: &str,
        message: &T,
        context: &str,
    ) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let json = match serialize_or_log(message, context) {
            Some(j) => j,
            None => return Ok(()), // Serialization failed, already logged
        };

        let mut conn_guard = self.connection.write().await;

        if let Some(ref mut conn) = *conn_guard {
            match conn.publish::<_, _, i32>(channel, &json).await {
                Ok(subscribers) => {
                    debug!("Published {} to {} ({} subscribers)", context, channel, subscribers);
                    Ok(())
                }
                Err(e) => {
                    warn!("[REDIS] Failed to publish {} to {}: {}", context, channel, e);
                    Err(e.into())
                }
            }
        } else {
            Ok(()) // No connection, silently succeed
        }
    }

    /// Publish a raw JSON string to a channel.
    #[allow(dead_code)]
    pub async fn publish_raw(&self, channel: &str, json: &str) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let mut conn_guard = self.connection.write().await;

        if let Some(ref mut conn) = *conn_guard {
            conn.publish::<_, _, i32>(channel, json)
                .await
                .context("Failed to publish raw message")?;
        }

        Ok(())
    }
}

/// Helper to get current timestamp in milliseconds.
/// Uses unwrap_or_default() to avoid panics if system time is before UNIX_EPOCH.
pub fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_disabled_publisher() {
        let publisher = RedisPublisher::disabled();
        assert!(!publisher.is_enabled());
    }

    #[test]
    fn test_serialize_state() {
        let state = EngineState {
            timestamp_ms: 1234567890,
            status: "running".to_string(),
            markets_tracked: 10,
            opportunities_found: 5,
            daily_pnl: 123.45,
            daily_trades: 15,
            positions: vec![],
        };

        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("running"));
        assert!(json.contains("123.45"));
    }

    #[test]
    fn test_serialize_trade() {
        let trade = TradeMessage {
            timestamp_ms: 1234567890,
            strategy: "SumTo100".to_string(),
            trade_type: "ARBITRAGE".to_string(),
            token_id: None,
            yes_token_id: Some("yes123".to_string()),
            no_token_id: Some("no123".to_string()),
            price: None,
            yes_price: Some(0.45),
            no_price: Some(0.50),
            size: 100.0,
            order_id: None,
            yes_order_id: Some("order-yes".to_string()),
            no_order_id: Some("order-no".to_string()),
            status: "FILLED".to_string(),
            pnl: Some(5.0),
            is_paper: false,
        };

        let json = serde_json::to_string(&trade).unwrap();
        assert!(json.contains("SumTo100"));
        assert!(json.contains("ARBITRAGE"));
    }
}
