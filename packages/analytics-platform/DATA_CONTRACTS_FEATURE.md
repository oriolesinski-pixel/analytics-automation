# Data Contracts / Schema Editor Feature

## Overview

This feature provides a visual UI graph-based interface for **editing and enriching AI-generated analytics schemas**. Users can:

- **Review AI-detected events** from codebase analysis
- **Transform raw values** into business-friendly names (e.g., `/products/1` → `iPhone 16`)
- **Rename fields** to match business terminology (e.g., `path` → `page_name`)
- **Add value mappings** for classification and enrichment
- **Deploy schema changes** through an integrated PR workflow

**Key Principle**: You can only edit what the AI already generated - not create new tracking from scratch. The AI detects events, triggers, and extraction logic from your codebase. You add the business context.

## Features

### ✅ Implemented Components

#### 1. **Navigation**
- Added "Data Contracts" sidebar item with BookOpen icon
- Location: `/data-contracts`

#### 2. **Main Page** (`/data-contracts/page.tsx`)
- Three-view flow:
  - UI Graph View (default)
  - Page Events View (when page clicked)
  - Event Editor Modal (when edit clicked)
- Displays schema version and last updated timestamp
- Sync from repo functionality

#### 3. **UI Graph View**
- Reuses `UIGraphWithTraffic` component from onboarding
- Annotates nodes with event counts
- Static mode (no heat map)
- Click any page to drill into events

#### 4. **Page Events View** (`PageEventsView.tsx`)
- Shows all events tracked on a specific page
- Event cards with:
  - Event name and frequency
  - Trigger description
  - Field list with extraction logic
  - Sample values
  - Recent events accordion
- Test and Edit buttons for each event
- Add new event functionality

#### 5. **Event Editor Modal** (`EventEditorModal.tsx`)
**AI-Generated Schema Editor** - Transform and enrich auto-detected events:

