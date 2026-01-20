//! Clipper Strategy - Classic Arbitrage
//!
//! Finds markets where YES + NO < $1.00 and buys both for guaranteed profit.
//! This is the purest form of arbitrage - zero directional risk.

use crate::config::ClipperConfig;
use crate::market::MarketData;

use super::{Strategy, TradeSignal};

/// Clipper strategy for YES+NO arbitrage.
pub struct ClipperStrategy {
    config: ClipperConfig,
}

impl ClipperStrategy {
    /// Create a new clipper strategy.
    pub fn new(config: ClipperConfig) -> Self {
        Self { config }
    }

    /// Scan all markets for arbitrage opportunities.
    fn scan_markets(&self, market_data: &MarketData) -> Option<TradeSignal> {
        // Get all market pairs (YES/NO token pairs)
        for (_market_id, pair) in market_data.get_all_pairs() {
            // Get best ask prices for both tokens
            let yes_ask = match market_data.get_ask(&pair.yes_token) {
                Some(p) => p,
                None => continue,
            };
            let no_ask = match market_data.get_ask(&pair.no_token) {
                Some(p) => p,
                None => continue,
            };

            // Calculate total cost and profit
            let total_cost = yes_ask + no_ask;
            let profit_per_share = 1.0 - total_cost;

            // Check if profitable after fees
            // Polymarket has ~0.5% taker fee per side = 1% total for arb
            let fees = total_cost * 0.01; // 1% fee estimate
            let net_profit = profit_per_share - fees;

            if net_profit >= self.config.min_profit {
                // Calculate position size
                let size = self.calculate_size(yes_ask, no_ask);

                return Some(TradeSignal::Arbitrage {
                    yes_token: pair.yes_token.clone(),
                    no_token: pair.no_token.clone(),
                    yes_price: yes_ask,
                    no_price: no_ask,
                    profit_per_share: net_profit,
                    size,
                });
            }
        }

        None
    }

    /// Calculate optimal position size based on available liquidity.
    fn calculate_size(&self, yes_ask: f64, no_ask: f64) -> f64 {
        // Start with max position from config
        let max_size = self.config.max_position;

        // Calculate how much we can afford per side
        let cost_per_share = yes_ask + no_ask;
        let shares_affordable = self.config.max_notional / cost_per_share;

        // Return the minimum of max position and affordable shares
        max_size.min(shares_affordable)
    }
}

impl Strategy for ClipperStrategy {
    fn evaluate(&self, market_data: &MarketData) -> Option<TradeSignal> {
        self.scan_markets(market_data)
    }

    fn name(&self) -> &'static str {
        "Clipper"
    }

    fn is_active(&self) -> bool {
        self.config.enabled
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clipper_creation() {
        let config = ClipperConfig::default();
        let clipper = ClipperStrategy::new(config);
        assert_eq!(clipper.name(), "Clipper");
    }

    #[test]
    fn test_size_calculation() {
        let config = ClipperConfig {
            enabled: true,
            min_profit: 0.01,
            max_position: 100.0,
            max_notional: 50.0,
        };
        let clipper = ClipperStrategy::new(config);

        // If YES=$0.45, NO=$0.50, cost=$0.95/share
        // Max notional $50 / $0.95 = ~52 shares
        // But max position is 100, so we get 52
        let size = clipper.calculate_size(0.45, 0.50);
        assert!(size < 53.0);
        assert!(size > 52.0);
    }

    #[test]
    fn test_size_respects_max_position() {
        let config = ClipperConfig {
            enabled: true,
            min_profit: 0.01,
            max_position: 10.0,   // Low max position
            max_notional: 1000.0, // High notional
        };
        let clipper = ClipperStrategy::new(config);

        // Should be capped at max_position
        let size = clipper.calculate_size(0.45, 0.50);
        assert_eq!(size, 10.0);
    }
}
