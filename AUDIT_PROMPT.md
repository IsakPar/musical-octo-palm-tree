# Poly-Rust Trading Engine: Production Readiness Audit

## Agent Directive

You are a **Production Readiness Auditor** for a high-frequency trading engine. Your mission is to audit the `poly_rust` repository and produce a comprehensive readiness report with actionable remediation steps.

**CRITICAL CONTEXT:**
- This is a **Rust trading bot** for Polymarket prediction markets
- Currently in **mock trading mode** - NOT live trading yet
- The #1 priority is **ASYNC PERFORMANCE** - nothing can block the hot path
- Target: sub-10ms order execution latency
- The bot exploits arbitrage opportunities that last only 50-100ms

---

## Required Skills (MUST USE)

You **MUST** invoke and apply the following skills during this audit. Reference them explicitly in your findings:

### Core Skills
1. **`code-auditor`** - Security vulnerabilities, OWASP issues, secrets scanning
2. **`performance-optimizer`** - Async bottlenecks, blocking code, latency analysis
3. **`rust-patterns`** - Idiomatic Rust, ownership issues, error handling
4. **`testing-expert`** - Test coverage, edge cases, mocking strategies

### Infrastructure Skills
5. **`docker`** - Containerization readiness, multi-stage builds
6. **`monitoring`** - Observability, metrics, health checks, alerting
7. **`websockets`** - Connection management, reconnection, heartbeats

### Domain Skills
8. **`trading-bots`** - Risk management, exchange integration, backtesting

---

## Audit Phases

### PHASE 1: Compilation & Build Validation
```bash
# Commands to run:
cargo build --release 2>&1
cargo test 2>&1
cargo clippy -- -D warnings 2>&1
cargo fmt --check 2>&1
```

**Deliverable:** Build status, compiler warnings, clippy lints

---

### PHASE 2: Async Performance Audit (HIGHEST PRIORITY)

**Blocking code is FATAL in a trading bot.** Search exhaustively for:

```rust
// BLOCKING PATTERNS TO FIND:
std::thread::sleep()           // BLOCKS async runtime
.blocking_lock()               // Can deadlock
std::sync::Mutex               // Use tokio::sync::Mutex instead
.unwrap() in async context     // Can panic and kill tasks
reqwest::blocking::           // NEVER in async code
std::fs::*                     // Use tokio::fs::* instead
```

**Performance Checklist:**
- [ ] All I/O operations are async (tokio)
- [ ] No `std::sync::Mutex` on async paths
- [ ] ECDSA signing uses `spawn_blocking`
- [ ] HTTP client has aggressive timeouts (500ms max)
- [ ] WebSocket reconnection is non-blocking
- [ ] Order book updates are lock-free (DashMap)
- [ ] Strategy evaluation doesn't block market data

**Measure:**
- Hot path from WebSocket message → Order submission
- Any `.await` chains longer than 5 hops
- Lock contention points

---

### PHASE 3: Security Audit

Apply **`code-auditor`** skill. Focus on:

#### 3.1 Secrets Management
```bash
# Scan for hardcoded secrets:
grep -rn "POLY_PRIVATE_KEY\|API_KEY\|SECRET" --include="*.rs" .
grep -rn "0x[a-fA-F0-9]{64}" --include="*.rs" .  # Ethereum private keys
```

- [ ] Private keys loaded from env only
- [ ] No secrets in git history
- [ ] `.env` is in `.gitignore`

#### 3.2 Input Validation
- [ ] WebSocket messages are validated
- [ ] Order parameters are bounds-checked
- [ ] No integer overflow in price calculations

#### 3.3 Financial Safety
- [ ] Risk manager has hard limits
- [ ] Daily loss limits enforced
- [ ] Position limits enforced
- [ ] Paper trading mode is default

---

### PHASE 4: Error Handling & Resilience

Apply **`rust-patterns`** skill:

```rust
// BAD PATTERNS TO FIND:
.unwrap()           // Should use ? or proper handling
.expect("msg")      // Only OK in infallible contexts
panic!()            // Never in production trading code
```

**Checklist:**
- [ ] All `unwrap()` calls are justified or replaced
- [ ] WebSocket disconnects are handled gracefully
- [ ] Order failures don't crash the engine
- [ ] Network timeouts are handled
- [ ] Circuit breakers exist for external services

---

### PHASE 5: Test Coverage Analysis

Apply **`testing-expert`** skill:

```bash
# Run with coverage:
cargo tarpaulin --out Html 2>&1
```

