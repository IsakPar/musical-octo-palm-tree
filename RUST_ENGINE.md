# Poly-Rust: High-Performance Trading Engine

## Why Rust?

### The Latency Problem

In prediction market arbitrage, **speed is everything**. Here's why:

```
Arbitrage Opportunity Lifecycle:
┌─────────────────────────────────────────────────────────────────┐
│  t=0ms     Market mispricing occurs (YES + NO = $0.95)          │
│  t=5ms     Fast traders detect opportunity                       │
│  t=10ms    Orders start hitting the book                         │
│  t=50ms    Opportunity shrinks as prices adjust                  │
│  t=100ms   Opportunity gone - you're too late                    │
└─────────────────────────────────────────────────────────────────┘
```

**Python limitations:**
- HTTP request overhead: 50-200ms per request
- GIL prevents true parallelism
- JSON parsing is slow
- asyncio adds ~5-10ms overhead per await

**Rust advantages:**
- Zero-cost abstractions
- Lock-free data structures
- SIMD-accelerated JSON parsing
- True parallelism with no GIL
- Predictable latency (no GC pauses)

### Performance Targets

| Operation | Python | Rust Target | Improvement |
|-----------|--------|-------------|-------------|
| Market scan (1000 markets) | ~100ms | <1ms | 100x |
| Order placement (HTTP) | ~200ms | <10ms | 20x |
| WebSocket message processing | ~5ms | <0.1ms | 50x |
| ESPN poll + match | ~500ms | <50ms | 10x |
| Memory usage | ~200MB | <20MB | 10x |
| Startup time | ~5s | <100ms | 50x |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RUST TRADING ENGINE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  WebSocket  │───▶│   Market    │───▶│  Strategy   │         │
│  │  Handler    │    │   Data      │    │  Engine     │         │
│  │  (tokio)    │    │  (DashMap)  │    │  (10 Hz)    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│        │                   │                  │                 │
│        │ Lock-free         │ Lock-free        │                 │
│        │ writes            │ reads            ▼                 │
│        │                   │           ┌─────────────┐         │
│        │                   │           │   Risk      │         │
│        │                   │           │   Manager   │         │
│        │                   │           └─────────────┘         │
│        │                   │                  │                 │
│        │                   │                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   ESPN      │───▶│  Sniper     │───▶│   Order     │         │
│  │   Client    │    │  Strategy   │    │  Manager    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                               │                 │
└───────────────────────────────────────────────│─────────────────┘
                                                │
                                                │ Signed orders
                                                ▼
                                    ┌─────────────────────┐
                                    │  Polymarket CLOB    │
                                    │  (HTTP API)         │
                                    └─────────────────────┘
```

---

## Trading Strategies

### 1. Clipper (YES+NO Arbitrage)

**The most reliable strategy** - mathematically guaranteed profit.

```
Example:
┌─────────────────────────────────────────┐
│  Market: "Will X happen?"               │
│  YES price: $0.45                       │
│  NO price:  $0.50                       │
│  Total:     $0.95                       │
│                                         │
│  Action: Buy both for $0.95             │
│  Result: Redeem for $1.00               │
│  Profit: $0.05 per share (5.3% return)  │
└─────────────────────────────────────────┘
```

**Why it works:**
- Market inefficiencies from latency differences
- Different traders on YES vs NO side
- Brief mispricings during high volume
- **Zero directional risk** - you win regardless of outcome

**Why speed matters:**
- Opportunities last milliseconds
- Multiple bots competing for same opportunities
- First to execute wins
- Need to place TWO orders (YES + NO) atomically

### 2. Sniper (Sports Time Arbitrage)

**Exploits information delay** between ESPN and Polymarket.

```
Timeline:
┌─────────────────────────────────────────────────────────────────┐
│  t=0s    Game ends - Lakers win                                 │
│  t=30s   ESPN API updates with final score                      │
│  t=45s   Our bot detects win, places buy order                  │
│  t=60s   Human traders start updating Polymarket                │
│  t=90s   Market fully adjusts to $1.00                          │
└─────────────────────────────────────────────────────────────────┘

Opportunity window: 30-60 seconds
Profit: Buy at $0.75, sell/redeem at $1.00 = 33% return
```

**Why speed matters:**
- Every second of delay = other traders take the edge
- Need to poll ESPN + match game + execute order in <1 second
- Python's HTTP overhead makes this nearly impossible

---

## Key Components

### Market Data Store (Lock-Free)

```rust
pub struct MarketData {
    // DashMap provides lock-free concurrent access
    prices: DashMap<TokenId, PriceLevel>,
    pairs: DashMap<MarketId, MarketPair>,

    // Atomic timestamp for freshness checks
    last_update_ns: AtomicU64,
}
```

**Why DashMap?**
- Multiple readers, single writer pattern
- No mutex contention
- ~10ns read latency vs ~1000ns for Mutex

### Strategy Trait

```rust
pub trait Strategy: Send + Sync {
    fn evaluate(&self, market_data: &MarketData) -> Option<TradeSignal>;
    fn name(&self) -> &'static str;
    fn is_active(&self) -> bool;
}
```

**Pluggable design:**
- Easy to add new strategies
- Each strategy runs independently
- Can enable/disable via config

### Risk Manager

```rust
pub struct RiskManager {
    config: RiskConfig,
    positions: RwLock<HashMap<TokenId, Position>>,
    daily_stats: RwLock<DailyStats>,
}
```

**Protections:**
- Maximum position per token
- Maximum notional per trade
- Daily loss limit (stops trading if exceeded)
- Rate limiting

---

## Configuration

All settings via environment variables (see `.env.example`):

```bash
# Execution mode (IMPORTANT: defaults to dry run!)
DRY_RUN=true

