//! Market data storage and management.
//!
//! Uses lock-free data structures for minimal latency.

mod data;

#[allow(unused_imports)]
pub use data::{DepthLevel, MarketData, MarketPair, OrderBook, PriceLevel, TokenId, VwapResult};
