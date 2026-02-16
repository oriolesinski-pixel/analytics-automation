#!/usr/bin/env node
/**
 * Mock Data Generator for Analytics Platform — Large Scale v2
 * 
 * Generates ~80K+ realistic analytics events for a project management SaaS
 * with ~10K unique users evenly spread across Jan 2024 → Feb 2026.
 * 
 * KEY FIX: Uses month-based target allocation instead of probabilistic filtering,
 * guaranteeing every month has meaningful data with a gentle growth curve.
 * 
 * Usage: node scripts/generate-mock-data.js [--app-key <key>] [--dry-run]
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../packages/analytics-service/.env') });

// ═══════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_APP_KEY = 'demo-test-apps-2026-01-22-mnhctas3am';
const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes('--dry-run');
const APP_KEY = process.argv.includes('--app-key')
  ? process.argv[process.argv.indexOf('--app-key') + 1]
  : DEFAULT_APP_KEY;

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════
//  TIME SETUP — Jan 1, 2024 → Feb 10, 2026
// ═══════════════════════════════════════════════════════
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// Define months explicitly for controlled distribution
const MONTHS = [];
for (let year = 2024; year <= 2026; year++) {
  const maxMonth = year === 2026 ? 2 : 12; // Up to Feb 2026
  for (let month = 1; month <= maxMonth; month++) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = month === maxMonth && year === 2026
      ? new Date(Date.UTC(2026, 1, 10)) // Feb 10, 2026
      : new Date(Date.UTC(year, month, 0)); // Last day of month
    const daysInMonth = Math.ceil((end.getTime() - start.getTime()) / DAY_MS) + 1;
    MONTHS.push({ year, month, start: start.getTime(), end: end.getTime(), days: daysInMonth, label: `${year}-${String(month).padStart(2, '0')}` });
  }
}

// ═══════════════════════════════════════════════════════
//  MONTHLY EVENT TARGETS — Smooth growth curve
//  Jan 2024: ~1,200 events → Feb 2026: ~5,500 events
//  Total: ~80K events across 26 months
// ═══════════════════════════════════════════════════════
const MONTHLY_TARGETS = MONTHS.map((m, idx) => {
  const progress = idx / (MONTHS.length - 1); // 0 to 1
  // Gentle S-curve: starts at ~1200, grows to ~5500
  const base = 1200 + 4300 * (progress * progress * (3 - 2 * progress)); // smoothstep
  // Add ±10% natural variance
  const variance = 1 + (Math.sin(idx * 1.7) * 0.10);
  return Math.round(base * variance);
});

// ═══════════════════════════════════════════════════════
//  MONTHLY NEW USER TARGETS — Growing user acquisition
//  Jan 2024: ~120 new users → Feb 2026: ~800 new users
//  Cumulative total: ~10,000+ unique users over 26 months
// ═══════════════════════════════════════════════════════
const MONTHLY_NEW_USERS = MONTHS.map((m, idx) => {
  const progress = idx / (MONTHS.length - 1);
  const base = 120 + 680 * (progress * progress * (3 - 2 * progress));
  return Math.round(base * (1 + Math.sin(idx * 2.1) * 0.08));
});

// ═══════════════════════════════════════════════════════
//  DIVERSITY DISTRIBUTIONS
// ═══════════════════════════════════════════════════════

const DEVICES = [
  { value: 'desktop', weight: 52 },
  { value: 'mobile', weight: 32 },
  { value: 'tablet', weight: 16 },
];

const BROWSERS = [
  { value: 'Chrome', weight: 55 },
  { value: 'Safari', weight: 20 },
  { value: 'Firefox', weight: 10 },
  { value: 'Edge', weight: 9 },
  { value: 'Brave', weight: 3 },
  { value: 'Opera', weight: 2 },
  { value: 'Arc', weight: 1 },
];

const OPERATING_SYSTEMS = [
  { value: 'Windows 11', weight: 28 },
  { value: 'macOS', weight: 25 },
  { value: 'Windows 10', weight: 12 },
  { value: 'iOS', weight: 16 },
  { value: 'Android', weight: 12 },
  { value: 'Linux', weight: 5 },
  { value: 'ChromeOS', weight: 2 },
];

const COUNTRIES = [
  { value: 'US', weight: 35 },
  { value: 'UK', weight: 12 },
  { value: 'Germany', weight: 8 },
  { value: 'Canada', weight: 7 },
  { value: 'Australia', weight: 5 },
  { value: 'France', weight: 5 },
  { value: 'Netherlands', weight: 4 },
  { value: 'India', weight: 4 },
  { value: 'Brazil', weight: 3 },
  { value: 'Japan', weight: 3 },
  { value: 'Sweden', weight: 2 },
  { value: 'Spain', weight: 2 },
  { value: 'Singapore', weight: 2 },
  { value: 'Israel', weight: 2 },
  { value: 'South Korea', weight: 1 },
  { value: 'Italy', weight: 1 },
  { value: 'Poland', weight: 1 },
  { value: 'Mexico', weight: 1 },
  { value: 'UAE', weight: 1 },
  { value: 'Other', weight: 1 },
];

const DESKTOP_RESOLUTIONS = ['1920x1080', '2560x1440', '1366x768', '1440x900', '1536x864', '3840x2160'];
const MOBILE_RESOLUTIONS = ['390x844', '393x873', '360x800', '414x896', '375x812'];
const TABLET_RESOLUTIONS = ['768x1024', '810x1080', '820x1180', '834x1194'];

const REFERRERS = [
  { value: '', weight: 30 },
  { value: 'https://google.com', weight: 22 },
  { value: 'https://linkedin.com', weight: 10 },
  { value: 'https://twitter.com', weight: 7 },
  { value: 'https://github.com', weight: 5 },
  { value: 'https://producthunt.com', weight: 4 },
  { value: 'https://reddit.com', weight: 3 },
  { value: 'https://bing.com', weight: 3 },
  { value: 'https://youtube.com', weight: 3 },
  { value: 'https://facebook.com', weight: 2 },
  { value: 'https://dev.to', weight: 2 },
  { value: 'https://hackernews.com', weight: 2 },
  { value: 'https://medium.com', weight: 2 },
  { value: 'https://slack.com', weight: 2 },
  { value: 'https://notion.so', weight: 1 },
  { value: 'https://duckduckgo.com', weight: 1 },
  { value: 'https://t.co', weight: 1 },
];

const ENTRY_TYPES = [
  { value: 'navigation', weight: 40 },
  { value: 'spa_transition', weight: 30 },
  { value: 'reload', weight: 15 },
  { value: 'back_forward', weight: 15 },
];

// ═══════════════════════════════════════════════════════
//  PAGES
// ═══════════════════════════════════════════════════════
const PAGES = [
  { path: '/', weight: 10, avgTime: 20, scrollable: true, title: 'ProjectFlow — Project Management Made Simple' },
  { path: '/login', weight: 9, avgTime: 12, scrollable: false, title: 'Login — ProjectFlow' },
  { path: '/signup', weight: 5, avgTime: 35, scrollable: false, title: 'Sign Up — ProjectFlow' },
  { path: '/dashboard', weight: 18, avgTime: 45, scrollable: true, title: 'Dashboard — ProjectFlow' },
  { path: '/projects', weight: 13, avgTime: 30, scrollable: true, title: 'All Projects — ProjectFlow' },
  { path: '/projects/website-redesign', weight: 5, avgTime: 55, scrollable: true, title: 'Website Redesign — ProjectFlow' },
  { path: '/projects/mobile-app-v2', weight: 4, avgTime: 50, scrollable: true, title: 'Mobile App v2.0 — ProjectFlow' },
  { path: '/projects/api-integration', weight: 4, avgTime: 60, scrollable: true, title: 'API Integration — ProjectFlow' },
  { path: '/projects/marketing-automation', weight: 3, avgTime: 45, scrollable: true, title: 'Marketing Automation — ProjectFlow' },
  { path: '/projects/data-pipeline', weight: 2, avgTime: 48, scrollable: true, title: 'Data Pipeline — ProjectFlow' },
  { path: '/tasks', weight: 14, avgTime: 35, scrollable: true, title: 'All Tasks — ProjectFlow' },
  { path: '/tasks/create', weight: 3, avgTime: 85, scrollable: false, title: 'Create Task — ProjectFlow' },
  { path: '/team', weight: 5, avgTime: 25, scrollable: true, title: 'Team Members — ProjectFlow' },
  { path: '/settings', weight: 4, avgTime: 40, scrollable: true, title: 'Settings — ProjectFlow' },
  { path: '/settings/integrations', weight: 2, avgTime: 50, scrollable: true, title: 'Integrations — ProjectFlow' },
  { path: '/billing', weight: 2, avgTime: 30, scrollable: false, title: 'Billing & Plans — ProjectFlow' },
  { path: '/reports', weight: 5, avgTime: 60, scrollable: true, title: 'Reports & Analytics — ProjectFlow' },
  { path: '/reports/weekly', weight: 2, avgTime: 45, scrollable: true, title: 'Weekly Report — ProjectFlow' },
  { path: '/notifications', weight: 3, avgTime: 15, scrollable: true, title: 'Notifications — ProjectFlow' },
  { path: '/help', weight: 2, avgTime: 55, scrollable: true, title: 'Help Center — ProjectFlow' },
];

// ═══════════════════════════════════════════════════════
//  BUTTONS
// ═══════════════════════════════════════════════════════
const BUTTONS = [
  { element_id: 'create-project-btn', element_text: 'Create Project', element_type: 'button', cta_category: 'conversion', surface: 'main', page_path: '/projects', weight: 9, component_name: 'NewProjectButton' },
  { element_id: 'create-task-btn', element_text: 'Create Task', element_type: 'button', cta_category: 'conversion', surface: 'main', page_path: '/tasks', weight: 11, component_name: 'CreateTaskButton' },
  { element_id: 'assign-task-btn', element_text: 'Assign Task', element_type: 'button', cta_category: 'conversion', surface: 'modal', page_path: '/tasks', weight: 7, component_name: 'TaskAssignButton' },
  { element_id: 'complete-task-btn', element_text: 'Mark Complete', element_type: 'button', cta_category: 'conversion', surface: 'card', page_path: '/tasks', weight: 8, component_name: 'TaskCompleteButton' },
  { element_id: 'invite-member-btn', element_text: 'Invite Team Member', element_type: 'button', cta_category: 'conversion', surface: 'main', page_path: '/team', weight: 4, component_name: 'InviteMemberButton' },
  { element_id: 'upgrade-plan-btn', element_text: 'Upgrade Plan', element_type: 'button', cta_category: 'conversion', surface: 'modal', page_path: '/billing', weight: 3, component_name: 'UpgradePlanButton' },
  { element_id: 'export-report-btn', element_text: 'Export Report', element_type: 'button', cta_category: 'conversion', surface: 'main', page_path: '/reports', weight: 4, component_name: 'ExportReportButton' },
  { element_id: 'start-trial-btn', element_text: 'Start Free Trial', element_type: 'button', cta_category: 'conversion', surface: 'main', page_path: '/', weight: 5, component_name: 'StartTrialButton' },
  { element_id: 'schedule-demo-btn', element_text: 'Schedule Demo', element_type: 'button', cta_category: 'conversion', surface: 'main', page_path: '/', weight: 3, component_name: 'ScheduleDemoButton' },
  { element_id: 'nav-projects', element_text: 'Projects', element_type: 'link', cta_category: 'navigation', surface: 'sidebar', page_path: '/dashboard', weight: 9, component_name: 'ProjectCardLink' },
  { element_id: 'nav-tasks', element_text: 'Tasks', element_type: 'link', cta_category: 'navigation', surface: 'sidebar', page_path: '/dashboard', weight: 9, component_name: 'NavLink' },
  { element_id: 'nav-dashboard', element_text: 'Dashboard', element_type: 'link', cta_category: 'navigation', surface: 'sidebar', page_path: '/projects', weight: 7, component_name: 'NavLink' },
  { element_id: 'nav-reports', element_text: 'Reports', element_type: 'link', cta_category: 'navigation', surface: 'sidebar', page_path: '/dashboard', weight: 5, component_name: 'NavLink' },
  { element_id: 'nav-team', element_text: 'Team', element_type: 'link', cta_category: 'navigation', surface: 'sidebar', page_path: '/dashboard', weight: 4, component_name: 'NavLink' },
  { element_id: 'view-project-detail', element_text: 'View Details', element_type: 'link', cta_category: 'navigation', surface: 'card', page_path: '/projects', weight: 6, component_name: 'ProjectCardLink' },
  { element_id: 'view-task-detail', element_text: 'View Task', element_type: 'link', cta_category: 'navigation', surface: 'card', page_path: '/tasks', weight: 6, component_name: 'TaskEditButton' },
  { element_id: 'breadcrumb-back', element_text: 'Back', element_type: 'link', cta_category: 'navigation', surface: 'header', page_path: '/projects/website-redesign', weight: 3, component_name: 'Breadcrumb' },
  { element_id: 'toggle-view-btn', element_text: 'Toggle View', element_type: 'button', cta_category: 'engagement', surface: 'main', page_path: '/projects', weight: 5, component_name: 'ViewToggle' },
  { element_id: 'filter-tasks-btn', element_text: 'Filter', element_type: 'button', cta_category: 'engagement', surface: 'main', page_path: '/tasks', weight: 6, component_name: 'FilterButton' },
  { element_id: 'sort-tasks-btn', element_text: 'Sort', element_type: 'button', cta_category: 'engagement', surface: 'main', page_path: '/tasks', weight: 5, component_name: 'SortButton' },
  { element_id: 'search-btn', element_text: 'Search', element_type: 'icon', cta_category: 'engagement', surface: 'header', page_path: '/dashboard', weight: 6, component_name: 'SearchButton' },
  { element_id: 'notification-bell', element_text: 'Notifications', element_type: 'icon', cta_category: 'engagement', surface: 'header', page_path: '/dashboard', weight: 7, component_name: 'NotificationBell' },
  { element_id: 'tab-board', element_text: 'Board View', element_type: 'tab', cta_category: 'engagement', surface: 'main', page_path: '/projects/website-redesign', weight: 4, component_name: 'ViewTab' },
  { element_id: 'tab-list', element_text: 'List View', element_type: 'tab', cta_category: 'engagement', surface: 'main', page_path: '/projects/website-redesign', weight: 3, component_name: 'ViewTab' },
  { element_id: 'tab-timeline', element_text: 'Timeline', element_type: 'tab', cta_category: 'engagement', surface: 'main', page_path: '/projects/website-redesign', weight: 2, component_name: 'ViewTab' },
  { element_id: 'tab-calendar', element_text: 'Calendar', element_type: 'tab', cta_category: 'engagement', surface: 'main', page_path: '/projects/website-redesign', weight: 2, component_name: 'ViewTab' },
  { element_id: 'dark-mode-toggle', element_text: 'Dark Mode', element_type: 'icon', cta_category: 'engagement', surface: 'header', page_path: '/settings', weight: 3, component_name: 'ThemeToggle' },
  { element_id: 'comment-btn', element_text: 'Add Comment', element_type: 'button', cta_category: 'engagement', surface: 'card', page_path: '/tasks', weight: 4, component_name: 'CommentButton' },
  { element_id: 'attachment-btn', element_text: 'Attach File', element_type: 'button', cta_category: 'engagement', surface: 'modal', page_path: '/tasks', weight: 3, component_name: 'AttachmentButton' },
];

// ═══════════════════════════════════════════════════════
//  FORMS
// ═══════════════════════════════════════════════════════
const FORMS = [
  { form_type: 'signup', weight: 7, submitRate: 0.62, page_path: '/signup' },
  { form_type: 'login', weight: 14, submitRate: 0.93, page_path: '/login' },
  { form_type: 'other', weight: 10, submitRate: 0.76, page_path: '/projects', form_id: 'project-creation-form' },
  { form_type: 'other', weight: 12, submitRate: 0.80, page_path: '/tasks/create', form_id: 'task-creation-form' },
  { form_type: 'other', weight: 4, submitRate: 0.68, page_path: '/settings', form_id: 'profile-settings-form' },
  { form_type: 'other', weight: 3, submitRate: 0.72, page_path: '/settings/integrations', form_id: 'integration-setup-form' },
  { form_type: 'contact', weight: 3, submitRate: 0.42, page_path: '/', form_id: 'support-contact-form' },
  { form_type: 'newsletter', weight: 3, submitRate: 0.28, page_path: '/', form_id: 'newsletter-form' },
  { form_type: 'checkout', weight: 2, submitRate: 0.55, page_path: '/billing', form_id: 'checkout-form' },
  { form_type: 'other', weight: 2, submitRate: 0.65, page_path: '/team', form_id: 'invite-form' },
];

// ═══════════════════════════════════════════════════════
//  ELEMENT VISIBILITY
// ═══════════════════════════════════════════════════════
const ELEMENTS = [
  { element_type: 'modal', element_id: 'upgrade-modal', weight: 5, dismissRate: 0.40 },
  { element_type: 'modal', element_id: 'task-detail-modal', weight: 9, dismissRate: 0.12 },
  { element_type: 'modal', element_id: 'invite-modal', weight: 5, dismissRate: 0.22 },
  { element_type: 'modal', element_id: 'project-create-modal', weight: 6, dismissRate: 0.18 },
  { element_type: 'modal', element_id: 'confirm-delete-modal', weight: 3, dismissRate: 0.45 },
  { element_type: 'modal', element_id: 'export-options-modal', weight: 3, dismissRate: 0.20 },
  { element_type: 'drawer', element_id: 'task-detail-drawer', weight: 10, dismissRate: 0.10 },
  { element_type: 'drawer', element_id: 'activity-drawer', weight: 5, dismissRate: 0.18 },
  { element_type: 'drawer', element_id: 'filter-drawer', weight: 4, dismissRate: 0.15 },
  { element_type: 'tooltip', element_id: 'onboarding-tip-1', weight: 3, dismissRate: 0.55 },
  { element_type: 'tooltip', element_id: 'onboarding-tip-2', weight: 3, dismissRate: 0.50 },
  { element_type: 'tooltip', element_id: 'feature-tip', weight: 4, dismissRate: 0.35 },
  { element_type: 'dropdown', element_id: 'user-menu', weight: 7, dismissRate: 0.05 },
  { element_type: 'dropdown', element_id: 'task-status-dropdown', weight: 9, dismissRate: 0.08 },
  { element_type: 'dropdown', element_id: 'priority-dropdown', weight: 6, dismissRate: 0.07 },
  { element_type: 'dropdown', element_id: 'assignee-dropdown', weight: 5, dismissRate: 0.10 },
  { element_type: 'toast', element_id: 'success-toast', weight: 8, dismissRate: 0.25 },
  { element_type: 'toast', element_id: 'error-toast', weight: 3, dismissRate: 0.40 },
  { element_type: 'toast', element_id: 'info-toast', weight: 4, dismissRate: 0.30 },
  { element_type: 'popup', element_id: 'feature-announcement', weight: 3, dismissRate: 0.35 },
  { element_type: 'popup', element_id: 'nps-survey', weight: 2, dismissRate: 0.50 },
];

const PROJECT_NAMES = [
  'Website Redesign Q1', 'Mobile App v2.0', 'API Integration Sprint',
  'Marketing Automation Setup', 'Customer Portal Revamp', 'Data Pipeline Migration',
  'Design System Update', 'Performance Optimization', 'Security Audit 2026',
  'Onboarding Flow Improvement', 'Payment Gateway v3', 'Analytics Dashboard',
  'Email Campaign Engine', 'Inventory Management', 'Social Media Integration',
  'User Research Sprint', 'Accessibility Audit', 'Localization Project',
];

const TASK_TITLES = [
  'Implement user authentication', 'Design landing page mockup', 'Set up CI/CD pipeline',
  'Write API documentation', 'Create database migration', 'Fix navigation bug',
  'Add search functionality', 'Optimize image loading', 'Set up monitoring alerts',
  'Review pull request #142', 'Update dependencies', 'Create unit tests',
  'Implement dark mode', 'Add export to PDF', 'Configure staging environment',
  'Design email templates', 'Integrate payment gateway', 'Set up A/B testing',
  'Refactor authentication flow', 'Create onboarding tutorial', 'Build notification system',
  'Fix mobile responsive layout', 'Add keyboard shortcuts', 'Implement file upload',
  'Create activity feed', 'Set up error tracking', 'Design logo variants',
  'Write user guide', 'Implement SSO login', 'Add Slack integration',
];

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════
function uuid() { return crypto.randomUUID(); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }

function wPick(items) {
  const total = items.reduce((s, i) => s + (i.weight || 1), 0);
  let r = Math.random() * total;
  for (const item of items) { r -= (item.weight || 1); if (r <= 0) return item.value !== undefined ? item.value : item; }
  return items[items.length - 1].value !== undefined ? items[items.length - 1].value : items[items.length - 1];
}

function wPickObj(items) {
  const total = items.reduce((s, i) => s + (i.weight || 1), 0);
  let r = Math.random() * total;
  for (const item of items) { r -= (item.weight || 1); if (r <= 0) return item; }
  return items[items.length - 1];
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getResolution(device) {
  if (device === 'mobile') return pickRandom(MOBILE_RESOLUTIONS);
  if (device === 'tablet') return pickRandom(TABLET_RESOLUTIONS);
  return pickRandom(DESKTOP_RESOLUTIONS);
}

// Time-of-day distribution (bimodal: morning + afternoon peaks)
function getRandomTimeInDay() {
  const r = Math.random();
  let hour;
  if (r < 0.08) hour = randInt(6, 7);
  else if (r < 0.18) hour = randInt(8, 8);
  else if (r < 0.42) hour = randInt(9, 11);
  else if (r < 0.52) hour = randInt(12, 13);
  else if (r < 0.78) hour = randInt(14, 17);
  else if (r < 0.90) hour = randInt(18, 20);
  else hour = randInt(21, 23);
  return hour * HOUR_MS + randInt(0, 59) * 60000 + randInt(0, 59) * 1000;
}

// Pick a random day within a month, biased toward weekdays
function pickDayInMonth(monthObj) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const dayOffset = randInt(0, monthObj.days - 1);
    const ts = monthObj.start + dayOffset * DAY_MS;
    const dow = new Date(ts).getDay();
    // 75% chance to keep weekdays, 25% for weekends
    if (dow === 0 || dow === 6) {
      if (Math.random() < 0.30) return ts; // ~30% of weekend days kept
    } else {
      return ts;
    }
  }
  return monthObj.start + randInt(0, monthObj.days - 1) * DAY_MS;
}

// ═══════════════════════════════════════════════════════
//  USER POOL — Create per-month user pools
// ═══════════════════════════════════════════════════════
let userIdCounter = 0;
function createUser() {
  userIdCounter++;
  const type = userIdCounter <= 300 ? 'power' : userIdCounter <= 2500 ? 'regular' : 'casual';
  return {
    id: `user-${type[0]}-${String(userIdCounter).padStart(5, '0')}`,
    type,
    device: wPick(DEVICES),
    browser: wPick(BROWSERS),
    os: wPick(OPERATING_SYSTEMS),
    country: wPick(COUNTRIES),
  };
}

// ═══════════════════════════════════════════════════════
//  EVENT GENERATORS
// ═══════════════════════════════════════════════════════

function generatePageView(user, sessionId, ts) {
  const page = wPickObj(PAGES);
  return {
    id: uuid(), event_type: 'PAGE_VIEW', app_key: APP_KEY,
    user_id: user.id, session_id: sessionId, ts,
    data: {
      path: page.path, url: `https://app.projectflow.io${page.path}`,
      title: page.title, time_on_page: Math.max(2, page.avgTime + randInt(-12, 20)),
      entry_type: wPick(ENTRY_TYPES), referrer: wPick(REFERRERS),
      device_type: user.device, browser: user.browser, os: user.os,
      country: user.country, screen_resolution: getResolution(user.device),
      language: pickRandom(['en-US', 'en-GB', 'en-AU', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ja-JP', 'ko-KR', 'nl-NL']),
    }
  };
}

function generateButtonClick(user, sessionId, ts) {
  const btn = wPickObj(BUTTONS);
  return {
    id: uuid(), event_type: 'BUTTON_CLICK', app_key: APP_KEY,
    user_id: user.id, session_id: sessionId, ts,
    data: {
      element_id: btn.element_id, element_text: btn.element_text,
      element_type: btn.element_type, cta_category: btn.cta_category,
      surface: btn.surface, page_path: btn.page_path,
      component_name: btn.component_name, device_type: user.device, browser: user.browser,
    }
  };
}

function generateFormInteraction(user, sessionId, ts) {
  const form = wPickObj(FORMS);
  const r = Math.random();
  const action = r < 0.30 ? 'started' : r < 0.30 + 0.70 * form.submitRate ? 'submitted' : 'abandoned';
  const data = { form_type: form.form_type, action, page_path: form.page_path, device_type: user.device, browser: user.browser };
  if (form.form_id) data.form_id = form.form_id;
  if (form.form_id === 'project-creation-form' && action === 'submitted') data.context = { project_name: pickRandom(PROJECT_NAMES) };
  if (form.form_id === 'task-creation-form' && action === 'submitted') {
    data.context = {
      task_title: pickRandom(TASK_TITLES),
      task_priority: pickRandom(['high', 'high', 'medium', 'medium', 'medium', 'low', 'low']),
      task_status: 'todo',
      project_id: pickRandom(['proj-website-redesign', 'proj-mobile-app', 'proj-api-integration', 'proj-marketing-auto', 'proj-data-pipeline', 'proj-design-system']),
    };
  }
  return { id: uuid(), event_type: 'FORM_INTERACTION', app_key: APP_KEY, user_id: user.id, session_id: sessionId, ts, data };
}

function generateElementVisibility(user, sessionId, ts) {
  const el = wPickObj(ELEMENTS);
  const r = Math.random();
  const action = r < 0.45 ? 'shown' : r < 0.45 + 0.55 * (1 - el.dismissRate) ? 'hidden' : 'dismissed';
  return {
    id: uuid(), event_type: 'ELEMENT_VISIBILITY', app_key: APP_KEY,
    user_id: user.id, session_id: sessionId, ts,
    data: {
      element_id: el.element_id, element_type: el.element_type, action,
      page_path: pickRandom(['/dashboard', '/projects', '/tasks', '/team', '/settings', '/reports', '/billing']),
      device_type: user.device,
    }
  };
}

function generateScrollInteraction(user, sessionId, ts) {
  const page = pickRandom(PAGES.filter(p => p.scrollable));
  const milestones = [
    { milestone: '25%', depth: 25, weight: 10 }, { milestone: '50%', depth: 50, weight: 8 },
    { milestone: '75%', depth: 75, weight: 5 }, { milestone: '90%', depth: 90, weight: 3 },
    { milestone: '100%', depth: 100, weight: 1 },
  ];
  const sel = wPickObj(milestones);
  return {
    id: uuid(), event_type: 'SCROLL_INTERACTION', app_key: APP_KEY,
    user_id: user.id, session_id: sessionId, ts,
    data: {
      milestone: sel.milestone, depth_percentage: Math.min(100, Math.max(0, sel.depth + randFloat(-3, 3))),
      page_path: page.path, page_height: randInt(1000, 5000), device_type: user.device,
    }
  };
}

function generateEvent(user, sessionId, ts) {
  const r = Math.random();
  if (r < 0.33) return generatePageView(user, sessionId, ts);
  if (r < 0.61) return generateButtonClick(user, sessionId, ts);
  if (r < 0.76) return generateFormInteraction(user, sessionId, ts);
  if (r < 0.90) return generateElementVisibility(user, sessionId, ts);
  return generateScrollInteraction(user, sessionId, ts);
}

// ═══════════════════════════════════════════════════════
//  MAIN GENERATION — Month-by-month allocation
//  Key design: ~10K unique users, 1-3 sessions per user,
//  each session has 2-6 events. Users are created per-month.
// ═══════════════════════════════════════════════════════

function generateAllEvents() {
  const events = [];
  let sessionCounter = 0;
  const allUsers = []; // all users ever created

  console.log('\n📊 Analytics Mock Data Generator — v3 (10K Users)');
  console.log('═════════════════════════════════════════════════');
  console.log(`   App Key:    ${APP_KEY}`);
  console.log(`   Time Span:  Jan 2024 → Feb 2026 (${MONTHS.length} months)`);
  console.log(`   Dry Run:    ${DRY_RUN}`);
  console.log('═════════════════════════════════════════════════\n');

  console.log('   Month-by-month:');

  for (let mi = 0; mi < MONTHS.length; mi++) {
    const month = MONTHS[mi];
    const targetEvents = MONTHLY_TARGETS[mi];
    const newUserCount = MONTHLY_NEW_USERS[mi];

    // Create this month's new users
    const newUsers = [];
    for (let i = 0; i < newUserCount; i++) {
      const u = createUser();
      allUsers.push(u);
      newUsers.push(u);
    }

    // Active users this month: all new users + ~20% of existing users return
    const returningUsers = [];
    if (allUsers.length > newUserCount) {
      const pool = allUsers.slice(0, -newUserCount);
      const returnRate = 0.15 + Math.random() * 0.10; // 15-25% return rate
      const returnCount = Math.floor(pool.length * returnRate);
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      returningUsers.push(...shuffled.slice(0, returnCount));
    }

    const activeUsers = [...newUsers, ...returningUsers];
    let eventsGenerated = 0;

    // Distribute target events across active users
    // Each user gets 1-3 sessions, each session 2-5 events
    const eventsPerUser = Math.max(2, Math.round(targetEvents / activeUsers.length));

    for (const user of activeUsers) {
      if (eventsGenerated >= targetEvents) break;

      const userEventBudget = Math.min(
        Math.max(2, eventsPerUser + randInt(-2, 2)),
        targetEvents - eventsGenerated
      );

      // 1-3 sessions per user this month
      const numSessions = Math.min(randInt(1, 3), Math.ceil(userEventBudget / 2));
      let userEventsLeft = userEventBudget;

      for (let s = 0; s < numSessions && userEventsLeft > 0; s++) {
        sessionCounter++;
        const sessionId = `sess-${sessionCounter}`;
        const sessSize = Math.min(userEventsLeft, randInt(2, Math.min(5, userEventsLeft)));
        userEventsLeft -= sessSize;

        const dayTs = pickDayInMonth(month);
        let ts = dayTs + getRandomTimeInDay();

        for (let e = 0; e < sessSize; e++) {
          ts += randInt(6000, 90000);
          events.push(generateEvent(user, sessionId, ts));
          eventsGenerated++;
        }
      }
    }

    const uniqueInMonth = new Set(events.slice(events.length - eventsGenerated).map(e => e.user_id)).size;
    console.log(`     ${month.label}:  ${String(eventsGenerated).padStart(5)} events,  ${String(uniqueInMonth).padStart(5)} users  (${newUserCount} new)`);
  }

  events.sort((a, b) => a.ts - b.ts);
  console.log(`\n   Total: ${events.length.toLocaleString()} events, ${allUsers.length.toLocaleString()} unique users\n`);
  return events;
}

// ═══════════════════════════════════════════════════════
//  SUPABASE INSERT
// ═══════════════════════════════════════════════════════

async function insertDirectly(events) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // First clean up old mock data
  console.log('🗑️  Cleaning old mock data...');
  const { data: deleted } = await supabase
    .from('analytics_product_events')
    .delete()
    .like('user_id', 'user-%')
    .eq('app_key', APP_KEY)
    .select('id');
  console.log(`   Removed ${deleted?.length || 0} old events\n`);

  const totalBatches = Math.ceil(events.length / BATCH_SIZE);
  let totalStored = 0, totalFailed = 0;

  console.log(`📤 Inserting ${events.length.toLocaleString()} events in ${totalBatches} batches...\n`);
  const startTime = Date.now();

  for (let i = 0; i < totalBatches; i++) {
    const batch = events.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const { data, error } = await supabase.from('analytics_product_events').insert(batch).select('id');

    if (error) {
      console.error(`\n   ❌ Batch ${i + 1} FAILED:`, error.message);
      totalFailed += batch.length;
    } else {
      totalStored += (data?.length || batch.length);
    }

    const pct = Math.round(((i + 1) / totalBatches) * 100);
    const bar = '█'.repeat(Math.floor(pct / 2)) + '░'.repeat(50 - Math.floor(pct / 2));
    process.stdout.write(`\r   [${bar}] ${pct}% (${i + 1}/${totalBatches}) | Stored: ${totalStored.toLocaleString()}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n\n═════════════════════════════════════════════════');
  console.log('   ✅ Generation Complete!');
  console.log('─────────────────────────────────────────────────');
  console.log(`   Events stored:   ${totalStored.toLocaleString()}`);
  if (totalFailed) console.log(`   Events failed:   ${totalFailed.toLocaleString()}`);
  console.log(`   Time elapsed:    ${elapsed}s`);
  console.log('═════════════════════════════════════════════════\n');
}

function printSummary(events) {
  const byType = {}, byDevice = {}, byBrowser = {}, byCountry = {}, byPage = {}, byCta = {}, byFormAction = {};
  const uniqueUsers = new Set(), uniqueSessions = new Set();
  const dateRange = { min: Infinity, max: -Infinity };

  for (const e of events) {
    byType[e.event_type] = (byType[e.event_type] || 0) + 1;
    uniqueUsers.add(e.user_id);
    uniqueSessions.add(e.session_id);
    dateRange.min = Math.min(dateRange.min, e.ts);
    dateRange.max = Math.max(dateRange.max, e.ts);
    if (e.data?.path) byPage[e.data.path] = (byPage[e.data.path] || 0) + 1;
    if (e.data?.cta_category) byCta[e.data.cta_category] = (byCta[e.data.cta_category] || 0) + 1;
    if (e.data?.device_type) byDevice[e.data.device_type] = (byDevice[e.data.device_type] || 0) + 1;
    if (e.data?.browser) byBrowser[e.data.browser] = (byBrowser[e.data.browser] || 0) + 1;
    if (e.data?.country) byCountry[e.data.country] = (byCountry[e.data.country] || 0) + 1;
    if (e.event_type === 'FORM_INTERACTION') byFormAction[e.data?.action] = (byFormAction[e.data?.action] || 0) + 1;
  }

  const sorted = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
  const section = (title, data, total) => {
    console.log(`   ${title}:`);
    for (const [k, v] of data) console.log(`     ${k.padEnd(28)} ${String(v.toLocaleString()).padStart(7)}  (${((v / total) * 100).toFixed(1)}%)`);
    console.log('');
  };

  console.log('📋 Event Summary:');
  console.log('─────────────────────────────────────────────────');
  console.log(`   Total Events:     ${events.length.toLocaleString()}`);
  console.log(`   Unique Users:     ${uniqueUsers.size.toLocaleString()}`);
  console.log(`   Unique Sessions:  ${uniqueSessions.size.toLocaleString()}`);
  console.log(`   Date Range:       ${new Date(dateRange.min).toISOString().split('T')[0]} → ${new Date(dateRange.max).toISOString().split('T')[0]}`);
  console.log('');
  section('By Event Type', sorted(byType), events.length);
  section('By Device', sorted(byDevice), Object.values(byDevice).reduce((a, b) => a + b, 0));
  section('By Browser', sorted(byBrowser), Object.values(byBrowser).reduce((a, b) => a + b, 0));
  section('Top Countries', sorted(byCountry, 8), Object.values(byCountry).reduce((a, b) => a + b, 0));
  section('Top Pages', sorted(byPage, 8), Object.values(byPage).reduce((a, b) => a + b, 0));
  section('CTA Categories', sorted(byCta), Object.values(byCta).reduce((a, b) => a + b, 0));
  section('Form Actions', sorted(byFormAction), Object.values(byFormAction).reduce((a, b) => a + b, 0));
}

// ═══════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════

async function main() {
  try {
    const events = generateAllEvents();
    printSummary(events);

    if (DRY_RUN) {
      console.log('🏃 DRY RUN — No events sent.\n');
      return;
    }

    await insertDirectly(events);
    console.log('💡 Open http://localhost:3002/analytics → "ProjectFlow Demo (Mock)" → Last 2 Years → Month dimension\n');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
