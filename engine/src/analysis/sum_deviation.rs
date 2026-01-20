//! Sum-to-100 Deviation Analyzer
//!
//! Finds markets where YES_ask + NO_ask < 1.00 (exploitable mispricing).
//! Uses VWAP calculations to account for depth and liquidity.

use crate::config::SumTo100Config;
use crate::market::{MarketData, MarketPair, TokenId, VwapResult};

/// A detected arbitrage opportunity
#[derive(Debug, Clone)]
pub struct SumDeviationOpportunity {
    /// Market ID
    pub market_id: String,
    /// YES token ID
    pub yes_token: TokenId,
    /// NO token ID
    pub no_token: TokenId,
    /// VWAP result for buying YES
    pub yes_vwap: VwapResult,
    /// VWAP result for buying NO
    pub no_vwap: VwapResult,
    /// Sum of VWAP prices (yes_vwap.vwap + no_vwap.vwap)
    pub sum: f64,
    /// Net edge after fees (1.0 - sum - fees)
    pub edge: f64,
    /// Recommended position size (min of available liquidity and config limits)
    pub recommended_size: f64,
    /// Confidence based on liquidity depth (0.0 - 1.0)
    pub confidence: f64,
}

/// Analyzer that scans markets for sum-to-100 arbitrage opportunities
pub struct SumDeviationAnalyzer {
    config: SumTo100Config,
}

impl SumDeviationAnalyzer {
    /// Create a new analyzer with the given configuration
    pub fn new(config: SumTo100Config) -> Self {
        Self { config }
    }

