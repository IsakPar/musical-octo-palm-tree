//! Prometheus metrics for trading engine observability.

use lazy_static::lazy_static;
use prometheus::{
    opts, register_counter, register_counter_vec, register_gauge, register_histogram_vec, Counter,
    CounterVec, Gauge, HistogramVec,
};

lazy_static! {
    // Order metrics
    pub static ref ORDERS_TOTAL: CounterVec = register_counter_vec!(
        opts!("poly_orders_total", "Total orders placed"),
        &["side", "status", "strategy"]
    )
    .expect("Failed to create ORDERS_TOTAL metric");

    pub static ref ORDER_LATENCY: HistogramVec = register_histogram_vec!(
        "poly_order_latency_seconds",
        "Order placement latency",
        &["side"],
        vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
    )
    .expect("Failed to create ORDER_LATENCY metric");

    // Strategy metrics
    pub static ref SIGNALS_TOTAL: CounterVec = register_counter_vec!(
        opts!("poly_signals_total", "Total signals generated"),
        &["strategy", "type"]
    )
    .expect("Failed to create SIGNALS_TOTAL metric");

    pub static ref EVALUATIONS_TOTAL: Counter = register_counter!(
        opts!("poly_evaluations_total", "Total strategy evaluations")
    )
    .expect("Failed to create EVALUATIONS_TOTAL metric");

    // Risk metrics
    pub static ref RISK_REJECTIONS: CounterVec = register_counter_vec!(
        opts!("poly_risk_rejections_total", "Signals rejected by risk manager"),
        &["reason"]
    )
    .expect("Failed to create RISK_REJECTIONS metric");

    // System metrics
    pub static ref WEBSOCKET_MESSAGES: Counter = register_counter!(
        opts!("poly_websocket_messages_total", "WebSocket messages received")
    )
    .expect("Failed to create WEBSOCKET_MESSAGES metric");

    pub static ref DAILY_PNL: Gauge = register_gauge!(
        opts!("poly_daily_pnl_dollars", "Current daily P&L in dollars")
    )
    .expect("Failed to create DAILY_PNL metric");
}

/// Initialize all metrics (forces lazy_static initialization).
/// Call this at startup to ensure metrics are registered.
pub fn init() {
    // Access each metric to force initialization
    lazy_static::initialize(&ORDERS_TOTAL);
    lazy_static::initialize(&ORDER_LATENCY);
    lazy_static::initialize(&SIGNALS_TOTAL);
    lazy_static::initialize(&EVALUATIONS_TOTAL);
    lazy_static::initialize(&RISK_REJECTIONS);
    lazy_static::initialize(&WEBSOCKET_MESSAGES);
    lazy_static::initialize(&DAILY_PNL);
}
