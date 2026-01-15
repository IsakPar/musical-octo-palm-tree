//! Database persistence for trades and positions.
//!
//! All write operations are fire-and-forget (non-blocking) to ensure
//! the trading loop is never delayed by database I/O.

mod repository;

pub use repository::{TradeRepository, Trade, ArbTrade};
