//! Notification systems for alerting on trades, errors, and events.
//!
//! All notification methods are fire-and-forget (non-blocking) to ensure
//! the trading loop is never delayed by notification delivery.

mod slack;

#[allow(unused_imports)]
pub use slack::{ErrorAlert, OrderNotification, RiskAlert, SlackNotifier};
