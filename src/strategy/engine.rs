//! Strategy engine that runs all strategies in a loop.

use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;
use tracing::{debug, info, warn};

use crate::execution::OrderManager;
use crate::market::MarketData;
use crate::risk::RiskManager;

use super::{Strategy, TradeSignal};

/// Strategy engine that evaluates all strategies and executes signals.
pub struct StrategyEngine {
    strategies: Vec<Box<dyn Strategy>>,
    market_data: Arc<MarketData>,
    risk_manager: Arc<RiskManager>,
    order_manager: Arc<OrderManager>,
    eval_interval_ms: u64,
}

impl StrategyEngine {
    /// Create a new strategy engine.
    pub fn new(
        market_data: Arc<MarketData>,
        risk_manager: Arc<RiskManager>,
        order_manager: Arc<OrderManager>,
    ) -> Self {
        Self {
            strategies: Vec::new(),
            market_data,
            risk_manager,
            order_manager,
            eval_interval_ms: 100, // 10 Hz by default
        }
    }

    /// Add a strategy to the engine.
    pub fn add_strategy(&mut self, strategy: Box<dyn Strategy>) {
        info!("Adding strategy: {}", strategy.name());
        self.strategies.push(strategy);
    }

    /// Set the evaluation interval in milliseconds.
    pub fn set_eval_interval(&mut self, ms: u64) {
        self.eval_interval_ms = ms;
    }

    /// Run the strategy engine loop.
    pub async fn run(&mut self) {
        info!(
            "Strategy engine starting with {} strategies",
            self.strategies.len()
        );

        let mut ticker = interval(Duration::from_millis(self.eval_interval_ms));

        loop {
            ticker.tick().await;

            // Skip if no market data yet
            if !self.market_data.has_data() {
                debug!("Waiting for market data...");
                continue;
            }

            // Evaluate each strategy
            for strategy in &self.strategies {
                if !strategy.is_active() {
                    continue;
                }

                if let Some(signal) = strategy.evaluate(&self.market_data) {
                    self.handle_signal(strategy.name(), signal).await;
                }
            }
        }
    }

    /// Handle a trade signal from a strategy.
    async fn handle_signal(&self, strategy_name: &str, signal: TradeSignal) {
        info!(
            "[{}] Signal: {}",
            strategy_name,
            signal.description()
        );

        // Check risk limits
        if !self.risk_manager.check_signal(&signal) {
            warn!(
                "[{}] Signal rejected by risk manager: {}",
                strategy_name,
                signal.description()
            );
            return;
        }

        // Execute the signal
        match &signal {
            TradeSignal::Buy {
                token_id,
                price,
                size,
                ..
            } => {
                match self.order_manager.place_buy(token_id, *price, *size).await {
                    Ok(order_id) => {
                        info!("[{}] Buy order placed: {}", strategy_name, order_id);
                        self.risk_manager.record_trade(&signal);
                    }
                    Err(e) => {
                        warn!("[{}] Buy order failed: {}", strategy_name, e);
                    }
                }
            }
            TradeSignal::Sell {
                token_id,
                price,
                size,
                ..
            } => {
                match self.order_manager.place_sell(token_id, *price, *size).await {
                    Ok(order_id) => {
                        info!("[{}] Sell order placed: {}", strategy_name, order_id);
                        self.risk_manager.record_trade(&signal);
                    }
                    Err(e) => {
                        warn!("[{}] Sell order failed: {}", strategy_name, e);
                    }
                }
            }
            TradeSignal::Arbitrage {
                yes_token,
                no_token,
                yes_price,
                no_price,
                size,
                ..
            } => {
                // For arbitrage, we need to place both orders
                let buy_yes = self
                    .order_manager
                    .place_buy(yes_token, *yes_price, *size)
                    .await;
                let buy_no = self
                    .order_manager
                    .place_buy(no_token, *no_price, *size)
                    .await;

                match (buy_yes, buy_no) {
                    (Ok(yes_id), Ok(no_id)) => {
                        info!(
                            "[{}] Arbitrage orders placed: YES={}, NO={}",
                            strategy_name, yes_id, no_id
                        );
                        self.risk_manager.record_trade(&signal);
                    }
                    (Err(e), _) | (_, Err(e)) => {
                        warn!("[{}] Arbitrage order failed: {}", strategy_name, e);
                        // TODO: Handle partial fills - cancel the successful order
                    }
                }
            }
        }
    }
}
