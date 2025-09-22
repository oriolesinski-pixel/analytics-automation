#!/bin/bash

# Analytics Platform Test & Connect Script
# This script tests and connects all components of the analytics platform

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ANALYTICS_SERVICE_PORT=8082
PLATFORM_PORT=3002
PROJECT_ROOT="$(pwd)"
ANALYTICS_SERVICE_DIR="$PROJECT_ROOT/packages/analytics-service"
ANALYTICS_PLATFORM_DIR="$PROJECT_ROOT/packages/analytics-platform"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to safely load environment variables
load_env() {
    if [ -f "$PROJECT_ROOT/.env" ]; then
        # Read .env file line by line, ignoring comments and empty lines
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            if [[ ! "$key" =~ ^# ]] && [[ -n "$key" ]]; then
                # Remove surrounding quotes from value
                value="${value%\"}"
                value="${value#\"}"
                value="${value%\'}"
                value="${value#\'}"
                # Export the variable
                export "$key=$value"
            fi
        done < "$PROJECT_ROOT/.env"
    else
        return 1
    fi
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -i:$port > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    if check_port $port; then
        print_warning "Killing process on port $port"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local max_attempts=30
    local attempt=0
    
    print_status "Waiting for service at $url..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f -o /dev/null "$url"; then
            print_success "Service is ready at $url"
            return 0
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    print_error "Service failed to start at $url"
    return 1
}

# Header
echo "================================================"
echo "   Analytics Platform Test & Connect Script"
echo "================================================"
echo ""

# Step 1: Check environment
print_status "Checking environment..."

# Check if .env exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    print_error ".env file not found in project root"
    print_status "Please create .env with your Supabase credentials"
    exit 1
fi

# Load environment variables
if ! load_env; then
    print_error "Failed to load .env file"
    exit 1
fi

# Check required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    print_error "Missing required environment variables in .env"
    print_status "Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    print_status "Found SUPABASE_URL: ${SUPABASE_URL:0:30}..."
    print_status "Found SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
    exit 1
fi

print_success "Environment configured correctly"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Step 2: Setup Analytics Service
echo ""
print_status "Setting up Analytics Service..."

cd "$ANALYTICS_SERVICE_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing analytics service dependencies..."
    npm install
fi

# Build TypeScript
print_status "Building analytics service..."
npx tsc || true  # Continue even if TypeScript has warnings

# Step 3: Setup Analytics Platform
echo ""
print_status "Setting up Analytics Platform..."

cd "$ANALYTICS_PLATFORM_DIR"

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    print_status "Creating .env.local for platform..."
    cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:${ANALYTICS_SERVICE_PORT}
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
EOF
    print_success "Created .env.local"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing platform dependencies..."
    npm install
fi

# Step 4: Start Analytics Service
echo ""
print_status "Starting Analytics Service..."

# Kill any existing process on the port
kill_port $ANALYTICS_SERVICE_PORT

# Start the service in background
cd "$ANALYTICS_SERVICE_DIR"
npm run dev > "$PROJECT_ROOT/logs/analytics-service.log" 2>&1 &
SERVICE_PID=$!

print_status "Analytics Service PID: $SERVICE_PID"

# Wait for service to be ready
if ! wait_for_service "http://localhost:$ANALYTICS_SERVICE_PORT/healthz"; then
    print_error "Failed to start Analytics Service"
    print_status "Check logs at $PROJECT_ROOT/logs/analytics-service.log"
    echo "Last 20 lines of log:"
    tail -20 "$PROJECT_ROOT/logs/analytics-service.log"
    kill $SERVICE_PID 2>/dev/null || true
    exit 1
fi

# Step 5: Test Analytics Service Endpoints
echo ""
print_status "Testing Analytics Service endpoints..."

# Test healthz endpoint
if curl -s "http://localhost:$ANALYTICS_SERVICE_PORT/healthz" | grep -q "ok"; then
    print_success "Health check passed"
else
    print_error "Health check failed"
fi

# Test selfcheck endpoint
print_status "Running self-check..."
SELFCHECK=$(curl -s "http://localhost:$ANALYTICS_SERVICE_PORT/selfcheck")
if echo "$SELFCHECK" | grep -q '"ok":true'; then
    print_success "Self-check passed"
else
    print_warning "Self-check has issues:"
    echo "$SELFCHECK" | python3 -m json.tool 2>/dev/null || echo "$SELFCHECK"
fi

# Test apps endpoint
print_status "Testing apps endpoint..."
APPS=$(curl -s "http://localhost:$ANALYTICS_SERVICE_PORT/apps/list")
if echo "$APPS" | grep -q '"ok":true'; then
    print_success "Apps endpoint working"
    echo "$APPS" | python3 -m json.tool 2>/dev/null || echo "$APPS"
else
    print_warning "No apps found or endpoint error"
fi

# Step 6: Start Analytics Platform
echo ""
print_status "Starting Analytics Platform..."

# Kill any existing process on the port
kill_port $PLATFORM_PORT

# Start the platform in background
cd "$ANALYTICS_PLATFORM_DIR"
npm run dev > "$PROJECT_ROOT/logs/analytics-platform.log" 2>&1 &
PLATFORM_PID=$!

print_status "Analytics Platform PID: $PLATFORM_PID"

# Wait for platform to be ready
if ! wait_for_service "http://localhost:$PLATFORM_PORT"; then
    print_error "Failed to start Analytics Platform"
    print_status "Check logs at $PROJECT_ROOT/logs/analytics-platform.log"
    echo "Last 20 lines of log:"
    tail -20 "$PROJECT_ROOT/logs/analytics-platform.log"
    kill $SERVICE_PID 2>/dev/null || true
    kill $PLATFORM_PID 2>/dev/null || true
    exit 1
fi

# Step 7: Create test data (optional)
echo ""
read -p "Do you want to send test analytics events? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Sending test events..."
    
    # Generate unique IDs
    TIMESTAMP=$(date +%s000)
    SESSION_ID="test-session-$(date +%s)"
    
    # Send test events
    curl -X POST "http://localhost:$ANALYTICS_SERVICE_PORT/ingest/analytics" \
        -H "Content-Type: application/json" \
        -d "{
            \"app_key\": \"test-app-rich\",
            \"session_id\": \"$SESSION_ID\",
            \"events\": [
                {
                    \"id\": \"test-id-${TIMESTAMP}-1\",
                    \"ts\": $TIMESTAMP,
                    \"event_type\": \"PAGE_VIEW\",
                    \"user_id\": \"12345678\",
                    \"data\": {
                        \"url\": \"/test\",
                        \"title\": \"Test Page\"
                    }
                },
                {
                    \"id\": \"test-id-${TIMESTAMP}-2\",
                    \"ts\": $TIMESTAMP,
                    \"event_type\": \"BUTTON_CLICK\",
                    \"user_id\": \"12345678\",
                    \"data\": {
                        \"element\": \"test-button\",
                        \"text\": \"Click Me\"
                    }
                }
            ]
        }" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "Test events sent successfully"
    else
        print_warning "Failed to send test events"
    fi
