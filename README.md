# Poly Trading System

High-performance trading system for Polymarket prediction markets.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Dashboard (React)    │
                    │   Vercel CDN           │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   API (FastAPI)        │
                    │   Vercel Serverless    │
                    └───────────┬───────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
┌─────────▼─────────┐ ┌─────────▼─────────┐ ┌────────▼────────┐
│      Redis        │ │    PostgreSQL     │ │  Trading Engine │
│   (Pub/Sub)       │ │  (Trade History)  │ │     (Rust)      │
└───────────────────┘ └───────────────────┘ └─────────────────┘
```

## Directory Structure

```
├── engine/          # Rust trading engine (Sevalla)
├── dashboard/       # React + TypeScript frontend (Vercel)
├── api/             # Python FastAPI backend (Vercel)
└── docker-compose.yml
```

## Trading Strategies

### SumTo100 (Depth-Aware Arbitrage)
Uses full order book depth for VWAP-based pricing. Buys YES + NO tokens when sum < $1.00.

### Clipper (Top-of-Book Arbitrage)
Simpler version using only best bid/ask prices.

### Sniper (Sports Time Arbitrage)
Uses ESPN data to buy winning outcomes before Polymarket prices update.

## Quick Start

### Prerequisites
- Rust 1.75+
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose

### Local Development

1. **Start infrastructure:**
   ```bash
   docker-compose up -d redis postgres
   ```

2. **Run the trading engine:**
   ```bash
   cd engine
   cp .env.example .env
   cargo run
   ```

3. **Run the API:**
   ```bash
   cd api
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

4. **Run the dashboard:**
   ```bash
   cd dashboard
   npm install
   npm run dev
   ```

## Deployment

| Service | Platform | Deploy Method |
|---------|----------|---------------|
| Engine | Sevalla | `git push` |
| Dashboard | Vercel | `git push` |
| API | Vercel | `git push` |

## Environment Variables

See `.env.example` files in each directory:
- `engine/.env.example` - Trading engine config
- `dashboard/.env.example` - Frontend config
- `api/.env.example` - Backend config (if exists)

## Safety

Trading involves risk of loss. Always start with:
- `DRY_RUN=true`
- `SUMTO100_PAPER_TRADING=true`

## License

Private - All rights reserved.
