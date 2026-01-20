//! Sniper Strategy - Sports Time Arbitrage
//!
//! Uses ESPN data to detect finished games before Polymarket prices update.
//! Buys winning outcomes at stale prices.

use crate::config::SniperConfig;
use crate::market::{MarketData, TokenId};

use super::{Strategy, TradeSignal};

/// Sniper strategy for sports time arbitrage.
pub struct SniperStrategy {
    config: SniperConfig,
    /// Cache of games we've already sniped (to avoid duplicate orders)
    sniped_games: std::collections::HashSet<String>,
}

impl SniperStrategy {
    /// Create a new sniper strategy.
    pub fn new(config: SniperConfig) -> Self {
        Self {
            config,
            sniped_games: std::collections::HashSet::new(),
        }
    }

    /// Check if a game has already been sniped.
    fn already_sniped(&self, game_id: &str) -> bool {
        self.sniped_games.contains(game_id)
    }

    /// Mark a game as sniped.
    #[allow(dead_code)]
    fn mark_sniped(&mut self, game_id: String) {
        self.sniped_games.insert(game_id);
    }

    /// Find arbitrage opportunity for a finished game.
    fn find_opportunity(
        &self,
        _game_id: &str,
        winning_token: &TokenId,
        market_data: &MarketData,
    ) -> Option<TradeSignal> {
        // Get current ask price for winning token
        let ask = market_data.get_ask(winning_token)?;

        // Check if price is within our range (stale opportunity)
        if ask < self.config.min_price || ask > self.config.max_price {
            return None;
        }

        // Calculate expected profit
        let expected_profit = 1.0 - ask;
        if expected_profit < self.config.min_profit {
            return None;
        }

        Some(TradeSignal::Buy {
            token_id: winning_token.clone(),
            price: ask,
            size: self.config.order_size,
            reason: format!("time_arb: EV ${:.4}", expected_profit),
        })
    }
}

impl Strategy for SniperStrategy {
    fn evaluate(&self, market_data: &MarketData) -> Option<TradeSignal> {
        // In full implementation, this would:
        // 1. Poll ESPN for finished games
        // 2. Match games to Polymarket markets
        // 3. Check if winning outcome is still underpriced
        // 4. Generate buy signal

        // For now, check if we have any sports markets with stale prices
        // This is a simplified version - full ESPN integration comes later

        // Get all sports markets from market data
        for (market_id, pair) in market_data.get_sports_markets() {
            // Skip if already sniped
            if self.already_sniped(&market_id) {
                continue;
            }

            // Check both YES and NO tokens for opportunities
            // In real implementation, we'd know which one won from ESPN
            if let Some(signal) = self.find_opportunity(&market_id, &pair.yes_token, market_data) {
                return Some(signal);
            }
        }

        None
    }

    fn name(&self) -> &'static str {
        "Sniper"
    }

    fn is_active(&self) -> bool {
        self.config.enabled
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sniper_creation() {
        let config = SniperConfig::default();
        let sniper = SniperStrategy::new(config);
        assert_eq!(sniper.name(), "Sniper");
    }

    #[test]
    fn test_sniped_tracking() {
        let config = SniperConfig::default();
        let mut sniper = SniperStrategy::new(config);

        assert!(!sniper.already_sniped("game1"));
        sniper.mark_sniped("game1".to_string());
        assert!(sniper.already_sniped("game1"));
    }
}
