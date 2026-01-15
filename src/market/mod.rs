//! Market data storage and management.
//!
//! Uses lock-free data structures for minimal latency.

mod data;

pub use data::{MarketData, MarketPair, PriceLevel};
