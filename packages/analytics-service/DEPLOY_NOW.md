# 🚀 Deploy Now - Simple Steps

## ✅ What I've Done For You:

1. **Built your service** - TypeScript compiled successfully ✓
2. **Installed Railway CLI** - Version 4.10.0 ready ✓
3. **Found your Supabase credentials** ✓
   - URL: `https://hptxgbufowarzlfmzzph.supabase.co`
   - Service Key: Found and ready to use
4. **Created deployment helper script** ✓

## 🎯 What You Need To Do:

### Option 1: Automated Script (Recommended)

Just run this one command:

```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-service
./deploy-to-railway.sh
```

The script will:
- ✅ Load your Supabase credentials automatically
- ✅ Check Railway login (prompts if needed)
- ✅ Initialize Railway project (asks first)
- ✅ Set all environment variables
- ✅ Deploy the service
- ✅ Show you the deployment status

### Option 2: Manual Steps

If you prefer to do it manually:

```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-service

# 1. Login to Railway (opens browser)
railway login

# 2. Initialize project
railway init

# 3. Set environment variables
railway variables set SUPABASE_URL="https://hptxgbufowarzlfmzzph.supabase.co"
railway variables set SUPABASE_SERVICE_ROLE_KEY="<paste-from-.env-file>"
railway variables set NODE_ENV="production"

# 4. Deploy
railway up

# 5. Get your URL
railway status
```

## 📋 After Deployment:

### 1. Get Your Railway URL
```bash
railway status
# Look for something like: https://analytics-service-production-xxxx.up.railway.app
```

### 2. Test It
```bash
# Replace with your actual URL
export RAILWAY_URL="https://your-url.railway.app"

curl $RAILWAY_URL/healthz
# Should return: {"ok":true}
```

### 3. Update Analytics Generator

Add to your `~/.zshrc`:
```bash
export ANALYTICS_BACKEND_URL="https://your-railway-url.railway.app/ingest/analytics"
```

Then reload:
```bash
source ~/.zshrc
```

### 4. Regenerate tracker.js

```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-generator
./test-generator.sh test-app-rich
```

### 5. Deploy Updated Tracker

Copy the new tracker.js to your frontend and push to trigger redeployment.

## 🆘 Troubleshooting

### "railway: command not found"
Already fixed - Railway CLI is installed!

### "Not logged in to Railway"
The script will prompt you to run: `railway login`

### "No Railway project found"
The script will ask if you want to initialize one.

### Want to see logs?
```bash
railway logs --follow
```

### Want to open Railway dashboard?
```bash
railway open
```

## 💡 Quick Tips

- Your Supabase URL: `https://hptxgbufowarzlfmzzph.supabase.co`
- Local service already running on: `http://localhost:8082`
- CORS already configured for Vercel & Railway ✓
- Health check endpoint ready at `/healthz` ✓

## 🎉 Ready to Deploy!

Run the automated script:
```bash
cd /Users/oriolesinski/main-project-repo/analytics-automation/packages/analytics-service
./deploy-to-railway.sh
```

Or follow the manual steps above!

