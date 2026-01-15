//! Risk Manager - Position limits and daily loss tracking.

use parking_lot::RwLock;
use std::collections::HashMap;
use tracing::{info, warn};

use crate::config::RiskConfig;
use crate::market::TokenId;
use crate::strategy::TradeSignal;

/// Position tracking for a single token.
#[derive(Debug, Default, Clone)]
pub struct Position {
    pub size: f64,
    pub avg_cost: f64,
    pub realized_pnl: f64,
}

/// Daily statistics.
#[derive(Debug, Default)]
struct DailyStats {
    trades: u64,
    volume: f64,
    pnl: f64,
}

/// Risk manager for position and loss limits.
pub struct RiskManager {
    config: RiskConfig,
    positions: RwLock<HashMap<TokenId, Position>>,
    daily_stats: RwLock<DailyStats>,
}

impl RiskManager {
    /// Create a new risk manager.
    pub fn new(config: RiskConfig) -> Self {
        info!(
            "Risk manager initialized: max_position=${}, max_daily_loss=${}",
            config.max_position, config.max_daily_loss
        );

        Self {
            config,
            positions: RwLock::new(HashMap::new()),
            daily_stats: RwLock::new(DailyStats::default()),
        }
    }

    /// Check if a signal passes risk checks.
    pub fn check_signal(&self, signal: &TradeSignal) -> bool {
        // Check daily loss limit
        let daily = self.daily_stats.read();
        if daily.pnl < -self.config.max_daily_loss {
            warn!(
                "Daily loss limit reached: ${:.2} < -${}",
                daily.pnl, self.config.max_daily_loss
            );
            return false;
        }
        drop(daily);

        // Check notional limit
        let notional = signal.notional();
        if notional > self.config.max_notional {
            warn!(
                "Notional limit exceeded: ${:.2} > ${}",
                notional, self.config.max_notional
            );
            return false;
        }

        // Check position size
        match signal {
            TradeSignal::Buy { token_id, size, .. } => {
                let positions = self.positions.read();
                let current = positions.get(token_id).map(|p| p.size).unwrap_or(0.0);
                if current + size > self.config.max_position {
                    warn!(
                        "Position limit exceeded: {} + {} > {}",
                        current, size, self.config.max_position
                    );
                    return false;
                }
            }
            TradeSignal::Sell { token_id, size, .. } => {
                let positions = self.positions.read();
                let current = positions.get(token_id).map(|p| p.size).unwrap_or(0.0);
                if current < *size {
                    warn!(
                        "Cannot sell more than owned: {} < {}",
                        current, size
                    );
                    return false;
                }
            }
            TradeSignal::Arbitrage { size, .. } => {
                // For arbitrage, check total position doesn't exceed limit
                if *size > self.config.max_position {
                    warn!(
                        "Arbitrage size exceeds limit: {} > {}",
                        size, self.config.max_position
                    );
                    return false;
                }
            }
        }

        true
    }

    /// Record a trade for position tracking.
    pub fn record_trade(&self, signal: &TradeSignal) {
        let mut positions = self.positions.write();
        let mut daily = self.daily_stats.write();

        daily.trades += 1;
        daily.volume += signal.notional();

        match signal {
            TradeSignal::Buy {
                token_id,
                price,
                size,
                ..
            } => {
                let position = positions.entry(token_id.clone()).or_default();
                let total_cost = position.avg_cost * position.size + price * size;
                position.size += size;
                if position.size > 0.0 {
                    position.avg_cost = total_cost / position.size;
                }
            }
            TradeSignal::Sell {
                token_id,
                price,
                size,
                ..
            } => {
                if let Some(position) = positions.get_mut(token_id) {
                    let pnl = (price - position.avg_cost) * size;
                    position.realized_pnl += pnl;
                    position.size -= size;
                    daily.pnl += pnl;

                    info!(
                        "Trade P&L: ${:.2} (total: ${:.2})",
                        pnl, position.realized_pnl
                    );
                }
            }
            TradeSignal::Arbitrage {
                yes_token,
                no_token,
                yes_price,
                no_price,
                profit_per_share,
                size,
            } => {
                // Record both positions
                let yes_pos = positions.entry(yes_token.clone()).or_default();
                yes_pos.size += size;
                yes_pos.avg_cost = *yes_price;

                let no_pos = positions.entry(no_token.clone()).or_default();
                no_pos.size += size;
                no_pos.avg_cost = *no_price;

                // Arbitrage profit is locked in
                let profit = profit_per_share * size;
                daily.pnl += profit;

                info!("Arbitrage profit locked: ${:.2}", profit);
            }
        }
    }

    /// Get current position for a token.
    pub fn get_position(&self, token_id: &TokenId) -> Option<Position> {
        self.positions.read().get(token_id).cloned()
    }

    /// Get all positions.
    pub fn get_all_positions(&self) -> HashMap<TokenId, Position> {
        self.positions.read().clone()
    }

    /// Get daily P&L.
    pub fn get_daily_pnl(&self) -> f64 {
        self.daily_stats.read().pnl
    }

    /// Get daily trade count.
    pub fn get_daily_trades(&self) -> u64 {
        self.daily_stats.read().trades
    }

    /// Reset daily stats (call at midnight).
    pub fn reset_daily(&self) {
        info!("Resetting daily stats");
        let mut daily = self.daily_stats.write();
        *daily = DailyStats::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> RiskConfig {
        RiskConfig {
            max_position: 100.0,
            max_notional: 1000.0,
            max_daily_loss: 500.0,
        }
    }

    #[test]
    fn test_buy_signal_within_limits() {
        let manager = RiskManager::new(test_config());
        let signal = TradeSignal::Buy {
            token_id: "token1".to_string(),
            price: 0.50,
            size: 50.0,
            reason: "test".to_string(),
        };

        assert!(manager.check_signal(&signal));
    }

    #[test]
    fn test_buy_signal_exceeds_position() {
        let manager = RiskManager::new(test_config());

        // First buy
        let signal1 = TradeSignal::Buy {
            token_id: "token1".to_string(),
            price: 0.50,
            size: 80.0,
            reason: "test".to_string(),
        };
        assert!(manager.check_signal(&signal1));
        manager.record_trade(&signal1);

        // Second buy exceeds limit
        let signal2 = TradeSignal::Buy {
            token_id: "token1".to_string(),
            price: 0.50,
            size: 30.0, // 80 + 30 > 100
            reason: "test".to_string(),
        };
        assert!(!manager.check_signal(&signal2));
    }

    #[test]
    fn test_daily_pnl_tracking() {
        let manager = RiskManager::new(test_config());

        // Buy
        let buy = TradeSignal::Buy {
            token_id: "token1".to_string(),
            price: 0.50,
            size: 10.0,
            reason: "test".to_string(),
        };
        manager.record_trade(&buy);

        // Sell at profit
        let sell = TradeSignal::Sell {
            token_id: "token1".to_string(),
            price: 0.60,
            size: 10.0,
            reason: "test".to_string(),
        };
        manager.record_trade(&sell);

        // PnL should be (0.60 - 0.50) * 10 = $1.00
        assert!((manager.get_daily_pnl() - 1.0).abs() < 0.001);
    }
}
