//! WebSocket connection handler for Polymarket.

use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
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

/// WebSocket connection statistics for observability
#[derive(Debug, Clone)]
pub struct WebSocketStats {
    pub messages_received: u64,
    pub book_updates: u64,
    pub price_changes: u64,
    pub reconnect_count: u64,
    pub uptime_secs: u64,
}

/// WebSocket handler with observability
pub struct WebSocketHandler {
    url: String,
    market_data: Arc<MarketData>,
    // Stats for logging
    messages_received: AtomicU64,
    book_updates: AtomicU64,
    price_changes: AtomicU64,
    reconnect_count: AtomicU64,
    connection_start: std::sync::Mutex<Option<Instant>>,
}

impl WebSocketHandler {
    pub fn new(url: String, market_data: Arc<MarketData>) -> Self {
        Self {
            url,
            market_data,
            messages_received: AtomicU64::new(0),
            book_updates: AtomicU64::new(0),
            price_changes: AtomicU64::new(0),
            reconnect_count: AtomicU64::new(0),
            connection_start: std::sync::Mutex::new(None),
        }
    }

    /// Get WebSocket stats for health checks
    pub fn get_stats(&self) -> WebSocketStats {
        let uptime_secs = self.connection_start
            .lock()
            .unwrap()
            .map(|start| start.elapsed().as_secs())
            .unwrap_or(0);

        WebSocketStats {
            messages_received: self.messages_received.load(Ordering::Relaxed),
            book_updates: self.book_updates.load(Ordering::Relaxed),
            price_changes: self.price_changes.load(Ordering::Relaxed),
            reconnect_count: self.reconnect_count.load(Ordering::Relaxed),
            uptime_secs,
        }
    }

    /// Run the WebSocket handler with automatic reconnection
    pub async fn run(&self) -> Result<()> {
        info!("[WS] WebSocket handler starting | url={}", self.url);

        loop {
            match self.connect_and_handle().await {
                Ok(_) => {
                    info!("[WS] WebSocket connection closed normally");
                }
                Err(e) => {
                    error!("[WS] WebSocket error: {}", e);
                }
            }

            // Clear connection start time
            *self.connection_start.lock().unwrap() = None;

            // Increment reconnect counter
            let reconnects = self.reconnect_count.fetch_add(1, Ordering::Relaxed) + 1;

            // Log stats before reconnect
            let stats = self.get_stats();
            warn!(
                "[WS] Reconnecting in 5s | reconnects={} | total_msgs={} | books={} | prices={}",
                reconnects, stats.messages_received, stats.book_updates, stats.price_changes
            );

            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }

    /// Connect and handle messages
    async fn connect_and_handle(&self) -> Result<()> {
        info!("[WS] Connecting to WebSocket: {}", self.url);

        let (ws_stream, _) = timeout(Duration::from_secs(10), connect_async(&self.url))
            .await
            .context("Connection timeout")?
            .context("Failed to connect")?;

        // Set connection start time for uptime tracking
        *self.connection_start.lock().unwrap() = Some(Instant::now());

        info!("[WS] WebSocket connected successfully");

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
                assets_ids: token_ids.clone(),
            };

            let msg = serde_json::to_string(&subscribe_msg)?;
            write.send(Message::Text(msg)).await?;
            info!("[WS] Subscribed to {} tokens", token_ids.len());
        } else {
            info!("[WS] No tokens to subscribe to yet - waiting for market registration");
        }

        // Ping interval to keep connection alive
        let mut ping_interval = interval(Duration::from_secs(30));
        // Heartbeat interval for logging (every 60 seconds)
        let mut heartbeat_interval = interval(Duration::from_secs(60));
        // Skip immediate first tick
        heartbeat_interval.tick().await;

        loop {
            tokio::select! {
                // Handle incoming messages
                msg = read.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            self.messages_received.fetch_add(1, Ordering::Relaxed);
                            self.handle_message(&text);
                        }
                        Some(Ok(Message::Ping(data))) => {
                            write.send(Message::Pong(data)).await?;
                            debug!("[WS] Responded to ping");
                        }
                        Some(Ok(Message::Pong(_))) => {
                            debug!("[WS] Received pong");
                        }
                        Some(Ok(Message::Close(frame))) => {
                            info!("[WS] Received close frame: {:?}", frame);
                            break;
                        }
                        Some(Err(e)) => {
                            error!("[WS] WebSocket stream error: {}", e);
                            break;
                        }
                        None => {
                            info!("[WS] WebSocket stream ended");
                            break;
                        }
                        _ => {}
                    }
                }

                // Send periodic pings
                _ = ping_interval.tick() => {
                    write.send(Message::Ping(vec![])).await?;
                    debug!("[WS] Sent ping");
                }

                // Log heartbeat stats
                _ = heartbeat_interval.tick() => {
                    let stats = self.get_stats();
                    info!(
                        "[WS HEARTBEAT] connected=true | uptime={}s | msgs={} | books={} | prices={} | tokens={}",
                        stats.uptime_secs,
                        stats.messages_received,
                        stats.book_updates,
                        stats.price_changes,
                        self.market_data.token_count()
                    );
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
        // Increment counter
        self.book_updates.fetch_add(1, Ordering::Relaxed);

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
            "[WS] Book update: {} bid={:.4} ask={:.4} depth={}b/{}a",
            &update.asset_id[..8.min(update.asset_id.len())],
            best_bid,
            best_ask,
            bids.len(),
            asks.len()
        );
    }

    /// Handle price change update
    fn handle_price_change(&self, update: PriceChangeUpdate) {
        // Increment counter
        self.price_changes.fetch_add(1, Ordering::Relaxed);

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
                    "[WS] Price change: {} {} @ {:.4}",
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
