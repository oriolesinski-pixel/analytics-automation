# AI-Enhanced Analytics Integration Guide for test-app-rich-demo-2025-09-25-3ickv9sa3xn

## 🤖 New Event Schema

All events now follow a consistent structure with exactly 7 fields:
- **id**: UUID (generated)
- **ts**: Unix timestamp (generated)  
- **app_key**: Your application key
- **session_id**: Session identifier
- **user_id**: 8-10 digit persistent user ID
- **event_type**: UPPERCASE event name
- **data**: Event-specific data object

## 📊 Event Types

### PAGE_VIEW
Tracks page loads and navigation with fields: url, path, title, referrer, is_first_view, entry_type

### BUTTON_CLICK  
Tracks all clickable elements with fields: element_text, element_id, element_type, surface, page_path, is_primary_cta, cta_category

### FORM_INTERACTION
Tracks form interactions with fields: action, form_name, form_id, form_type, surface, page_path, fields_total, fields_completed

### ELEMENT_VISIBILITY
Tracks modal/popup visibility with fields: action, element_type, element_name, element_id, trigger_source, page_path, has_cta

### SCROLL_INTERACTION
Tracks scroll depth with fields: action, depth_percentage, milestone, page_path, direction

## 🚀 One-Line Setup

Just add this single line to your HTML:

```html
<script src="/tracker.js"></script>
```

**That's it!** The AI-enhanced tracker automatically adapts to your components.

## 🔑 User ID System

The tracker automatically generates and persists user IDs:
- **Format:** 8-10 digit string (e.g., "87654321")
- **Persistence:** 1-2 years across sessions
- **Storage:** localStorage, cookies, and sessionStorage for resilience
- **Privacy:** No personal information, just anonymous integers

## 🤖 AI-Discovered Components

The AI analyzed your application and found:
- **Framework:** react
- **Interactive Components:** 15
- **Behavior Patterns:** 15

### Discovered Components:
- **Button** (button): Navigational links, calls to action
- **Link** (link): Navigational links
- **Input** (form_input): Form fields for user input
- **QuantitySelector** (selector): Quantity control for products in cart
- **RemoveFromCartButton** (button): Remove item from cart
- **ClearCartButton** (button): Clear all items from cart
- **SubmitPaymentForm** (form): Process payment and complete order
- **PreviousSlideButton** (button): Navigate to previous carousel slide
- **NextSlideButton** (button): Navigate to next carousel slide
- **SlideIndicator** (button): Navigate to a specific carousel slide
- **WishlistButton** (icon): Add/remove item from wishlist
- **CartButton** (icon): View cart contents
- **UserMenu** (toggle): Manage user account and logout
- **LoginButton** (icon): Navigate to login page
- **MobileMenuToggle** (button): Toggle mobile menu

## 🧪 Testing Your Integration

1. **Open Browser Console**
   - Look for: "🤖 AI-Enhanced Analytics initialized"
   - Check: "📊 Tracking X discovered components"
   - See: "🔑 User ID: [8-10 digit number]"

2. **Monitor Network**
   - Filter by: `/ingest/analytics`
   - Verify event structure with base fields + data object

3. **Check Event Format**
   - All events have the same 7 base fields
   - Data field structure is consistent per event_type

## 🎯 What Makes This Special?

- **Consistent Schema** - All events follow the same structure
- **AI-Powered** - Understands your specific components
- **Zero Configuration** - Just add the script
- **Smart User Tracking** - Persistent 8-10 digit user IDs
- **Framework Aware** - Optimized for react

---

**Generated:** 2025-09-25T19:05:07.816Z
**AI Model:** Claude 3 Haiku