//! Analysis modules for trading opportunities.
//!
//! Contains analyzers that scan market data for profitable opportunities.

mod sum_deviation;

pub use sum_deviation::{SumDeviationAnalyzer, SumDeviationOpportunity};
