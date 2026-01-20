//! Risk Manager - Position limits and daily loss tracking.

use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use tracing::{info, warn};

use crate::config::RiskConfig;
use crate::market::TokenId;
use crate::metrics::RISK_REJECTIONS;
use crate::strategy::TradeSignal;

/// Position tracking for a single token.
#[allow(dead_code)]
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
}

/// Risk manager for position and loss limits.
///
/// Uses atomic for daily P&L to avoid lock contention on the hot path.
/// The daily P&L check is the most frequent operation during signal validation.
pub struct RiskManager {
    config: RiskConfig,
    positions: RwLock<HashMap<TokenId, Position>>,
    daily_stats: RwLock<DailyStats>,
    /// Daily P&L in microdollars (1 USD = 1_000_000 microdollars) for atomic ops
    daily_pnl_micro: AtomicI64,
    /// Emergency stop flag - when true, all trading is halted
    #[allow(dead_code)]
    emergency_stop: AtomicBool,
}

/// Conversion factor: 1 USD = 1_000_000 microdollars
const MICRO_PER_DOLLAR: f64 = 1_000_000.0;

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
            daily_pnl_micro: AtomicI64::new(0),
            emergency_stop: AtomicBool::new(false),
        }
    }

    /// Check if a signal passes risk checks.
    pub fn check_signal(&self, signal: &TradeSignal) -> bool {
        // Check emergency stop FIRST - highest priority safety check
        if self.emergency_stop.load(Ordering::SeqCst) {
            warn!("[RISK] Signal rejected - Emergency stop is active");
            RISK_REJECTIONS
                .with_label_values(&["emergency_stop"])
                .inc();
            return false;
        }

        // Check daily loss limit using atomic (no lock needed!)
        let pnl = self.daily_pnl_micro.load(Ordering::Relaxed) as f64 / MICRO_PER_DOLLAR;
        if pnl < -self.config.max_daily_loss {
            warn!(
                "Daily loss limit reached: ${:.2} < -${}",
                pnl, self.config.max_daily_loss
            );
            RISK_REJECTIONS
                .with_label_values(&["daily_loss_limit"])
                .inc();
            return false;
        }

        // Check notional limit
        let notional = signal.notional();
        if notional > self.config.max_notional {
            warn!(
                "Notional limit exceeded: ${:.2} > ${}",
                notional, self.config.max_notional
            );
            RISK_REJECTIONS
                .with_label_values(&["notional_limit"])
                .inc();
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
                    RISK_REJECTIONS
                        .with_label_values(&["position_limit"])
                        .inc();
                    return false;
                }
            }
            TradeSignal::Sell { token_id, size, .. } => {
                let positions = self.positions.read();
                let current = positions.get(token_id).map(|p| p.size).unwrap_or(0.0);
                if current < *size {
                    warn!("Cannot sell more than owned: {} < {}", current, size);
                    RISK_REJECTIONS
                        .with_label_values(&["insufficient_position"])
                        .inc();
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
                    RISK_REJECTIONS
                        .with_label_values(&["position_limit"])
                        .inc();
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

                    // Update atomic P&L (lock-free for check_signal)
                    let pnl_micro = (pnl * MICRO_PER_DOLLAR) as i64;
                    self.daily_pnl_micro.fetch_add(pnl_micro, Ordering::Relaxed);

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

                // Update atomic P&L (lock-free for check_signal)
                let profit_micro = (profit * MICRO_PER_DOLLAR) as i64;
                self.daily_pnl_micro
                    .fetch_add(profit_micro, Ordering::Relaxed);

                info!("Arbitrage profit locked: ${:.2}", profit);
            }
        }
    }

    /// Get current position for a token.
    #[allow(dead_code)]
    pub fn get_position(&self, token_id: &TokenId) -> Option<Position> {
        self.positions.read().get(token_id).cloned()
    }

    /// Get all positions.
    #[allow(dead_code)]
    pub fn get_all_positions(&self) -> HashMap<TokenId, Position> {
        self.positions.read().clone()
    }

    /// Get daily P&L.
    pub fn get_daily_pnl(&self) -> f64 {
        self.daily_pnl_micro.load(Ordering::Relaxed) as f64 / MICRO_PER_DOLLAR
    }

    /// Get daily trade count.
    pub fn get_daily_trades(&self) -> u64 {
        self.daily_stats.read().trades
    }

    /// Reset daily stats (call at midnight).
    #[allow(dead_code)]
    pub fn reset_daily(&self) {
        info!("Resetting daily stats");
        let mut daily = self.daily_stats.write();
        *daily = DailyStats::default();
        self.daily_pnl_micro.store(0, Ordering::Relaxed);
    }

    /// Activate emergency stop - immediately halts all trading.
    ///
    /// This is the highest priority safety mechanism. When activated,
    /// all signals will be rejected until cleared.
    #[allow(dead_code)]
    pub fn emergency_stop(&self) {
        self.emergency_stop.store(true, Ordering::SeqCst);
        warn!("[RISK] EMERGENCY STOP ACTIVATED - All trading halted!");
    }

    /// Check if emergency stop is currently active.
    #[allow(dead_code)]
    pub fn is_emergency_stopped(&self) -> bool {
        self.emergency_stop.load(Ordering::SeqCst)
    }

    /// Clear emergency stop - resumes normal trading.
    ///
    /// Only call this after the emergency condition has been resolved.
    #[allow(dead_code)]
    pub fn clear_emergency_stop(&self) {
        self.emergency_stop.store(false, Ordering::SeqCst);
        info!("[RISK] Emergency stop cleared - Trading resumed");
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

    #[test]
    fn test_emergency_stop() {
        let manager = RiskManager::new(test_config());
        let signal = TradeSignal::Buy {
            token_id: "token1".to_string(),
            price: 0.50,
            size: 50.0,
            reason: "test".to_string(),
        };

        // Initially, emergency stop is not active
        assert!(!manager.is_emergency_stopped());

        // Signal should pass normally
        assert!(manager.check_signal(&signal));

        // Activate emergency stop
        manager.emergency_stop();
        assert!(manager.is_emergency_stopped());

        // Signal should now be rejected
        assert!(!manager.check_signal(&signal));

        // Clear emergency stop
        manager.clear_emergency_stop();
        assert!(!manager.is_emergency_stopped());

        // Signal should pass again
        assert!(manager.check_signal(&signal));
    }
}
