# Developer Handover Document
**Project:** Polymarket Trading Bot System  
**Date:** January 21, 2026  
**Status:** Deployed but showing mock data - needs integration work

---

## 🎯 Project Overview

This is a multi-bot trading system for Polymarket with:
- **Rust trading engine** (high-performance, multiple strategies)
- **Python FastAPI backend** (WebSocket server, dashboard API)
- **React dashboard** (real-time monitoring UI)

### Live URLs
- **Dashboard:** https://special-lamp-51hz.vercel.app
- **API:** https://special-lamp-phi.vercel.app
- **Rust Engine:** Deployed on Railway (internal URL)
- **GitHub:** https://github.com/IsakPar/special-lamp

---

## 🏗️ Architecture

```
┌─────────────────┐
│  React Dashboard│  (Vercel)
│  Port: N/A      │  - Real-time UI
└────────┬────────┘  - WebSocket client
         │
         │ WSS + HTTPS
         ▼
┌─────────────────┐
│  Python API     │  (Vercel)
│  Port: N/A      │  - FastAPI server
└────────┬────────┘  - WebSocket hub
         │           - Auth (OTP via Slack)
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
┌────────┐  ┌──────────┐
│ Redis  │  │ Postgres │  (Railway)
└────────┘  └──────────┘
    ▲
    │ Pub/Sub
    │
┌────────────────┐
│  Rust Engine   │  (Railway)
│  Port: 8080    │  - Trading strategies
└────────────────┘  - Market data WebSocket
                    - Redis publisher
```

---

## 🚨 CRITICAL ISSUE: Mock Data Problem

**The dashboard is showing 100% FAKE DATA!**

### What You'll See:
- Total P&L: $2,450.32 ❌ HARDCODED
- Win Rate: 78% ❌ HARDCODED
- Order book depth ❌ HARDCODED
- Recent opportunities ❌ HARDCODED or empty

### Root Cause:
1. **Rust engine** only exposes `/health` and `/metrics` endpoints
2. **Python API** tries to call non-existent endpoints like:
   - `GET /state`
   - `GET /positions`
   - `GET /strategy/{name}/stats`
   - `GET /strategy/{name}/opportunities`
3. When these calls fail, Python API returns hardcoded fallback data (see `api/main.py` lines 743-751, 786-800)

### The Mock Data Locations:
```python
# api/main.py:743-751
return {
    "todayPnl": 85.30,      # FAKE
    "totalPnl": 2450.32,    # FAKE
    "trades": 23,           # FAKE
    "winRate": 78.0,        # FAKE
    # ... etc
}
```

---

## 📦 Current Deployment State

### ✅ What's Working:
- Dashboard deploys successfully
- API deploys successfully
- Rust engine runs on Railway
- Authentication (Slack OTP) works
- WebSocket connections establish
- Redis is connected
- PostgreSQL is connected
- Health checks pass

### ❌ What's Broken:
- No real trading data displayed
- Rust engine has no REST API endpoints
- Python API can't fetch Rust engine state
- Dashboard shows mock data as fallback

### ⚠️ What's Unwanted:
- **3 Python bots** in `api/bots/`:
  - `gabagool.py` - Should be removed
  - `clipper.py` - Should be removed  
  - `sniper.py` - Should be removed
- These start automatically in `api/main.py` lifespan

---

## 🔧 Environment Variables

### API (Vercel - special-lamp-phi)
```bash
SECRET_KEY=<64-char-hex>              # JWT signing
ALLOWED_EMAIL=<user-email>            # Auth whitelist
DATABASE_URL=postgresql://...         # Railway Postgres (PUBLIC URL)
REDIS_URL=redis://default:...         # Railway Redis (PUBLIC URL)
SYNTH_ARB_URL=https://...railway.app  # Rust engine (PUBLIC URL)
ALLOWED_ORIGINS=https://special-lamp-51hz.vercel.app
SLACK_WEBHOOK_URL=https://hooks.slack.com/...  # OTP delivery
```

### Dashboard (Vercel - special-lamp-51hz)
```bash
VITE_API_URL=https://special-lamp-phi.vercel.app
VITE_WS_URL=wss://special-lamp-phi.vercel.app/ws
```

### Rust Engine (Railway)
```bash
# Not fully documented yet - check Railway dashboard
REDIS_URL=redis://...  # Internal Railway Redis
DATABASE_URL=postgresql://...  # Internal Railway Postgres
DRY_RUN=true  # Likely set to true for safety
# ... plus strategy configs (SUMTO100_*, CLIPPER_*, etc)
```

---

## 📂 Repository Structure

```
poly_rust/
├── api/                  # Python FastAPI backend
│   ├── main.py          # Main server (has MOCK DATA!)
│   ├── auth.py          # Slack OTP authentication
│   ├── bots/            # ⚠️ TO BE REMOVED
│   │   ├── gabagool.py  # Unwanted Python bot
│   │   ├── clipper.py   # Unwanted Python bot
│   │   └── sniper.py    # Unwanted Python bot
│   ├── services/
│   │   └── database/    # PostgreSQL integration
│   ├── requirements.txt
│   └── vercel.json
│
├── dashboard/           # React + Vite frontend
│   ├── src/
│   │   ├── pages/       # Dashboard pages
│   │   └── components/  # Reusable components
│   ├── package.json
│   └── vercel.json
│
├── engine/              # Rust trading engine
│   ├── src/
│   │   ├── main.rs      # Entry point (only /health endpoint!)
│   │   ├── config.rs    # Strategy configuration
│   │   ├── strategy/    # Trading strategies
│   │   │   ├── sumto100.rs
│   │   │   ├── clipper.rs
│   │   │   └── sniper.rs
│   │   ├── redis/       # Redis publisher
│   │   ├── db/          # PostgreSQL repository
│   │   └── ...
│   ├── Cargo.toml
│   └── Dockerfile       # Railway deployment
│
└── VERCEL_ENV_SETUP.md  # Deployment guide (already created)
```

