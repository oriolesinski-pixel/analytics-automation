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
