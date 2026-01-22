# App Deduplication Guide

## Problem

When analyzing repositories multiple times, the system was creating duplicate app entries in the database. This resulted in multiple "demo-test-apps" entries cluttering the dashboard.

## Solution

We've implemented two fixes:

### 1. Cleanup Script

A cleanup script that removes duplicate app entries, keeping only the most recent one for each repository.

**Location:** `/scripts/cleanup-duplicate-apps.sh` (or `.ts` for direct execution)

**How it works:**
- Groups apps by `github_repo` or `name`
- Keeps the most recently created app in each group
- Deletes all older duplicates
- Provides a summary of deletions

**Usage:**

```bash
# From project root
./scripts/cleanup-duplicate-apps.sh
```

Or run the TypeScript version directly:

```bash
# Make sure you're in the project root
cd /path/to/main-project-repo

# Run with ts-node
ts-node scripts/cleanup-duplicate-apps.ts
```

**Requirements:**
- Supabase credentials in environment variables or `.env` file
- The script automatically looks in these locations:
  - `.env.local`
  - `.env`
  - `analytics-automation/packages/analytics-service/.env`
  - `analytics-automation/packages/analytics-generator/.env`

### 2. Deduplication Logic in `/apps/register`

The `/apps/register` endpoint now checks for existing apps using a cascade approach:

**Matching Priority:**
1. **GitHub Repo** (Primary): Checks if an app with the same `github_repo` exists
2. **Repo ID** (Secondary): Falls back to matching by `repo_id`
3. **App Key** (Fallback): Finally checks by `app_key`

If a match is found, the app is **updated** instead of creating a new entry.

**Updated Files:**
- `analytics-automation/packages/analytics-service/src/routes/apps.ts`
- `analytics-automation/packages/analytics-platform/src/app/api/analyze/route.ts`
- `analytics-automation/packages/analytics-platform/src/app/onboarding/analyze/route.ts`

## How It Works

### Before Fix
```
User analyzes "demo-test-apps" → Creates app with key "demo-test-apps-2025-10-08-abc123"
User analyzes "demo-test-apps" again → Creates NEW app "demo-test-apps-2025-10-08-xyz789"
Result: Multiple duplicate entries
```

### After Fix
```
User analyzes "demo-test-apps" → Creates app with key "demo-test-apps-2025-10-08-abc123"
User analyzes "demo-test-apps" again → Finds existing app by github_repo → UPDATES existing app
Result: Single entry, updated with latest analysis
```

## Testing

### Test the Deduplication

1. Start your services:
   ```bash
   cd analytics-automation
   ./start.sh
   ```

2. Analyze a repository twice through the dashboard (localhost:3002)

3. Check the database - you should see only ONE app entry for that repository, with the most recent `updated_at` timestamp

### Clean Up Existing Duplicates

1. Run the cleanup script:
   ```bash
   ./scripts/cleanup-duplicate-apps.sh
   ```

2. Review the output to see what was deleted

3. Check your dashboard - duplicates should be gone!

## Database Schema

The app deduplication relies on these fields in the `apps` table:

```sql
CREATE TABLE apps (
  id UUID PRIMARY KEY,
  app_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  domain TEXT,
  repo_id UUID REFERENCES repos(id),
  github_repo TEXT,  -- Format: "owner/repo"
  setup_status TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Key Fields for Deduplication:**
- `github_repo`: The primary identifier (e.g., "oriolesinski/demo-test-apps")
- `repo_id`: Secondary identifier (UUID reference to repos table)
- `app_key`: Fallback identifier (includes timestamp and random ID)

## Future Improvements

Consider adding:
1. A database constraint to prevent duplicate `github_repo` entries
2. An admin UI for manually merging/deleting apps
3. Automatic cleanup as part of the deployment process
4. Event tracking to link old app_keys to the updated one

## Troubleshooting

### "Missing Supabase credentials"
Make sure you have a `.env` file with:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### "ts-node not found"
Install it:
```bash
npm install -g ts-node
```

Or use the project's local version:
```bash
npx ts-node scripts/cleanup-duplicate-apps.ts
```

### Apps still duplicating
1. Make sure the analytics-service is restarted after the code changes
2. Check that `github_repo` is being passed in the analyze request
3. Verify the logs show "Found existing app by github_repo"

## Summary

✅ **Cleanup script** removes existing duplicates  
✅ **Deduplication logic** prevents future duplicates  
✅ **GitHub repo matching** ensures same repo = same app  
✅ **Update instead of insert** when app exists  

Your dashboard should now stay clean with one app per repository! 🎉

