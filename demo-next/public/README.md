# Quick Integration

## Files to copy:
- `tracker.js` → `public/tracker.js`
- `Analytics.tsx` → `components/Analytics.tsx`

## Add to layout.tsx:
```tsx
import Analytics from '@/components/Analytics';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

## Test:
Open console for "Analytics tracker initialized"

## Track custom events:
```javascript
window.analytics.trackEvent('button_click', {
  button: 'cta',
  page: 'homepage'
});
```