- **Read-only trigger info** - Shows AI-detected trigger (can't modify)
- **Read-only extraction logic** - Shows how data is captured (AI-generated)
- **Field renaming** - Change field names (e.g., `path` → `page_name`)
- **Value mappings** - Transform raw values:
  - Example: `/products/1` → `iPhone 16`
  - Example: `prod_123` → `iPhone 16 Pro`
- **Enrichment rules** - Add advanced transformations (lookup tables, regex, API calls)
- **Breaking change detection** - Warns about affected dashboards
- **Sample values display** - See real data being captured

**You cannot**: Add new fields without AI detection, modify extraction logic, or create events from scratch

#### 6. **Preview Changes Modal** (`PreviewChangesModal.tsx`)
- Summary of changes (added/modified fields)
- Impact analysis (events/day, dashboards affected)
- Files to be changed list
- Code diff tabs:
  - tracker.js diff (color-coded)
  - schema.json diff
- Create PR button

#### 7. **Create PR Modal** (`CreatePRModal.tsx`)
- Repository display
- Editable PR title
- Auto-generated description (editable)
- Reviewers input
- Post-PR actions:
  - Run validation checks
  - Auto-merge if CI passes

#### 8. **PR Review Page** (`/data-contracts/pr/[prNumber]/page.tsx`)
- **IN-PLATFORM** PR review (no GitHub navigation needed)
- Real-time status updates via WebSocket
- Three tabs:
  - **Overview**: PR description
  - **Files Changed**: Diff view with syntax highlighting
  - **Checks**: CI/CD status with icons
- Merge actions:
  - Close PR
  - Approve & Merge (with validation)
- View on GitHub link (optional)

#### 9. **Merge Confirmation Modal** (`MergeConfirmationModal.tsx`)
- Merge strategy selection:
  - Squash and merge (recommended)
  - Create merge commit
- Editable commit message
- Deployment time estimate
- Confirm merge button

#### 10. **Deployment Monitor Modal** (`DeploymentMonitorModal.tsx`)
- Real-time deployment progress
- Step-by-step status:
  - Merge Pull Request
  - Build Tracker
  - Deploy to CDN
  - Verify First Event
- Event monitoring:
  - Old tracker version events
  - New tracker version events
- Success/failure alerts
- First event detection timestamp

## Technical Architecture

### State Management

**Store**: `useDataContractsStore` (Zustand)
- Navigation state (selectedPageId)
- Event editing state
- Preview state
- PR state
- Merge state
- Deployment state
- Schema info
- Test state

### API Endpoints

All endpoints follow the pattern: `/api/apps/[appKey]/...`

1. **GET** `/ui-graph` - Fetch UI graph with event annotations
2. **GET** `/pages/[pageId]/events` - Get events for a specific page
3. **PUT** `/events/[eventId]` - Update event definition
4. **POST** `/pull-requests` - Create PR
5. **GET** `/pull-requests/[prNumber]` - Get PR details
6. **POST** `/pull-requests/[prNumber]/merge` - Merge PR
7. **GET** `/deployments/[deploymentId]` - Monitor deployment (polling)

### Real-time Updates

- **WebSocket** for PR status updates
- **Polling** (3s interval) for deployment progress
- Event monitoring during deployment

## UI Components Used

### shadcn/ui Components
- Button
- Card
- Badge
- Dialog
- Input
- Label
- Textarea
- Alert
- Accordion
- Tabs
- Progress
- RadioGroup
- Checkbox

### Custom Components
- UIGraphWithTraffic (reused from onboarding)
- All data-contracts components

## Styling

- **Design System**: Consistent with existing platform
- **Color Coding**:
  - Green: additions (+)
  - Red: deletions (-)
  - Yellow: modifications (~)
- **Loading States**: Spinners and skeleton loaders
- **Toast Notifications**: Success/error feedback
- **Dark Mode**: Full support

## User Flow

1. **View AI-Generated Schema**
   - Navigate to "Data Contracts" in sidebar
   - See UI graph with event count badges
   - View AI-detected events per page
   
2. **Transform Event Data**
   - Click page node → View AI-generated events
   - Click "Edit" on event → See extraction logic (read-only)
   - **Rename fields** for business terminology
   - **Add value mappings** (e.g., `/products/1` → `iPhone 16`)
   - **Add enrichment rules** for advanced transformations
   
3. **Preview Transformations**
   - Review transformation pipeline code
   - See impact (dashboards affected, event volume)
   - See example of transformed data
   - Click "Create PR"
   
4. **Create PR**
   - Auto-generated title/description
   - Add reviewers
   - Enable auto-merge if desired
   - Submit
   
5. **Review PR (In-Platform)**
   - View overview, files, checks
   - Wait for CI/CD to pass
   - Click "Approve & Merge"
   
6. **Merge & Deploy**
   - Select merge strategy
   - Confirm merge
   - Watch deployment progress
   - See first event confirmation
   
7. **Success!**
   - Schema changes are live
   - Return to data contracts view

## Key Requirements Met

✅ Reuse UIGraph component from onboarding  
✅ Show event counts as badges on graph nodes  
✅ ALL PR operations happen in platform (no GitHub navigation)  
✅ Real-time CI/CD status updates via WebSocket  
✅ In-platform merge button (one-click)  
✅ Deployment monitoring with step-by-step progress  
✅ First event detection to confirm deployment success  

## Example Transformations

### Example 1: Page URLs → Page Names
**AI Detected:**
```javascript
path: window.location.pathname
// Values: /products/1, /products/2, /cart
```

**User Transforms:**
```javascript
// Rename field
path → page_name

// Add mappings
/products/1 → iPhone 16
/products/2 → iPhone 16 Pro
/cart → Shopping Cart
```

### Example 2: Product IDs → Product Names
**AI Detected:**
```javascript
product_id: element.dataset.productId
// Values: prod_123, prod_456, prod_789
```

**User Transforms:**
```javascript
// Rename field
product_id → product_name

// Add enrichment
enrichment: lookup(product_catalog, product_id)
// This would query a product catalog to get names
```

### Example 3: Payment Methods → Human-Readable
**AI Detected:**
```javascript
payment_method: element.value
// Values: credit_card, paypal, apple_pay
```

**User Transforms:**
```javascript
// Add mappings (no rename needed)
credit_card → Credit Card
paypal → PayPal
apple_pay → Apple Pay
```

## Future Enhancements

- [ ] Lookup table management UI
- [ ] Test transformations with real event data
- [ ] Bulk value mapping import (CSV)
- [ ] AI-suggested transformations
- [ ] Field validation rules
- [ ] Transformation history/rollback
- [ ] A/B test different transformations
- [ ] Real-time transformation preview
- [ ] Export/import transformation configs

## Files Created

### Components
- `/src/app/data-contracts/page.tsx`
- `/src/app/data-contracts/pr/[prNumber]/page.tsx`
- `/src/components/data-contracts/PageEventsView.tsx`
- `/src/components/data-contracts/EventEditorModal.tsx`
- `/src/components/data-contracts/PreviewChangesModal.tsx`
- `/src/components/data-contracts/CreatePRModal.tsx`
- `/src/components/data-contracts/MergeConfirmationModal.tsx`
- `/src/components/data-contracts/DeploymentMonitorModal.tsx`

### State Management
- `/src/lib/useDataContractsStore.ts`

### API Routes
- `/src/app/api/apps/[appKey]/ui-graph/route.ts`
- `/src/app/api/apps/[appKey]/pages/[pageId]/events/route.ts`
- `/src/app/api/apps/[appKey]/events/[eventId]/route.ts`
- `/src/app/api/apps/[appKey]/pull-requests/route.ts`
- `/src/app/api/apps/[appKey]/pull-requests/[prNumber]/route.ts`
- `/src/app/api/apps/[appKey]/pull-requests/[prNumber]/merge/route.ts`
- `/src/app/api/apps/[appKey]/deployments/[deploymentId]/route.ts`

### UI Components
- `/src/components/ui/progress.tsx`
- `/src/components/ui/use-toast.ts`

### Modified Files
- `/src/components/Sidebar.tsx` - Added Data Contracts navigation item

## Getting Started

1. **Navigate to Data Contracts**
   ```
   http://localhost:3002/data-contracts
   ```

2. **Ensure App is Selected**
   - App key should be in localStorage/sessionStorage
   - If not, redirects to onboarding

3. **Start Editing**
   - Click any page node in the UI graph
   - Edit events, create PRs, merge changes!

## Notes

- Currently uses **mock data** for API responses
- WebSocket connections are stubbed (needs backend)
- Deployment monitoring simulates progress
- Ready for backend integration

---

**Status**: ✅ All components implemented and ready for testing!

