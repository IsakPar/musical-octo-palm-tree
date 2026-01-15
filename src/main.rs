//! Poly-Rust: High-performance trading bots for Polymarket
//!
//! This is the main entry point for the trading engine.

mod config;
mod execution;
mod external;
mod market;
mod risk;
mod strategy;
mod ws;

use anyhow::Result;
use std::sync::Arc;
use tokio::signal;
use tracing::{info, warn};

use crate::config::Config;
use crate::execution::OrderManager;
use crate::market::MarketData;
use crate::risk::RiskManager;
use crate::strategy::{ClipperStrategy, SniperStrategy, StrategyEngine};
use crate::ws::WebSocketHandler;

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

    // Initialize shared state
    let market_data = Arc::new(MarketData::new());
    let risk_manager = Arc::new(RiskManager::new(config.risk.clone()));
    let order_manager = Arc::new(OrderManager::new(config.clone()).await?);

    // Initialize strategies
    let sniper = SniperStrategy::new(config.sniper.clone());
    let clipper = ClipperStrategy::new(config.clipper.clone());

    // Create strategy engine
    let mut strategy_engine = StrategyEngine::new(
        market_data.clone(),
        risk_manager.clone(),
        order_manager.clone(),
    );
    strategy_engine.add_strategy(Box::new(sniper));
    strategy_engine.add_strategy(Box::new(clipper));

    // Start WebSocket handler
    let ws_handler = WebSocketHandler::new(config.ws_url.clone(), market_data.clone());
    let ws_task = tokio::spawn(async move {
        if let Err(e) = ws_handler.run().await {
            warn!("WebSocket error: {}", e);
        }
    });

    // Start strategy engine
    let engine_task = tokio::spawn(async move {
        strategy_engine.run().await;
    });

    info!("Trading engine started");
    info!("Press Ctrl+C to shutdown");

    // Wait for shutdown signal
    signal::ctrl_c().await?;
    info!("Shutdown signal received");

    // Cleanup
    ws_task.abort();
    engine_task.abort();

    info!("Shutdown complete");
    Ok(())
}
