//! Strategy engine that runs all strategies in a loop.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};

use crate::db::{ArbTrade, Trade, TradeRepository};
use crate::execution::OrderManager;
use crate::market::MarketData;
use crate::metrics::{DAILY_PNL, EVALUATIONS_TOTAL, SIGNALS_TOTAL};
use crate::notifications::{OrderNotification, SlackNotifier};
use crate::redis::{now_ms, EngineState, RedisPublisher, SignalMessage, TradeMessage};
use crate::risk::RiskManager;

use super::{Strategy, TradeSignal};

/// Get current time as nanoseconds since UNIX epoch (lock-free timestamp)
fn now_ns() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64
}

/// Named signal for tracking which strategy generated it
struct NamedSignal {
    strategy_name: &'static str,
    signal: TradeSignal,
}

/// Strategy engine that evaluates all strategies and executes signals.
pub struct StrategyEngine {
    strategies: Vec<Box<dyn Strategy>>,
    market_data: Arc<MarketData>,
    risk_manager: Arc<RiskManager>,
    order_manager: Arc<OrderManager>,
    redis_publisher: Option<Arc<RedisPublisher>>,
    slack_notifier: Option<Arc<SlackNotifier>>,
    trade_repo: Option<Arc<TradeRepository>>,
    cancellation_token: Option<CancellationToken>,
    eval_interval_ms: u64,
    // Metrics for logging
    eval_count: AtomicU64,
    signal_count: AtomicU64,
    /// Last heartbeat time as nanoseconds since UNIX epoch (lock-free)
    last_heartbeat_ns: AtomicU64,
    /// Engine start time as nanoseconds since UNIX epoch
    start_time_ns: u64,
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
            redis_publisher: None,
            slack_notifier: None,
            trade_repo: None,
            cancellation_token: None,
            eval_interval_ms: 100, // 10 Hz by default
            eval_count: AtomicU64::new(0),
            signal_count: AtomicU64::new(0),
            last_heartbeat_ns: AtomicU64::new(now_ns()),
            start_time_ns: now_ns(),
        }
    }

    /// Set the cancellation token for graceful shutdown.
    pub fn set_cancellation_token(&mut self, token: CancellationToken) {
        self.cancellation_token = Some(token);
    }

    /// Set the Redis publisher for streaming data to dashboard.
    pub fn set_redis_publisher(&mut self, publisher: Arc<RedisPublisher>) {
        if publisher.is_enabled() {
            info!("[ENGINE] Redis publisher enabled - streaming to dashboard");
            self.redis_publisher = Some(publisher);
        }
    }

    /// Set the Slack notifier for trade notifications.
    pub fn set_slack_notifier(&mut self, notifier: Arc<SlackNotifier>) {
        if notifier.is_enabled() {
            info!("[ENGINE] Slack notifier enabled - sending trade alerts");
            self.slack_notifier = Some(notifier);
        }
    }

    /// Set the trade repository for database persistence.
    pub fn set_trade_repo(&mut self, repo: Arc<TradeRepository>) {
        if repo.is_enabled() {
            info!("[ENGINE] Database persistence enabled - storing trades");
            self.trade_repo = Some(repo);
        }
    }

    /// Add a strategy to the engine.
    pub fn add_strategy(&mut self, strategy: Box<dyn Strategy>) {
        info!("Adding strategy: {}", strategy.name());
        self.strategies.push(strategy);
    }

    /// Set the evaluation interval in milliseconds.
    #[allow(dead_code)]
    pub fn set_eval_interval(&mut self, ms: u64) {
        self.eval_interval_ms = ms;
    }

    /// Run the strategy engine loop.
    pub async fn run(&mut self) {
        info!(
            "Strategy engine starting with {} strategies @ {} Hz",
            self.strategies.len(),
            1000 / self.eval_interval_ms
        );

        let mut ticker = interval(Duration::from_millis(self.eval_interval_ms));
        let mut waiting_for_data = true;
        let heartbeat_interval = Duration::from_secs(60); // Log heartbeat every minute

        loop {
            // Check for cancellation with cancellation-aware tick
            if let Some(ref token) = self.cancellation_token {
                tokio::select! {
                    _ = ticker.tick() => {}
                    _ = token.cancelled() => {
                        info!("[ENGINE] Shutdown requested - stopping strategy engine gracefully");
                        return;
                    }
                }
            } else {
                ticker.tick().await;
            }

            // Check for cancellation at the start of each loop iteration
            if let Some(ref token) = self.cancellation_token {
                if token.is_cancelled() {
                    info!("[ENGINE] Shutdown requested - stopping strategy engine gracefully");
                    return;
                }
            }

            // Skip if no market data yet
            if !self.market_data.has_data() {
                if waiting_for_data {
                    info!("[HEARTBEAT] Waiting for market data from WebSocket...");
                }
                continue;
            }

            // First time we have data
            if waiting_for_data {
                waiting_for_data = false;
                info!("[HEARTBEAT] Market data received! Starting strategy evaluation.");
            }

            // Increment eval counter (both internal counter and Prometheus metric)
            let evals = self.eval_count.fetch_add(1, Ordering::Relaxed) + 1;
            EVALUATIONS_TOTAL.inc();

            // Periodic heartbeat log and Redis state publish (every minute)
            let heartbeat_interval_ns = heartbeat_interval.as_nanos() as u64;
            let current_ns = now_ns();
            let last_hb_ns = self.last_heartbeat_ns.load(Ordering::Relaxed);
            if current_ns.saturating_sub(last_hb_ns) >= heartbeat_interval_ns {
                let signals = self.signal_count.load(Ordering::Relaxed);
                let markets = self.market_data.get_all_pairs().len();
                let order_books = self.market_data.order_book_count();
                let uptime_secs = current_ns.saturating_sub(self.start_time_ns) / 1_000_000_000;

                info!(
                    "[HEARTBEAT] Engine alive | evals={} | signals={} | markets={} | order_books={} | uptime={}s",
                    evals,
                    signals,
                    markets,
                    order_books,
                    uptime_secs
                );

                // Update Prometheus daily P&L gauge
                DAILY_PNL.set(self.risk_manager.get_daily_pnl());

                // Publish state to Redis (fire-and-forget, non-blocking)
                if let Some(ref publisher) = self.redis_publisher {
                    let state = EngineState {
                        timestamp_ms: now_ms(),
                        status: "running".to_string(),
                        markets_tracked: markets,
                        opportunities_found: signals as usize,
                        daily_pnl: self.risk_manager.get_daily_pnl(),
                        daily_trades: self.risk_manager.get_daily_trades(),
                        positions: vec![], // TODO: Get from risk manager
                    };
                    let pub_clone = Arc::clone(publisher);
                    tokio::spawn(async move {
                        let _ = pub_clone.publish_state(&state).await;
                    });
                }

                self.last_heartbeat_ns.store(current_ns, Ordering::Relaxed);
            }

            // Phase 1: Collect all signals from all strategies (sync, CPU-bound)
            let signals: Vec<NamedSignal> = self
                .strategies
                .iter()
                .filter(|s| s.is_active())
                .filter_map(|strategy| {
                    strategy
                        .evaluate(&self.market_data)
                        .map(|signal| NamedSignal {
                            strategy_name: strategy.name(),
                            signal,
                        })
                })
                .collect();

            if signals.is_empty() {
                continue;
            }

            // Count signals
            self.signal_count
                .fetch_add(signals.len() as u64, Ordering::Relaxed);

            info!("[ENGINE] {} signal(s) generated this cycle", signals.len());

            // Phase 2: Handle signals concurrently (async, I/O-bound)
            // This allows multiple orders to be in-flight simultaneously
            let futures: Vec<_> = signals
                .into_iter()
                .map(|named| self.handle_signal(named.strategy_name, named.signal))
                .collect();

            futures::future::join_all(futures).await;
        }
    }

    /// Handle a trade signal from a strategy.
    async fn handle_signal(&self, strategy_name: &str, signal: TradeSignal) {
        info!("[{}] Signal: {}", strategy_name, signal.description());

        // Record signal in Prometheus metrics
        let signal_type = match &signal {
            TradeSignal::Buy { .. } => "buy",
            TradeSignal::Sell { .. } => "sell",
            TradeSignal::Arbitrage { .. } => "arbitrage",
        };
        SIGNALS_TOTAL
            .with_label_values(&[strategy_name, signal_type])
            .inc();

        // Publish signal to Redis (fire-and-forget)
        self.publish_signal_to_redis(strategy_name, &signal);

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
                reason,
            } => match self.order_manager.place_buy(token_id, *price, *size).await {
                Ok(order_id) => {
                    info!("[{}] Buy order placed: {}", strategy_name, order_id);
                    self.risk_manager.record_trade(&signal);
                    self.publish_trade_to_redis(strategy_name, &signal, Some(&order_id), "FILLED");
                    self.notify_slack_order(
                        strategy_name,
                        "BUY",
                        Some(token_id),
                        None,
                        None,
                        Some(*price),
                        None,
                        None,
                        *size,
                        Some(&order_id),
                        "FILLED",
                        None,
                    );
                    self.persist_trade_to_db(
                        strategy_name,
                        token_id,
                        "BUY",
                        *price,
                        *size,
                        Some(&order_id),
                        "FILLED",
                        Some(reason.as_str()),
                    );
                }
                Err(e) => {
                    warn!("[{}] Buy order failed: {}", strategy_name, e);
                    let status = format!("FAILED: {}", e);
                    self.publish_trade_to_redis(strategy_name, &signal, None, &status);
                    self.notify_slack_order(
                        strategy_name,
                        "BUY",
                        Some(token_id),
                        None,
                        None,
                        Some(*price),
                        None,
                        None,
                        *size,
                        None,
                        &status,
                        None,
                    );
                    self.persist_trade_to_db(
                        strategy_name,
                        token_id,
                        "BUY",
                        *price,
                        *size,
                        None,
                        &status,
                        Some(reason.as_str()),
                    );
                }
            },
            TradeSignal::Sell {
                token_id,
                price,
                size,
                reason,
            } => match self.order_manager.place_sell(token_id, *price, *size).await {
                Ok(order_id) => {
                    info!("[{}] Sell order placed: {}", strategy_name, order_id);
                    self.risk_manager.record_trade(&signal);
                    self.publish_trade_to_redis(strategy_name, &signal, Some(&order_id), "FILLED");
                    self.notify_slack_order(
                        strategy_name,
                        "SELL",
                        Some(token_id),
                        None,
                        None,
                        Some(*price),
                        None,
                        None,
                        *size,
                        Some(&order_id),
                        "FILLED",
                        None,
                    );
                    self.persist_trade_to_db(
                        strategy_name,
                        token_id,
                        "SELL",
                        *price,
                        *size,
                        Some(&order_id),
                        "FILLED",
                        Some(reason.as_str()),
                    );
                }
                Err(e) => {
                    warn!("[{}] Sell order failed: {}", strategy_name, e);
                    let status = format!("FAILED: {}", e);
                    self.publish_trade_to_redis(strategy_name, &signal, None, &status);
                    self.notify_slack_order(
                        strategy_name,
                        "SELL",
                        Some(token_id),
                        None,
                        None,
                        Some(*price),
                        None,
                        None,
                        *size,
                        None,
                        &status,
                        None,
                    );
                    self.persist_trade_to_db(
                        strategy_name,
                        token_id,
                        "SELL",
                        *price,
                        *size,
                        None,
                        &status,
                        Some(reason.as_str()),
                    );
                }
            },
            TradeSignal::Arbitrage {
                yes_token,
                no_token,
                yes_price,
                no_price,
                profit_per_share,
                size,
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
                        let pnl = profit_per_share * size;
                        // Publish arbitrage trade
                        self.publish_arb_trade_to_redis(
                            strategy_name,
                            yes_token,
                            no_token,
                            *yes_price,
                            *no_price,
                            *size,
                            *profit_per_share,
                            Some(&yes_id),
                            Some(&no_id),
                            "FILLED",
                        );
                        self.notify_slack_order(
                            strategy_name,
                            "ARBITRAGE",
                            None,
                            Some(yes_token),
                            Some(no_token),
                            None,
                            Some(*yes_price),
                            Some(*no_price),
                            *size,
                            None,
                            "FILLED",
                            Some(pnl),
                        );
                        self.persist_arb_trade_to_db(
                            strategy_name,
                            yes_token,
                            no_token,
                            *yes_price,
                            *no_price,
                            *size,
                            *profit_per_share,
                            Some(&yes_id),
                            Some(&no_id),
                            "FILLED",
                        );
                    }
                    (Err(e), _) | (_, Err(e)) => {
                        warn!("[{}] Arbitrage order failed: {}", strategy_name, e);
                        let status = format!("FAILED: {}", e);
                        self.publish_arb_trade_to_redis(
                            strategy_name,
                            yes_token,
                            no_token,
                            *yes_price,
                            *no_price,
                            *size,
                            *profit_per_share,
                            None,
                            None,
                            &status,
                        );
                        self.notify_slack_order(
                            strategy_name,
                            "ARBITRAGE",
                            None,
                            Some(yes_token),
                            Some(no_token),
                            None,
                            Some(*yes_price),
                            Some(*no_price),
                            *size,
                            None,
                            &status,
                            None,
                        );
                        self.persist_arb_trade_to_db(
                            strategy_name,
                            yes_token,
                            no_token,
                            *yes_price,
                            *no_price,
                            *size,
                            *profit_per_share,
                            None,
                            None,
                            &status,
                        );
                    }
                }
            }
        }
    }

    /// Send order notification to Slack (fire-and-forget)
    #[allow(clippy::too_many_arguments)]
    fn notify_slack_order(
        &self,
        strategy: &str,
        order_type: &str,
        token_id: Option<&String>,
        yes_token: Option<&String>,
        no_token: Option<&String>,
        price: Option<f64>,
        yes_price: Option<f64>,
        no_price: Option<f64>,
        size: f64,
        order_id: Option<&str>,
        status: &str,
        pnl: Option<f64>,
    ) {
        if let Some(ref notifier) = self.slack_notifier {
            let notification = OrderNotification {
                strategy: strategy.to_string(),
                order_type: order_type.to_string(),
                token_id: token_id.cloned(),
                yes_token: yes_token.cloned(),
                no_token: no_token.cloned(),
                price,
                yes_price,
                no_price,
                size,
                order_id: order_id.map(|s| s.to_string()),
                status: status.to_string(),
                pnl,
                is_paper: self.order_manager.is_dry_run(),
            };
            notifier.notify_order(notification);
        }
    }

    /// Publish signal to Redis (fire-and-forget, non-blocking)
    fn publish_signal_to_redis(&self, strategy_name: &str, signal: &TradeSignal) {
        if let Some(ref publisher) = self.redis_publisher {
            let msg = match signal {
                TradeSignal::Buy {
                    token_id,
                    price,
                    size,
                    reason,
                } => SignalMessage {
                    timestamp_ms: now_ms(),
                    strategy: strategy_name.to_string(),
                    signal_type: "BUY".to_string(),
                    token_id: Some(token_id.clone()),
                    yes_token_id: None,
                    no_token_id: None,
                    price: Some(*price),
                    yes_price: None,
                    no_price: None,
                    size: *size,
                    edge: None,
                    reason: reason.clone(),
                },
                TradeSignal::Sell {
                    token_id,
                    price,
                    size,
                    reason,
                } => SignalMessage {
                    timestamp_ms: now_ms(),
                    strategy: strategy_name.to_string(),
                    signal_type: "SELL".to_string(),
                    token_id: Some(token_id.clone()),
                    yes_token_id: None,
                    no_token_id: None,
                    price: Some(*price),
                    yes_price: None,
                    no_price: None,
                    size: *size,
                    edge: None,
                    reason: reason.clone(),
                },
                TradeSignal::Arbitrage {
                    yes_token,
                    no_token,
                    yes_price,
                    no_price,
                    profit_per_share,
                    size,
                } => SignalMessage {
                    timestamp_ms: now_ms(),
                    strategy: strategy_name.to_string(),
                    signal_type: "ARBITRAGE".to_string(),
                    token_id: None,
                    yes_token_id: Some(yes_token.clone()),
                    no_token_id: Some(no_token.clone()),
                    price: None,
                    yes_price: Some(*yes_price),
                    no_price: Some(*no_price),
                    size: *size,
                    edge: Some(*profit_per_share),
                    reason: format!(
                        "Arbitrage: YES@{:.4} + NO@{:.4} = {:.4} profit",
                        yes_price, no_price, profit_per_share
                    ),
                },
            };
            let pub_clone = Arc::clone(publisher);
            tokio::spawn(async move {
                let _ = pub_clone.publish_signal(&msg).await;
            });
        }
    }

    /// Publish trade to Redis (fire-and-forget, non-blocking)
    fn publish_trade_to_redis(
        &self,
        strategy_name: &str,
        signal: &TradeSignal,
        order_id: Option<&str>,
        status: &str,
    ) {
        if let Some(ref publisher) = self.redis_publisher {
            let msg = match signal {
                TradeSignal::Buy {
                    token_id,
                    price,
                    size,
                    ..
                } => TradeMessage {
                    timestamp_ms: now_ms(),
                    strategy: strategy_name.to_string(),
                    trade_type: "BUY".to_string(),
                    token_id: Some(token_id.clone()),
                    yes_token_id: None,
                    no_token_id: None,
                    price: Some(*price),
                    yes_price: None,
                    no_price: None,
                    size: *size,
                    order_id: order_id.map(|s| s.to_string()),
                    yes_order_id: None,
                    no_order_id: None,
                    status: status.to_string(),
                    pnl: None,
                    is_paper: self.order_manager.is_dry_run(),
                },
                TradeSignal::Sell {
                    token_id,
                    price,
                    size,
                    ..
                } => TradeMessage {
                    timestamp_ms: now_ms(),
                    strategy: strategy_name.to_string(),
                    trade_type: "SELL".to_string(),
                    token_id: Some(token_id.clone()),
                    yes_token_id: None,
                    no_token_id: None,
                    price: Some(*price),
                    yes_price: None,
                    no_price: None,
                    size: *size,
                    order_id: order_id.map(|s| s.to_string()),
                    yes_order_id: None,
                    no_order_id: None,
                    status: status.to_string(),
                    pnl: None,
                    is_paper: self.order_manager.is_dry_run(),
                },
                _ => return, // Arbitrage handled separately
            };
            let pub_clone = Arc::clone(publisher);
            tokio::spawn(async move {
                let _ = pub_clone.publish_trade(&msg).await;
            });
        }
    }

    /// Publish arbitrage trade to Redis (fire-and-forget, non-blocking)
    #[allow(clippy::too_many_arguments)]
    fn publish_arb_trade_to_redis(
        &self,
        strategy_name: &str,
        yes_token: &str,
        no_token: &str,
        yes_price: f64,
        no_price: f64,
        size: f64,
        edge: f64,
        yes_order_id: Option<&str>,
        no_order_id: Option<&str>,
        status: &str,
    ) {
        if let Some(ref publisher) = self.redis_publisher {
            let pnl = if status.starts_with("FILLED") {
                Some(edge * size) // Profit = edge per share * number of shares
            } else {
                None
            };
            let msg = TradeMessage {
                timestamp_ms: now_ms(),
                strategy: strategy_name.to_string(),
                trade_type: "ARBITRAGE".to_string(),
                token_id: None,
                yes_token_id: Some(yes_token.to_string()),
                no_token_id: Some(no_token.to_string()),
                price: None,
                yes_price: Some(yes_price),
                no_price: Some(no_price),
                size,
                order_id: None,
                yes_order_id: yes_order_id.map(|s| s.to_string()),
                no_order_id: no_order_id.map(|s| s.to_string()),
                status: status.to_string(),
                pnl,
                is_paper: self.order_manager.is_dry_run(),
            };
            let pub_clone = Arc::clone(publisher);
            tokio::spawn(async move {
                let _ = pub_clone.publish_trade(&msg).await;
            });
        }
    }

    /// Persist trade to database (fire-and-forget, non-blocking)
    #[allow(clippy::too_many_arguments)]
    fn persist_trade_to_db(
        &self,
        strategy_name: &str,
        token_id: &str,
        side: &str,
        price: f64,
        size: f64,
        order_id: Option<&str>,
        status: &str,
        reason: Option<&str>,
    ) {
        if let Some(ref repo) = self.trade_repo {
            let trade = Trade {
                token_id: token_id.to_string(),
                side: side.to_string(),
                price,
                size,
                order_id: order_id.map(|s| s.to_string()),
                status: status.to_string(),
                strategy: strategy_name.to_string(),
                signal_reason: reason.map(|s| s.to_string()),
                is_paper: self.order_manager.is_dry_run(),
            };
            repo.insert_trade(trade);
        }
    }

    /// Persist arbitrage trade to database (fire-and-forget, non-blocking)
    #[allow(clippy::too_many_arguments)]
    fn persist_arb_trade_to_db(
        &self,
        strategy_name: &str,
        yes_token: &str,
        no_token: &str,
        yes_price: f64,
        no_price: f64,
        size: f64,
        _profit_per_share: f64,
        yes_order_id: Option<&str>,
        no_order_id: Option<&str>,
        status: &str,
    ) {
        if let Some(ref repo) = self.trade_repo {
            let total_cost = (yes_price + no_price) * size;
            let fee_rate = 0.01; // 1% total fees
            let fees = total_cost * fee_rate;
            let gross_profit = (1.0 - yes_price - no_price) * size;
            let net_profit = gross_profit - fees;

            let trade = ArbTrade {
                market_id: format!(
                    "{}:{}",
                    &yes_token[..8.min(yes_token.len())],
                    &no_token[..8.min(no_token.len())]
                ),
                yes_token_id: yes_token.to_string(),
                no_token_id: no_token.to_string(),
                yes_price,
                no_price,
                size,
                total_cost,
                fees,
                gross_profit,
                net_profit,
                yes_order_id: yes_order_id.map(|s| s.to_string()),
                no_order_id: no_order_id.map(|s| s.to_string()),
                status: status.to_string(),
                strategy: strategy_name.to_string(),
                is_paper: self.order_manager.is_dry_run(),
            };
            repo.insert_arb_trade(trade);
        }
    }
}