---

## 🛠️ What Needs To Be Done

### Priority 1: Fix the Mock Data Issue

**Option A: Add REST API to Rust Engine** (Recommended)
1. Add HTTP REST endpoints to `engine/src/main.rs`:
   - `GET /state` → Current engine state
   - `GET /positions` → Open positions
   - `GET /metrics` → Risk metrics
   - `GET /strategy/{name}/stats` → Strategy stats
   - `GET /strategy/{name}/opportunities` → Recent opportunities
2. Use `axum` or `warp` web framework
3. Query internal state from `StrategyEngine`
4. Update Python API to call real endpoints
5. Remove all mock data fallbacks

**Option B: Simplify to Redis-Only**
1. Dashboard connects directly to Redis (via proxy)
2. Remove REST API calls from Python API
3. Stream all data via Redis pub/sub
4. Simpler but less flexible for complex queries

### Priority 2: Remove Python Bots
1. Delete `api/bots/gabagool.py`
2. Delete `api/bots/clipper.py`
3. Delete `api/bots/sniper.py`
4. Remove bot initialization from `api/main.py` lifespan
5. Remove bot endpoints (`/api/gabagool`, `/api/clipper`, `/api/sniper`)
6. Clean up `api/requirements.txt` if dependencies are no longer needed

### Priority 3: Update Dashboard
1. Remove/disable Python bot UI components
2. Focus UI on Rust engine strategies only
3. Add error handling for when Rust engine is unreachable
4. Show "waiting for data" instead of mock data

### Priority 4: Documentation
1. Document Rust engine API endpoints (once added)
2. Update README with accurate architecture
3. Document Redis channel structure
4. Add testing instructions

---

## 🧪 How to Test Locally

### 1. Run Rust Engine
```bash
cd engine
# Set up .env with Railway database URLs (or use local Redis/Postgres)
cargo run
# Should see: "TRADING ENGINE STARTED" on port 8080
```

### 2. Run Python API
```bash
cd api
pip install -r requirements.txt
# Set up .env (can point to Railway or local services)
python -m uvicorn main:app --reload --port 8000
# Should see: "POLY TRADING BOTS - BACKEND SERVER"
```

### 3. Run Dashboard
```bash
cd dashboard
npm install
npm run dev
# Opens on http://localhost:5173
```

### 4. Verify Data Flow
- Check if Rust engine shows market data in logs
- Check if Redis is receiving published messages
- Check if Python API receives WebSocket connections
- Check if Dashboard shows real data (not mock)

---

## 🔍 Key Files to Review

1. **api/main.py** (lines 743-751, 786-800) - Remove mock data
2. **engine/src/main.rs** - Add REST API endpoints here
3. **engine/src/strategy/engine.rs** - State that needs to be exposed via REST
4. **dashboard/src/pages/StrategyDetailPage.tsx** - Where mock data is consumed

---

## 📞 Questions for Product Owner

1. **Data source priority:**
   - Should dashboard get data via REST API or Redis pub/sub?
   - Is historical data important (needs REST) or only real-time (Redis is fine)?

2. **Python bots:**
   - Confirm these should be deleted?
   - Any functionality worth porting to Rust?

3. **Trading mode:**
   - Is the Rust engine in DRY_RUN mode?
   - Should it be? (Given mock data concerns)

4. **Monitoring:**
   - Do we need dashboards for each strategy separately?
   - What metrics are most critical?

---

## 🎓 Learning Resources

- **Rust Axum (for adding REST API):** https://docs.rs/axum
- **FastAPI WebSockets:** https://fastapi.tiangolo.com/advanced/websockets/
- **Redis Pub/Sub:** https://redis.io/docs/manual/pubsub/
- **Vercel Deployment:** Already documented in `VERCEL_ENV_SETUP.md`

---

## ⚡ Quick Wins

If you just want to see SOME real data quickly:

1. **Check Railway logs** - Rust engine prints trade signals
2. **Monitor Redis** - Use `redis-cli MONITOR` to see published messages
3. **Add basic `/state` endpoint** to Rust engine that returns a JSON blob
4. **Update one dashboard page** to fetch from the new endpoint

---

## 🐛 Known Issues

1. **Mock data everywhere** (see above)
2. **Python bots auto-starting** but not needed
3. **No error handling** when Rust engine is down
4. **CORS needs updating** after each dashboard redeploy
5. **Railway URLs are internal** - need PUBLIC URLs in env vars
6. **No database migrations** - schema might drift between environments

---

## 📝 Notes

- Original developer set up infrastructure well (Railway, Vercel, Redis, Postgres all working)
- Authentication via Slack OTP is clever but unusual
- Rust engine looks solid, just needs HTTP API layer
- Dashboard UI is well-designed, just needs real data
- Tests are minimal/missing - consider adding

---

**Good luck! The foundation is solid, just needs the integration layer. Start with adding a simple /state endpoint to the Rust engine and work from there.** 🚀