**Test Requirements:**
- [ ] Unit tests for each strategy
- [ ] Unit tests for risk manager
- [ ] Unit tests for order book VWAP calculations
- [ ] Integration test for WebSocket handler
- [ ] Paper trader validation tests
- [ ] Edge cases: empty order book, stale data, max positions

**Missing Tests to Flag:**
- Order execution path
- Risk limit enforcement
- WebSocket reconnection
- Strategy signal generation

---

### PHASE 6: Infrastructure Readiness

Apply **`docker`** skill:

**Files Required:**
- [ ] `Dockerfile` (multi-stage, non-root user)
- [ ] `docker-compose.yml` (local dev with Redis, Postgres)
- [ ] `.dockerignore`

**Container Checklist:**
- [ ] Image size < 100MB (use `FROM scratch` or `alpine`)
- [ ] Non-root user
- [ ] Health check endpoint
- [ ] Graceful shutdown handling

---

### PHASE 7: Observability

Apply **`monitoring`** skill:

**Required Endpoints:**
- [ ] `/health` - Liveness probe
- [ ] `/ready` - Readiness probe (WS connected, etc.)
- [ ] `/metrics` - Prometheus metrics

**Required Metrics:**
- `trading_orders_total` (counter, labels: side, status)
- `trading_latency_ms` (histogram, labels: operation)
- `trading_pnl_dollars` (gauge)
- `websocket_messages_total` (counter)
- `websocket_reconnects_total` (counter)

**Required Alerts:**
- WebSocket disconnected > 30s
- Order execution latency > 100ms
- Daily loss limit > 80%
- Error rate > 1%

---

### PHASE 8: Risk Management Audit

Apply **`trading-bots`** skill:

**Risk Controls:**
- [ ] Max position per market
- [ ] Max total exposure
- [ ] Daily loss limit (hard stop)
- [ ] Order size limits
- [ ] Stale data rejection (order book age)
- [ ] Emergency stop functionality

**Paper Trading Validation:**
- [ ] Realistic slippage simulation
- [ ] Fee calculation accurate
- [ ] Fill simulation uses order book depth
- [ ] P&L tracking is accurate

---

## Readiness Score Framework

For each service/module, assign a score from 0-100:

| Score | Status | Meaning |
|-------|--------|---------|
| 0-25  | **RED** | Critical blockers, not deployable |
| 26-50 | **ORANGE** | Major issues, needs significant work |
| 51-75 | **YELLOW** | Functional but missing production features |
| 76-90 | **GREEN** | Production-ready with minor improvements |
| 91-100| **BLUE** | Excellent, battle-tested |

### Scoring Criteria per Module:

**WebSocket Handler (`ws/handler.rs`):**
- Compilation: 10 pts
- Reconnection logic: 15 pts
- Heartbeat/ping-pong: 10 pts
- Error handling: 15 pts
- Non-blocking: 20 pts
- Tests: 15 pts
- Metrics: 15 pts

**Strategy Engine (`strategy/engine.rs`):**
- Compilation: 10 pts
- Async correctness: 20 pts
- Signal generation: 15 pts
- Error handling: 15 pts
- Tests: 20 pts
- Performance: 20 pts

**Order Manager (`execution/order_manager.rs`):**
- Compilation: 10 pts
- EIP-712 signing: 15 pts
- Timeout handling: 15 pts
- Error recovery: 20 pts
- Tests: 20 pts
- Dry-run mode: 10 pts
- Metrics: 10 pts

**Risk Manager (`risk/manager.rs`):**
- Compilation: 10 pts
- Position limits: 20 pts
- Daily loss limits: 20 pts
- Lock-free P&L: 15 pts
- Tests: 20 pts
- Emergency stop: 15 pts

**Paper Trader (`execution/paper.rs`):**
- Compilation: 10 pts
- Realistic fills: 25 pts
- P&L accuracy: 25 pts
- Tests: 25 pts
- Reporting: 15 pts

**Market Data (`market/data.rs`):**
- Compilation: 10 pts
- Lock-free structures: 25 pts
- VWAP accuracy: 20 pts
- Freshness tracking: 15 pts
- Tests: 20 pts
- Memory efficiency: 10 pts

---

## Output Format

Produce a report with this EXACT structure:

