# Poly-Rust: High-Performance Polymarket Trading Engine

A low-latency trading engine for [Polymarket](https://polymarket.com/) prediction markets, built in Rust for maximum performance.

## Why Rust?

**Arbitrage opportunities last milliseconds.** Python's HTTP overhead (50-200ms) means you miss them. Rust targets <10ms order placement.

| Operation | Python | Rust Target |
|-----------|--------|-------------|
| Market scan (1000 markets) | ~100ms | <1ms |
| Order placement | ~200ms | <10ms |
| Memory usage | ~200MB | <20MB |

## Strategies

### Clipper (YES+NO Arbitrage)
Finds markets where `YES + NO < $1.00` and buys both for guaranteed profit.

```
YES=$0.45 + NO=$0.50 = $0.95
Buy both → Redeem for $1.00 → 5.3% profit
```

### Sniper (Sports Time Arbitrage)
Uses ESPN data to buy winning outcomes before Polymarket prices update.

```
ESPN reports Lakers win → Polymarket still shows YES @ $0.75
Buy at $0.75 → Redeem at $1.00 → 33% profit
```

## Quick Start

```bash
# Configure
cp .env.example .env
# Edit .env with your Polymarket credentials

# Build & run (dry run mode by default)
cargo run --release
```

## Project Structure

```
poly_rust/
├── Cargo.toml
├── .env.example
├── src/
│   ├── main.rs              # Entry point
│   ├── config.rs            # Configuration
│   ├── market/data.rs       # Lock-free price storage
│   ├── ws/handler.rs        # WebSocket connection
│   ├── strategy/
│   │   ├── clipper.rs       # YES+NO arbitrage
│   │   └── sniper.rs        # Sports time arbitrage
│   ├── execution/           # Order management
│   ├── external/espn.rs     # ESPN client
│   └── risk/manager.rs      # Position tracking
└── python/                  # Python connectors (TODO)
    ├── client.py            # gRPC client
    └── dashboard.py         # Integration with poly dashboard
```

## Configuration

Key environment variables:

```bash
DRY_RUN=true              # ALWAYS start with this!
RISK_MAX_DAILY_LOSS=200   # Stop if daily loss exceeds
CLIPPER_MIN_PROFIT=0.01   # Min profit per share
```

See `.env.example` for full list.

## Safety

- **Defaults to dry run mode** - no real orders until you're ready
- **Risk limits enforced** - position caps, daily loss limits
- **Never risk more than you can afford to lose**

## Documentation

- [RUST_ENGINE.md](RUST_ENGINE.md) - Detailed architecture & latency analysis
- [CLAUDE.md](CLAUDE.md) - Context for AI assistants

## TODO

- [ ] Verify Polymarket redemption mechanics (YES+NO → $1?)
- [ ] Test order signing with real API
- [ ] Add gRPC server for Python dashboard integration
- [ ] Benchmark actual latency improvements

## License

MIT
