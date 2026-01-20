//! Poly-Rust: High-performance trading bots for Polymarket
//!
//! This is the main entry point for the trading engine.

mod analysis;
mod config;
mod db;
mod execution;
mod external;
mod market;
mod metrics;
mod notifications;
mod redis;
mod risk;
mod strategy;
mod ws;

use anyhow::Result;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::signal;
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};

use crate::config::Config;
use crate::db::TradeRepository;
use crate::execution::OrderManager;
use crate::market::MarketData;
use crate::notifications::SlackNotifier;
use crate::redis::RedisPublisher;
use crate::risk::RiskManager;
use crate::strategy::{ClipperStrategy, SniperStrategy, StrategyEngine, SumTo100Strategy};
use crate::ws::WebSocketHandler;

/// Global health check state
struct HealthState {
    start_time: Instant,
    market_data: Arc<MarketData>,
}

/// Simple health check HTTP handler (no framework dependencies)
async fn health_check_handler(state: Arc<HealthState>) -> Result<String, Infallible> {
    let uptime = state.start_time.elapsed().as_secs();
    let tokens = state.market_data.token_count();
    let order_books = state.market_data.order_book_count();
    let markets = state.market_data.market_count();
    let has_data = state.market_data.has_data();

    let status = if has_data {
        "healthy"
    } else {
        "waiting_for_data"
    };

    // JSON response
    let json = format!(
        r#"{{"status":"{}","uptime_secs":{},"tokens":{},"order_books":{},"markets":{},"has_data":{}}}"#,
        status, uptime, tokens, order_books, markets, has_data
    );

    Ok(json)
}

/// Generate Prometheus metrics output
fn metrics_handler() -> String {
    use prometheus::Encoder;
    let encoder = prometheus::TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer).unwrap_or_default();
    String::from_utf8(buffer).unwrap_or_default()
}

