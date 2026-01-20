//! External data sources (ESPN, etc).

mod espn;

#[allow(unused_imports)]
pub use espn::{EspnClient, Game, League};
