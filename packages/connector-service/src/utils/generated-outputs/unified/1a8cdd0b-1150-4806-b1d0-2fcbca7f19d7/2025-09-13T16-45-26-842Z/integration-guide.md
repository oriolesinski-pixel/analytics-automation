# Analytics Integration Guide for demo-next-app

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

#### Available Events (4 total)
- **page_view**: page_url
- **button_click**: button_text, button_href
- **footer_link_click**: link_text, link_href
- **code_snippet_interaction**: action

#### Examples
```javascript
window.analytics.trackEvent('page_view', {
  "page_url": "/",
  "page_title": "Create Next App"
});

window.analytics.trackEvent('button_click', {
  "button_text": "Deploy now",
  "button_href": "https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app",
  "button_type": "primary"
});

window.analytics.trackEvent('footer_link_click', {
  "link_text": "Learn",
  "link_href": "https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app",
  "icon_type": "file"
});
```

## Required Fields (Automatically Included)
- `app_key`: "demo-next-app"
- `session_id`: Auto-generated per session
- `user_id`: From context (can be null)
- `ts`: ISO timestamp

## Testing
1. Open browser console
2. Look for "Analytics tracker initialized"
3. Check Network tab for requests to /ingest/analytics
4. Verify events contain all required fields