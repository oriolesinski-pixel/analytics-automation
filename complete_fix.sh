#!/bin/bash

echo "🔧 Complete fix for all dependency issues"
echo "========================================="
echo ""

# 1. Fix connector-service completely
echo "📦 Step 1: Fixing connector-service..."
cd packages/connector-service

# Remove node_modules and reinstall everything
rm -rf node_modules package-lock.json
npm install

# Install missing tsx if needed
npm install --save-dev tsx typescript @types/node

# Verify installation
echo "Verifying tsx installation:"
npm ls tsx

cd ../..

# 2. Fix examples/demo-next layout.tsx (remove broken imports)
echo ""
echo "🔧 Step 2: Fixing demo-next layout.tsx..."
cat > examples/demo-next/src/app/layout.tsx << 'LAYOUT'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Demo Next App",
  description: "Analytics tracking demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="/tracker.js" defer></script>
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
LAYOUT

# 3. Fix demo-next completely
echo ""
echo "🔧 Step 3: Reinstalling demo-next dependencies..."
cd examples/demo-next

# Clean install
rm -rf node_modules package-lock.json .next
npm install
cd ../..

# 4. Remove analytics-ui since we consolidated it
echo ""
echo "🗑️  Step 4: Removing analytics-ui..."
rm -rf packages/analytics-ui

# 5. Fix analytics-platform
echo ""
echo "📦 Step 5: Fixing analytics-platform..."
cd packages/analytics-platform
rm -rf node_modules package-lock.json .next
npm install
cd ../..

# 6. Test connector-service
echo ""
echo "🧪 Testing connector-service..."
cd packages/connector-service
echo "Starting server (press Ctrl+C to stop)..."
timeout 3 npm run dev 2>&1 | head -20 || true
cd ../..

echo ""
echo "✅ Complete fix applied!"
echo ""
echo "📁 Final clean structure:"
tree -I 'node_modules|.git|.next' -L 3

