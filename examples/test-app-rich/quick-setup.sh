#!/bin/bash

# Quick Analytics Setup Script - Direct Path Version
# This script uses the exact path to your generated analytics files

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}       Analytics Quick Setup - Direct Path Version          ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Direct paths - UPDATE THESE IF NEEDED
ANALYTICS_OUTPUT_DIR="/Users/oriolesinski/analytics-automation/packages/analytics-generator/src/utils/generated-outputs/unified/test-app-rich/2025-09-18T14-38-08-771Z"
EXAMPLE_APP="/Users/oriolesinski/analytics-automation/examples/test-app-rich"
BACKEND_DIR="/Users/oriolesinski/analytics-automation/backend"
PROJECT_ROOT="/Users/oriolesinski/analytics-automation"

echo -e "${YELLOW}Using analytics from:${NC}"
echo "  $ANALYTICS_OUTPUT_DIR"
echo ""

# Verify the directory exists
if [ ! -d "$ANALYTICS_OUTPUT_DIR" ]; then
    echo -e "${RED}✗ Analytics directory not found!${NC}"
    echo -e "${YELLOW}Please update the ANALYTICS_OUTPUT_DIR variable in this script${NC}"
    exit 1
fi

# Step 1: Copy tracker.js to the public directory
echo -e "${YELLOW}▶ Step 1: Installing tracker.js...${NC}"
mkdir -p "$EXAMPLE_APP/public"
cp "$ANALYTICS_OUTPUT_DIR/tracker.js" "$EXAMPLE_APP/public/tracker.js"
echo -e "${GREEN}✓ Copied tracker.js to public directory${NC}"

# Step 2: Copy TypeScript types
echo -e "${YELLOW}▶ Step 2: Installing TypeScript types...${NC}"
mkdir -p "$EXAMPLE_APP/app/types"
cp "$ANALYTICS_OUTPUT_DIR/analytics.types.ts" "$EXAMPLE_APP/app/types/analytics.types.ts"
echo -e "${GREEN}✓ Copied analytics.types.ts${NC}"

# Step 3: Install Analytics Provider
echo -e "${YELLOW}▶ Step 3: Installing Analytics Provider...${NC}"
mkdir -p "$EXAMPLE_APP/app/components"
cp "$ANALYTICS_OUTPUT_DIR/analytics-provider.tsx" "$EXAMPLE_APP/app/components/analytics-provider.tsx"
echo -e "${GREEN}✓ Copied analytics-provider.tsx${NC}"

# Step 4: Update the root layout
echo -e "${YELLOW}▶ Step 4: Updating root layout...${NC}"

# Check if Script import already exists
if ! grep -q "import Script from 'next/script'" "$EXAMPLE_APP/app/layout.tsx"; then
    # Backup the original
    cp "$EXAMPLE_APP/app/layout.tsx" "$EXAMPLE_APP/app/layout.tsx.backup"
    
    # Add Script import and tracker.js
    sed -i '' "/import .* from 'next\/font\/google'/a\\
import Script from 'next/script';
" "$EXAMPLE_APP/app/layout.tsx"
    
    # Add the script tag in the head
    sed -i '' '/<html lang="en">/a\
      <head>\
        {/* Analytics Tracker - Zero Configuration Required! */}\
        <Script src="/tracker.js" strategy="afterInteractive" />\
      </head>' "$EXAMPLE_APP/app/layout.tsx"
    
    echo -e "${GREEN}✓ Added Script import and tracker.js to layout${NC}"
else
    echo -e "${YELLOW}  Script already imported, skipping...${NC}"
fi

# Step 5: Copy documentation
echo -e "${YELLOW}▶ Step 5: Installing documentation...${NC}"
mkdir -p "$EXAMPLE_APP/analytics-docs"
cp "$ANALYTICS_OUTPUT_DIR/"*.md "$EXAMPLE_APP/analytics-docs/" 2>/dev/null || true
cp "$ANALYTICS_OUTPUT_DIR/"*.json "$EXAMPLE_APP/analytics-docs/" 2>/dev/null || true
echo -e "${GREEN}✓ Documentation copied${NC}"

# Step 6: Create simple start script
echo -e "${YELLOW}▶ Step 6: Creating start script...${NC}"

cat > "$PROJECT_ROOT/start.sh" << 'EOF'
#!/bin/bash

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting Analytics Demo...${NC}"

# Start backend
echo "Starting backend server..."
cd backend && npm start &

# Wait a bit for backend to start
sleep 3

# Start frontend
echo "Starting frontend..."
cd examples/test-app-rich && npm run dev &

sleep 5

echo ""
echo -e "${GREEN}✅ Analytics Demo is running!${NC}"
echo -e "${BLUE}Frontend:${NC} http://localhost:3000"
echo -e "${BLUE}Backend:${NC} http://localhost:8082/ingest/analytics"
echo ""
echo "Open browser console to see analytics events"
echo "Press Ctrl+C to stop"

wait
EOF

chmod +x "$PROJECT_ROOT/start.sh"
echo -e "${GREEN}✓ Created start.sh${NC}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Analytics Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📦 Files installed:${NC}"
echo "  • public/tracker.js"
echo "  • app/types/analytics.types.ts"
echo "  • app/components/analytics-provider.tsx"
echo "  • analytics-docs/"
echo ""
echo -e "${YELLOW}🚀 To start the application:${NC}"
echo -e "  ${GREEN}cd $PROJECT_ROOT${NC}"
echo -e "  ${GREEN}./start.sh${NC}"
echo ""
echo -e "${YELLOW}📊 Test analytics by:${NC}"
echo "  1. Opening http://localhost:3000"
echo "  2. Opening browser console (F12)"
echo "  3. Looking for '✅ Analytics tracker initialized'"
echo "  4. Interacting with the site"
echo "  5. Checking Network tab for 'ingest' requests"
echo ""
