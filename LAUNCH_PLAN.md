# Polymarket Trading System - Launch Plan

## Current State Summary

| Component | Completion | Blockers |
|-----------|------------|----------|
| **Python Dashboard** | 80% | Auth not production-ready, CORS hardcoded |
| **React Frontend** | 75% | Works, needs backend fixes |
| **Rust Engine** | 50% | Not compiled/tested, no persistence |
| **Rust-Python Integration** | 0% | HTTP polling only (defeats Rust speed) |
| **Cloud Infrastructure** | 5% | No Docker, no CI/CD, no persistence |

**Total System: ~65% complete**

---

## Critical Path to 1-Month Cloud Test

### Phase 1: Rust Engine Validation (Day 1-3)
**Goal:** Verify the Rust engine actually works

1. Install Rust toolchain
2. Run `cargo build --release`
3. Fix any compilation errors
4. Run `cargo test`
5. Connect to real Polymarket WebSocket (dry-run mode)
6. Validate order book data is flowing

**Deliverable:** Working Rust binary that connects to Polymarket

---

### Phase 2: Dashboard Auth & Security (Day 4-6)
**Goal:** Production-ready authentication

**Files to modify:**
- `../poly/backend/auth.py`
- `../poly/backend/main.py`

**Changes:**
1. Replace in-memory OTP with Redis
2. Use proper JWT signing (python-jose)
3. Add rate limiting middleware
4. Make CORS configurable via env var
5. Add request validation

---

### Phase 3: Containerization (Day 7-10)
**Goal:** Docker images for both services

**Create:**
1. `Dockerfile` - Multi-stage Rust build
2. Update `../poly/Dockerfile.fullstack` - Add Redis dependency
3. `docker-compose.yml` - Full stack (Rust + Python + Redis + Postgres)

---

### Phase 4: Database Persistence (Day 11-14)
**Goal:** Don't lose data on restart

**Rust changes needed:**
- Add PostgreSQL client (sqlx)
- Persist trade history
- Persist position snapshots
- Add crash recovery

**Python already has:** PostgreSQL support (asyncpg)

---

### Phase 5: Rust-Python Integration via Redis (Day 15-18)
**Goal:** Real-time communication between services

**CHOSEN: Redis Pub/Sub**

**Architecture:**
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

**Channels to implement:**
- `poly:state` - Engine state updates (every 100ms)
- `poly:signals` - Trade signals as they happen
- `poly:trades` - Executed trades
- `poly:errors` - Error notifications

---

### Phase 6: Cloud Deployment (Day 19-23)
**Goal:** Running in the cloud

**Platform:** Railway.app
- Already has Railway config for Python dashboard
- Easy Postgres + Redis add-ons
- Simple Docker deployment

**Final Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                      RAILWAY                             │
│                                                          │
│  ┌──────────────┐     ┌──────────────┐                  │
│  │ Rust Engine  │────▶│    Redis     │◀────┐            │
│  │ (Publisher)  │     │  (Pub/Sub)   │     │            │
│  │ - SumTo100   │     └──────────────┘     │            │
│  │ - Clipper    │            │             │            │
│  │ - Sniper     │     ┌──────▼───────┐     │            │
│  └──────────────┘     │   Python     │─────┘            │
│         │             │  Dashboard   │                  │
│         │             │ (Subscriber) │                  │
│         │             └──────────────┘                  │
│         │                    │                          │
│         └────────────────────┼──────────────────────────┤
│                              ▼                          │
│                       ┌──────────────┐                  │
│                       │  PostgreSQL  │                  │
│                       │ (Trade DB)   │                  │
│                       └──────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

---

### Phase 7: Monitoring & Safety (Day 24-27)
**Goal:** Know what's happening

**Add:**
1. Health check endpoints (`/health`)
2. Prometheus metrics export
3. Alerting on errors (Slack webhook)
4. Daily P&L reports
5. Circuit breaker for API failures

---

### Phase 8: Paper Trading Validation (Day 28-30)
**Goal:** Validate strategies work

**Run with:**
```bash
DRY_RUN=true
SUMTO100_PAPER_TRADING=true
RISK_MAX_POSITION=10
RISK_MAX_DAILY_LOSS=50
```

**Monitor for 48-72 hours before enabling real trading**

---

## Files to Create

| File | Purpose |
|------|---------|
| `Dockerfile` | Rust engine container |
| `src/redis/mod.rs` | Redis publisher |
| `src/db/mod.rs` | Database persistence |
| `docker-compose.yml` | Local development stack |
| `.github/workflows/deploy.yml` | CI/CD pipeline |

---

## Files to Modify

| File | Changes |
|------|---------|
| `../poly/backend/auth.py` | Redis OTP, proper JWT |
| `../poly/backend/main.py` | CORS env var, rate limiting |
| `Cargo.toml` | Add redis, sqlx crates |
| `src/main.rs` | Add Redis publisher, DB init |

---

## Estimated Timeline

| Phase | Days | Effort |
|-------|------|--------|
| Rust Validation | 3 | 8 hrs |
| Dashboard Auth | 3 | 10 hrs |
| Containerization | 4 | 12 hrs |
| Database | 4 | 16 hrs |
| Redis Integration | 4 | 12 hrs |
| Cloud Deploy | 5 | 15 hrs |
| Monitoring | 4 | 12 hrs |
| Paper Trading | 3 | 8 hrs |
| **TOTAL** | **30 days** | **~93 hrs** |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Rust doesn't compile | Budget 1 day for fixes |
| Auth vulnerability | Never deploy without Redis+JWT |
| Data loss | Always have Postgres before real money |
| API rate limits | Implement backoff early |
| Network issues | Add circuit breaker |

---

## Success Criteria for 1-Month Test

- [ ] Rust engine running 24/7 in cloud
- [ ] Dashboard accessible via HTTPS
- [ ] Authentication working securely
- [ ] Trade history persisted to database
- [ ] Paper trading profitable for 1 week
- [ ] Alerting on errors via Slack
- [ ] Daily P&L reports
- [ ] No data loss on restart

---

## Quick Commands

```bash
# Build Rust engine
cargo build --release

# Run tests
cargo test

# Run with paper trading
DRY_RUN=true SUMTO100_PAPER_TRADING=true cargo run

# Build Docker image
docker build -t poly-rust .

# Run full stack locally
docker-compose up
```
