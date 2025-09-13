#!/bin/bash

echo "🧹 Smart Cleanup - Preserving all debug/test files"
echo "==================================================="
echo ""

# Counter for actions
removed_count=0
kept_count=0

# 1. Remove only truly unnecessary files
echo "📄 Step 1: Removing unnecessary root files..."
for file in "eval \$(ssh-agent -s)" "eval \$(ssh-agent -s).pub" "openai_response.txt" "adaptive_response.json" "bump.txt"; do
    if [ -f "$file" ]; then
        rm -f "$file"
        echo "  ❌ Removed: $file"
        ((removed_count++))
    fi
done

# 2. Remove .DS_Store files (Mac metadata)
echo ""
echo "🗑️  Step 2: Removing .DS_Store files..."
ds_count=$(find . -name ".DS_Store" -type f | wc -l)
if [ $ds_count -gt 0 ]; then
    find . -name ".DS_Store" -type f -delete
    echo "  ❌ Removed $ds_count .DS_Store files"
    removed_count=$((removed_count + ds_count))
fi

# 3. Clean truly empty packages
echo ""
echo "📦 Step 3: Checking packages..."

# Check analyzer-core (appears to be empty)
if [ -d "packages/analyzer-core" ]; then
    file_count=$(find packages/analyzer-core -type f -not -name "*.lock" -not -name ".DS_Store" | wc -l)
    if [ $file_count -eq 0 ]; then
        echo "  ℹ️  analyzer-core appears empty (only lock files)"
        read -p "  Remove packages/analyzer-core? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf packages/analyzer-core
            echo "  ❌ Removed: packages/analyzer-core"
            ((removed_count++))
        else
            echo "  ✅ Kept: packages/analyzer-core"
            ((kept_count++))
        fi
    fi
fi

# 4. Organize demo-next
echo ""
echo "📁 Step 4: Organizing demo-next..."
if [ -d "demo-next" ]; then
    mkdir -p examples
    mv demo-next examples/
    echo "  ✅ Moved demo-next → examples/demo-next"
fi

# 5. Clean build artifacts only
echo ""
echo "🏗️  Step 5: Cleaning build artifacts..."
next_count=$(find . -name ".next" -type d 2>/dev/null | wc -l)
if [ $next_count -gt 0 ]; then
    find . -name ".next" -type d -exec rm -rf {} + 2>/dev/null
    echo "  ❌ Removed $next_count .next directories"
    removed_count=$((removed_count + next_count))
fi

# Clean other build directories
for dir in "dist" "build" "out"; do
    dir_count=$(find . -name "$dir" -type d 2>/dev/null | wc -l)
    if [ $dir_count -gt 0 ]; then
        find . -name "$dir" -type d -exec rm -rf {} + 2>/dev/null
        echo "  ❌ Removed $dir_count $dir directories"
        removed_count=$((removed_count + dir_count))
    fi
done

# 6. Remove only truly temporary directories
echo ""
echo "🗃️  Step 6: Cleaning temporary directories..."
if [ -d "packages/connector-service/.analytics" ]; then
    rm -rf packages/connector-service/.analytics
    echo "  ❌ Removed: .analytics temp directory"
    ((removed_count++))
fi

if [ -d "supabase/.temp" ]; then
    rm -rf supabase/.temp
    echo "  ❌ Removed: supabase/.temp"
    ((removed_count++))
fi

# 7. Clean up duplicate lock files (keep package-lock.json as standard)
echo ""
echo "🔒 Step 7: Standardizing lock files..."
pnpm_count=$(find . -name "pnpm-lock.yaml" -not -path "*/node_modules/*" | wc -l)
yarn_count=$(find . -name "yarn.lock" -not -path "*/node_modules/*" | wc -l)

if [ $pnpm_count -gt 0 ] || [ $yarn_count -gt 0 ]; then
    echo "  Found: $pnpm_count pnpm-lock.yaml, $yarn_count yarn.lock files"
    read -p "  Standardize on package-lock.json? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        find . -name "pnpm-lock.yaml" -not -path "*/node_modules/*" -delete
        find . -name "yarn.lock" -not -path "*/node_modules/*" -delete
        echo "  ✅ Standardized on package-lock.json"
        removed_count=$((removed_count + pnpm_count + yarn_count))
    fi
fi

# 8. Explicitly preserve important files
echo ""
echo "✅ Step 8: Verified preservation of important files:"
important_files=(
    "packages/connector-service/src/selfcheck.ts"
    "packages/connector-service/selfcheck.ts"
    "packages/connector-service/src/debug_tracker_generation.js"
    "packages/connector-service/payload.json"
    "packages/connector-service/package.json.bak"
    "packages/connector-service/src/lib/tracker-generator.ts"
    "packages/connector-service/src/server.ts"
    "HANDOFF_CURRENT_STATE.md"
)

for file in "${important_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ Preserved: $file"
        ((kept_count++))
    fi
done

# 9. Remove analysis scripts (they can be recreated)
echo ""
echo "🧹 Step 9: Cleaning up analysis scripts..."
if [ -f "analyze_project.sh" ]; then
    rm -f analyze_project.sh
    echo "  ❌ Removed: analyze_project.sh"
    ((removed_count++))
fi

if [ -d "project_analysis" ]; then
    read -p "  Remove project_analysis directory? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf project_analysis
        echo "  ❌ Removed: project_analysis/"
        ((removed_count++))
    fi
fi

# 10. Update .gitignore
echo ""
echo "📝 Step 10: Updating .gitignore..."
if ! grep -q ".DS_Store" .gitignore 2>/dev/null; then
    cat >> .gitignore << 'GITIGNORE'

# OS Files
.DS_Store
Thumbs.db

# Build outputs
dist/
build/
.next/
out/

# Temporary files
*.tmp
*.temp
.temp/
.analytics/

# Generated outputs
generated-outputs/
parsed-results/

# Debug logs (uncomment if you want to ignore them)
# debug-logs/
# *.log

# Analysis outputs
project_analysis/
GITIGNORE
    echo "  ✅ Updated .gitignore"
fi

# Final summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Cleanup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo "  • Removed: $removed_count items"
echo "  • Preserved: $kept_count important files"
echo ""
echo "📁 New structure:"
tree -I 'node_modules|.git' -L 2

echo ""
echo "🎯 Next steps:"
echo "1. Review packages/analytics-platform and packages/analytics-ui"
echo "2. Run 'npm install' in packages/connector-service"
echo "3. Test the connector service: npm run dev"
echo "4. Commit changes: git add -A && git commit -m 'chore: smart cleanup preserving debug/test files'"
