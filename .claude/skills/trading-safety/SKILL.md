---
name: trading-safety
description: Verify trading safety before any execution changes. Use when modifying order execution, risk management, position handling, or anything touching real money.
allowed-tools: Read, Grep, Glob, Bash
---

# Trading Safety Skill

## When to Use This

**MANDATORY** for any changes to:
- Order execution (`src/execution/`)
- Risk management (`src/risk/`)
- Strategy engine (`src/strategy/engine.rs`)
- Position handling
- API credential usage
- WebSocket order flow

## Safety Checklist

Before approving ANY changes to trading code:

### 1. Safety Modes Still Work
- [ ] `DRY_RUN=true` path still functions
- [ ] `SUMTO100_PAPER_TRADING=true` path still functions
- [ ] Paper trader simulation matches real execution path

### 2. Risk Limits Cannot Be Bypassed
- [ ] Max position size enforced
- [ ] Max notional value enforced
- [ ] Max daily loss enforced
- [ ] No code path skips risk checks

### 3. Error Handling is Robust
- [ ] No `unwrap()` on Results in execution path
- [ ] No `expect()` without graceful fallback
- [ ] Errors are logged and handled
- [ ] Partial failures don't leave orphaned orders

### 4. No Secrets Exposed
- [ ] Private keys never logged
- [ ] API credentials never in error messages
- [ ] No sensitive data in Slack notifications
- [ ] Debug output doesn't include secrets

### 5. Concurrent Safety
- [ ] No race conditions in order execution
- [ ] Position updates are atomic
- [ ] Risk calculations use consistent state

## Red Flags - STOP AND REVIEW

🚨 **Immediate review required** if you see:

```rust
// RED FLAG: Unwrap in execution path
order_result.unwrap()

// RED FLAG: Bypassing risk check
if skip_risk_check { ... }

// RED FLAG: Logging secrets
tracing::info!("Key: {}", private_key);

// RED FLAG: Removing safety mode check
// was: if config.dry_run { return; }
// now: (removed)
```

## Pre-Commit Verification

Run these before any execution changes:

```bash
# 1. No unwrap in execution path
grep -r "unwrap()" engine/src/execution/ | grep -v test

# 2. No expect in execution path
grep -r "expect(" engine/src/execution/ | grep -v test

# 3. Risk manager is always called
grep -r "risk_manager" engine/src/strategy/engine.rs

# 4. Clippy is clean
cargo clippy --all-targets -- -D warnings
```

## Testing Requirements

Before merging execution changes:

1. **Unit tests pass**: `cargo test`
2. **Paper trade test**: Run with `SUMTO100_PAPER_TRADING=true` for 1 hour
3. **DRY_RUN test**: Run with `DRY_RUN=true`, verify no real orders
4. **Risk limit test**: Manually trigger each risk limit, verify behavior

## Common Mistakes

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Removing DRY_RUN check | Real orders in test | Always grep for safety checks |
| `unwrap()` on API response | Panic = position orphaned | Use `?` or match |
| Logging full order | Leaks API signature | Log order ID only |
| Async race in position update | Wrong position size | Use atomic operations |
| Skipping risk check "temporarily" | Unlimited loss | Never skip, even for testing |

## Emergency Procedures

If something goes wrong in production:

1. **Kill switch**: Set `DRY_RUN=true` in environment
2. **Stop container**: `docker stop poly_rust_engine`
3. **Check positions**: Log into Polymarket, verify state
4. **Review logs**: Check for what triggered the issue
5. **Don't restart** until root cause is understood
