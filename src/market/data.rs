//! Lock-free market data storage.

use dashmap::DashMap;
use parking_lot::RwLock;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// Token ID type (Polymarket uses hex strings)
pub type TokenId = String;

/// Market ID type
pub type MarketId = String;

/// A YES/NO token pair for a market
#[derive(Clone, Debug)]
pub struct MarketPair {
    pub market_id: MarketId,
    pub yes_token: TokenId,
    pub no_token: TokenId,
    pub question: String,
}

/// Price level for a token
#[derive(Clone, Copy, Debug, Default)]
pub struct PriceLevel {
    pub bid: f64,
    pub ask: f64,
    pub mid: f64,
    pub spread: f64,
    pub timestamp_ns: u64,
}

impl PriceLevel {
    pub fn new(bid: f64, ask: f64) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64;

        Self {
            bid,
            ask,
            mid: (bid + ask) / 2.0,
            spread: ask - bid,
            timestamp_ns: now,
        }
    }
}

/// Price history entry
#[derive(Clone, Copy, Debug)]
pub struct PriceTick {
    pub price: f64,
    pub timestamp_ns: u64,
}

/// Lock-free market data store
pub struct MarketData {
    /// Token prices (lock-free reads via DashMap)
    prices: DashMap<TokenId, PriceLevel>,

    /// Market pairs (YES/NO mapping)
    pairs: DashMap<MarketId, MarketPair>,

    /// Token to market mapping
    token_to_market: DashMap<TokenId, MarketId>,

    /// Price history per token (for crash detection, etc.)
    history: DashMap<TokenId, RwLock<VecDeque<PriceTick>>>,

    /// Last update timestamp (atomic for lock-free access)
    last_update_ns: AtomicU64,

    /// History size limit
    max_history_size: usize,
}

impl MarketData {
    pub fn new() -> Self {
        Self::with_history_size(1024)
    }

    pub fn with_history_size(max_history_size: usize) -> Self {
        Self {
            prices: DashMap::new(),
            pairs: DashMap::new(),
            token_to_market: DashMap::new(),
            history: DashMap::new(),
            last_update_ns: AtomicU64::new(0),
            max_history_size,
        }
    }

    /// Update price for a token (lock-free for readers)
    #[inline]
    pub fn update_price(&self, token_id: &TokenId, bid: f64, ask: f64) {
        let level = PriceLevel::new(bid, ask);

        // Update price
        self.prices.insert(token_id.clone(), level);

        // Update last update timestamp
        self.last_update_ns.store(level.timestamp_ns, Ordering::Release);

        // Add to history
        self.add_to_history(token_id, level.mid, level.timestamp_ns);
    }

    /// Get current price for a token (lock-free)
    #[inline]
    pub fn get_price(&self, token_id: &TokenId) -> Option<PriceLevel> {
        self.prices.get(token_id).map(|p| *p)
    }

    /// Get best ask price for a token
    #[inline]
    pub fn get_ask(&self, token_id: &TokenId) -> Option<f64> {
        self.prices.get(token_id).map(|p| p.ask)
    }

    /// Get best bid price for a token
    #[inline]
    pub fn get_bid(&self, token_id: &TokenId) -> Option<f64> {
        self.prices.get(token_id).map(|p| p.bid)
    }

    /// Register a market pair
    pub fn register_pair(&self, pair: MarketPair) {
        self.token_to_market.insert(pair.yes_token.clone(), pair.market_id.clone());
        self.token_to_market.insert(pair.no_token.clone(), pair.market_id.clone());
        self.pairs.insert(pair.market_id.clone(), pair);
    }

    /// Get market pair by market ID
    pub fn get_pair(&self, market_id: &MarketId) -> Option<MarketPair> {
        self.pairs.get(market_id).map(|p| p.clone())
    }

    /// Get complement token (YES -> NO, NO -> YES)
    pub fn get_complement(&self, token_id: &TokenId) -> Option<TokenId> {
        let market_id = self.token_to_market.get(token_id)?;
        let pair = self.pairs.get(&*market_id)?;

        if &pair.yes_token == token_id {
            Some(pair.no_token.clone())
        } else {
            Some(pair.yes_token.clone())
        }
    }

