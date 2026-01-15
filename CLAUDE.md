# Poly-Rust Trading Engine - Claude Context

## Project Overview

This is a **standalone high-performance trading engine** for Polymarket prediction markets. It's designed to be fast enough to capture arbitrage opportunities that last milliseconds.

**Location:** `/Users/isaks_macbook/Desktop/Dev/poly_rust`

**Related project:** `/Users/isaks_macbook/Desktop/Dev/poly` (Python dashboard)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RUST TRADING ENGINE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WebSocket ──▶ MarketData ──▶ Strategies ──▶ OrderManager   │
│  (tokio)      (DashMap)       (10 Hz)        (HTTP+Sign)    │
│                                    │                         │
│                                    ▼                         │
│                              RiskManager                     │
│                           (position limits)                  │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/main.rs` | Entry point, wires everything together |
| `src/config.rs` | Environment variable loading |
| `src/market/data.rs` | Lock-free price storage using DashMap |
| `src/ws/handler.rs` | WebSocket with auto-reconnect |
| `src/strategy/traits.rs` | Strategy trait definition |
| `src/strategy/clipper.rs` | YES+NO arbitrage |
| `src/strategy/sniper.rs` | Sports time arbitrage |
| `src/execution/order_manager.rs` | Order placement with signing |
| `src/external/espn.rs` | ESPN API client |
| `src/risk/manager.rs` | Position & daily loss tracking |

## Trading Strategies

### Clipper (Arbitrage)
- Scans all markets for `YES + NO < $1.00`
- Buys both tokens for guaranteed profit
- **Key question:** Can YES+NO be redeemed for $1 directly, or must wait for settlement?

### Sniper (Sports)
- Polls ESPN for finished games
- Buys winning outcomes before Polymarket prices update
- Window: ~30-60 seconds after game ends

## Why Latency Matters

```
t=0ms     Opportunity appears (YES+NO = $0.95)
t=5ms     Fast bots detect it
t=10ms    Orders hit the book
t=50ms    Prices adjust
t=100ms   Opportunity GONE

Python: 200ms per order → ALWAYS too late
Rust:   <10ms per order → Can capture opportunities
```

## Current State

### Done
- [x] WebSocket handler with auto-reconnect
- [x] Lock-free market data store
- [x] Strategy trait and engine
- [x] Clipper strategy (YES+NO arb)
- [x] Sniper strategy (sports time arb)
- [x] Order manager with signing
- [x] Risk manager
- [x] ESPN client

### TODO
- [ ] **Verify Polymarket redemption** - Can YES+NO → $1 directly?
- [ ] Test order signing with real Polymarket API
- [ ] Add gRPC server for Python dashboard integration
- [ ] Benchmark actual latency vs Python
- [ ] Add market discovery (auto-find new markets)

## Python Integration Plan

The `/python` folder will contain:
1. **gRPC client** - Connect to Rust engine for status/control
2. **Dashboard connector** - Feed data to the existing poly dashboard

This keeps the Rust engine standalone while allowing the Python dashboard to display its state.

## Common Tasks

### Adding a new strategy
1. Create `src/strategy/your_strategy.rs`
2. Implement `Strategy` trait
3. Add to `src/strategy/mod.rs`
4. Register in `src/main.rs`

### Changing risk limits
Edit `.env` or modify defaults in `src/config.rs`

### Testing without real orders
Keep `DRY_RUN=true` (default) - logs orders without executing

## Environment Variables

Critical ones (see `.env.example` for all):
```bash
POLY_PRIVATE_KEY=your_wallet_key    # Required
POLY_API_KEY=from_polymarket        # Required
DRY_RUN=true                        # KEEP TRUE until tested!
RISK_MAX_DAILY_LOSS=200             # Safety limit
```

## Build & Run

```bash
# Development
cargo run

# Production (optimized)
cargo run --release

# Tests
cargo test
```

## Safety Warnings

1. **ALWAYS start with `DRY_RUN=true`**
2. **Never risk more than you can afford to lose**
3. **Test extensively before enabling real trading**
4. **Start with small position limits**
