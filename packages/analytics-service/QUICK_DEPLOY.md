# Railway Quick Deploy Commands

## 🚀 Quick Deployment Steps

```bash
# 1. Navigate to analytics-service
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-service

# 2. Test local build
npm run build && npm start

# 3. Login to Railway
railway login

# 4. Initialize project
railway init

# 5. Set environment variables (via CLI or use Dashboard)
railway variables set SUPABASE_URL="https://your-project.supabase.co"
railway variables set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
railway variables set NODE_ENV="production"

# 6. Deploy
railway up

# 7. Get your Railway URL
railway status
# Look for: https://analytics-service-production-xxxx.up.railway.app
```

## 📝 Update Analytics Generator

```bash
# Set environment variable for your shell
export ANALYTICS_BACKEND_URL="https://your-railway-url.up.railway.app/ingest/analytics"

# Add to ~/.zshrc or ~/.bashrc to make permanent:
echo 'export ANALYTICS_BACKEND_URL="https://your-railway-url.up.railway.app/ingest/analytics"' >> ~/.zshrc
source ~/.zshrc
```

## ✅ Quick Verification

```bash
# Test health endpoint
curl https://your-railway-url.up.railway.app/healthz

# Test analytics ingestion
curl -X POST https://your-railway-url.up.railway.app/ingest/analytics \
  -H "Content-Type: application/json" \
  -H "Origin: https://demo-test-apps.vercel.app" \
  -d '{"app_key":"test","event_type":"page_view","session_id":"s1","user_id":"u1","id":"e1","ts":1696800000000}'
```

## 🔄 Regenerate Tracker.js

```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-generator

# Regenerate with new Railway URL (uses ANALYTICS_BACKEND_URL env var)
./test-generator.sh test-app-rich

# Or via API:
curl -X POST http://localhost:3001/generate/analytics-intelligence \
  -H "Content-Type: application/json" \
  -d '{
    "app_key": "test-app-rich",
    "backend_url": "https://your-railway-url.up.railway.app/ingest/analytics",
    "github_repo": "your-org/test-app-rich"
  }'
```

## 📊 Monitor Deployment

```bash
# View logs
railway logs --follow

# Open Railway dashboard
railway open

# Check service status
railway status
```

## 🎯 Key Files Modified

- ✅ `src/server.ts` - PORT now reads from `process.env.PORT`
- ✅ `package.json` - Added `build` and `start` scripts
- ✅ `railway.json` - Railway configuration
- ✅ `analytics-generator/src/lib/analytics-intelligence-generator.ts` - Uses `ANALYTICS_BACKEND_URL` env var
- ✅ `analytics-generator/src/routes/analytics-intelligence.ts` - Uses `ANALYTICS_BACKEND_URL` env var

## 🔐 Security Notes

- ✅ CORS already configured for `*.vercel.app`, `*.railway.app`, `localhost`
- ✅ Supabase keys set as environment variables (never in code)
- ✅ Service role key only used server-side
- ✅ Healthcheck endpoint public, data endpoints require proper origin

## 💡 Tips

1. **Local Development**: Keep using `http://localhost:8082` (default when `ANALYTICS_BACKEND_URL` not set)
2. **Production**: Set `ANALYTICS_BACKEND_URL` to Railway URL
3. **Multiple Environments**: Use different Railway projects for staging/production
4. **Auto-deploy**: Connect Railway to GitHub for automatic deployments on push

## 📞 Getting Your Railway URL

After `railway up` completes:
```bash
railway status
# Or visit Railway dashboard and copy the URL from your project
```

The URL format: `https://analytics-service-production-XXXX.up.railway.app`