    /// Iterate over all market pairs
    pub fn iter_pairs(&self) -> impl Iterator<Item = MarketPair> + '_ {
        self.pairs.iter().map(|r| r.value().clone())
    }

    /// Get all pairs (for strategies)
    pub fn get_all_pairs(&self) -> Vec<(MarketId, MarketPair)> {
        self.pairs.iter().map(|r| (r.key().clone(), r.value().clone())).collect()
    }

    /// Get sports markets (markets with certain tags/categories)
    /// For now, returns all markets - filter will be added when we have market metadata
    pub fn get_sports_markets(&self) -> Vec<(MarketId, MarketPair)> {
        // TODO: Filter by market category once we have that metadata
        self.get_all_pairs()
    }

    /// Check if we have any market data yet
    pub fn has_data(&self) -> bool {
        !self.prices.is_empty()
    }

    /// Iterate over all prices
    pub fn iter_prices(&self) -> impl Iterator<Item = (TokenId, PriceLevel)> + '_ {
        self.prices.iter().map(|r| (r.key().clone(), *r.value()))
    }

    /// Get price history for a token
    pub fn get_history(&self, token_id: &TokenId) -> Option<Vec<PriceTick>> {
        self.history
            .get(token_id)
            .map(|h| h.read().iter().copied().collect())
    }

    /// Get recent high price for a token
    pub fn get_recent_high(&self, token_id: &TokenId, ticks: usize) -> Option<f64> {
        self.history.get(token_id).and_then(|h| {
            let history = h.read();
            history
                .iter()
                .rev()
                .take(ticks)
                .map(|t| t.price)
                .max_by(|a, b| a.partial_cmp(b).unwrap())
        })
    }

    /// Check if price has been stable (for crash detection)
    pub fn is_price_stable(&self, token_id: &TokenId, ticks: usize, tolerance: f64) -> bool {
        self.history
            .get(token_id)
            .map(|h| {
                let history = h.read();
                if history.len() < ticks {
                    return false;
                }

                let recent: Vec<f64> = history.iter().rev().take(ticks).map(|t| t.price).collect();

                if recent.is_empty() {
                    return false;
                }

                let avg = recent.iter().sum::<f64>() / recent.len() as f64;
                recent.iter().all(|p| (p - avg).abs() / avg < tolerance)
            })
            .unwrap_or(false)
    }

    /// Add price tick to history
    fn add_to_history(&self, token_id: &TokenId, price: f64, timestamp_ns: u64) {
        let tick = PriceTick { price, timestamp_ns };

        self.history
            .entry(token_id.clone())
            .or_insert_with(|| RwLock::new(VecDeque::with_capacity(self.max_history_size)))
            .write()
            .push_back(tick);

        // Trim history if needed
        if let Some(h) = self.history.get(token_id) {
            let mut history = h.write();
            while history.len() > self.max_history_size {
                history.pop_front();
            }
        }
    }

    /// Get last update timestamp
    pub fn last_update_ns(&self) -> u64 {
        self.last_update_ns.load(Ordering::Acquire)
    }

    /// Get number of tracked tokens
    pub fn token_count(&self) -> usize {
        self.prices.len()
    }

    /// Get number of tracked markets
    pub fn market_count(&self) -> usize {
        self.pairs.len()
    }
}

impl Default for MarketData {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_price_update() {
        let data = MarketData::new();
        let token = "0x123".to_string();

        data.update_price(&token, 0.45, 0.47);

        let price = data.get_price(&token).unwrap();
        assert!((price.bid - 0.45).abs() < 0.001);
        assert!((price.ask - 0.47).abs() < 0.001);
        assert!((price.mid - 0.46).abs() < 0.001);
    }

    #[test]
    fn test_complement_lookup() {
        let data = MarketData::new();

        let pair = MarketPair {
            market_id: "market1".into(),
            yes_token: "yes_token".into(),
            no_token: "no_token".into(),
            question: "Test?".into(),
        };

        data.register_pair(pair);

        assert_eq!(
            data.get_complement(&"yes_token".into()),
            Some("no_token".into())
        );
        assert_eq!(
            data.get_complement(&"no_token".into()),
            Some("yes_token".into())
        );
    }

    #[test]
    fn test_price_history() {
        let data = MarketData::new();
        let token = "0x123".to_string();

        // Add some prices
        for i in 0..10 {
            data.update_price(&token, 0.40 + i as f64 * 0.01, 0.42 + i as f64 * 0.01);
        }

        let history = data.get_history(&token).unwrap();
        assert_eq!(history.len(), 10);
    }
}
