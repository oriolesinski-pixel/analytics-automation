# 🎯 Complete Operation Guide - Analytics Service on Railway

## Current Status:
- ✅ Code deployed to Railway
- ⚠️ Need to configure environment variables
- ⚠️ Need to generate public URL
- ⚠️ Need to test and update generators

---

## Part 1: Configure Railway (5 minutes)

### Step 1: Open Railway Dashboard
🔗 **Your Project:** https://railway.com/project/50ec11d6-f221-4477-bd47-bd3dcf35c9c5

### Step 2: Add Environment Variables

1. Click on your **service card** (should see your deployment)
2. Click **"Variables"** tab at the top
3. Click **"+ New Variable"** or click **"Raw Editor"** button
4. Add these three variables:

```bash
SUPABASE_URL=https://hptxgbufowarzlfmzzph.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdHhnYnVmb3dhcnpsZm16enBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc3MzYxMiwiZXhwIjoyMDcxMzQ5NjEyfQ.nwlC76LjZlnyh7XfqeK-AbRGL-iGIalpGGHyc_Mp6F8
NODE_ENV=production
```

5. Click **"Add"** or **"Save"**
6. Railway will automatically redeploy (wait ~2 minutes)

### Step 3: Generate Public Domain

1. In your service, click **"Settings"** tab
2. Scroll to **"Networking"** section
3. Under **"Public Networking"**, click **"Generate Domain"**
4. Copy the generated URL (example: `analytics-service-production-a1b2.up.railway.app`)

### Step 4: Verify Deployment

Once the domain is generated, test it:
```bash
# Replace with YOUR actual Railway URL
curl https://analytics-service-production-xxxx.up.railway.app/healthz
```

**Expected response:** `{"ok":true}`

If you see this, your service is live! 🎉

---

## Part 2: Update Local Environment (2 minutes)

### Step 1: Set Your Railway URL

Replace `YOUR_RAILWAY_URL` with your actual Railway domain:

```bash
# Add to your shell configuration
echo 'export ANALYTICS_BACKEND_URL="https://YOUR_RAILWAY_URL/ingest/analytics"' >> ~/.zshrc

# Reload shell
source ~/.zshrc

# Verify it's set
echo $ANALYTICS_BACKEND_URL
```

**Example:**
```bash
export ANALYTICS_BACKEND_URL="https://analytics-service-production-a1b2.up.railway.app/ingest/analytics"
```

---

## Part 3: Regenerate Analytics Trackers (3 minutes)

Now that your service is live, regenerate tracker.js with the new endpoint:

### For test-app-rich:
```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-generator

# This will use your ANALYTICS_BACKEND_URL environment variable
./test-generator.sh test-app-rich
```

### Or use the API:
```bash
curl -X POST http://localhost:3001/generate/analytics-intelligence \
  -H "Content-Type: application/json" \
  -d '{
    "app_key": "test-app-rich",
    "backend_url": "https://YOUR_RAILWAY_URL/ingest/analytics",
    "github_repo": "your-org/test-app-rich"
  }'
```

---

## Part 4: Deploy Updated Tracker to Your App (5 minutes)

### Step 1: Copy Generated Tracker
```bash
# Find the generated tracker.js
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-generator/src/utils/generated-outputs

# Copy to your app's public folder
cp [path-to-tracker.js] /Users/oriolesinski/main-project-repo/demo-test-apps/test-app-rich/public/tracker.js
```

### Step 2: Commit and Push
```bash
cd /Users/oriolesinski/main-project-repo/demo-test-apps/test-app-rich

git add public/tracker.js
git commit -m "Update analytics endpoint to Railway production"
git push
```

This will trigger Vercel to redeploy with the new tracker.

---

## Part 5: Verify End-to-End (2 minutes)

### Step 1: Test Direct Ingestion
```bash
curl -X POST https://YOUR_RAILWAY_URL/ingest/analytics \
  -H "Content-Type: application/json" \
  -H "Origin: https://your-app.vercel.app" \
  -d '{
    "app_key": "test-app-rich",
    "event_type": "page_view",
    "session_id": "test-session-123",
    "user_id": "test-user-123",
    "id": "test-event-123",
    "ts": 1696800000000,
    "data": {"page": "/test"}
  }'
```

