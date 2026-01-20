# Pre-Launch Audit Command

Run a comprehensive pre-launch audit for the trading bot.

$ARGUMENTS

## Instructions

This command runs a full audit before launching the trading bot to production.

### What This Audits

1. **Security** - Private keys, API credentials, input validation
2. **Risk Management** - Limits enforcement, kill switches
3. **Code Quality** - Error handling, async correctness
4. **Integrations** - Redis, PostgreSQL, Slack, Polymarket API
5. **Safety Modes** - DRY_RUN, paper trading

### Quick Audit (Single Chat)

For a quick single-chat audit, use this prompt:

```
You are a Pre-Launch Auditor for a Polymarket trading bot.

## Critical Areas

### 1. Security (HIGHEST PRIORITY)
Check:
- engine/src/config.rs - How are credentials loaded?
- engine/src/execution/order_manager.rs - Private key handling?
- Any logging that might expose secrets?

### 2. Risk Management
Check:
- engine/src/risk/manager.rs - Are limits enforced?
- engine/src/strategy/engine.rs - Can limits be bypassed?
- What happens when limits are hit?

### 3. Error Handling
Check:
- Any unwrap() in production code paths?
- Any expect() without proper context?
- What happens on API failures?

### 4. Safety Modes
Verify:
- DRY_RUN mode prevents real orders
- PAPER_TRADING mode simulates correctly

Read the relevant files and produce:
1. Security assessment (Critical/High/Medium/Low issues)
2. Risk assessment
3. Code quality issues
4. Pre-launch checklist

Focus on BLOCKING issues that must be fixed before launch.
```

### Full Orchestrated Audit (Multiple Chats)

For a thorough audit, run the orchestration workflow:

1. **Open a chat for Security Audit**
   - Focus: Private keys, credentials, input validation
   - Files: config.rs, order_manager.rs, ws/handler.rs

2. **Open a chat for Risk Audit**
   - Focus: Limits enforcement, circuit breakers
   - Files: risk/manager.rs, strategy/engine.rs

3. **Open a chat for Code Quality**
   - Focus: Error handling, async correctness
   - Run: cargo clippy, review warnings

4. **Open a chat for Integration Review**
   - Focus: Redis, PostgreSQL, Slack reliability
   - Files: redis/, db/, notifications/

5. **Combine findings into final checklist**

### Existing Audit Documents

This project already has:
- `AUDIT_PROMPT.md` - Previous audit specifications
- `AUDIT_REPORT.md` - Previous audit findings

Review these first to avoid duplicate work.

### Output Expected

```markdown
# Pre-Launch Audit Report

## Summary
| Area | Status | Blocking Issues |
|------|--------|-----------------|
| Security | ✅/⚠️/❌ | [count] |
| Risk Management | ✅/⚠️/❌ | [count] |
| Code Quality | ✅/⚠️/❌ | [count] |
| Integrations | ✅/⚠️/❌ | [count] |
| Safety Modes | ✅/⚠️/❌ | [count] |

## Blocking Issues (Must Fix)
1. [Issue + File + Fix]

## High Priority (Should Fix)
1. [Issue + File + Fix]

## Pre-Launch Checklist
- [ ] All blocking issues resolved
- [ ] DRY_RUN tested
- [ ] Paper trading tested (1hr minimum)
- [ ] Risk limits tested
- [ ] Slack notifications working
- [ ] Health endpoint responding
- [ ] Metrics endpoint responding
- [ ] Database connected
- [ ] Redis connected

## Recommendation
[READY TO LAUNCH | FIX ISSUES FIRST]
```

### After Audit

Once audit passes:
1. Run with `DRY_RUN=true` for 24 hours
2. Run with paper trading for 24 hours
3. Start with minimal position sizes
4. Gradually increase limits
