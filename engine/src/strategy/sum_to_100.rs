//! Sum-to-100 Arbitrage Strategy
//!
//! Exploits markets where YES_ask + NO_ask < 1.00.
//! Uses VWAP calculations for depth-aware pricing.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use tracing::info;

use crate::analysis::SumDeviationAnalyzer;
use crate::config::SumTo100Config;
use crate::market::MarketData;

use super::{Strategy, TradeSignal};

/// SumTo100 arbitrage strategy
pub struct SumTo100Strategy {
    config: SumTo100Config,
    analyzer: SumDeviationAnalyzer,
    /// Last evaluation timestamp (for rate limiting)
    last_evaluation_ns: AtomicU64,
    /// Minimum interval between evaluations (nanoseconds)
    min_interval_ns: u64,
}

impl SumTo100Strategy {
    /// Create a new SumTo100 strategy
    pub fn new(config: SumTo100Config) -> Self {
        let analyzer = SumDeviationAnalyzer::new(config.clone());
        Self {
            config,
            analyzer,
            last_evaluation_ns: AtomicU64::new(0),
            min_interval_ns: 100_000_000, // 100ms minimum between evaluations
        }
    }

    /// Get current timestamp in nanoseconds
    fn now_ns() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64
    }
}

impl Strategy for SumTo100Strategy {
    fn evaluate(&self, market_data: &MarketData) -> Option<TradeSignal> {
        // Rate limiting: don't evaluate too frequently
        let now = Self::now_ns();
        let last = self.last_evaluation_ns.load(Ordering::Relaxed);
        if now.saturating_sub(last) < self.min_interval_ns {
            return None;
        }
        self.last_evaluation_ns.store(now, Ordering::Relaxed);

        // Find opportunities
        let opportunities = self.analyzer.analyze(market_data);

        if opportunities.is_empty() {
            return None;
        }

        // Take the best opportunity (highest edge)
        let best = &opportunities[0];

        // Log the opportunity
        info!(
            "SumTo100 opportunity: {} YES@${:.4} + NO@${:.4} = ${:.4} | edge={:.2}% | size={:.0} | confidence={:.0}%",
            best.market_id,
            best.yes_vwap.vwap,
            best.no_vwap.vwap,
            best.sum,
            best.edge * 100.0,
            best.recommended_size,
            best.confidence * 100.0
        );

        // Generate trade signal
        Some(TradeSignal::Arbitrage {
            yes_token: best.yes_token.clone(),
            no_token: best.no_token.clone(),
            yes_price: best.yes_vwap.vwap,
            no_price: best.no_vwap.vwap,
            profit_per_share: best.edge,
            size: best.recommended_size,
        })
    }

    fn name(&self) -> &'static str {
        "SumTo100"
    }

    fn is_active(&self) -> bool {
        self.config.enabled
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market::{DepthLevel, MarketPair};

    fn create_test_config() -> SumTo100Config {
        SumTo100Config {
            enabled: true,
            min_edge: 0.003,
            max_position: 100.0,
            max_notional: 100.0,
            min_liquidity: 10.0,
            fee_rate: 0.01,
            paper_trading: true,
            max_book_age_ms: 60000,
        }
    }

    #[test]
    fn test_strategy_generates_signal() {
        let config = create_test_config();
        let strategy = SumTo100Strategy::new(config);
        let market_data = MarketData::new();

        // Set up a profitable market
        let pair = MarketPair {
            market_id: "test_market".into(),
            yes_token: "yes_token".into(),
            no_token: "no_token".into(),
            question: "Test?".into(),
        };
        market_data.register_pair(pair);

        market_data.update_order_book(
            &"yes_token".into(),
            vec![DepthLevel::new(0.44, 100.0)],
            vec![DepthLevel::new(0.45, 100.0)],
        );
        market_data.update_order_book(
            &"no_token".into(),
            vec![DepthLevel::new(0.49, 100.0)],
            vec![DepthLevel::new(0.50, 100.0)],
        );

        let signal = strategy.evaluate(&market_data);
        assert!(signal.is_some());

        if let Some(TradeSignal::Arbitrage {
            yes_price,
            no_price,
            profit_per_share,
            ..
        }) = signal
        {
            assert!((yes_price - 0.45).abs() < 0.001);
            assert!((no_price - 0.50).abs() < 0.001);
            assert!(profit_per_share > 0.0);
        } else {
            panic!("Expected Arbitrage signal");
        }
    }

    #[test]
    fn test_strategy_respects_enabled() {
        let mut config = create_test_config();
        config.enabled = false;
        let strategy = SumTo100Strategy::new(config);

        assert!(!strategy.is_active());
    }
}
