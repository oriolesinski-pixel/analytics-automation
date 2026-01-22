# Railway Deployment Guide for Analytics Service

This guide covers deploying the analytics-service to Railway with proper environment configuration and CORS setup.

## Prerequisites

1. **Railway CLI**: Install if not already available
   ```bash
   npm install -g @railway/cli
   ```

2. **Railway Account**: Sign up at [railway.app](https://railway.app)

3. **Supabase Credentials**: Have your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` ready

## Step 1: Test Local Build

Before deploying, verify the production build works locally:

```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-service

# Build TypeScript to JavaScript
npm run build

# Test the production build locally
PORT=8082 \
SUPABASE_URL=your-url-here \
SUPABASE_SERVICE_ROLE_KEY=your-key-here \
npm start
```

Verify the service responds:
```bash
curl http://localhost:8082/healthz
# Should return: {"ok":true}
```

## Step 2: Initialize Railway Project

```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-service

# Login to Railway (opens browser)
railway login

# Initialize new project
railway init

# When prompted:
# - Project name: "analytics-service" (or your preference)
# - Choose: "Create new project"
```

## Step 3: Configure Environment Variables

Set environment variables in Railway (choose one method):

### Option A: Via Railway Dashboard (Recommended)
1. Go to https://railway.app/dashboard
2. Select your `analytics-service` project
3. Click "Variables" tab
4. Add these variables:
   - `SUPABASE_URL` = `https://your-project.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = `your-service-role-key`
   - `NODE_ENV` = `production`
   - `PORT` = (leave empty, Railway auto-assigns)

### Option B: Via Railway CLI
```bash
railway variables set SUPABASE_URL="https://your-project.supabase.co"
railway variables set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
railway variables set NODE_ENV="production"
```

## Step 4: Deploy to Railway

```bash
# Deploy the service
railway up

# Watch deployment logs
railway logs
```

Wait for deployment to complete. You'll see a URL like:
```
https://analytics-service-production-xxxx.up.railway.app
```

## Step 5: Verify Deployment

Test the deployed service:

```bash
# Replace with your actual Railway URL
export RAILWAY_URL="https://analytics-service-production-xxxx.up.railway.app"

# Test health endpoint
curl $RAILWAY_URL/healthz

# Test analytics ingestion (should accept POST)
curl -X POST $RAILWAY_URL/ingest/analytics \
  -H "Content-Type: application/json" \
  -H "Origin: https://demo-test-apps.vercel.app" \
  -d '{
    "app_key": "test-app-rich",
    "event_type": "page_view",
    "session_id": "test-session",
    "user_id": "test-user",
    "id": "test-event-id",
    "ts": 1696800000000,
    "data": {"page": "/test"}
  }'

# Should return: {"ok":true}
# Check browser console for CORS headers - should allow the origin
```

## Step 6: Update Analytics Generator

Now that your service is deployed, update the analytics generator to use the Railway URL:

### Option A: Set Environment Variable (Recommended)

Add to your shell profile (`.zshrc`, `.bashrc`, etc.):
```bash
export ANALYTICS_BACKEND_URL="https://analytics-service-production-xxxx.up.railway.app/ingest/analytics"
```

Then restart your analytics-generator service:
```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-generator
# Restart the service (method depends on how you're running it)
```

### Option B: Pass at Generation Time

When generating analytics for an app:
```bash
curl -X POST http://localhost:3001/generate/analytics-intelligence \
  -H "Content-Type: application/json" \
  -d '{
    "app_key": "test-app-rich",
    "backend_url": "https://analytics-service-production-xxxx.up.railway.app/ingest/analytics",
    ...other params...
  }'
```

## Step 7: Regenerate tracker.js for Test Apps

Regenerate the tracker.js for your test apps with the new Railway URL:

```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-generator

# Set the backend URL
export ANALYTICS_BACKEND_URL="https://analytics-service-production-xxxx.up.railway.app/ingest/analytics"

# Run the generator for test-app-rich
npm run generate -- --app-key test-app-rich
```

This will create a new `tracker.js` file with the Railway endpoint.

## Step 8: Deploy Updated Tracker to Your Frontend

Copy the new tracker.js to your frontend app and redeploy:

```bash
# Example for test-app-rich
cp /path/to/generated/tracker.js /Users/oriolesinski/main-project-repo/demo-test-apps/test-app-rich/public/

# Commit and push to trigger Vercel redeploy
cd /Users/oriolesinski/main-project-repo/demo-test-apps/test-app-rich
git add public/tracker.js
git commit -m "Update analytics endpoint to Railway"
git push
```

## Step 9: Final Verification

After your frontend redeploys:

1. **Open your live app** (e.g., `https://test-app-rich.vercel.app`)
2. **Open browser DevTools** → Network tab
3. **Filter for** `/ingest/analytics`
4. **Interact with the app** (click, navigate, etc.)
5. **Verify**:
   - POST requests go to Railway URL (not localhost)
   - Requests return `200 OK`
   - No CORS errors in console
6. **Check Supabase**:
   - Go to Supabase dashboard
   - Open `analytics_product_events` table
   - Confirm events are being logged

## CORS Configuration

The service already supports the following origins:
- ✅ `localhost` (any port) - for local development
- ✅ `*.vercel.app` - for Vercel deployments
- ✅ `*.railway.app` - for Railway deployments

No CORS changes needed! 🎉

## Monitoring & Maintenance

### View Logs
```bash
railway logs --follow
```

### Update Deployment
```bash
# Make code changes, then:
railway up
```

### Check Service Status
```bash
railway status
```

### Link to Dashboard
```bash
railway open
```

## Troubleshooting

### Issue: Health check failing
**Solution**: Verify `/healthz` endpoint returns `{"ok":true}` by testing locally first

### Issue: 502 Bad Gateway
**Solution**: 
- Check Railway logs: `railway logs`
- Verify build completed: check for "Server running" message
- Ensure PORT is not hardcoded (should use `process.env.PORT`)

### Issue: CORS errors
**Solution**: 
- Verify request origin matches allowed patterns (vercel.app, railway.app, localhost)
- Check browser console for exact origin being sent
- Review server logs for blocked origin messages

### Issue: Events not reaching Supabase
**Solution**:
- Verify environment variables are set in Railway dashboard
- Test Supabase connection locally with same credentials
- Check Railway logs for Supabase connection errors

### Issue: Cannot find module errors
**Solution**:
- Ensure `npm run build` completes without errors
- Check that `dist/` directory is created
- Verify all dependencies are in `dependencies` (not `devDependencies`)

## Cost Estimates

Railway's free tier includes:
- $5 worth of usage per month
- Pay-as-you-go after that

Typical costs for this service:
- **Hobby use**: $0-5/month (usually covered by free tier)
- **Production (low traffic)**: $5-10/month
- **Production (high traffic)**: $10-20/month

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | ✅ Yes | - | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | - | Service role key (has elevated permissions) |
| `PORT` | ❌ No | Auto-assigned | Railway assigns this automatically |
| `NODE_ENV` | ❌ No | `production` | Set to production for Railway |
| `ANALYTICS_PORT` | ❌ No | 8082 | Fallback for local development |

## Next Steps

1. ✅ Set up monitoring/alerting (optional)
2. ✅ Configure custom domain (optional)
3. ✅ Set up staging environment (optional)
4. ✅ Enable automatic deployments from GitHub (recommended)

## Support

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Supabase Docs**: https://supabase.com/docs

