# Analytics Integration Guide for test-generation

## Quick Start

### 1. Add tracker to your HTML
```html
<script src="/tracker.js"></script>
```

### 2. Add Analytics Provider (React/Next.js)
```tsx
import { AnalyticsProvider } from './analytics-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AnalyticsProvider userId={currentUser?.id}>
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
```

### 3. Track Events

#### Available Events (2 total)
- **page_view**: page_url
- **interaction**: element_type, action

#### Examples
```javascript
window.analytics.trackEvent('page_view', {
  "page_url": "/",
  "page_title": "Home"
});

window.analytics.trackEvent('interaction', {
  "element_type": "button",
  "action": "click"
});
```

## Required Fields (Automatically Included)
- `app_key`: "test-generation"
- `session_id`: Auto-generated per session
- `user_id`: From context (can be null)
- `ts`: ISO timestamp

## Testing
1. Open browser console
2. Look for "Analytics tracker initialized"
3. Check Network tab for requests to /ingest/analytics
4. Verify events contain all required fields