# 🎯 Finish Your Deployment - 3 Minutes!

## ✅ What's Done:
- ✅ Railway project created: **analytics-service**
- ✅ Code uploaded to Railway
- ✅ Build started

## 🔧 Complete Setup (Via Dashboard - Easier!)

### Step 1: Open Your Railway Dashboard
Go to: **https://railway.com/project/50ec11d6-f221-4477-bd47-bd3dcf35c9c5**

Or visit: https://railway.app/dashboard and click "analytics-service"

### Step 2: Click on Your Service
You should see a service card (might be named after your repo). Click it.

### Step 3: Add Environment Variables
1. Click the **"Variables"** tab
2. Click **"+ New Variable"** or **"Raw Editor"**
3. Add these three variables:

```
SUPABASE_URL=https://hptxgbufowarzlfmzzph.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<get-from-below>
NODE_ENV=production
```

**To get your Supabase Service Role Key:**
```bash
grep "^SUPABASE_SERVICE_ROLE_KEY=" /Users/oriolesinski/main-project-repo/analytics-automation/.env
```

Copy the value after the `=` sign.

### Step 4: Save and Redeploy
1. Click **"Deploy"** or the variables will auto-trigger a redeploy
2. Wait ~2 minutes for deployment to complete

### Step 5: Get Your Railway URL
1. In your service, look for **"Deployments"** tab
2. Click the latest deployment
3. Look for **"Domains"** or **"Settings" → "Networking"**
4. Click **"Generate Domain"** if no domain exists
5. Copy the URL (like: `https://analytics-service-production-xxxx.up.railway.app`)

### Step 6: Test Your Deployment
```bash
# Replace with your actual Railway URL
curl https://your-railway-url.railway.app/healthz
```

Should return: `{"ok":true}`

---

## 🚀 After Deployment

### Update Your Environment Variable
```bash
# Add this to ~/.zshrc
echo 'export ANALYTICS_BACKEND_URL="https://your-railway-url.railway.app/ingest/analytics"' >> ~/.zshrc
source ~/.zshrc
```

### Regenerate tracker.js
```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-generator
./test-generator.sh test-app-rich
```

---

## 📋 Quick Checklist

- [ ] Open Railway dashboard
- [ ] Find analytics-service project
- [ ] Click on the service
- [ ] Add 3 environment variables
- [ ] Generate domain
- [ ] Copy Railway URL
- [ ] Test `/healthz` endpoint
- [ ] Update `ANALYTICS_BACKEND_URL`
- [ ] Regenerate tracker.js

---

## 🆘 Need Help?

**Project URL:** https://railway.com/project/50ec11d6-f221-4477-bd47-bd3dcf35c9c5

**Build Logs:** Available in your Railway dashboard → Deployments tab

**Service Details:**
- Project: analytics-service
- Environment: production
- Region: us-west1 (default)

---

## Alternative: Use Railway CLI

If you prefer CLI, run these commands in your terminal (requires TTY):

```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-service

# Link service (interactive)
railway link

# Set variables
railway variables --set "SUPABASE_URL=https://hptxgbufowarzlfmzzph.supabase.co"
railway variables --set "SUPABASE_SERVICE_ROLE_KEY=your-key-here"
railway variables --set "NODE_ENV=production"

# Check status
railway status
```

But the **dashboard is faster** for this! 🎯

