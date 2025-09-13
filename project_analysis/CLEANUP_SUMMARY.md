# Project Structure Analysis Report
Generated: $(date)

## 📊 Project Statistics

| Metric | Count |
|--------|-------|
| Total source files | $(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -not -path "*/node_modules/*" -not -path "*/.git/*" | wc -l) |
| Total packages | $(find . -name "package.json" -not -path "*/node_modules/*" | wc -l) |
| Analyzer-related files | $(find . -iname "*analyz*" -not -path "*/node_modules/*" | wc -l) |
| Tracker-related files | $(find . -iname "*track*" -not -path "*/node_modules/*" | wc -l) |
| Server/API files | $(find . \( -iname "*server*" -o -iname "*api*" \) -not -path "*/node_modules/*" | wc -l) |
| Config files | $(find . \( -name "*.config.*" -o -name "*rc*" \) -not -path "*/node_modules/*" | wc -l) |
| TODO/FIXME comments | $(grep -r "TODO\|FIXME" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules . 2>/dev/null | wc -l) |

## 📁 Root Level Directories
$(ls -d */ 2>/dev/null | grep -v node_modules | sed 's/^/- /')

## 📦 Packages Directory Contents
$(ls -d packages/*/ 2>/dev/null | sed 's/^/- /' || echo "No packages found")

## 🔍 Potential Cleanup Targets

### Duplicate Analyzer Files
$(find . -iname "*analyz*" -not -path "*/node_modules/*" | wc -l) files found

### Duplicate Tracker Files  
$(find . -iname "*track*" -not -path "*/node_modules/*" | wc -l) files found

### Multiple Server/API Files
$(find . \( -iname "*server*" -o -iname "*api*" \) -not -path "*/node_modules/*" | wc -l) files found

## 🎯 Key Working Components (DO NOT DELETE)
- packages/connector-service/src/lib/tracker-generator.ts ✅
- packages/connector-service/src/server.ts ✅
- HANDOFF_CURRENT_STATE.md ✅

