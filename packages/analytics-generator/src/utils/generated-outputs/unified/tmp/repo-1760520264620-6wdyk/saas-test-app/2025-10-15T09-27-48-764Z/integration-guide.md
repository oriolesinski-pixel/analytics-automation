# AI-Enhanced Analytics Integration Guide for demo-test-apps-2025-10-15-p2w0l70pwva

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

### MODAL_INTERACTION
Tracks modal dialogs specifically with fields: action (opened/closed/submitted/dismissed), modal_name, modal_id, trigger_source, page_path, context
- Automatically captures context from the modal (form fields, product info, etc.)
- Distinguishes between opened, closed, submitted, and dismissed actions

### ELEMENT_VISIBILITY
Tracks other overlay elements (popups, tooltips, dropdowns) with fields: action, element_type, element_name, element_id, trigger_source, page_path, has_cta

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
- **Framework:** nextjs-app-router
- **Interactive Components:** 22
- **Behavior Patterns:** 22

### Discovered Components:
- **CheckoutStepContinue** (button): Advance to payment step
- **CheckoutForm** (form): Complete payment and subscription
- **BackToPricingLink** (link): Return to pricing page
- **GetStartedButton** (button): Navigate to dashboard after upgrade
- **NewProjectButton** (button): Navigate to create project
- **UpgradeToPremiumButton** (button): Navigate to pricing page
- **ProjectForm** (form): Create new project
- **CreateTaskButton** (button): Open task creation modal
- **TaskForm** (form): Create or update task
- **TaskStatusDropdown** (select): Change task status
- **TaskActionMenu** (button): Open task actions menu
- **DeleteTaskButton** (button): Delete task
- **ArchiveProjectButton** (button): Archive project
- **InviteTeamMemberButton** (button): Open invite modal
- **InviteForm** (form): Send team invitation
- **RemoveMemberButton** (button): Remove team member
- **SettingsForm** (form): Update settings
- **NotificationToggle** (toggle): Toggle notification preferences
- **SettingsTabs** (tab): Switch settings section
- **ManageBillingButton** (button): Navigate to billing page
- **DownloadInvoiceButton** (button): Download invoice
- **ProjectCard** (link): Navigate to project detail

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
- **Framework Aware** - Optimized for nextjs-app-router

---

**Generated:** 2025-10-15T09:27:48.764Z
**AI Model:** Claude 3 Haiku