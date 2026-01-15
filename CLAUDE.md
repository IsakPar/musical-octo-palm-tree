# Poly-Rust Trading Engine - Claude Context

## IMPORTANT: Repository Location

**THIS IS THE CORRECT REPO:** `/Users/isaks_macbook/Desktop/Dev/poly_rust`

DO NOT work in:
- `/Users/isaks_macbook/.claude-worktrees/poly/amazing-maxwell/poly-rust` (worktree - wrong!)
- Any other location

**Related project:** `/Users/isaks_macbook/Desktop/Dev/poly` (Python dashboard)

---

## CURRENT PRIORITY: 30-Day Cloud Launch

**See `LAUNCH_PLAN.md` for full details.**

### Active Phase Checklist

- [ ] **Phase 1 (Day 1-3):** Validate Rust compiles and connects to Polymarket
- [ ] **Phase 2 (Day 4-6):** Fix Python dashboard auth (Redis OTP + JWT)
- [ ] **Phase 3 (Day 7-10):** Create Dockerfiles for both services
- [ ] **Phase 4 (Day 11-14):** Add PostgreSQL persistence
- [ ] **Phase 5 (Day 15-18):** Redis Pub/Sub integration (Rust→Python)
- [ ] **Phase 6 (Day 19-23):** Deploy to Railway.app
- [ ] **Phase 7 (Day 24-27):** Add monitoring and Slack alerts
- [ ] **Phase 8 (Day 28-30):** Paper trading validation

### Integration Architecture (DECIDED)

```
┌─────────────────┐      ┌─────────────────┐
│   Rust Engine   │─────▶│      Redis      │
│  (Publisher)    │      │   (Pub/Sub)     │
└─────────────────┘      └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │ Python Dashboard│
                         │  (Subscriber)   │
                         └─────────────────┘
```

**Redis Channels:**
- `poly:state` - Engine state (100ms interval)
- `poly:signals` - Trade signals
- `poly:trades` - Executed trades
- `poly:errors` - Error notifications

### Files to Create (This Sprint)

| File | Purpose | Phase |
|------|---------|-------|
| `Dockerfile` | Rust engine container | 3 |
| `src/redis/mod.rs` | Redis publisher | 5 |
| `src/redis/publisher.rs` | Pub/Sub logic | 5 |
| `src/db/mod.rs` | PostgreSQL persistence | 4 |
| `docker-compose.yml` | Local dev stack | 3 |

### Latency Optimizations (COMPLETED)

1. **HTTP timeout (500ms)** - `execution/order_manager.rs`
2. **ECDSA off async runtime** - `spawn_blocking` for signing
3. **Parallel signal handling** - `futures::join_all` in engine
4. **Atomic P&L checks** - Lock-free in risk manager

---

## Project Overview

High-performance trading engine for Polymarket prediction markets. Designed to capture arbitrage opportunities that last milliseconds.

### Why Rust?

```
Python: 200ms per order → ALWAYS too late
Rust:   <10ms per order → Can capture opportunities

Arbitrage opportunities last ~50-100ms
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      RUST TRADING ENGINE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  WebSocket   │───▶│  MarketData  │───▶│  Strategies  │          │
│  │  Handler     │    │  + OrderBook │    │  (10 Hz)     │          │
│  │  (tokio)     │    │  (DashMap)   │    │              │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│        │                    │                    │                  │
│        │ Full depth         │ VWAP calcs         │                  │
│        │ preserved          │                    ▼                  │
│        │                    │           ┌──────────────┐           │
│        │                    │           │ RiskManager  │           │
│        │                    │           └──────────────┘           │
│        │                    │                    │                  │
│        │                    │                    ▼                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Analysis   │───▶│  SumTo100    │───▶│ OrderManager │          │
│  │   Module     │    │  Strategy    │    │ or Paper     │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                  │                  │
└──────────────────────────────────────────────────│──────────────────┘
                                                   │
                                                   ▼
                                       ┌─────────────────────┐
                                       │  Polymarket CLOB    │
                                       └─────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/main.rs` | Entry point, wires everything together |
