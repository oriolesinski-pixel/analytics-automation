#!/bin/bash

echo "🔧 Fixing remaining cleanup issues..."
echo "====================================="
echo ""

# 1. Fix demo-next duplication
echo "📁 Checking demo-next directories..."
if [ -d "demo-next" ] && [ -d "examples/demo-next" ]; then
    echo "Found demo-next in both root and examples/"
    
    # Check if root demo-next is empty or just has hidden files
    root_files=$(find demo-next -type f -not -path "*/\.*" 2>/dev/null | wc -l)
    examples_files=$(find examples/demo-next -type f -not -path "*/\.*" 2>/dev/null | wc -l)
    
    echo "  Root demo-next has $root_files files"
    echo "  Examples/demo-next has $examples_files files"
    
    if [ $examples_files -gt 0 ] && [ $root_files -eq 0 ]; then
        # Examples has content, root is empty - remove root
        rm -rf demo-next
        echo "  ✅ Removed empty root demo-next"
    elif [ $root_files -gt 0 ] && [ $examples_files -eq 0 ]; then
        # Root has content, examples is empty - move properly
        rm -rf examples/demo-next
        mv demo-next examples/
        echo "  ✅ Moved demo-next to examples/"
    else
        # Both have content - need manual intervention
        echo "  ⚠️  Both directories have content. Manual merge needed."
        echo "  Suggestion: Keep examples/demo-next, remove root demo-next"
        read -p "  Remove root demo-next? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf demo-next
            echo "  ✅ Removed root demo-next"
        fi
    fi
elif [ -d "demo-next" ]; then
    # Only root exists, move it
    mkdir -p examples
    mv demo-next examples/
    echo "  ✅ Moved demo-next to examples/"
fi

# 2. Remove SSH agent files (these shouldn't be in repo)
echo ""
echo "🔑 Removing SSH agent files..."
if [ -f 'eval "$(ssh-agent -s)"' ] || [ -f 'eval "$(ssh-agent -s)".pub' ]; then
    rm -f 'eval "$(ssh-agent -s)"' 'eval "$(ssh-agent -s)".pub'
    echo "  ✅ Removed SSH agent files"
fi

# 3. Check if analytics-platform and analytics-ui are worth keeping
echo ""
echo "📦 Checking analytics packages..."

for pkg in "analytics-platform" "analytics-ui"; do
    if [ -d "packages/$pkg" ]; then
        # Count actual source files (not just config)
        src_files=$(find "packages/$pkg/src" -type f 2>/dev/null | wc -l)
        echo ""
        echo "  Package: $pkg"
        echo "  Source files in src/: $src_files"
        
        if [ $src_files -le 2 ]; then
            echo "  ⚠️  This package appears nearly empty"
            read -p "  Remove packages/$pkg? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rm -rf "packages/$pkg"
                echo "  ✅ Removed packages/$pkg"
            fi
        else
            echo "  ℹ️  Package has content, keeping it"
        fi
    fi
done

# 4. Final structure
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Final cleanup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Clean structure:"
tree -I 'node_modules|.git' -L 3

echo ""
echo "🎯 Verify core files still exist:"
for file in \
    "packages/connector-service/src/lib/tracker-generator.ts" \
    "packages/connector-service/src/server.ts" \
    "HANDOFF_CURRENT_STATE.md"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ MISSING: $file"
    fi
done