    /// Analyze all markets and return opportunities sorted by edge (highest first)
    pub fn analyze(&self, market_data: &MarketData) -> Vec<SumDeviationOpportunity> {
        let mut opportunities: Vec<SumDeviationOpportunity> = market_data
            .get_all_pairs()
            .iter()
            .filter_map(|(market_id, pair)| self.analyze_pair(market_id, pair, market_data))
            .collect();

        // Sort by edge descending (best opportunities first)
        opportunities.sort_by(|a, b| {
            b.edge
                .partial_cmp(&a.edge)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        opportunities
    }

    /// Analyze a single market pair for arbitrage opportunity
    fn analyze_pair(
        &self,
        market_id: &str,
        pair: &MarketPair,
        market_data: &MarketData,
    ) -> Option<SumDeviationOpportunity> {
        // Get order books for both tokens
        let yes_book = market_data.get_order_book(&pair.yes_token)?;
        let no_book = market_data.get_order_book(&pair.no_token)?;

        // Check if data is stale
        let max_age_ns = self.config.max_book_age_ms * 1_000_000;
        if yes_book.is_stale(max_age_ns) || no_book.is_stale(max_age_ns) {
            return None;
        }

        // Calculate VWAP for target position size
        let target_size = self.config.max_position;
        let yes_vwap = yes_book.vwap_buy(target_size)?;
        let no_vwap = no_book.vwap_buy(target_size)?;

        // Check minimum liquidity requirement
        if yes_vwap.total_size < self.config.min_liquidity
            || no_vwap.total_size < self.config.min_liquidity
        {
            return None;
        }

        // Calculate sum and edge
        let sum = yes_vwap.vwap + no_vwap.vwap;
        let edge = 1.0 - sum - self.config.fee_rate;

        // Only report if edge exceeds minimum threshold
        if edge < self.config.min_edge {
            return None;
        }

        // Determine recommended size (limited by liquidity and config)
        let max_fillable = yes_vwap.total_size.min(no_vwap.total_size);
        let max_from_notional = self.config.max_notional / sum;
        let recommended_size = max_fillable
            .min(self.config.max_position)
            .min(max_from_notional);

        // Calculate confidence based on liquidity depth
        // More liquidity relative to target = higher confidence
        let liquidity_ratio = max_fillable / target_size;
        let confidence = (liquidity_ratio.min(2.0) / 2.0).min(1.0);

        Some(SumDeviationOpportunity {
            market_id: market_id.to_string(),
            yes_token: pair.yes_token.clone(),
            no_token: pair.no_token.clone(),
            yes_vwap,
            no_vwap,
            sum,
            edge,
            recommended_size,
            confidence,
        })
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
            max_book_age_ms: 60000, // 60 seconds for tests
        }
    }

    #[test]
    fn test_analyzer_finds_opportunity() {
        let config = create_test_config();
        let analyzer = SumDeviationAnalyzer::new(config);
        let market_data = MarketData::new();

        // Register a market pair
        let pair = MarketPair {
            market_id: "test_market".into(),
            yes_token: "yes_token".into(),
            no_token: "no_token".into(),
            question: "Will it happen?".into(),
        };
        market_data.register_pair(pair);

        // Set up order books with profitable spread
        // YES ask: $0.45, NO ask: $0.50, sum = $0.95
        // Edge = 1.0 - 0.95 - 0.01 (fees) = 0.04 = 4%
        market_data.update_order_book(
            &"yes_token".into(),
            vec![DepthLevel::new(0.44, 100.0)], // bids
            vec![DepthLevel::new(0.45, 100.0)], // asks
        );
        market_data.update_order_book(
            &"no_token".into(),
            vec![DepthLevel::new(0.49, 100.0)], // bids
            vec![DepthLevel::new(0.50, 100.0)], // asks
        );

        let opportunities = analyzer.analyze(&market_data);
        assert_eq!(opportunities.len(), 1);

        let opp = &opportunities[0];
        assert_eq!(opp.market_id, "test_market");
        assert!((opp.sum - 0.95).abs() < 0.001);
        assert!((opp.edge - 0.04).abs() < 0.001);
    }

    #[test]
    fn test_analyzer_rejects_unprofitable() {
        let config = create_test_config();
        let analyzer = SumDeviationAnalyzer::new(config);
        let market_data = MarketData::new();

        // Register a market pair
        let pair = MarketPair {
            market_id: "test_market".into(),
            yes_token: "yes_token".into(),
            no_token: "no_token".into(),
            question: "Will it happen?".into(),
        };
        market_data.register_pair(pair);

        // Set up order books WITHOUT profitable spread
        // YES ask: $0.50, NO ask: $0.52, sum = $1.02 (unprofitable!)
        market_data.update_order_book(
            &"yes_token".into(),
            vec![DepthLevel::new(0.49, 100.0)],
            vec![DepthLevel::new(0.50, 100.0)],
        );
        market_data.update_order_book(
            &"no_token".into(),
            vec![DepthLevel::new(0.51, 100.0)],
            vec![DepthLevel::new(0.52, 100.0)],
        );

        let opportunities = analyzer.analyze(&market_data);
        assert!(opportunities.is_empty());
    }

    #[test]
    fn test_analyzer_respects_liquidity_requirement() {
        let config = create_test_config();
        let analyzer = SumDeviationAnalyzer::new(config);
        let market_data = MarketData::new();

        // Register a market pair
        let pair = MarketPair {
            market_id: "test_market".into(),
            yes_token: "yes_token".into(),
            no_token: "no_token".into(),
            question: "Will it happen?".into(),
        };
        market_data.register_pair(pair);

        // Profitable spread but insufficient liquidity
        market_data.update_order_book(
            &"yes_token".into(),
            vec![DepthLevel::new(0.44, 100.0)],
            vec![DepthLevel::new(0.45, 5.0)], // Only 5 shares - below min_liquidity
        );
        market_data.update_order_book(
            &"no_token".into(),
            vec![DepthLevel::new(0.49, 100.0)],
            vec![DepthLevel::new(0.50, 100.0)],
        );

        let opportunities = analyzer.analyze(&market_data);
        assert!(opportunities.is_empty());
    }

    #[test]
    fn test_vwap_calculation_in_opportunity() {
        let config = create_test_config();
        let analyzer = SumDeviationAnalyzer::new(config);
        let market_data = MarketData::new();

        // Register a market pair
        let pair = MarketPair {
            market_id: "test_market".into(),
            yes_token: "yes_token".into(),
            no_token: "no_token".into(),
            question: "Will it happen?".into(),
        };
        market_data.register_pair(pair);

        // Set up order books with depth
        // YES: 50 @ $0.45, 50 @ $0.46
        // NO: 100 @ $0.48
        market_data.update_order_book(
            &"yes_token".into(),
            vec![DepthLevel::new(0.44, 100.0)],
            vec![DepthLevel::new(0.45, 50.0), DepthLevel::new(0.46, 50.0)],
        );
        market_data.update_order_book(
            &"no_token".into(),
            vec![DepthLevel::new(0.47, 100.0)],
            vec![DepthLevel::new(0.48, 100.0)],
        );

        let opportunities = analyzer.analyze(&market_data);
        assert_eq!(opportunities.len(), 1);

        let opp = &opportunities[0];
        // YES VWAP for 100 shares: (50*0.45 + 50*0.46) / 100 = 0.455
        assert!((opp.yes_vwap.vwap - 0.455).abs() < 0.001);
        // NO VWAP for 100 shares: 0.48
        assert!((opp.no_vwap.vwap - 0.48).abs() < 0.001);
    }
}
