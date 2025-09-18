#!/bin/bash
# packages/analytics-generator/test-generator.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}    Analytics Intelligence Generator Test Suite     ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found${NC}"
    echo "Please run this script from the analytics-generator directory"
    exit 1
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
    echo "Creating .env file from template..."
    
    cat > .env << 'EOF'
# Anthropic API Key for Claude
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Optional: Keep local copies of generated files
KEEP_LOCAL_COPY=true

# Optional: Custom backend URL
ANALYTICS_BACKEND_URL=http://localhost:8082/ingest/analytics

# Node environment
NODE_ENV=development
EOF

    echo -e "${YELLOW}Please edit .env file with your actual credentials${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Function to test a specific app
test_app() {
    local app_name=$1
    echo -e "\n${BLUE}🧪 Testing: $app_name${NC}"
    echo "────────────────────────────────────────"
    
    # Run the TypeScript test directly with ts-node
    npx ts-node src/test-generator.ts "$app_name"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Test passed for $app_name${NC}"
        return 0
    else
        echo -e "${RED}❌ Test failed for $app_name${NC}"
        return 1
    fi
}

# Main test execution
main() {
    local app=$1
    local failed=0
    
    if [ -n "$app" ]; then
        # Test specific app
        test_app "$app"
        failed=$?
    else
        # Test all apps
        echo -e "${BLUE}Running tests for all applications...${NC}\n"
        
        for app_name in "test-app-rich" "demo-next"; do
            test_app "$app_name"
            if [ $? -ne 0 ]; then
                failed=$((failed + 1))
            fi
        done
    fi
    
    # Final summary
    echo -e "\n${BLUE}═══════════════════════════════════════════════════${NC}"
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests completed successfully!${NC}"
        
        # Show output location
        echo -e "\n${BLUE}📁 Generated files location:${NC}"
        echo "   Local: ./src/utils/generated-outputs/unified/"
        echo "   Cloud: Check Supabase storage bucket"
        
    else
        echo -e "${RED}⚠️  $failed test(s) failed${NC}"
        exit 1
    fi
}

# Show usage
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: ./test-generator.sh [app-name]"
    echo ""
    echo "Available apps:"
    echo "  - test-app-rich"
    echo "  - demo-next"
    echo ""
    echo "Examples:"
    echo "  ./test-generator.sh              # Test all apps"
    echo "  ./test-generator.sh test-app-rich # Test specific app"
    exit 0
fi

# Run main function
main "$1"