# Risk limits
RISK_MAX_POSITION=100      # Max shares per token
RISK_MAX_NOTIONAL=500      # Max $ per trade
RISK_MAX_DAILY_LOSS=200    # Stop if daily loss exceeds

# Clipper (arbitrage)
CLIPPER_ENABLED=true
CLIPPER_MIN_PROFIT=0.01    # Min profit per share after fees

# Sniper (sports)
SNIPER_ENABLED=true
SNIPER_MIN_PRICE=0.50      # Don't buy if already expensive
SNIPER_MAX_PRICE=0.95      # Don't overpay
```

---

## Building & Running

```bash
cd poly-rust

# Development
cargo build
cargo run

# Production (optimized)
cargo build --release
./target/release/poly-rust

# Run tests
cargo test

# Benchmarks
cargo bench
```

---

## Polymarket Redemption Mechanics (VERIFIED)

### Key Finding: YES + NO CAN be merged to $1 IMMEDIATELY

You don't have to wait for market settlement! Polymarket supports **merging** at any time:

```
1 YES token + 1 NO token → 1 USDC (via mergePositions())
```

### Three Operations

| Operation | Direction | When |
|-----------|-----------|------|
| **Split** | 1 USDC → 1 YES + 1 NO | Anytime |
| **Merge** | 1 YES + 1 NO → 1 USDC | Anytime |
| **Redeem** | Winning tokens → USDC | After resolution |

### Arbitrage Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Detect opportunity: YES $0.45 + NO $0.50 = $0.95       │
│  2. Buy YES tokens (CLOB order)                             │
│  3. Buy NO tokens (CLOB order)                              │
│  4. Call mergePositions() on CTF contract                   │
│  5. Receive 1 USDC per merged pair                          │
│  6. Profit: $0.05 per share (minus fees)                    │
└─────────────────────────────────────────────────────────────┘
```

### Fees to Consider

- CLOB trading fees (~0.5% per side = ~1% total)
- Gas fees for merge transaction
- Slippage on partial fills

Edge is only realized after: `min(filled_yes, filled_no)` pairs merged.

### On-Chain Function

```solidity
// Called on Conditional Token Framework (CTF) contract
mergePositions(
    collateralToken,    // USDC address
    parentCollectionId, // bytes32(0) for Polymarket
    conditionId,        // Market condition ID
    partition,          // [1, 2] for YES/NO
    amount              // Number of pairs to merge
)
```

### Official Polymarket Clients

Polymarket provides official clients that handle all this:

- **Rust**: [rs-clob-client](https://github.com/Polymarket/rs-clob-client) - Supports CTF split/merge/redeem
- **Python**: [py-clob-client](https://github.com/Polymarket/py-clob-client) - Official Python client

**Consider using the official rs-clob-client** for better compatibility and maintenance.

---

## TODO / Roadmap

### Phase 1: Core Engine (DONE)
- [x] WebSocket handler with auto-reconnect
- [x] Lock-free market data store
- [x] Strategy trait and engine
- [x] Order manager with signing
- [x] Risk manager
- [x] ESPN client
- [x] Verify redemption mechanics (YES+NO → $1 works!)

### Phase 2: Integration (NEXT)
- [ ] Evaluate official rs-clob-client vs custom implementation
- [ ] Add merge operation to order manager
- [ ] Test order signing with real API
- [ ] Benchmark actual latency improvements

### Phase 3: Production
- [ ] Add gRPC server for Python dashboard integration
- [ ] Implement market discovery (auto-find new markets)
- [ ] Add position reconciliation
- [ ] Implement graceful shutdown

### Phase 4: Advanced
- [ ] Cross-market correlation arbitrage
- [ ] Settlement arbitrage (markets that should settle same)
- [ ] Multi-outcome market arbitrage

---

## File Structure

```
poly-rust/
├── Cargo.toml              # Dependencies
├── .env.example            # Configuration template
├── RUST_ENGINE.md          # This file
└── src/
    ├── main.rs             # Entry point
    ├── config.rs           # Configuration loading
    ├── market/
    │   ├── mod.rs
    │   └── data.rs         # Lock-free price storage
    ├── ws/
    │   ├── mod.rs
    │   └── handler.rs      # WebSocket connection
    ├── strategy/
    │   ├── mod.rs
    │   ├── traits.rs       # Strategy trait
    │   ├── engine.rs       # Evaluation loop
    │   ├── clipper.rs      # YES+NO arbitrage
    │   └── sniper.rs       # Sports time arbitrage
    ├── execution/
    │   ├── mod.rs
    │   └── order_manager.rs # Order placement
    ├── external/
    │   ├── mod.rs
    │   └── espn.rs         # ESPN API client
    └── risk/
        ├── mod.rs
        └── manager.rs      # Position & risk tracking
```

---

## Why Not Just Optimize Python?

We tried. Here's why it doesn't work:

| Approach | Result |
|----------|--------|
| asyncio | Still limited by GIL, 5-10ms overhead per await |
| PyPy | Better, but still 10-50x slower than Rust |
| Cython | Complex, partial improvement, maintenance burden |
| multiprocessing | IPC overhead defeats the purpose |
| uvloop | ~20% improvement, not enough |

**The fundamental issue:** Python was designed for developer productivity, not latency-critical systems. For trading where milliseconds matter, you need a systems language.

---

## Safety First

The engine defaults to **DRY_RUN=true** for safety. Before going live:

1. Test extensively in dry run mode
2. Start with small position limits
3. Monitor the first few trades manually
4. Gradually increase limits as confidence grows

**Never risk more than you can afford to lose.**
