# AI-Enhanced Analytics Integration Guide for test-app-rich-1758388507977

## 🤖 AI-Discovered Components

The AI analyzed your application and found:
- **Framework:** react
- **Interactive Components:** 15
- **Behavior Patterns:** 15

### Discovered Components:
- **AddToCartButton** (button): Add product to cart
- **WishlistButton** (button): Add/remove product from wishlist
- **QuantitySelector** (selector): Update product quantity in cart
- **RemoveFromCartButton** (button): Remove product from cart
- **ClearCartButton** (button): Clear all items from cart
- **LoginForm** (form): User authentication
- **RegisterForm** (form): User registration
- **ShippingInfoForm** (form): Collect shipping information
- **PaymentForm** (form): Process payment
- **TestCredentialsButton** (button): Prefill login form with test credentials
- **Carousel** (custom): Navigate carousel slides
- **ProductLink** (link): Navigate to product details page
- **LogoutButton** (button): Log out user
- **ContinueShoppingButton** (button): Navigate to product listing page
- **BackToHomeButton** (button): Navigate to home page

## 🚀 One-Line Setup

Just add this single line to your HTML:

```html
<script src="/tracker.js"></script>
```

**That's it!** The AI-enhanced tracker automatically adapts to your components.

## ✨ Auto-Tracked Events

### 📊 User Interactions
- **element_click** - All interactive elements with AI-detected context
- **selection_change** - Option selections with component awareness
- **form_started/submitted** - Form interactions with smart field detection

### 📱 Navigation & Engagement
- **page_view** - Page loads and route changes
- **scroll_depth** - User engagement tracking (25%, 50%, 75%, 100%)

## 📈 Event Details

### page_view
**Required:** page_url
**Optional:** page_title, referrer, query_params, hash

### element_click
**Required:** element_text, element_type
**Optional:** element_id, element_class, element_location, context, component_name, page_title, page_url

### selection_change
**Required:** selection_type, selection_value
**Optional:** selection_name, previous_value, component_name, page_title, page_url

### form_started
**Required:** form_name, page_title
**Optional:** form_id, first_field_focused, context, page_url

### form_submitted
**Required:** form_name, success, page_title
**Optional:** form_id, error_message, duration_seconds, fields_interacted, context, page_url

### scroll_depth
**Required:** depth_percent, page_title
**Optional:** page_height, viewport_height, time_on_page_seconds, page_url

## 🔑 AI-Powered Context Collection

The tracker uses AI-discovered patterns to collect relevant context:
- **AddToCartButton**: Collects product_id
- **WishlistButton**: Collects product_id
- **QuantitySelector**: Collects product_id, quantity

## 🧪 Testing Your Integration

1. **Open Browser Console**
   - Look for: "🤖 AI-Enhanced Analytics initialized"
   - Check: "📊 Tracking X discovered components"

2. **Interact With Components**
   - The AI recognizes your specific components
   - Context is collected based on learned patterns

3. **Monitor Network**
   - Filter by: `/ingest/analytics`
   - See AI-enhanced event data

## 🎯 What Makes This Special?

- **AI-Powered** - Understands your specific components
- **Zero Configuration** - Just add the script
- **Adaptive** - Learns from your code patterns
- **Framework Aware** - Optimized for react
- **Context Smart** - Collects relevant data automatically

---

**Generated:** 2025-09-20T17:15:34.834Z
**AI Model:** Claude 3 Haiku