| `src/config.rs` | Environment variable loading (all strategies) |
| `src/market/data.rs` | Lock-free storage: `PriceLevel`, `OrderBook`, `DepthLevel`, `VwapResult` |
| `src/market/mod.rs` | Exports market types |
| `src/ws/handler.rs` | WebSocket handler - **preserves full order book depth** |
| `src/analysis/sum_deviation.rs` | `SumDeviationAnalyzer` - finds YES+NO < $1 opportunities |
| `src/strategy/traits.rs` | `Strategy` trait, `TradeSignal` enum |
| `src/strategy/sum_to_100.rs` | **SumTo100Strategy** - depth-aware VWAP arbitrage |
| `src/strategy/clipper.rs` | Clipper - top-of-book YES+NO arbitrage |
| `src/strategy/sniper.rs` | Sniper - sports time arbitrage |
| `src/strategy/engine.rs` | Strategy engine (runs all strategies at 10 Hz) |
| `src/execution/order_manager.rs` | Order placement with EIP-712 signing |
| `src/execution/paper.rs` | `PaperTrader` - simulates fills for validation |
| `src/external/espn.rs` | ESPN API client for sports data |
| `src/risk/manager.rs` | Position limits, daily loss tracking |

---

## Trading Strategies

### 1. SumTo100 (Depth-Aware Arbitrage) - **PRIMARY STRATEGY**

**The most advanced strategy** - uses full order book depth for VWAP pricing.

```
Finding: YES_ask + NO_ask < 1.00 (after VWAP calculation)

Example with depth:
┌─────────────────────────────────────────────────────┐
│ YES Order Book:           NO Order Book:            │
│ 50 @ $0.45                100 @ $0.48               │
│ 50 @ $0.46                                          │
│                                                     │
│ VWAP for 100 shares:                                │
│ YES: (50×0.45 + 50×0.46)/100 = $0.455               │
│ NO:  100×0.48/100 = $0.48                           │
│                                                     │
│ Sum: $0.935 + 1% fees = $0.945                      │
│ Edge: 5.5% profit per share                         │
└─────────────────────────────────────────────────────┘
```

**Key features:**
- Uses VWAP (Volume-Weighted Average Price) across depth
- Checks minimum liquidity requirements
- Validates order book freshness (rejects stale data)
- Paper trading mode for validation

**Configuration:**
```bash
SUMTO100_ENABLED=true
SUMTO100_MIN_EDGE=0.003      # 0.3% minimum edge
SUMTO100_MIN_LIQUIDITY=50    # Min shares available
SUMTO100_FEE_RATE=0.01       # 1% total fees
SUMTO100_PAPER_TRADING=true  # Start with paper trading!
```

### 2. Clipper (Top-of-Book Arbitrage)

Simpler version - only uses best bid/ask prices.

```
Example:
YES best ask: $0.45
NO best ask:  $0.50
Total:        $0.95 → Buy both, redeem for $1.00
```

### 3. Sniper (Sports Time Arbitrage)

Exploits information delay between ESPN and Polymarket.

```
Timeline:
t=0s    Game ends - Lakers win
t=30s   ESPN API updates
t=45s   Our bot buys Lakers YES @ $0.75
t=90s   Market adjusts to $1.00
Profit: 33%
```

---

## Polymarket Redemption (VERIFIED)

**YES + NO CAN be merged to $1 IMMEDIATELY** via `mergePositions()`:

```
1 YES token + 1 NO token → 1 USDC (via CTF contract)
```

No need to wait for market settlement!

---

## Current State

### Completed
- [x] WebSocket handler with auto-reconnect
- [x] Lock-free market data store with **full depth**
- [x] `OrderBook` with VWAP calculations (`vwap_buy`, `vwap_sell`)
- [x] `SumDeviationAnalyzer` for opportunity detection
- [x] `SumTo100Strategy` - depth-aware arbitrage
- [x] `PaperTrader` for strategy validation
- [x] Clipper strategy (top-of-book arb)
- [x] Sniper strategy (sports time arb)
- [x] Order manager with EIP-712 signing
- [x] Risk manager (position limits, daily loss)
- [x] ESPN client
- [x] Comprehensive configuration via env vars

### TODO (See LAUNCH_PLAN.md for full timeline)

**Phase 1 - Validation:**
- [ ] Run `cargo build --release` and fix compilation errors
- [ ] Run `cargo test` to verify tests pass
- [ ] Test with real Polymarket WebSocket (dry-run mode)

**Phase 3 - Containerization:**
- [ ] Create `Dockerfile` for Rust engine
- [ ] Create `docker-compose.yml` for local dev

**Phase 4 - Persistence:**
- [ ] Add `sqlx` for PostgreSQL
- [ ] Create `src/db/mod.rs` for trade persistence

