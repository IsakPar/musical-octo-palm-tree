//! Trading strategies.

mod clipper;
mod engine;
mod sniper;
mod sum_to_100;
mod traits;

pub use clipper::ClipperStrategy;
pub use engine::StrategyEngine;
pub use sniper::SniperStrategy;
pub use sum_to_100::SumTo100Strategy;
pub use traits::{Strategy, TradeSignal};
