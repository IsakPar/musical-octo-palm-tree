//! Trade repository for PostgreSQL persistence.
//!
//! All write operations are fire-and-forget (non-blocking) - they spawn
//! async tasks and return immediately to ensure the trading loop is never
//! delayed by database I/O.

use anyhow::Result;
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::sync::Arc;
use std::time::Duration;
use tracing::{info, warn};

/// A trade record for the database
#[derive(Debug, Clone)]
pub struct Trade {
    pub token_id: String,
    pub side: String, // "BUY" or "SELL"
    pub price: f64,
    pub size: f64,
    pub order_id: Option<String>,
    pub status: String, // "FILLED", "FAILED", "PAPER"
    pub strategy: String,
    pub signal_reason: Option<String>,
    pub is_paper: bool,
}

/// An arbitrage trade record for the database
#[derive(Debug, Clone)]
pub struct ArbTrade {
    pub market_id: String,
    pub yes_token_id: String,
    pub no_token_id: String,
    pub yes_price: f64,
    pub no_price: f64,
    pub size: f64,
    pub total_cost: f64,
    pub fees: f64,
    pub gross_profit: f64,
    pub net_profit: f64,
    pub yes_order_id: Option<String>,
    pub no_order_id: Option<String>,
    pub status: String,
    pub strategy: String,
    pub is_paper: bool,
}

/// Async PostgreSQL trade repository.
/// All write operations are fire-and-forget to avoid blocking the trading loop.
pub struct TradeRepository {
    pool: Option<PgPool>,
    enabled: bool,
}

impl TradeRepository {
    /// Create a new repository from environment variable.
    /// If DATABASE_URL is not set, operations will be no-ops.
    pub async fn new(database_url: Option<&str>) -> Result<Self> {
        match database_url {
            Some(url) => {
                let pool = PgPoolOptions::new()
                    .max_connections(5)
                    .acquire_timeout(Duration::from_secs(3))
                    .connect(url)
                    .await?;

                info!("[DB] Connected to PostgreSQL");
                Ok(Self {
                    pool: Some(pool),
                    enabled: true,
                })
            }
            None => {
                info!("[DB] Database disabled (DATABASE_URL not set)");
                Ok(Self {
                    pool: None,
                    enabled: false,
                })
            }
        }
    }

    /// Create a disabled repository (for testing)
    #[allow(dead_code)]
    pub fn disabled() -> Self {
        Self {
            pool: None,
            enabled: false,
        }
    }

    /// Check if database is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Insert a trade (fire-and-forget, non-blocking)
    pub fn insert_trade(&self, trade: Trade) {
        if !self.enabled {
            return;
        }

        let pool = match &self.pool {
            Some(p) => p.clone(),
            None => return,
        };

        // Fire-and-forget: spawn task and return immediately
        tokio::spawn(async move {
            let result = sqlx::query(
                r#"
                INSERT INTO trades (token_id, side, price, size, order_id, status, strategy, signal_reason, is_paper)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                "#
            )
            .bind(&trade.token_id)
            .bind(&trade.side)
            .bind(trade.price)
            .bind(trade.size)
            .bind(&trade.order_id)
            .bind(&trade.status)
            .bind(&trade.strategy)
            .bind(&trade.signal_reason)
            .bind(trade.is_paper)
            .execute(&pool)
            .await;

            if let Err(e) = result {
                warn!("[DB] Failed to insert trade: {}", e);
            }
        });
    }

    /// Insert an arbitrage trade (fire-and-forget, non-blocking)
    pub fn insert_arb_trade(&self, trade: ArbTrade) {
        if !self.enabled {
            return;
        }

        let pool = match &self.pool {
            Some(p) => p.clone(),
            None => return,
        };

        // Fire-and-forget: spawn task and return immediately
        tokio::spawn(async move {
            let result = sqlx::query(
                r#"
                INSERT INTO arb_trades (
                    market_id, yes_token_id, no_token_id, yes_price, no_price, size,
                    total_cost, fees, gross_profit, net_profit,
                    yes_order_id, no_order_id, status, strategy, is_paper
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                "#,
            )
            .bind(&trade.market_id)
            .bind(&trade.yes_token_id)
            .bind(&trade.no_token_id)
            .bind(trade.yes_price)
            .bind(trade.no_price)
            .bind(trade.size)
            .bind(trade.total_cost)
            .bind(trade.fees)
            .bind(trade.gross_profit)
            .bind(trade.net_profit)
            .bind(&trade.yes_order_id)
            .bind(&trade.no_order_id)
            .bind(&trade.status)
            .bind(&trade.strategy)
            .bind(trade.is_paper)
            .execute(&pool)
            .await;

            if let Err(e) = result {
                warn!("[DB] Failed to insert arb trade: {}", e);
            }
        });
    }

    /// Get recent trade count (for health checks)
    #[allow(dead_code)]
    pub async fn recent_trade_count(&self, minutes: i32) -> Result<i64> {
        if !self.enabled {
            return Ok(0);
        }

        let pool = match &self.pool {
            Some(p) => p,
            None => return Ok(0),
        };

        let result: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM trades WHERE created_at > NOW() - INTERVAL '1 minute' * $1",
        )
        .bind(minutes)
        .fetch_one(pool)
        .await?;

        Ok(result.0)
    }

    /// Get today's P&L from arbitrage trades
    #[allow(dead_code)]
    pub async fn today_pnl(&self) -> Result<f64> {
        if !self.enabled {
            return Ok(0.0);
        }

        let pool = match &self.pool {
            Some(p) => p,
            None => return Ok(0.0),
        };

        let result: (Option<f64>,) = sqlx::query_as(
            r#"
            SELECT COALESCE(SUM(net_profit), 0)
            FROM arb_trades
            WHERE DATE(created_at) = CURRENT_DATE
              AND status = 'FILLED'
              AND is_paper = false
            "#,
        )
        .fetch_one(pool)
        .await?;

        Ok(result.0.unwrap_or(0.0))
    }
}

/// Helper to create a repository from Arc for sharing
impl TradeRepository {
    #[allow(dead_code)]
    pub fn into_arc(self) -> Arc<Self> {
        Arc::new(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_disabled_repository() {
        let repo = TradeRepository::disabled();
        assert!(!repo.is_enabled());
    }

    #[test]
    fn test_trade_struct() {
        let trade = Trade {
            token_id: "abc123".to_string(),
            side: "BUY".to_string(),
            price: 0.45,
            size: 100.0,
            order_id: Some("order123".to_string()),
            status: "FILLED".to_string(),
            strategy: "SumTo100".to_string(),
            signal_reason: Some("Edge: 5%".to_string()),
            is_paper: false,
        };
        assert_eq!(trade.side, "BUY");
    }
}
