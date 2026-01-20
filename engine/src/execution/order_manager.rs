//! Order Manager - Handles order placement and tracking.

use anyhow::{Context, Result};
use ethers::signers::{LocalWallet, Signer};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tracing::{debug, info};

use crate::config::Config;
use crate::execution::paper::{PaperTrader, PaperTraderStats};
use crate::market::{MarketData, TokenId};
use crate::metrics::{ORDERS_TOTAL, ORDER_LATENCY};

/// Order side
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Side {
    Buy,
    Sell,
}

/// Order type
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum OrderType {
    Gtc, // Good til cancelled
    Fok, // Fill or kill
    Ioc, // Immediate or cancel
}

/// Order request to Polymarket CLOB
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OrderRequest {
    token_id: String,
    price: String,
    size: String,
    side: Side,
    order_type: OrderType,
    signature: String,
    timestamp: u64,
    nonce: u64,
}

/// Order response from Polymarket
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderResponse {
    pub order_id: String,
    pub status: String,
}

/// HTTP timeout for order requests (500ms for latency-sensitive trading)
const ORDER_TIMEOUT: Duration = Duration::from_millis(500);

/// Order manager for placing and tracking orders.
pub struct OrderManager {
    client: Client,
    /// Wallet is optional - None in dry-run mode without valid private key
    wallet: Option<Arc<LocalWallet>>,
    api_key: String,
    api_secret: String,
    base_url: String,
    dry_run: bool,
    /// Paper trader for simulating fills with VWAP calculations in dry-run mode
    paper_trader: Option<PaperTrader>,
    /// Market data for paper trading simulations
    market_data: Option<Arc<MarketData>>,
}

impl OrderManager {
    /// Create a new order manager.
    ///
    /// # Arguments
    /// * `config` - Configuration for the order manager
    /// * `market_data` - Optional market data for paper trading simulations.
    ///   When provided with dry_run=true, enables realistic VWAP-based fill simulation.
    pub async fn new(config: Config, market_data: Option<Arc<MarketData>>) -> Result<Self> {
        // In dry-run mode, wallet is optional (allows running without private key)
        let wallet: Option<Arc<LocalWallet>> = if config.dry_run {
            match config.private_key.parse::<LocalWallet>() {
                Ok(w) => {
                    info!(
                        "Order manager initialized for address: {:?} (DRY RUN)",
                        w.address()
                    );
                    Some(Arc::new(w))
                }
                Err(_) => {
                    info!("Order manager initialized in DRY RUN mode (no wallet - mock key)");
                    None
                }
            }
        } else {
            // Real trading mode - wallet is required
            let w: LocalWallet = config
                .private_key
                .parse()
                .context("Failed to parse private key - required for live trading")?;
            info!("Order manager initialized for address: {:?}", w.address());
            Some(Arc::new(w))
        };

        // Create paper trader in dry-run mode for realistic fill simulation
        let paper_trader = if config.dry_run {
            let fee_rate = config.sum_to_100.fee_rate;
            info!(
                "Paper trader enabled with fee_rate={:.2}%",
                fee_rate * 100.0
            );
            Some(PaperTrader::new(fee_rate))
        } else {
            None
        };

        // Build client with timeout for latency-sensitive trading
        let client = Client::builder()
            .timeout(ORDER_TIMEOUT)
            .build()
            .context("Failed to build HTTP client")?;

        Ok(Self {
            client,
            wallet,
            api_key: config.api_key,
            api_secret: config.api_secret,
            base_url: config.clob_url,
            dry_run: config.dry_run,
            paper_trader,
            market_data,
        })
    }

    /// Check if running in dry-run mode (no real orders).
    pub fn is_dry_run(&self) -> bool {
        self.dry_run
    }

    /// Place a buy order.
    pub async fn place_buy(&self, token_id: &TokenId, price: f64, size: f64) -> Result<String> {
        self.place_order(token_id, price, size, Side::Buy).await
    }

    /// Place a sell order.
    pub async fn place_sell(&self, token_id: &TokenId, price: f64, size: f64) -> Result<String> {
        self.place_order(token_id, price, size, Side::Sell).await
    }

