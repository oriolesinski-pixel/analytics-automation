# AI-Enhanced Analytics Integration Guide for demo-test-apps-2025-10-15-ido8ggbdcsl

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
- **Interactive Components:** 21
- **Behavior Patterns:** 21

### Discovered Components:
- **CheckoutStepContinue** (button): Continue to payment step
- **CheckoutPaymentForm** (form): Submit payment details
- **CheckoutSuccessGetStarted** (button): Navigate to dashboard after upgrade
- **CreateProjectForm** (form): Create new project
- **CreateTaskButton** (button): Open create task modal
- **CreateTaskForm** (form): Create new task
- **TaskStatusDropdown** (select): Change task status
- **TaskActionMenu** (button): Open task actions menu
- **EditTaskMenuItem** (button): Open edit task modal
- **DeleteTaskMenuItem** (button): Delete task
- **ProjectCard** (link): Navigate to project detail
- **InviteTeamMemberButton** (button): Open invite member modal
- **InviteMemberForm** (form): Send team invitation
- **RemoveMemberMenuItem** (button): Remove team member
- **SettingsTabs** (tab): Switch settings section
- **SaveProfileButton** (button): Save profile changes
- **NotificationToggles** (toggle): Toggle notification preferences
- **UpgradeToPremiumButton** (button): Navigate to pricing page
- **ManageSubscriptionButton** (button): Manage billing subscription
- **DownloadInvoiceButton** (button): Download invoice PDF
- **BackButton** (link): Navigate back

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

**Generated:** 2025-10-15T08:58:15.470Z
**AI Model:** Claude 3 Haiku