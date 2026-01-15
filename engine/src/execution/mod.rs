//! Order execution module.

mod order_manager;
mod paper;

pub use order_manager::{OrderManager, Side};
pub use paper::{PaperArbTrade, PaperFill, PaperTrader, PaperTraderStats};
