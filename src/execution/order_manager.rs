//! Order Manager - Handles order placement and tracking.

use anyhow::{Context, Result};
use ethers::signers::{LocalWallet, Signer};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tracing::{debug, info};

use crate::config::Config;
use crate::market::TokenId;

/// Order side
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Side {
    Buy,
    Sell,
}

/// Order type
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
}

impl OrderManager {
    /// Create a new order manager.
    pub async fn new(config: Config) -> Result<Self> {
        // In dry-run mode, wallet is optional (allows running without private key)
        let wallet: Option<Arc<LocalWallet>> = if config.dry_run {
            match config.private_key.parse::<LocalWallet>() {
                Ok(w) => {
                    info!("Order manager initialized for address: {:?} (DRY RUN)", w.address());
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
        })
    }

    /// Check if running in dry-run mode (no real orders).
    pub fn is_dry_run(&self) -> bool {
        self.dry_run
    }

    /// Place a buy order.
    pub async fn place_buy(
        &self,
        token_id: &TokenId,
        price: f64,
        size: f64,
    ) -> Result<String> {
        self.place_order(token_id, price, size, Side::Buy).await
    }

    /// Place a sell order.
    pub async fn place_sell(
        &self,
        token_id: &TokenId,
        price: f64,
        size: f64,
    ) -> Result<String> {
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
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs();
        let nonce = timestamp * 1000 + rand::random::<u64>() % 1000;

        // Format price and size for API
        let price_str = format!("{:.4}", price);
        let size_str = format!("{:.2}", size);

        // In dry-run mode, skip signing and return immediately
        if self.dry_run {
            info!(
                "[DRY RUN] Would place {:?} order: {} @ ${} x {}",
                side, token_id, price_str, size_str
            );
            return Ok(format!("dry-run-{}", nonce));
        }

        // Wallet is required for real orders
        let wallet = self.wallet.as_ref()
            .context("Wallet not available - cannot place real orders")?;

        // Create message to sign
        let message = format!(
            "{}:{}:{}:{}:{}",
            token_id, price_str, size_str,
            if matches!(side, Side::Buy) { "BUY" } else { "SELL" },
            nonce
        );

        // Sign the message off the async runtime (ECDSA is CPU-bound)
        let wallet = Arc::clone(wallet);
        let msg = message.clone();
        let signature = tokio::task::spawn_blocking(move || {
            // Note: LocalWallet::sign_message is actually sync under the hood
            // We use a blocking task to avoid blocking tokio workers
            tokio::runtime::Handle::current().block_on(wallet.sign_message(&msg))
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

        let response = self.client
            .post(format!("{}/order", self.base_url))
            .header("POLY-API-KEY", &self.api_key)
            .header("POLY-SIGNATURE", &self.api_secret)
            .header("POLY-TIMESTAMP", timestamp.to_string())
            .json(&request)
            .send()
            .await
            .context("Failed to send order request")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Order failed with status {}: {}", status, body);
        }

        let order_response: OrderResponse = response
            .json()
            .await
            .context("Failed to parse order response")?;

        info!(
            "Order placed: {} - {:?} {} @ ${} x {}",
            order_response.order_id, side, token_id, price, size
        );

        Ok(order_response.order_id)
    }

    /// Cancel an order.
    pub async fn cancel_order(&self, order_id: &str) -> Result<()> {
        if self.dry_run {
            info!("[DRY RUN] Would cancel order: {}", order_id);
            return Ok(());
        }

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs();

        let response = self.client
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
}
