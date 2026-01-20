//! Redis integration for Rust-Python communication.
//!
//! This module provides pub/sub functionality to stream trading data
//! to the Python dashboard in real-time.

mod publisher;

#[allow(unused_imports)]
pub use publisher::{
    now_ms, EngineState, ErrorMessage, PositionInfo, RedisPublisher, SignalMessage, TradeMessage,
};
