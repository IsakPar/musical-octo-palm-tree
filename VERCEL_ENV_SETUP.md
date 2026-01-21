# Vercel Environment Variables Setup Guide

This guide explains what environment variables you need to configure in Vercel for both your **API** and **Dashboard** deployments.

## 📋 Prerequisites

You mentioned you've already set up on Railway:
- ✅ Rust trading engine (running on Railway)
- ✅ PostgreSQL database (Railway)
- ✅ Redis instance (Railway)

## 🔧 API Environment Variables

Deploy the `api/` directory to Vercel. Configure these environment variables in your Vercel project settings:

### Required Variables

```bash
# Authentication
SECRET_KEY=your-long-random-secret-key-change-this-in-production
ALLOWED_EMAIL=your@email.com

# Redis (Use your Railway Redis URL)
REDIS_URL=redis://default:your-password@your-railway-redis.railway.app:6379

# PostgreSQL (Use your Railway Postgres URL)
DATABASE_URL=postgresql://user:password@your-railway-postgres.railway.app:5432/railway

# Rust Engine URL (Your Railway deployment)
SYNTH_ARB_URL=https://your-rust-engine.up.railway.app

# CORS - Add your dashboard URL after deployment
ALLOWED_ORIGINS=https://your-dashboard.vercel.app,http://localhost:5173
```

### Optional Variables (Slack Notifications)

```bash
# Slack notifications (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### How to get Railway URLs:

1. **Redis URL**: Go to your Redis service in Railway → Variables tab → Find `REDIS_URL` or construct it:
   ```
   redis://default:<password>@<host>.railway.app:<port>
   ```

2. **PostgreSQL URL**: Go to your Postgres service → Variables tab → Find `DATABASE_URL`:
   ```
   postgresql://<user>:<password>@<host>.railway.app:5432/railway
   ```

3. **Rust Engine URL**: Go to your Rust engine service → Settings → Copy the public domain:
   ```
   https://your-service.up.railway.app
   ```

---

## 🎨 Dashboard Environment Variables

Deploy the `dashboard/` directory to Vercel. Configure these environment variables:

### Required Variables

```bash
# Backend API URL (Your Vercel API deployment)
VITE_API_URL=https://your-api.vercel.app

# WebSocket URL (Same as API URL but with wss://)
VITE_WS_URL=wss://your-api.vercel.app/ws
```

### After API Deployment:

1. Deploy your `api/` directory to Vercel first
2. Copy the Vercel URL (e.g., `https://poly-api.vercel.app`)
3. Use that URL for `VITE_API_URL`
4. Change `https://` to `wss://` for `VITE_WS_URL` and append `/ws`

---

## 📝 Step-by-Step Deployment

### 1. Deploy the API First

```bash
cd api/
vercel
```

When prompted:
- Link to existing project or create new one
- Set Root Directory to `api/`
- Override build command: (leave empty or use `pip install -r requirements.txt`)
- Override output directory: (leave empty)

Add environment variables in Vercel dashboard:
1. Go to your project → Settings → Environment Variables
2. Add all the API variables listed above

### 2. Update CORS in API

After deploying the dashboard (next step), update `ALLOWED_ORIGINS` in your API environment variables to include your dashboard URL.

### 3. Deploy the Dashboard

```bash
cd ../dashboard/
vercel
```

When prompted:
- Link to existing project or create new one
- Set Root Directory to `dashboard/`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Add environment variables in Vercel dashboard:
1. Go to your project → Settings → Environment Variables
2. Add the dashboard variables listed above (using your API URL from step 1)

---

## 🔐 Security Notes

### For SECRET_KEY:
Generate a secure random key. You can use:
```bash
openssl rand -hex 32
```

Or in Python:
```python
import secrets
print(secrets.token_hex(32))
```

### For ALLOWED_EMAIL:
This is the email that can authenticate to your dashboard. Only this email will receive OTP codes and be able to log in.

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] API Health Check: Visit `https://your-api.vercel.app/api/health`
  - Should return: `{"status": "ok"}`
  
- [ ] Dashboard loads: Visit `https://your-dashboard.vercel.app`
  - Should show login page
  
- [ ] API can connect to Railway services:
  - Check Vercel function logs for database connections
  - Check for Redis connection messages
  
- [ ] WebSocket connection works:
  - Log in to dashboard
  - Check browser console for WS connection
  
- [ ] Rust engine integration:
  - Check if synth-arb data appears in dashboard
  - Verify Redis pub/sub is working

---

## 🐛 Troubleshooting

### Common Issues:

1. **Database Connection Fails**
   - Verify `DATABASE_URL` format: must start with `postgresql://` (not `postgres://`)
   - Check Railway database is publicly accessible
   - Verify credentials are correct

2. **Redis Connection Fails**
   - Verify `REDIS_URL` format includes password: `redis://default:password@host:port`
   - Check Railway Redis is publicly accessible
   
3. **CORS Errors**
   - Update `ALLOWED_ORIGINS` to include your dashboard URL
   - Redeploy API after changing environment variables

4. **WebSocket Connection Fails**
   - Ensure `VITE_WS_URL` uses `wss://` (not `https://`)
   - Verify `/ws` path is appended
   - Check that token is being sent correctly

5. **Rust Engine Not Connecting**
   - Verify `SYNTH_ARB_URL` is the public Railway URL
   - Check if Railway service is running
   - Test endpoint: `curl https://your-engine.up.railway.app/state`

---

## 📊 Environment Variables Summary

### API (8 variables)
| Variable | Required | Example |
|----------|----------|---------|
| `SECRET_KEY` | ✅ Yes | `a1b2c3d4...` (64 chars) |
| `ALLOWED_EMAIL` | ✅ Yes | `you@email.com` |
| `REDIS_URL` | ✅ Yes | `redis://default:xxx@host:6379` |
| `DATABASE_URL` | ✅ Yes | `postgresql://user:pass@host:5432/db` |
| `SYNTH_ARB_URL` | ✅ Yes | `https://engine.railway.app` |
| `ALLOWED_ORIGINS` | ✅ Yes | `https://dashboard.vercel.app` |
| `SLACK_WEBHOOK_URL` | ❌ No | `https://hooks.slack.com/...` |

### Dashboard (2 variables)
| Variable | Required | Example |
|----------|----------|---------|
| `VITE_API_URL` | ✅ Yes | `https://api.vercel.app` |
| `VITE_WS_URL` | ✅ Yes | `wss://api.vercel.app/ws` |

---

## 🚀 Quick Copy-Paste Templates

### API .env (for local testing)
```bash
SECRET_KEY=your-secret-key
ALLOWED_EMAIL=your@email.com
REDIS_URL=redis://default:xxx@your-redis.railway.app:6379
DATABASE_URL=postgresql://user:pass@your-postgres.railway.app:5432/railway
SYNTH_ARB_URL=https://your-engine.up.railway.app
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
```

### Dashboard .env (for local testing)
```bash
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

### Dashboard .env.production (for Vercel)
```bash
VITE_API_URL=https://your-api.vercel.app
VITE_WS_URL=wss://your-api.vercel.app/ws
```

---

## 📚 Additional Resources

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Railway Database Connection Strings](https://docs.railway.app/databases/postgresql)
- [Railway Redis](https://docs.railway.app/databases/redis)

---

**Need Help?** If you encounter any issues:
1. Check Vercel function logs: Project → Deployments → Click deployment → Functions tab
2. Check Railway logs: Service → Deployments → Logs
3. Check browser console for frontend errors