/// Start a minimal health check HTTP server on port 8080
async fn start_health_server(state: Arc<HealthState>) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    let port = std::env::var("HEALTH_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080u16);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    let listener = match TcpListener::bind(addr).await {
        Ok(l) => {
            info!("[HEALTH] Health check server listening on http://{}", addr);
            info!("[HEALTH] Metrics available at http://{}/metrics", addr);
            l
        }
        Err(e) => {
            warn!("[HEALTH] Failed to bind health server on {}: {}", addr, e);
            return;
        }
    };

    loop {
        match listener.accept().await {
            Ok((mut socket, _)) => {
                let state = Arc::clone(&state);
                tokio::spawn(async move {
                    let mut buf = [0u8; 1024];
                    // Read the request to check the path
                    let n = socket.read(&mut buf).await.unwrap_or(0);
                    let request = String::from_utf8_lossy(&buf[..n]);

                    // Check if this is a metrics request
                    let is_metrics = request.contains("/metrics");

                    let (body, content_type) = if is_metrics {
                        (metrics_handler(), "text/plain; version=0.0.4; charset=utf-8")
                    } else {
                        (health_check_handler(state).await.unwrap_or_default(), "application/json")
                    };

                    // Write HTTP response
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        content_type,
                        body.len(),
                        body
                    );

                    let _ = socket.write_all(response.as_bytes()).await;
                });
            }
            Err(e) => {
                warn!("[HEALTH] Accept error: {}", e);
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("poly_rust=info".parse()?),
        )
        .init();

    info!("===========================================");
    info!("  POLY-RUST TRADING ENGINE");
    info!("===========================================");

    // Load configuration
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;
    info!("Configuration loaded");

    // Initialize Prometheus metrics
    metrics::init();
    info!("Prometheus metrics initialized");

    // Initialize Redis publisher (optional - for Python dashboard integration)
    let redis_url = std::env::var("REDIS_URL").ok();
    let redis_publisher = Arc::new(RedisPublisher::new(redis_url.as_deref()).await?);
    if redis_publisher.is_enabled() {
        info!("Redis publisher enabled - streaming to Python dashboard");
    }

    // Initialize Slack notifier (optional - for trade notifications)
    let slack_notifier = Arc::new(SlackNotifier::from_env());

    // Initialize database repository (optional - for trade persistence)
    let database_url = std::env::var("DATABASE_URL").ok();
    let trade_repo = Arc::new(TradeRepository::new(database_url.as_deref()).await?);

    // Initialize shared state
    let market_data = Arc::new(MarketData::new());
    let risk_manager = Arc::new(RiskManager::new(config.risk.clone()));
    // Pass market_data to OrderManager for paper trading simulations
    let order_manager = Arc::new(OrderManager::new(config.clone(), Some(market_data.clone())).await?);

    // Initialize strategies
    let sniper = SniperStrategy::new(config.sniper.clone());
    let clipper = ClipperStrategy::new(config.clipper.clone());
    let sum_to_100 = SumTo100Strategy::new(config.sum_to_100.clone());

    // Create strategy engine
    let mut strategy_engine = StrategyEngine::new(
        market_data.clone(),
        risk_manager.clone(),
        order_manager.clone(),
    );

    // Wire Redis publisher to strategy engine for real-time dashboard updates
    strategy_engine.set_redis_publisher(redis_publisher.clone());

    // Wire Slack notifier to strategy engine for trade alerts
    strategy_engine.set_slack_notifier(slack_notifier.clone());

    // Wire database repository to strategy engine for trade persistence
    strategy_engine.set_trade_repo(trade_repo.clone());

    strategy_engine.add_strategy(Box::new(sniper));
    strategy_engine.add_strategy(Box::new(clipper));
    strategy_engine.add_strategy(Box::new(sum_to_100));

    info!(
        "SumTo100 strategy: {} | min_edge={:.1}% | paper_trading={}",
        if config.sum_to_100.enabled {
            "ENABLED"
        } else {
            "DISABLED"
        },
        config.sum_to_100.min_edge * 100.0,
        config.sum_to_100.paper_trading
    );

    // Create cancellation token for graceful shutdown
    let cancellation_token = CancellationToken::new();

    // Start health check server (no cancellation needed - can be aborted immediately)
    let health_state = Arc::new(HealthState {
        start_time: Instant::now(),
        market_data: market_data.clone(),
    });
    let health_task = tokio::spawn(start_health_server(health_state));

    // Start WebSocket handler with cancellation support
    let ws_handler = WebSocketHandler::new(
        config.ws_url.clone(),
        market_data.clone(),
        cancellation_token.clone(),
    );
    let ws_task = tokio::spawn(async move {
        if let Err(e) = ws_handler.run().await {
            warn!("WebSocket error: {}", e);
        }
    });

    // Wire cancellation token to strategy engine for graceful shutdown
    strategy_engine.set_cancellation_token(cancellation_token.clone());

    // Start strategy engine
    let engine_task = tokio::spawn(async move {
        strategy_engine.run().await;
    });

    info!("==========================================");
    info!("  TRADING ENGINE STARTED");
    info!("==========================================");
    info!("  - Health check: http://0.0.0.0:8080/health");
    info!("  - Metrics: http://0.0.0.0:8080/metrics");
    info!("  - Strategies: {} active", 3);
    info!(
        "  - Mode: {}",
        if config.dry_run { "DRY RUN" } else { "LIVE" }
    );
    info!(
        "  - Redis: {}",
        if redis_publisher.is_enabled() {
            "ENABLED"
        } else {
            "disabled"
        }
    );
    info!(
        "  - Slack: {}",
        if slack_notifier.is_enabled() {
            "ENABLED"
        } else {
            "disabled"
        }
    );
    info!(
        "  - Database: {}",
        if trade_repo.is_enabled() {
            "ENABLED"
        } else {
            "disabled"
        }
    );
    info!("==========================================");
    info!("Press Ctrl+C to shutdown");

    // Wait for shutdown signal
    signal::ctrl_c().await?;
    info!("[SHUTDOWN] Signal received - initiating graceful shutdown...");

    // Cancel all tasks that support graceful shutdown
    cancellation_token.cancel();

    // Wait for tasks with timeout (30 seconds max)
    let shutdown_timeout = Duration::from_secs(30);

    // Create a future that waits for both tasks to complete
    let shutdown_future = async {
        // Wait for WebSocket and engine tasks to complete gracefully
        let ws_result = ws_task.await;
        info!("[SHUTDOWN] WebSocket handler stopped (result: {:?})", ws_result.is_ok());

        let engine_result = engine_task.await;
        info!("[SHUTDOWN] Strategy engine stopped (result: {:?})", engine_result.is_ok());
    };

    tokio::select! {
        _ = tokio::time::sleep(shutdown_timeout) => {
            warn!("[SHUTDOWN] Timeout waiting for tasks (30s) - forcing abort");
            // Note: Tasks may already be dropped if the future was partially completed
        }
        _ = shutdown_future => {
            info!("[SHUTDOWN] All tasks completed gracefully");
        }
    }

    // Health server can always be aborted immediately (no cleanup needed)
    health_task.abort();

    info!("[SHUTDOWN] Complete");
    Ok(())
}
