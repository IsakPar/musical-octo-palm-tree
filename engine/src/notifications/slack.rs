//! Slack webhook notifications for trading events.
//!
//! All methods are fire-and-forget (non-blocking) - they spawn async tasks
//! and return immediately to ensure the trading loop is never delayed.

use reqwest::Client;
use serde::Serialize;
use std::sync::Arc;
use tracing::{info, warn};

/// Slack message payload
#[derive(Debug, Serialize)]
struct SlackMessage {
    text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    icon_emoji: Option<String>,
}

/// Order notification for Slack
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct OrderNotification {
    pub strategy: String,
    pub order_type: String, // "BUY", "SELL", "ARBITRAGE"
    pub token_id: Option<String>,
    pub yes_token: Option<String>,
    pub no_token: Option<String>,
    pub price: Option<f64>,
    pub yes_price: Option<f64>,
    pub no_price: Option<f64>,
    pub size: f64,
    pub order_id: Option<String>,
    pub status: String, // "FILLED", "FAILED: reason"
    pub pnl: Option<f64>,
    pub is_paper: bool,
}

/// Risk violation alert for Slack
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct RiskAlert {
    pub alert_type: String, // "DAILY_LOSS", "POSITION_LIMIT", "NOTIONAL_LIMIT"
    pub message: String,
    pub current_value: f64,
    pub limit_value: f64,
}

/// Error alert for Slack
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct ErrorAlert {
    pub source: String,
    pub error_type: String,
    pub message: String,
}

/// Async Slack notifier - all methods are fire-and-forget
#[allow(dead_code)]
pub struct SlackNotifier {
    client: Option<Client>,
    webhook_url: Option<String>,
    enabled: bool,
    notify_orders: bool,
    notify_risk: bool,
    notify_errors: bool,
}

impl SlackNotifier {
    /// Create a new Slack notifier from environment variables.
    ///
    /// Set `SLACK_WEBHOOK_URL` to enable. Optional flags:
    /// - `SLACK_NOTIFY_ORDERS` (default: true)
    /// - `SLACK_NOTIFY_RISK` (default: true)
    /// - `SLACK_NOTIFY_ERRORS` (default: true)
    pub fn from_env() -> Self {
        let webhook_url = std::env::var("SLACK_WEBHOOK_URL").ok();
        let enabled = webhook_url.is_some();

        let notify_orders = std::env::var("SLACK_NOTIFY_ORDERS")
            .map(|v| v.to_lowercase() != "false")
            .unwrap_or(true);
        let notify_risk = std::env::var("SLACK_NOTIFY_RISK")
            .map(|v| v.to_lowercase() != "false")
            .unwrap_or(true);
        let notify_errors = std::env::var("SLACK_NOTIFY_ERRORS")
            .map(|v| v.to_lowercase() != "false")
            .unwrap_or(true);

        if enabled {
            info!(
                "[SLACK] Notifications enabled | orders={} | risk={} | errors={}",
                notify_orders, notify_risk, notify_errors
            );
        } else {
            info!("[SLACK] Notifications disabled (SLACK_WEBHOOK_URL not set)");
        }

        let client = if enabled {
            Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .build()
                .ok()
        } else {
            None
        };

        Self {
            client,
            webhook_url,
            enabled,
            notify_orders,
            notify_risk,
            notify_errors,
        }
    }

    /// Create a disabled notifier (for testing)
    #[allow(dead_code)]
    pub fn disabled() -> Self {
        Self {
            client: None,
            webhook_url: None,
            enabled: false,
            notify_orders: false,
            notify_risk: false,
            notify_errors: false,
        }
    }

