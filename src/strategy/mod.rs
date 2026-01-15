//! Trading strategies.

mod clipper;
mod engine;
mod sniper;
mod traits;

pub use clipper::ClipperStrategy;
pub use engine::StrategyEngine;
pub use sniper::SniperStrategy;
pub use traits::{Strategy, TradeSignal};
