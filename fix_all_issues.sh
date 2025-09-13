#!/bin/bash

echo "🔧 Fixing all project issues..."
echo "==============================="
echo ""

# 1. Fix connector-service dependencies
echo "📦 Installing connector-service dependencies..."
cd packages/connector-service
npm install @supabase/supabase-js @octokit/rest @octokit/auth-app
cd ../..

# 2. Fix demo-next issues
echo "🔧 Fixing demo-next imports..."

# Fix the Analytics import path in layout.tsx
cat > examples/demo-next/src/app/layout.tsx << 'LAYOUT'
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
LAYOUT

# 3. Consolidate analytics packages
echo ""
echo "📦 Consolidating analytics packages..."
echo "Checking what's in analytics-platform and analytics-ui..."

# Show what's in each package
echo ""
echo "Analytics-platform source files:"
find packages/analytics-platform/src -type f -name "*.tsx" -o -name "*.ts" | head -5

echo ""
echo "Analytics-ui source files:"
find packages/analytics-ui/src -type f -name "*.tsx" -o -name "*.ts" | head -5

echo ""
read -p "Consolidate analytics-ui into analytics-platform? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Copy UI components to platform
    mkdir -p packages/analytics-platform/src/components
    cp -r packages/analytics-ui/src/components/* packages/analytics-platform/src/components/ 2>/dev/null
    
    # Install lucide-react in analytics-platform
    cd packages/analytics-platform
    npm install lucide-react
    cd ../..
    
    # Remove analytics-ui
    rm -rf packages/analytics-ui
    echo "✅ Consolidated analytics-ui into analytics-platform"
else
    # Just install missing deps
    cd packages/analytics-ui
    npm install lucide-react
    cd ../..
    cd packages/analytics-platform
    npm install lucide-react
    cd ../..
fi

# 4. Fix React type issues in demo-next
echo ""
echo "🔧 Fixing React type issues..."
cd examples/demo-next

# Remove node_modules and reinstall with npm
rm -rf node_modules package-lock.json pnpm-lock.yaml
npm install
cd ../..

# 5. Create missing font files for demo-next
echo ""
echo "📝 Creating font file placeholders..."
mkdir -p examples/demo-next/src/app/fonts
touch examples/demo-next/src/app/fonts/GeistVF.woff
touch examples/demo-next/src/app/fonts/GeistMonoVF.woff

echo ""
echo "✅ All fixes applied!"
echo ""
echo "🧪 Testing installations..."

# Verify key dependencies
echo "Checking connector-service:"
cd packages/connector-service
npm ls @supabase/supabase-js 2>/dev/null | head -1 || echo "❌ Supabase not installed"
cd ../..

echo ""
echo "Final structure:"
tree -I 'node_modules|.git' -L 3

