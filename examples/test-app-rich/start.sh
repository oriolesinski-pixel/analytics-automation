#!/bin/bash
echo "🚀 Starting TestShop..."
echo "Backend on :3002, Frontend on :3000"
(cd backend && npm run dev) &
npm run dev
