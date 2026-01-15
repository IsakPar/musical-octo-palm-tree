//! Paper Trading Simulator
//!
//! Simulates order fills based on current order book depth.
//! Used for validating strategies without risking real capital.

use parking_lot::RwLock;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use tracing::info;

use crate::execution::Side;
use crate::market::{MarketData, TokenId};

/// A simulated fill
#[derive(Debug, Clone)]
pub struct PaperFill {
    pub token_id: TokenId,
    pub side: Side,
    pub price: f64,
    pub size: f64,
    pub timestamp_ns: u64,
}

/// A completed arbitrage trade (both legs)
#[derive(Debug, Clone)]
pub struct PaperArbTrade {
    pub yes_fill: PaperFill,
    pub no_fill: PaperFill,
    pub gross_profit: f64,
    pub net_profit: f64,
    pub timestamp_ns: u64,
}

/// Paper trading simulator for validating strategies
pub struct PaperTrader {
    fills: RwLock<Vec<PaperFill>>,
    arb_trades: RwLock<Vec<PaperArbTrade>>,
    total_pnl_cents: AtomicU64, // Store as cents to use atomic
    trade_count: AtomicU64,
    fee_rate: f64,
}

impl PaperTrader {
    /// Create a new paper trader
    pub fn new(fee_rate: f64) -> Self {
        Self {
            fills: RwLock::new(Vec::new()),
            arb_trades: RwLock::new(Vec::new()),
            total_pnl_cents: AtomicU64::new(0),
            trade_count: AtomicU64::new(0),
            fee_rate,
        }
    }

    /// Get current timestamp in nanoseconds
    fn now_ns() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64
    }

    /// Simulate buying a token based on current order book
    pub fn simulate_buy(
        &self,
        market_data: &MarketData,
        token_id: &TokenId,
        target_size: f64,
    ) -> Option<PaperFill> {
        let book = market_data.get_order_book(token_id)?;
        let vwap = book.vwap_buy(target_size)?;

        let fill = PaperFill {
            token_id: token_id.clone(),
            side: Side::Buy,
            price: vwap.vwap,
            size: vwap.total_size,
            timestamp_ns: Self::now_ns(),
        };

        self.fills.write().push(fill.clone());
        Some(fill)
    }

    /// Simulate an arbitrage trade (buy YES + buy NO)
    pub fn simulate_arb_trade(
        &self,
        market_data: &MarketData,
        yes_token: &TokenId,
        no_token: &TokenId,
        target_size: f64,
    ) -> Option<PaperArbTrade> {
        let yes_fill = self.simulate_buy(market_data, yes_token, target_size)?;
        let no_fill = self.simulate_buy(market_data, no_token, target_size)?;

        // Calculate actual fillable size (min of both)
        let actual_size = yes_fill.size.min(no_fill.size);

        // Calculate profits
        let total_cost = yes_fill.price * actual_size + no_fill.price * actual_size;
        let total_fees = total_cost * self.fee_rate;
        let gross_profit = actual_size - total_cost; // 1 share YES + 1 share NO = $1
        let net_profit = gross_profit - total_fees;

        let trade = PaperArbTrade {
            yes_fill,
            no_fill,
            gross_profit,
            net_profit,
            timestamp_ns: Self::now_ns(),
        };

        // Update stats
        self.arb_trades.write().push(trade.clone());

        // Update PnL (convert to cents for atomic storage)
        let pnl_cents = (net_profit * 100.0) as u64;
        self.total_pnl_cents.fetch_add(pnl_cents, Ordering::Relaxed);
        self.trade_count.fetch_add(1, Ordering::Relaxed);

        info!(
            "[PAPER] ARB: YES@${:.4} + NO@${:.4} = ${:.4} | size={:.0} | gross=${:.4} | net=${:.4}",
            trade.yes_fill.price,
            trade.no_fill.price,
            trade.yes_fill.price + trade.no_fill.price,
            actual_size,
            gross_profit,
            net_profit
        );

        Some(trade)
    }

    /// Get total P&L in dollars
    pub fn get_pnl(&self) -> f64 {
        self.total_pnl_cents.load(Ordering::Relaxed) as f64 / 100.0
    }

    /// Get total trade count
    pub fn get_trade_count(&self) -> u64 {
        self.trade_count.load(Ordering::Relaxed)
    }

    /// Get all fills
    pub fn get_fills(&self) -> Vec<PaperFill> {
        self.fills.read().clone()
    }

    /// Get all arb trades
    pub fn get_arb_trades(&self) -> Vec<PaperArbTrade> {
        self.arb_trades.read().clone()
    }

    /// Get summary statistics
    pub fn get_stats(&self) -> PaperTraderStats {
        let trades = self.arb_trades.read();

        if trades.is_empty() {
            return PaperTraderStats::default();
        }

        let total_gross: f64 = trades.iter().map(|t| t.gross_profit).sum();
        let total_net: f64 = trades.iter().map(|t| t.net_profit).sum();
        let winning_trades = trades.iter().filter(|t| t.net_profit > 0.0).count();

        PaperTraderStats {
            trade_count: trades.len(),
            winning_trades,
            total_gross_profit: total_gross,
            total_net_profit: total_net,
            win_rate: winning_trades as f64 / trades.len() as f64,
            avg_profit_per_trade: total_net / trades.len() as f64,
        }
    }

    /// Reset all stats (for testing or new sessions)
    pub fn reset(&self) {
        self.fills.write().clear();
        self.arb_trades.write().clear();
        self.total_pnl_cents.store(0, Ordering::Relaxed);
        self.trade_count.store(0, Ordering::Relaxed);
    }
}

