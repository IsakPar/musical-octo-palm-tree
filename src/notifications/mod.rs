//! Notification systems for alerting on trades, errors, and events.
//!
//! All notification methods are fire-and-forget (non-blocking) to ensure
//! the trading loop is never delayed by notification delivery.

mod slack;

pub use slack::{SlackNotifier, OrderNotification, RiskAlert, ErrorAlert};
