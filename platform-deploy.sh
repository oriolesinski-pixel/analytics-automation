#!/bin/bash
# platform-deploy.sh - Complete platform deployment with GitHub integration

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ROOT="$(pwd)"
cd "${PROJECT_ROOT}"

echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║      Analytics Platform - GitHub Integration          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}\n"

# Step 1: Kill existing processes
echo -e "${BLUE}Step 1: Stopping existing services...${NC}"
killall node 2>/dev/null || true
sleep 2
echo -e "${GREEN}✓ Services stopped${NC}\n"

# Load environment variables from root .env file
if [ -f "${PROJECT_ROOT}/.env" ]; then
    # Fix spaces around = signs and source the environment
    sed 's/ = /=/g' "${PROJECT_ROOT}/.env" > /tmp/.env.tmp
    set -a
    source /tmp/.env.tmp
    set +a
    rm /tmp/.env.tmp
fi
echo -e "${BLUE}Step 2: Checking dependencies...${NC}"

# Analytics Service
cd "${PROJECT_ROOT}/packages/analytics-service"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing analytics service dependencies...${NC}"
    npm install
fi

# Analytics Platform
cd "${PROJECT_ROOT}/packages/analytics-platform"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing platform dependencies...${NC}"
    npm install
fi

echo -e "${GREEN}✓ Dependencies ready${NC}\n"

# Step 3: Start Analytics Service
echo -e "${BLUE}Step 3: Starting Analytics Service...${NC}"
cd "${PROJECT_ROOT}/packages/analytics-service"

# Build the TypeScript files
echo -e "${YELLOW}Building analytics service...${NC}"
npx tsc

# Start the service
npm run dev &
SERVICE_PID=$!

# Wait for service to be ready
echo -e "${YELLOW}Waiting for analytics service...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8082/healthz > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Analytics service ready on port 8082${NC}\n"
        break
    fi
    sleep 1
    echo -n "."
done

# Step 4: Start Analytics Generator Service (if needed)
echo -e "${BLUE}Step 4: Checking Generator Service...${NC}"
cd "${PROJECT_ROOT}/packages/analytics-generator"

if [ -f "src/server.ts" ]; then
    echo -e "${YELLOW}Starting generator service...${NC}"
    npm run dev &
    GENERATOR_PID=$!
    
    # Wait for generator to be ready
    for i in {1..30}; do
        if curl -s http://localhost:8081/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Generator service ready on port 8081${NC}\n"
            break
        fi
        sleep 1
        echo -n "."
    done
else
    echo -e "${YELLOW}Generator service not configured (using inline generation)${NC}\n"
    GENERATOR_PID=""
fi

# Step 5: Start Analytics Platform
echo -e "${BLUE}Step 5: Starting Analytics Platform...${NC}"
cd "${PROJECT_ROOT}/packages/analytics-platform"

# Create/update environment file
cat > .env.local << EOF
# GitHub OAuth
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID:-"YOUR_GITHUB_CLIENT_ID"}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET:-"YOUR_GITHUB_CLIENT_SECRET"}
GITHUB_REDIRECT_URI=http://localhost:3002/api/auth/github/callback

# Service URLs
NEXT_PUBLIC_API_URL=http://localhost:8082
ANALYTICS_SERVICE_URL=http://localhost:8082
GENERATOR_SERVICE_URL=http://localhost:8081
PLATFORM_URL=http://localhost:3002

# Supabase
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
EOF

# Start the platform
npm run dev &
PLATFORM_PID=$!

echo -e "${GREEN}✓ Platform starting on port 3002${NC}\n"

# Wait for platform to be ready
echo -e "${YELLOW}Waiting for platform to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Platform ready${NC}\n"
        break
    fi
    sleep 1
    echo -n "."
done

# Step 6: Show summary
echo -e "\n${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           🚀 Platform Deployment Complete!            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}\n"

echo -e "${YELLOW}Services Running:${NC}"
echo -e "  📊 Analytics Platform:  ${GREEN}http://localhost:3002${NC}"
echo -e "  🔧 Analytics Service:   ${GREEN}http://localhost:8082${NC}"
if [ ! -z "$GENERATOR_PID" ]; then
    echo -e "  🤖 Generator Service:   ${GREEN}http://localhost:8081${NC}"
fi
echo ""

echo -e "${YELLOW}GitHub Integration Flow:${NC}"
echo -e "  1. Visit: ${GREEN}http://localhost:3002/onboarding${NC}"
echo -e "  2. Connect your GitHub account"
echo -e "  3. Select a repository to analyze"
echo -e "  4. Review the generated analytics schema"
echo -e "  5. Deploy with auto-merge (if you have permissions)"
echo ""

echo -e "${YELLOW}Dashboard:${NC}"
echo -e "  View real-time analytics: ${GREEN}http://localhost:3002/dashboard${NC}"
echo ""

if [[ "${GITHUB_CLIENT_ID}" == "YOUR_GITHUB_CLIENT_ID" ]]; then
    echo -e "${RED}⚠️  WARNING: GitHub OAuth not configured!${NC}"
    echo -e "${YELLOW}To enable GitHub integration:${NC}"
    echo -e "  1. Create OAuth App at: https://github.com/settings/applications/new"
    echo -e "  2. Set callback URL: http://localhost:3002/api/auth/github/callback"
    echo -e "  3. Update .env with GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET"
    echo ""
fi

echo -e "${CYAN}Press Ctrl+C to stop all services${NC}\n"

# Trap to handle Ctrl+C
trap 'echo -e "\n${YELLOW}Stopping services...${NC}"; kill $SERVICE_PID $GENERATOR_PID $PLATFORM_PID 2>/dev/null; exit' INT TERM

# Keep script running
wait

s