/// Summary statistics for paper trading
#[derive(Debug, Clone, Default)]
pub struct PaperTraderStats {
    pub trade_count: usize,
    pub winning_trades: usize,
    pub total_gross_profit: f64,
    pub total_net_profit: f64,
    pub win_rate: f64,
    pub avg_profit_per_trade: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market::{DepthLevel, MarketPair};

    #[test]
    fn test_paper_buy() {
        let trader = PaperTrader::new(0.01);
        let market_data = MarketData::new();

        let pair = MarketPair {
            market_id: "test".into(),
            yes_token: "yes".into(),
            no_token: "no".into(),
            question: "Test?".into(),
        };
        market_data.register_pair(pair);

        market_data.update_order_book(
            &"yes".into(),
            vec![DepthLevel::new(0.44, 100.0)],
            vec![DepthLevel::new(0.45, 100.0)],
        );

        let fill = trader.simulate_buy(&market_data, &"yes".into(), 50.0);
        assert!(fill.is_some());

        let fill = fill.unwrap();
        assert!((fill.price - 0.45).abs() < 0.001);
        assert!((fill.size - 50.0).abs() < 0.001);
    }

    #[test]
    fn test_paper_arb_trade() {
        let trader = PaperTrader::new(0.01);
        let market_data = MarketData::new();

        let pair = MarketPair {
            market_id: "test".into(),
            yes_token: "yes".into(),
            no_token: "no".into(),
            question: "Test?".into(),
        };
        market_data.register_pair(pair);

        // Profitable spread: 0.45 + 0.50 = 0.95
        market_data.update_order_book(
            &"yes".into(),
            vec![DepthLevel::new(0.44, 100.0)],
            vec![DepthLevel::new(0.45, 100.0)],
        );
        market_data.update_order_book(
            &"no".into(),
            vec![DepthLevel::new(0.49, 100.0)],
            vec![DepthLevel::new(0.50, 100.0)],
        );

        let trade = trader.simulate_arb_trade(&market_data, &"yes".into(), &"no".into(), 50.0);
        assert!(trade.is_some());

        let trade = trade.unwrap();
        // 50 shares * ($1 - $0.95) = $2.50 gross profit
        assert!(trade.gross_profit > 0.0);
        assert!(trade.net_profit > 0.0);
        assert!(trader.get_pnl() > 0.0);
    }
}
