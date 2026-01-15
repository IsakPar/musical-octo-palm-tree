//! Order Manager - Handles order placement and tracking.

use anyhow::{Context, Result};
use ethers::signers::{LocalWallet, Signer};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
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

/// Order manager for placing and tracking orders.
pub struct OrderManager {
    client: Client,
    wallet: LocalWallet,
    api_key: String,
    api_secret: String,
    base_url: String,
    dry_run: bool,
}

impl OrderManager {
    /// Create a new order manager.
    pub async fn new(config: Config) -> Result<Self> {
        let wallet: LocalWallet = config
            .private_key
            .parse()
            .context("Failed to parse private key")?;

        info!("Order manager initialized for address: {:?}", wallet.address());

        Ok(Self {
            client: Client::new(),
            wallet,
            api_key: config.api_key,
            api_secret: config.api_secret,
            base_url: config.clob_url,
            dry_run: config.dry_run,
        })
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

        // Create message to sign
        let message = format!(
            "{}:{}:{}:{}:{}",
            token_id, price_str, size_str,
            if matches!(side, Side::Buy) { "BUY" } else { "SELL" },
            nonce
        );

        // Sign the message
        let signature = self.wallet
            .sign_message(&message)
            .await
            .context("Failed to sign order")?
            .to_string();

        if self.dry_run {
            info!(
                "[DRY RUN] Would place {:?} order: {} @ ${} x {}",
                side, token_id, price_str, size_str
            );
            return Ok(format!("dry-run-{}", nonce));
        }

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