    /// Place an order.
    async fn place_order(
        &self,
        token_id: &TokenId,
        price: f64,
        size: f64,
        side: Side,
    ) -> Result<String> {
        let start = Instant::now();
        let side_label = if matches!(side, Side::Buy) { "buy" } else { "sell" };
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
        let nonce = timestamp * 1000 + rand::random::<u64>() % 1000;

        // Format price and size for API
        let price_str = format!("{:.4}", price);
        let size_str = format!("{:.2}", size);

        // In dry-run mode, use paper trader for realistic simulation if available
        if self.dry_run {
            // Try to simulate with paper trader for realistic VWAP-based fills
            if let (Some(paper_trader), Some(market_data)) =
                (&self.paper_trader, &self.market_data)
            {
                if matches!(side, Side::Buy) {
                    if let Some(fill) = paper_trader.simulate_buy(market_data, token_id, size) {
                        info!(
                            "[PAPER] Simulated {:?} fill: {} @ ${:.4} (requested ${}) x {:.2}",
                            side, token_id, fill.price, price, fill.size
                        );
                        // Record metrics for paper trades
                        ORDER_LATENCY
                            .with_label_values(&[side_label])
                            .observe(start.elapsed().as_secs_f64());
                        ORDERS_TOTAL
                            .with_label_values(&[side_label, "success", "paper"])
                            .inc();
                        return Ok(format!("paper-{}", timestamp));
                    }
                }
                // Fall through to basic dry-run if simulation fails (no order book data)
                info!(
                    "[PAPER] No order book data for {} - falling back to dry run",
                    token_id
                );
            }

            // Basic dry-run mode (no paper trader or simulation failed)
            info!(
                "[DRY RUN] Would place {:?} order: {} @ ${} x {}",
                side, token_id, price_str, size_str
            );
            // Record metrics for dry-run orders
            ORDER_LATENCY
                .with_label_values(&[side_label])
                .observe(start.elapsed().as_secs_f64());
            ORDERS_TOTAL
                .with_label_values(&[side_label, "success", "dry_run"])
                .inc();
            return Ok(format!("dry-run-{}", nonce));
        }

        // Wallet is required for real orders
        let wallet = self
            .wallet
            .as_ref()
            .context("Wallet not available - cannot place real orders")?;

        // Create message to sign
        let message = format!(
            "{}:{}:{}:{}:{}",
            token_id,
            price_str,
            size_str,
            if matches!(side, Side::Buy) {
                "BUY"
            } else {
                "SELL"
            },
            nonce
        );

        // Sign the message off the async runtime (ECDSA is CPU-bound)
        let wallet = Arc::clone(wallet);
        let msg = message.clone();
        let signature = tokio::task::spawn_blocking(move || {
            // Use futures::executor::block_on since we're outside the tokio runtime
            // in spawn_blocking. This avoids nesting tokio runtimes.
            futures::executor::block_on(wallet.sign_message(&msg))
        })
        .await
        .context("Signing task panicked")?
        .context("Failed to sign order")?
        .to_string();

        let request = OrderRequest {
            token_id: token_id.clone(),
            price: price_str,
            size: size_str,
            side,
            order_type: OrderType::Gtc,
            signature,
            timestamp,
            nonce,
        };

        debug!("Placing order: {:?}", request);

        let response = self
            .client
            .post(format!("{}/order", self.base_url))
            .header("POLY-API-KEY", &self.api_key)
            .header("POLY-SIGNATURE", &self.api_secret)
            .header("POLY-TIMESTAMP", timestamp.to_string())
            .json(&request)
            .send()
            .await;

        // Record latency regardless of success/failure
        ORDER_LATENCY
            .with_label_values(&[side_label])
            .observe(start.elapsed().as_secs_f64());

        let response = response.context("Failed to send order request")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            ORDERS_TOTAL
                .with_label_values(&[side_label, "failed", "live"])
                .inc();
            anyhow::bail!("Order failed with status {}: {}", status, body);
        }

        let order_response: OrderResponse = response
            .json()
            .await
            .context("Failed to parse order response")?;

        ORDERS_TOTAL
            .with_label_values(&[side_label, "success", "live"])
            .inc();

        info!(
            "Order placed: {} - {:?} {} @ ${} x {}",
            order_response.order_id, side, token_id, price, size
        );

        Ok(order_response.order_id)
    }

    /// Cancel an order.
    #[allow(dead_code)]
    pub async fn cancel_order(&self, order_id: &str) -> Result<()> {
        if self.dry_run {
            info!("[DRY RUN] Would cancel order: {}", order_id);
            return Ok(());
        }

        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();

        let response = self
            .client
            .delete(format!("{}/order/{}", self.base_url, order_id))
            .header("POLY-API-KEY", &self.api_key)
            .header("POLY-SIGNATURE", &self.api_secret)
            .header("POLY-TIMESTAMP", timestamp.to_string())
            .send()
            .await
            .context("Failed to send cancel request")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Cancel failed with status {}: {}", status, body);
        }

        info!("Order cancelled: {}", order_id);
        Ok(())
    }

    /// Get paper trading statistics if paper trader is enabled.
    ///
    /// Returns None if not in dry-run mode or paper trader is not available.
    #[allow(dead_code)]
    pub fn get_paper_stats(&self) -> Option<PaperTraderStats> {
        self.paper_trader.as_ref().map(|pt| pt.get_stats())
    }
}
