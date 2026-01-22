#!/bin/bash
# Railway Deployment Helper Script
# This script helps deploy analytics-service to Railway

set -e  # Exit on error

echo "🚀 Analytics Service - Railway Deployment Helper"
echo "=================================================="
echo ""

# Load environment variables
if [ -f "../../.env" ]; then
    echo "✅ Found .env file, loading credentials..."
    export $(cat ../../.env | grep -E "^SUPABASE_URL=" | xargs)
    export $(cat ../../.env | grep -E "^SUPABASE_SERVICE_ROLE_KEY=" | xargs)
fi

# Check if credentials are available
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ ERROR: Supabase credentials not found!"
    echo ""
    echo "Please set these environment variables:"
    echo "  SUPABASE_URL"
    echo "  SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    exit 1
fi

echo "📦 Credentials loaded:"
echo "   SUPABASE_URL: ${SUPABASE_URL}"
echo "   SUPABASE_SERVICE_ROLE_KEY: ***hidden***"
echo ""

# Check if Railway is logged in
echo "🔍 Checking Railway login status..."
if ! railway whoami &>/dev/null; then
    echo "❌ Not logged in to Railway"
    echo ""
    echo "Please run: railway login"
    echo "This will open your browser to authenticate."
    echo ""
    exit 1
fi

echo "✅ Logged in as: $(railway whoami)"
echo ""

# Check if Railway project is initialized
echo "🔍 Checking Railway project..."
if ! railway status &>/dev/null; then
    echo "⚠️  No Railway project found in this directory"
    echo ""
    echo "Would you like to initialize a new project? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "🎯 Initializing Railway project..."
        railway init
    else
        echo "Skipping initialization. Run 'railway init' manually when ready."
        exit 0
    fi
fi

echo "✅ Railway project found"
echo ""

# Set environment variables
echo "🔧 Setting environment variables in Railway..."
railway variables set SUPABASE_URL="$SUPABASE_URL"
railway variables set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
railway variables set NODE_ENV="production"

echo "✅ Environment variables set!"
echo ""

# Deploy
echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "📊 Getting deployment status..."
railway status

echo ""
echo "🎉 Deployment script completed!"
echo ""
echo "Next steps:"
echo "1. Wait for deployment to complete (check logs: railway logs)"
echo "2. Get your Railway URL from: railway status"
echo "3. Test the endpoint: curl https://your-url.railway.app/healthz"
echo "4. Update ANALYTICS_BACKEND_URL environment variable with your Railway URL"