    /// Check if notifications are enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Notify about an order (fire-and-forget, non-blocking)
    pub fn notify_order(&self, order: OrderNotification) {
        if !self.enabled || !self.notify_orders {
            return;
        }

        let emoji = match order.status.as_str() {
            s if s.starts_with("FILLED") => {
                if order.is_paper {
                    ":memo:"
                } else {
                    ":chart_with_upwards_trend:"
                }
            }
            _ => ":x:",
        };

        let paper_tag = if order.is_paper { " [PAPER]" } else { "" };

        let text = match order.order_type.as_str() {
            "ARBITRAGE" => {
                let pnl_str = order
                    .pnl
                    .map(|p| format!(" | PnL: ${:.2}", p))
                    .unwrap_or_default();
                format!(
                    "{} *{}*{} ARB\nYES@${:.4} + NO@${:.4} x {:.0}{}\nStatus: {}",
                    emoji,
                    order.strategy,
                    paper_tag,
                    order.yes_price.unwrap_or(0.0),
                    order.no_price.unwrap_or(0.0),
                    order.size,
                    pnl_str,
                    order.status
                )
            }
            _ => {
                let token_short = order
                    .token_id
                    .as_ref()
                    .map(|t| &t[..8.min(t.len())])
                    .unwrap_or("???");
                format!(
                    "{} *{}*{} {} {} @ ${:.4} x {:.0}\nStatus: {}",
                    emoji,
                    order.strategy,
                    paper_tag,
                    order.order_type,
                    token_short,
                    order.price.unwrap_or(0.0),
                    order.size,
                    order.status
                )
            }
        };

        self.send_message(text, ":robot_face:");
    }

    /// Notify about a risk violation (fire-and-forget, non-blocking)
    #[allow(dead_code)]
    pub fn notify_risk(&self, alert: RiskAlert) {
        if !self.enabled || !self.notify_risk {
            return;
        }

        let text = format!(
            ":warning: *RISK ALERT: {}*\n{}\nCurrent: {:.2} | Limit: {:.2}",
            alert.alert_type, alert.message, alert.current_value, alert.limit_value
        );

        self.send_message(text, ":rotating_light:");
    }

    /// Notify about an error (fire-and-forget, non-blocking)
    #[allow(dead_code)]
    pub fn notify_error(&self, alert: ErrorAlert) {
        if !self.enabled || !self.notify_errors {
            return;
        }

        let text = format!(
            ":x: *ERROR in {}*\nType: {}\n{}",
            alert.source, alert.error_type, alert.message
        );

        self.send_message(text, ":skull:");
    }

    /// Internal: Send a message to Slack (fire-and-forget)
    fn send_message(&self, text: String, icon: &str) {
        let client = match &self.client {
            Some(c) => c.clone(),
            None => return,
        };

        let webhook_url = match &self.webhook_url {
            Some(u) => u.clone(),
            None => return,
        };

        let message = SlackMessage {
            text,
            username: Some("Poly-Rust Bot".to_string()),
            icon_emoji: Some(icon.to_string()),
        };

        // Fire-and-forget: spawn task and return immediately
        tokio::spawn(async move {
            match client.post(&webhook_url).json(&message).send().await {
                Ok(resp) => {
                    if !resp.status().is_success() {
                        warn!("[SLACK] Non-success response: {}", resp.status());
                    }
                }
                Err(e) => {
                    warn!("[SLACK] Failed to send: {}", e);
                }
            }
        });
    }
}

/// Helper to create a notifier from Arc for sharing
impl SlackNotifier {
    #[allow(dead_code)]
    pub fn into_arc(self) -> Arc<Self> {
        Arc::new(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_disabled_notifier() {
        let notifier = SlackNotifier::disabled();
        assert!(!notifier.is_enabled());
    }

    #[test]
    fn test_order_notification_format() {
        let order = OrderNotification {
            strategy: "SumTo100".to_string(),
            order_type: "ARBITRAGE".to_string(),
            token_id: None,
            yes_token: Some("yes123".to_string()),
            no_token: Some("no123".to_string()),
            price: None,
            yes_price: Some(0.45),
            no_price: Some(0.50),
            size: 100.0,
            order_id: None,
            status: "FILLED".to_string(),
            pnl: Some(5.0),
            is_paper: false,
        };

        // Just verify the struct can be created
        assert_eq!(order.strategy, "SumTo100");
    }
}