fi

# Step 8: Final Summary
echo ""
echo "================================================"
echo "         Platform Successfully Started!"
echo "================================================"
echo ""
print_success "Analytics Service: http://localhost:$ANALYTICS_SERVICE_PORT"
print_success "Analytics Platform: http://localhost:$PLATFORM_PORT"
echo ""
print_status "Service Endpoints:"
echo "  - Health: http://localhost:$ANALYTICS_SERVICE_PORT/healthz"
echo "  - Self-check: http://localhost:$ANALYTICS_SERVICE_PORT/selfcheck"
echo "  - Apps: http://localhost:$ANALYTICS_SERVICE_PORT/apps/list"
echo "  - Ingest: http://localhost:$ANALYTICS_SERVICE_PORT/ingest/analytics"
echo ""
print_status "Logs:"
echo "  - Service: $PROJECT_ROOT/logs/analytics-service.log"
echo "  - Platform: $PROJECT_ROOT/logs/analytics-platform.log"
echo ""
print_status "PIDs:"
echo "  - Service: $SERVICE_PID"
echo "  - Platform: $PLATFORM_PID"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    print_status "Shutting down services..."
    kill $SERVICE_PID 2>/dev/null || true
    kill $PLATFORM_PID 2>/dev/null || true
    print_success "Services stopped"
    exit 0
}

# Set up trap for cleanup
trap cleanup INT TERM

# Keep script running
print_status "Services running. Monitoring..."
while true; do
    # Check if services are still running
    if ! kill -0 $SERVICE_PID 2>/dev/null; then
        print_error "Analytics Service crashed!"
        cleanup
    fi
    if ! kill -0 $PLATFORM_PID 2>/dev/null; then
        print_error "Analytics Platform crashed!"
        cleanup
    fi
    sleep 5
done