```markdown
# Poly-Rust Production Readiness Audit Report

**Audit Date:** YYYY-MM-DD
**Auditor:** Claude (using skills: code-auditor, performance-optimizer, rust-patterns, testing-expert, docker, monitoring, websockets, trading-bots)
**Repository:** /Users/isaks_macbook/Desktop/Dev/poly_rust

---

## Executive Summary

**Overall Readiness Score: XX/100**
**Status: [RED|ORANGE|YELLOW|GREEN|BLUE]**
**Recommendation:** [BLOCK|FIX THEN DEPLOY|DEPLOY WITH MONITORING|READY]

[2-3 sentence summary of critical findings]

---

## Module Readiness Scores

| Module | Score | Status | Blockers |
|--------|-------|--------|----------|
| WebSocket Handler | XX/100 | COLOR | Brief issue |
| Strategy Engine | XX/100 | COLOR | Brief issue |
| Order Manager | XX/100 | COLOR | Brief issue |
| Risk Manager | XX/100 | COLOR | Brief issue |
| Paper Trader | XX/100 | COLOR | Brief issue |
| Market Data | XX/100 | COLOR | Brief issue |
| **Overall** | **XX/100** | **COLOR** | |

---

## Critical Blockers (Must Fix Before Mock Trading)

### BLOCKER-1: [Title]
**Severity:** CRITICAL
**Location:** `file:line`
**Skill Applied:** [code-auditor|performance-optimizer|etc]
**Issue:** [Description]
**Impact:** [What happens if not fixed]
**Fix:**
```rust
// Before (bad)
...
// After (good)
...
```

[Repeat for each blocker]

---

## High Priority Issues (Fix Within 1 Week)

### HIGH-1: [Title]
...

---

## Medium Priority Issues (Fix Within 1 Month)

### MED-1: [Title]
...

---

## Low Priority / Improvements

### LOW-1: [Title]
...

---

## Async Performance Analysis

### Hot Path Audit
[Diagram or description of the hot path]

### Blocking Code Found
| Location | Issue | Severity | Fix |
|----------|-------|----------|-----|
| file:line | Description | HIGH | Suggested fix |

### Latency Estimates
| Operation | Current | Target | Status |
|-----------|---------|--------|--------|
| WS → Strategy | Xms | <5ms | OK/FAIL |
| Strategy → Order | Xms | <5ms | OK/FAIL |
| Order → Confirm | Xms | <500ms | OK/FAIL |

---

## Test Coverage Report

**Current Coverage:** X%
**Target Coverage:** 80%

### Missing Tests
| Module | Missing Test | Priority |
|--------|--------------|----------|
| strategy/sum_to_100.rs | Edge case: empty book | HIGH |

---

## Security Findings

### Secrets Scan
- [ ] No hardcoded secrets found
- [ ] Private keys in env only
- [ ] `.env` in `.gitignore`

### Vulnerabilities
[List any CVEs from cargo audit]

---

## Infrastructure Gaps

| Requirement | Status | Notes |
|-------------|--------|-------|
| Dockerfile | MISSING/EXISTS | |
| docker-compose.yml | MISSING/EXISTS | |
| Health endpoint | MISSING/EXISTS | |
| Metrics endpoint | MISSING/EXISTS | |
| Prometheus config | MISSING/EXISTS | |
| Alerting rules | MISSING/EXISTS | |

---

## Remediation Roadmap

### Week 1: Critical Fixes
1. [Specific task]
2. [Specific task]

### Week 2-3: High Priority
1. [Specific task]

### Week 4+: Hardening
1. [Specific task]

---

## Files Reviewed

- [ ] src/main.rs
- [ ] src/config.rs
- [ ] src/ws/handler.rs
- [ ] src/market/data.rs
- [ ] src/strategy/engine.rs
- [ ] src/strategy/sum_to_100.rs
- [ ] src/strategy/clipper.rs
- [ ] src/strategy/sniper.rs
- [ ] src/execution/order_manager.rs
- [ ] src/execution/paper.rs
- [ ] src/risk/manager.rs
- [ ] Cargo.toml
- [ ] .env.example

---

## Appendix: Commands Run

```bash
cargo build --release
cargo test
cargo clippy
cargo audit
# etc.
```
```

---

## Agent Execution Instructions

1. **START** by running `cargo build --release` and `cargo test`
2. **READ** all source files listed in "Files Reviewed"
3. **GREP** for blocking patterns, secrets, unwrap()
4. **SCORE** each module using the criteria above
5. **WRITE** the full report to `AUDIT_REPORT.md`
6. **SUMMARIZE** the top 3 actions needed

**DO NOT:**
- Skip any module
- Give generous scores without evidence
- Ignore async/blocking issues (they are FATAL)
- Forget to check for `unwrap()` calls

**REMEMBER:**
- Mock trading means we can afford some gaps
- Async performance is NON-NEGOTIABLE
- Every blocking call in the hot path is a potential missed trade
- The bot competes against other bots - speed is everything
