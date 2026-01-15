//! Redis integration for Rust-Python communication.
//!
//! This module provides pub/sub functionality to stream trading data
//! to the Python dashboard in real-time.

mod publisher;

pub use publisher::{
    RedisPublisher,
    EngineState,
    SignalMessage,
    TradeMessage,
    ErrorMessage,
    PositionInfo,
    now_ms,
};