**Phase 5 - Redis Integration:**
- [ ] Add `redis` crate to Cargo.toml
- [ ] Create `src/redis/publisher.rs`
- [ ] Publish state/signals/trades to Redis channels

**Phase 7 - Monitoring:**
- [ ] Add `/health` endpoint
- [ ] Add Prometheus metrics
- [ ] Add Slack error notifications

---

## Build & Run

```bash
cd /Users/isaks_macbook/Desktop/Dev/poly_rust

# Development
cargo build
cargo run

# Production (optimized)
cargo build --release
./target/release/poly-rust

# Run tests
cargo test

# Run specific test
cargo test market::tests::test_vwap
```

---

## Configuration

All settings via environment variables. Copy `.env.example` to `.env`:

```bash
# Required
POLY_PRIVATE_KEY=your_wallet_key
POLY_API_KEY=from_polymarket
POLY_API_SECRET=from_polymarket

# Safety (KEEP TRUE UNTIL TESTED!)
DRY_RUN=true

# SumTo100 Strategy
SUMTO100_ENABLED=true
SUMTO100_MIN_EDGE=0.003
SUMTO100_PAPER_TRADING=true

# Risk limits
RISK_MAX_POSITION=100
RISK_MAX_DAILY_LOSS=200
```

---

## Common Tasks

### Adding a new strategy
1. Create `src/strategy/your_strategy.rs`
2. Implement `Strategy` trait
3. Add to `src/strategy/mod.rs`
4. Register in `src/main.rs`

### Adding a new analyzer
1. Create `src/analysis/your_analyzer.rs`
2. Add to `src/analysis/mod.rs`
3. Use in strategy

### Changing risk limits
Edit `.env` or modify defaults in `src/config.rs`

### Testing without real orders
- Set `DRY_RUN=true` (logs orders without executing)
- Set `SUMTO100_PAPER_TRADING=true` (simulates fills)

---

## Safety Warnings

1. **ALWAYS start with `DRY_RUN=true`**
2. **ALWAYS start with `SUMTO100_PAPER_TRADING=true`**
3. **Never risk more than you can afford to lose**
4. **Test extensively before enabling real trading**
5. **Start with small position limits**
6. **Monitor the first few trades manually**

---

## File Structure

```
poly_rust/
├── Cargo.toml              # Dependencies
├── .env.example            # Configuration template
├── CLAUDE.md               # This file (agent context)
├── README.md               # User documentation
├── RUST_ENGINE.md          # Technical deep-dive
├── python/                 # Python connectors (future)
└── src/
    ├── main.rs             # Entry point
    ├── config.rs           # Configuration
    ├── analysis/
    │   ├── mod.rs
    │   └── sum_deviation.rs # Opportunity detection
    ├── market/
    │   ├── mod.rs
    │   └── data.rs         # OrderBook, VWAP, DepthLevel
    ├── ws/
    │   ├── mod.rs
    │   └── handler.rs      # WebSocket (preserves depth!)
    ├── strategy/
    │   ├── mod.rs
    │   ├── traits.rs       # Strategy trait
    │   ├── engine.rs       # Evaluation loop
    │   ├── sum_to_100.rs   # Depth-aware arbitrage
    │   ├── clipper.rs      # Top-of-book arbitrage
    │   └── sniper.rs       # Sports time arbitrage
    ├── execution/
    │   ├── mod.rs
    │   ├── order_manager.rs # Real orders
    │   └── paper.rs        # Paper trading simulator
    ├── external/
    │   ├── mod.rs
    │   └── espn.rs         # ESPN API
    └── risk/
        ├── mod.rs
        └── manager.rs      # Risk limits
```

---

## Recent Changes (Jan 2025)

1. **Added full order book depth support**
   - `ws/handler.rs` now preserves ALL depth levels (was only using `.first()`)
   - `market/data.rs` added `OrderBook`, `DepthLevel`, `VwapResult` types

2. **Added SumTo100 Strategy**
   - Uses VWAP for realistic fill price calculations
   - Checks liquidity requirements
   - Validates data freshness

3. **Added Paper Trading**
   - `PaperTrader` simulates fills for strategy validation
   - Tracks P&L, win rate, trade history

4. **Added Analysis Module**
   - `SumDeviationAnalyzer` scans all markets for opportunities
   - Returns opportunities sorted by edge (highest first)
