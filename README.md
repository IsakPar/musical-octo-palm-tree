# Poly-Rust: High-Performance Polymarket Trading Engine

A low-latency trading engine for [Polymarket](https://polymarket.com/) prediction markets, built in Rust for maximum performance.

## Why Rust?

**Arbitrage opportunities last milliseconds.** Python's HTTP overhead (50-200ms) means you miss them. Rust targets <10ms order placement.

| Operation | Python | Rust Target |
|-----------|--------|-------------|
| Market scan (1000 markets) | ~100ms | <1ms |
| Order placement | ~200ms | <10ms |
| WebSocket processing | ~5ms | <0.1ms |
| Memory usage | ~200MB | <20MB |

## Strategies

### 1. SumTo100 (Depth-Aware Arbitrage) ⭐ PRIMARY

**Uses full order book depth for VWAP-based pricing.**

```
Order Book Example:
YES asks: 50 @ $0.45, 50 @ $0.46  →  VWAP for 100 shares = $0.455
NO asks:  100 @ $0.48              →  VWAP for 100 shares = $0.48

Total VWAP: $0.935 + 1% fees = $0.945
Edge: 5.5% profit per share!
```

Features:
- Volume-Weighted Average Price calculations
- Minimum liquidity requirements
- Stale data rejection
- Paper trading mode for validation

### 2. Clipper (Top-of-Book Arbitrage)

Simpler version using only best bid/ask:

```
YES=$0.45 + NO=$0.50 = $0.95
Buy both → Redeem for $1.00 → 5.3% profit
```

### 3. Sniper (Sports Time Arbitrage)

Uses ESPN data to buy winning outcomes before Polymarket prices update:

```
ESPN reports Lakers win → Polymarket still shows YES @ $0.75
Buy at $0.75 → Redeem at $1.00 → 33% profit
```

## Quick Start

```bash
# 1. Configure
cp .env.example .env
# Edit .env with your Polymarket credentials

# 2. Build
cargo build --release

# 3. Run (dry run mode by default - safe!)
cargo run --release

# 4. Run tests
cargo test
```

## Configuration

Key environment variables (see `.env.example` for full list):

```bash
# Required
POLY_PRIVATE_KEY=your_wallet_key
POLY_API_KEY=from_polymarket
POLY_API_SECRET=from_polymarket

# Safety (ALWAYS START WITH THESE!)
DRY_RUN=true
SUMTO100_PAPER_TRADING=true

# SumTo100 Strategy
SUMTO100_ENABLED=true
SUMTO100_MIN_EDGE=0.003        # 0.3% minimum edge
SUMTO100_MIN_LIQUIDITY=50      # Minimum shares available
SUMTO100_FEE_RATE=0.01         # 1% total fees

# Risk Limits
RISK_MAX_POSITION=100          # Max shares per token
RISK_MAX_DAILY_LOSS=200        # Stop if daily loss exceeds
```

## Project Structure

```
poly_rust/
├── Cargo.toml              # Dependencies
├── .env.example            # Configuration template
├── CLAUDE.md               # AI assistant context
├── README.md               # This file
├── RUST_ENGINE.md          # Technical deep-dive
├── python/                 # Python connectors (future)
└── src/
    ├── main.rs             # Entry point
    ├── config.rs           # Configuration loading
    ├── analysis/
    │   └── sum_deviation.rs # Opportunity detection (VWAP-based)
    ├── market/
    │   └── data.rs         # OrderBook, DepthLevel, VwapResult
    ├── ws/
    │   └── handler.rs      # WebSocket (preserves full depth!)
    ├── strategy/
    │   ├── sum_to_100.rs   # Depth-aware VWAP arbitrage
    │   ├── clipper.rs      # Top-of-book arbitrage
    │   └── sniper.rs       # Sports time arbitrage
    ├── execution/
    │   ├── order_manager.rs # Real order placement
    │   └── paper.rs        # Paper trading simulator
    ├── external/
    │   └── espn.rs         # ESPN API client
    └── risk/
        └── manager.rs      # Position & loss tracking
```

## Key Features

### Full Order Book Depth
Unlike simple arbitrage bots that only look at top-of-book, this engine:
- Preserves ALL depth levels from WebSocket
- Calculates VWAP (Volume-Weighted Average Price) across depth
- Accounts for slippage on larger orders

### Paper Trading
Validate strategies without risking capital:
- Simulates fills based on current order book
- Tracks P&L, win rate, trade history
- Enable with `SUMTO100_PAPER_TRADING=true`

### Polymarket Redemption
**Verified:** YES + NO tokens CAN be merged to $1 USDC immediately via `mergePositions()`. No need to wait for market settlement!

## Safety

⚠️ **Trading involves risk of loss. This software is provided as-is.**

Safety features:
- **Defaults to dry run mode** - no real orders until you enable them
- **Paper trading mode** - simulate fills without real orders
- **Risk limits enforced** - position caps, daily loss limits
- **Stale data rejection** - won't trade on old prices

**ALWAYS:**
1. Start with `DRY_RUN=true`
2. Start with `SUMTO100_PAPER_TRADING=true`
3. Test extensively before enabling real trading
4. Never risk more than you can afford to lose

## Documentation

- [CLAUDE.md](CLAUDE.md) - Context for AI assistants
- [RUST_ENGINE.md](RUST_ENGINE.md) - Technical architecture & latency analysis
- [.env.example](.env.example) - All configuration options

## Development

```bash
# Build
cargo build

# Run tests
cargo test

# Run specific test
cargo test market::tests::test_vwap

# Format code
cargo fmt

# Lint
cargo clippy
```

## TODO

- [ ] Run `cargo build` and fix any compilation errors
- [ ] Run `cargo test` to verify all tests pass
- [ ] Test with real Polymarket WebSocket
- [ ] Benchmark actual latency vs Python
- [ ] Add gRPC server for Python dashboard integration
- [ ] Add market discovery (auto-find new markets)

## License

MIT
