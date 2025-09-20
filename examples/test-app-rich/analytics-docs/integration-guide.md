# Analytics Integration Guide for test-app-rich-1758206274927

## 🚀 One-Line Setup - Zero Configuration Required!

Just add this single line to your HTML:

```html
<script src="/tracker.js"></script>
```

**That's it!** Analytics automatically tracks everything:

## ✨ Auto-Tracked Events (No Code Required)

The tracker automatically captures ALL of these events without any manual integration:

### 📊 User Interactions
- **button_click** - Every button click with context (text, location, page)
- **link_click** - All link navigation with external/internal detection
- **form_started** - When users begin filling forms
- **form_submitted** - Successful form submissions with duration
- **form_error** - Form validation failures

### 📱 Page & Navigation
- **page_view** - Initial load and SPA route changes
- **scroll_depth** - Engagement milestones (25%, 50%, 75%, 100%)

### 🎭 UI Components
- **modal_opened** - Modal/dialog appearances
- **modal_closed** - How modals are dismissed

## 📈 Complete Event Details

### page_view
**Auto-captured:** page_url
**Additional:** page_title, referrer, query_params, hash

### button_click
**Auto-captured:** button_text
**Additional:** button_type, button_location

### link_click
**Auto-captured:** link_text, link_url
**Additional:** link_type

### form_started
**Auto-captured:** form_name
**Additional:** form_type

### form_submitted
**Auto-captured:** form_name, form_valid
**Additional:** form_type

### form_error
**Auto-captured:** form_name, error_message
**Additional:** form_type, field_name

### modal_opened
**Auto-captured:** modal_name
**Additional:** modal_type

### modal_closed
**Auto-captured:** modal_name
**Additional:** modal_type

### scroll_depth
**Auto-captured:** page_url, scroll_percentage
**Additional:** scroll_position

### search_performed
**Auto-captured:** search_query
**Additional:** search_filters

## 🧪 Testing Your Integration

1. **Open Browser Console**
   - Look for: "✅ Analytics auto-tracking initialized"

2. **Interact With Your App**
   - Click any button → see `button_click` events
   - Start typing in a form → see `form_started` events
   - Navigate pages → see `page_view` events
   - Scroll the page → see `scroll_depth` at 25/50/75/100%

3. **Check Network Tab**
   - Filter by: `/ingest/analytics`
   - Events batch every 10 interactions or 30 seconds

## 🔧 Optional: React/Next.js Context Provider

For user identification, add the Analytics Provider:

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

## 📝 Manual Tracking (If Needed)

While auto-tracking covers most use cases, you can still track custom events:

```javascript
// Custom event tracking
window.analytics.trackEvent('custom_event', {
  custom_property: 'value'
});

// Identify users
window.analytics.identify('user123', {
  email: 'user@example.com',
  plan: 'premium'
});
```

## 🎯 What Makes This Special?

- **Zero Integration** - Just add the script tag
- **Framework Agnostic** - Works with React, Vue, Angular, vanilla JS
- **SPA Ready** - Tracks client-side routing automatically
- **Performance Optimized** - Batching, debouncing, minimal overhead
- **Privacy Friendly** - No PII collected by default
- **Complete Coverage** - Captures 90% of analytics needs automatically

## 📊 Default Tracked Properties

Every event includes:
- `app_key`: "test-app-rich-1758206274927"
- `session_id`: Auto-generated per session
- `user_id`: From context (can be null)
- `ts`: ISO timestamp
- `page_title`: Current page title
- `page_url`: Current URL path

---

**Generated:** 2025-09-18T14:38:08.766Z