**Expected:** `{"ok":true}`

### Step 2: Check Your Live App
1. Open your deployed app (e.g., `https://test-app-rich.vercel.app`)
2. Open DevTools → Network tab
3. Filter for "analytics"
4. Click around your app
5. Verify POST requests go to Railway URL (not localhost)
6. Verify responses are 200 OK

### Step 3: Check Supabase
1. Go to your Supabase dashboard
2. Open `analytics_product_events` table
3. Verify new events are being logged

---

## 📊 Monitoring & Management

### View Logs
```bash
railway logs --follow
```

Or in dashboard: Click service → "Deployments" → Click deployment → "View Logs"

### Check Service Status
```bash
railway status
```

### Update Deployment
```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-service
railway up
```

### Manage Variables
Dashboard: Service → "Variables" tab

### View Metrics
Dashboard: Service → "Metrics" tab (CPU, Memory, Network)

---

## 🔧 Common Operations

### Restart Service
Dashboard: Service → "Settings" → "Restart"

### Scale Service
Dashboard: Service → "Settings" → Change instance type

### View Deployments
Dashboard: Service → "Deployments" tab

### Custom Domain
Dashboard: Service → "Settings" → "Domains" → "Custom Domain"

---

## 🆘 Troubleshooting

### Service Won't Start
**Check:** Railway logs for errors
**Fix:** Verify all 3 environment variables are set correctly

### Health Check Failing
**Test locally:**
```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-service
npm run build && npm start
curl http://localhost:8082/healthz
```

### CORS Errors
**Already fixed!** Service accepts:
- `*.vercel.app`
- `*.railway.app`
- `localhost` (any port)

### Events Not Reaching Supabase
**Check:**
1. Railway logs for Supabase connection errors
2. Supabase credentials are correct
3. Test ingestion endpoint directly (see Part 5, Step 1)

---

## 📋 Complete Checklist

- [ ] Railway environment variables added (3 variables)
- [ ] Public domain generated
- [ ] `/healthz` endpoint returns `{"ok":true}`
- [ ] `ANALYTICS_BACKEND_URL` set in local environment
- [ ] Shell config updated (~/.zshrc)
- [ ] tracker.js regenerated with Railway URL
- [ ] tracker.js copied to app's public folder
- [ ] App redeployed with new tracker
- [ ] Verified events flow from app → Railway → Supabase
- [ ] No CORS errors in browser console

---

## 🎉 Success Metrics

When everything is working:
- ✅ `curl https://YOUR_RAILWAY_URL/healthz` returns `{"ok":true}`
- ✅ Browser DevTools shows POST to Railway URL (not localhost)
- ✅ POST responses are 200 OK
- ✅ No CORS errors
- ✅ Events appear in Supabase `analytics_product_events` table
- ✅ Can view events in Analytics Platform dashboard

---

## 🔗 Important Links

- **Railway Project:** https://railway.com/project/50ec11d6-f221-4477-bd47-bd3dcf35c9c5
- **Supabase Dashboard:** https://supabase.com/dashboard/project/hptxgbufowarzlfmzzph
- **Local Analytics Service:** http://localhost:8082
- **Local Analytics Platform:** http://localhost:3002

---

## 💡 Pro Tips

1. **Development:** Keep using `localhost:8082` locally (default when `ANALYTICS_BACKEND_URL` not set)
2. **Production:** Use Railway URL in generated trackers
3. **Multiple Apps:** Generate separate trackers for each app with unique `app_key`
4. **Monitoring:** Set up Railway alerts for downtime (Settings → Alerts)
5. **Cost:** Check Railway usage dashboard regularly

---

## Next Steps After Setup

1. **Monitor initial events** - Watch Railway logs and Supabase
2. **Set up alerts** - Configure Railway health checks
3. **Document your URL** - Save Railway URL for team
4. **Test from mobile** - Verify CORS works from different origins
5. **Scale if needed** - Upgrade Railway instance if traffic increases

