//! WebSocket connection handler for Polymarket.

use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::{interval, timeout};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{debug, error, info, warn};

use crate::market::{DepthLevel, MarketData};

/// WebSocket message types from Polymarket
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum WsMessage {
    #[serde(rename = "book")]
    Book(BookUpdate),
    #[serde(rename = "price_change")]
    PriceChange(PriceChangeUpdate),
    #[serde(rename = "tick_size_change")]
    TickSizeChange(TickSizeChangeUpdate),
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Deserialize)]
pub struct BookUpdate {
    pub asset_id: String,
    pub market: Option<String>,
    pub bids: Vec<PriceSize>,
    pub asks: Vec<PriceSize>,
    pub timestamp: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PriceSize {
    pub price: String,
    pub size: String,
}

#[derive(Debug, Deserialize)]
pub struct PriceChangeUpdate {
    pub asset_id: String,
    pub price: String,
    pub side: String,
}

#[derive(Debug, Deserialize)]
pub struct TickSizeChangeUpdate {
    pub asset_id: String,
    pub tick_size: String,
}

/// Subscription message to send to Polymarket
#[derive(Debug, Serialize)]
pub struct SubscribeMessage {
    pub r#type: String,
    pub assets_ids: Vec<String>,
}

/// WebSocket handler
pub struct WebSocketHandler {
    url: String,
    market_data: Arc<MarketData>,
}

impl WebSocketHandler {
    pub fn new(url: String, market_data: Arc<MarketData>) -> Self {
        Self { url, market_data }
    }

    /// Run the WebSocket handler with automatic reconnection
    pub async fn run(&self) -> Result<()> {
        loop {
            match self.connect_and_handle().await {
                Ok(_) => {
                    info!("WebSocket connection closed normally");
                }
                Err(e) => {
                    error!("WebSocket error: {}", e);
                }
            }

            // Wait before reconnecting
            warn!("Reconnecting in 5 seconds...");
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }

    /// Connect and handle messages
    async fn connect_and_handle(&self) -> Result<()> {
        info!("Connecting to WebSocket: {}", self.url);

        let (ws_stream, _) = timeout(Duration::from_secs(10), connect_async(&self.url))
            .await
            .context("Connection timeout")?
            .context("Failed to connect")?;

        info!("WebSocket connected");

        let (mut write, mut read) = ws_stream.split();

        // Send subscription for all tracked tokens
        let token_ids: Vec<String> = self
            .market_data
            .iter_prices()
            .map(|(id, _)| id)
            .collect();

        if !token_ids.is_empty() {
            let subscribe_msg = SubscribeMessage {
                r#type: "subscribe".into(),
                assets_ids: token_ids,
            };

            let msg = serde_json::to_string(&subscribe_msg)?;
            write.send(Message::Text(msg)).await?;
            info!("Subscribed to {} tokens", self.market_data.token_count());
        }

        // Ping interval to keep connection alive
        let mut ping_interval = interval(Duration::from_secs(30));

        loop {
            tokio::select! {
                // Handle incoming messages
                msg = read.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            self.handle_message(&text);
                        }
                        Some(Ok(Message::Ping(data))) => {
                            write.send(Message::Pong(data)).await?;
                        }
                        Some(Ok(Message::Close(_))) => {
                            info!("Received close frame");
                            break;
                        }
                        Some(Err(e)) => {
                            error!("WebSocket error: {}", e);
                            break;
                        }
                        None => {
                            info!("WebSocket stream ended");
                            break;
                        }
                        _ => {}
                    }
                }

                // Send periodic pings
                _ = ping_interval.tick() => {
                    write.send(Message::Ping(vec![])).await?;
                }
            }
        }

        Ok(())
    }

    /// Handle a single WebSocket message
    fn handle_message(&self, text: &str) {
        // Try to parse the message
        match serde_json::from_str::<WsMessage>(text) {
            Ok(WsMessage::Book(update)) => {
                self.handle_book_update(update);
            }
            Ok(WsMessage::PriceChange(update)) => {
                self.handle_price_change(update);
            }
            Ok(WsMessage::TickSizeChange(_)) => {
                // Ignore tick size changes
            }
            Ok(WsMessage::Unknown) => {
                debug!("Unknown message type: {}", text);
            }
            Err(e) => {
                debug!("Failed to parse message: {} - {}", e, text);
            }
        }
    }

    /// Handle order book update
    fn handle_book_update(&self, update: BookUpdate) {
        // Parse ALL depth levels (not just first)
        let bids: Vec<DepthLevel> = update
            .bids
            .iter()
            .filter_map(|p| {
                Some(DepthLevel::new(
                    p.price.parse().ok()?,
                    p.size.parse().ok()?,
                ))
            })
            .collect();

        let asks: Vec<DepthLevel> = update
            .asks
            .iter()
            .filter_map(|p| {
                Some(DepthLevel::new(
                    p.price.parse().ok()?,
                    p.size.parse().ok()?,
                ))
            })
            .collect();

        // Store full order book depth
        self.market_data
            .update_order_book(&update.asset_id, bids.clone(), asks.clone());

        // Also update top-of-book PriceLevel for backward compatibility with existing strategies
        let best_bid = bids.first().map(|l| l.price).unwrap_or(0.0);
        let best_ask = asks.first().map(|l| l.price).unwrap_or(1.0);
        self.market_data
            .update_price(&update.asset_id, best_bid, best_ask);

        debug!(
            "Book update: {} bid={:.4} ask={:.4} depth={}b/{}a",
            &update.asset_id[..8.min(update.asset_id.len())],
            best_bid,
            best_ask,
            bids.len(),
            asks.len()
        );
    }

    /// Handle price change update
    fn handle_price_change(&self, update: PriceChangeUpdate) {
        if let Ok(price) = update.price.parse::<f64>() {
            // Get current price to update only one side
            if let Some(current) = self.market_data.get_price(&update.asset_id) {
                let (bid, ask) = if update.side == "BUY" {
                    (price, current.ask)
                } else {
                    (current.bid, price)
                };

                self.market_data.update_price(&update.asset_id, bid, ask);

                debug!(
                    "Price change: {} {} @ {:.4}",
                    &update.asset_id[..8.min(update.asset_id.len())],
                    update.side,
                    price
                );
            }
        }
    }

    /// Subscribe to additional tokens
    pub async fn subscribe(&self, token_ids: Vec<String>) -> Result<()> {
        // This would need a reference to the write half
        // For now, tokens should be pre-registered before connecting
        for token_id in token_ids {
            self.market_data.update_price(&token_id, 0.0, 1.0);
        }
        Ok(())
    }
}
