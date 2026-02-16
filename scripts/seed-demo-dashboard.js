#!/usr/bin/env node
/**
 * Demo Dashboard Seed Script v3 — Story-Driven with Section Headers
 * 
 * Structure tells the story with editorial section dividers:
 *   KPIs → Growth → Behavior → Conversion → Depth
 * 
 * Usage: node scripts/seed-demo-dashboard.js [--app-key <key>]
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../packages/analytics-service/.env') });

const API_BASE = process.env.API_URL || 'http://localhost:8082';
const APP_KEY = process.argv.includes('--app-key')
  ? process.argv[process.argv.indexOf('--app-key') + 1]
  : 'demo-test-apps-2026-01-22-mnhctas3am';

const FULL_RANGE = {
  start: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  end: new Date().toISOString(),
};

// ═══════════════════════════════════════════════════════
//  TILES — story structure with section headers
// ═══════════════════════════════════════════════════════

const TILES = [

  // ── ACT 1 — KPIs ──────────────────────────────────

  {
    name: 'Users',
    description: 'Unique users across all product surfaces',
    config: {
      measures: [{ id: 'unique_users', label: 'Users', aggregation: 'count_distinct', field: 'user_id' }],
      dimensions: [],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'number',
    },
  },
  {
    name: 'Sessions',
    description: 'Total page views',
    config: {
      eventType: 'PAGE_VIEW',
      measures: [{ id: 'sessions', label: 'Sessions', aggregation: 'count' }],
      dimensions: [],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'number',
    },
  },
  {
    name: 'Conversions',
    description: 'High-value actions completed',
    config: {
      eventType: 'BUTTON_CLICK',
      measures: [{ id: 'conversions', label: 'Conversions', aggregation: 'count' }],
      dimensions: [],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'number',
    },
  },
  {
    name: 'Conv. Rate',
    description: 'Unique converting users / total unique users',
    config: {
      measures: [
        { id: 'converting_users', label: 'Converting Users', aggregation: 'count_distinct', field: 'user_id', conditions: [{ field: 'event_type', operator: 'equals', value: 'BUTTON_CLICK' }, { field: 'data->cta_category', operator: 'equals', value: 'conversion' }] },
        { id: 'unique_users', label: 'All Users', aggregation: 'count_distinct', field: 'user_id' },
      ],
      dimensions: [],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'number',
      computedFormula: 'rate',
    },
  },

  // ── Section: Growth ────────────────────────────────
  {
    name: 'Growth',
    tile_type: 'markdown',
    config: { type: 'markdown', content: '# Growth\nMonthly trajectory and conversion efficiency', isSection: true, backgroundColor: 'transparent', textColor: '#334155' },
  },

  // ── ACT 2 — Growth ────────────────────────────────

  {
    name: 'User Growth',
    description: 'Monthly unique users over time',
    config: {
      measures: [{ id: 'unique_users', label: 'Users', aggregation: 'count_distinct', field: 'user_id' }],
      dimensions: [{ id: 'month', label: 'Month', field: 'ts', type: 'temporal' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'area',
    },
  },
  {
    name: 'Users & Conv. Rate',
    description: 'Monthly users (left) vs conversion rate % (right)',
    config: {
      measures: [
        { id: 'unique_users', label: 'Users', aggregation: 'count_distinct', field: 'user_id', yAxis: 'left' },
        { id: 'conv_count', label: 'Conv. Rate %', aggregation: 'count', yAxis: 'right', conditions: [{ field: 'event_type', operator: 'equals', value: 'BUTTON_CLICK' }, { field: 'data->cta_category', operator: 'equals', value: 'conversion' }] },
      ],
      dimensions: [{ id: 'month', label: 'Month', field: 'ts', type: 'temporal' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'area',
      computedFormula: 'rate',
    },
  },

  // ── Section: Behavior ──────────────────────────────
  {
    name: 'Behavior',
    tile_type: 'markdown',
    config: { type: 'markdown', content: '# Behavior\nWhat users do and where they go', isSection: true, backgroundColor: 'transparent', textColor: '#334155' },
  },

  // ── ACT 3 — Behavior ──────────────────────────────

  {
    name: 'Top Sections',
    description: 'Most visited product areas',
    config: {
      eventType: 'PAGE_VIEW',
      measures: [{ id: 'page_views', label: 'Visits', aggregation: 'count' }],
      dimensions: [{ id: 'page_path', label: 'Section', field: 'data->path', type: 'categorical' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'bar',
      pivotAxis: true,
      sortDirection: 'desc',
    },
  },
  {
    name: 'Action Mix',
    description: 'Distribution of user intent',
    config: {
      eventType: 'BUTTON_CLICK',
      measures: [{ id: 'actions', label: 'Actions', aggregation: 'count' }],
      dimensions: [{ id: 'cta_category', label: 'Category', field: 'data->cta_category', type: 'categorical' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'pie',
    },
  },
  {
    name: 'Top CTAs',
    description: 'Most completed high-value actions',
    config: {
      eventType: 'BUTTON_CLICK',
      measures: [{ id: 'conversions', label: 'Completions', aggregation: 'count' }],
      dimensions: [{ id: 'element_text', label: 'Action', field: 'data->element_text', type: 'categorical' }],
      filters: [{ id: 'f1', field: 'data->cta_category', operator: 'equals', value: 'conversion' }],
      dateRange: FULL_RANGE,
      chartType: 'bar',
      pivotAxis: true,
      sortDirection: 'desc',
    },
  },

  // ── Section: Conversion ────────────────────────────
  {
    name: 'Conversion',
    tile_type: 'markdown',
    config: { type: 'markdown', content: '# Conversion Pipeline\nFrom first visit to completed action', isSection: true, backgroundColor: 'transparent', textColor: '#334155' },
  },

  // ── ACT 4 — Conversion ────────────────────────────

  {
    name: 'Adoption Funnel',
    description: 'Dashboard → Projects → Create Task → Complete Task',
    config: {
      measures: [{ id: 'unique_users', label: 'Users', aggregation: 'count_distinct', field: 'user_id' }],
      dimensions: [],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'flow',
      flowSteps: [
        {
          id: 'step-1',
          label: 'Visit Dashboard',
          conditions: [
            { id: 'c1', field: 'event_type', value: 'PAGE_VIEW' },
            { id: 'c2', field: 'data->path', value: '/dashboard' },
          ],
        },
        {
          id: 'step-2',
          label: 'Browse Projects',
          conditions: [
            { id: 'c3', field: 'event_type', value: 'PAGE_VIEW' },
            { id: 'c4', field: 'data->path', value: '/projects' },
          ],
        },
        {
          id: 'step-3',
          label: 'Create Task',
          conditions: [
            { id: 'c5', field: 'event_type', value: 'BUTTON_CLICK' },
            { id: 'c6', field: 'data->element_id', value: 'create-task-btn' },
          ],
        },
        {
          id: 'step-4',
          label: 'Complete Task',
          conditions: [
            { id: 'c7', field: 'event_type', value: 'BUTTON_CLICK' },
            { id: 'c8', field: 'data->element_id', value: 'complete-task-btn' },
          ],
        },
      ],
    },
  },
  {
    name: 'Form Completions',
    description: 'Submitted forms by type with CVR on right axis',
    config: {
      eventType: 'FORM_INTERACTION',
      measures: [
        { id: 'submissions', label: 'Completions', aggregation: 'count', conditions: [{ id: 'fc1', field: 'data->action', operator: 'equals', value: 'submitted' }] },
        { id: 'form_seen', label: 'Seen', aggregation: 'count', conditions: [{ id: 'fc2', field: 'data->action', operator: 'equals', value: 'started' }], yAxis: 'right' },
      ],
      dimensions: [{ id: 'form_type', label: 'Form', field: 'data->form_type', type: 'categorical' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'bar',
      sortDirection: 'desc',
      showLabels: true,
      computedFormula: 'rate',
    },
  },

  // ── Section: Engagement ────────────────────────────
  {
    name: 'Engagement',
    tile_type: 'markdown',
    config: { type: 'markdown', content: '# Engagement Depth\nContent consumption and feature discovery', isSection: true, backgroundColor: 'transparent', textColor: '#334155' },
  },

  // ── ACT 5 — Depth ─────────────────────────────────

  {
    name: 'Scroll Depth',
    description: 'Content consumption by milestone',
    config: {
      eventType: 'SCROLL_INTERACTION',
      measures: [{ id: 'scroll_events', label: 'Users', aggregation: 'count' }],
      dimensions: [{ id: 'scroll_milestone', label: 'Milestone', field: 'data->milestone', type: 'categorical' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'bar',
      pivotAxis: true,
      sortDirection: 'desc',
    },
  },
  {
    name: 'Feature Discovery',
    description: 'UI elements users interact with',
    config: {
      eventType: 'ELEMENT_VISIBILITY',
      measures: [{ id: 'interactions', label: 'Interactions', aggregation: 'count' }],
      dimensions: [{ id: 'modal_type', label: 'Element', field: 'data->element_type', type: 'categorical' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'pie',
    },
  },
];

// ═══════════════════════════════════════════════════════
//  LAYOUT — includes section header rows (h:1)
// ═══════════════════════════════════════════════════════

function buildLayout(tileIds) {
  // Indices:
  //  0-3 = KPIs (Act 1)
  //  4   = Section: Growth
  //  5-6 = Growth charts (Act 2)
  //  7   = Section: Behavior
  //  8-10 = Behavior charts (Act 3)
  //  11  = Section: Conversion
  //  12-13 = Conversion charts (Act 4)
  //  14  = Section: Engagement
  //  15-16 = Depth charts (Act 5)

  const lg = [
    // Act 1: 4 KPIs
    { i: tileIds[0],  x: 0,  y: 0,  w: 3,  h: 3, minW: 2, minH: 2 },
    { i: tileIds[1],  x: 3,  y: 0,  w: 3,  h: 3, minW: 2, minH: 2 },
    { i: tileIds[2],  x: 6,  y: 0,  w: 3,  h: 3, minW: 2, minH: 2 },
    { i: tileIds[3],  x: 9,  y: 0,  w: 3,  h: 3, minW: 2, minH: 2 },

    // Section: Growth
    { i: tileIds[4],  x: 0,  y: 3,  w: 12, h: 1, minW: 6, minH: 1 },

    // Act 2: Growth
    { i: tileIds[5],  x: 0,  y: 4,  w: 6,  h: 5, minW: 4, minH: 4 },
    { i: tileIds[6],  x: 6,  y: 4,  w: 6,  h: 5, minW: 4, minH: 4 },

    // Section: Behavior
    { i: tileIds[7],  x: 0,  y: 9,  w: 12, h: 1, minW: 6, minH: 1 },

    // Act 3: Behavior
    { i: tileIds[8],  x: 0,  y: 10, w: 4,  h: 5, minW: 3, minH: 4 },
    { i: tileIds[9],  x: 4,  y: 10, w: 4,  h: 5, minW: 3, minH: 4 },
    { i: tileIds[10], x: 8,  y: 10, w: 4,  h: 5, minW: 3, minH: 4 },

    // Section: Conversion
    { i: tileIds[11], x: 0,  y: 15, w: 12, h: 1, minW: 6, minH: 1 },

    // Act 4: Conversion
    { i: tileIds[12], x: 0,  y: 16, w: 7,  h: 6, minW: 5, minH: 5 },
    { i: tileIds[13], x: 7,  y: 16, w: 5,  h: 6, minW: 3, minH: 4 },

    // Section: Engagement
    { i: tileIds[14], x: 0,  y: 22, w: 12, h: 1, minW: 6, minH: 1 },

    // Act 5: Depth
    { i: tileIds[15], x: 0,  y: 23, w: 6,  h: 5, minW: 3, minH: 4 },
    { i: tileIds[16], x: 6,  y: 23, w: 6,  h: 5, minW: 3, minH: 4 },
  ];

  const md = lg.map(item => ({
    ...item,
    w: Math.min(item.w, 10),
    x: Math.min(item.x, 10 - Math.min(item.w, 10)),
  }));

  const sm = lg.map((item, idx) => ({
    ...item,
    x: 0,
    y: idx * item.h,
    w: 6,
  }));

  const xs = lg.map((item, idx) => ({
    ...item,
    x: 0,
    y: idx * item.h,
    w: 4,
  }));

  return { lg, md, sm, xs };
}

// ═══════════════════════════════════════════════════════
//  API HELPERS
// ═══════════════════════════════════════════════════════

async function apiPost(endpoint, body) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`API error at ${endpoint}: ${data.error}`);
  return data;
}

async function apiPut(endpoint, body) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`API error at ${endpoint}: ${data.error}`);
  return data;
}

async function apiGet(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`);
  const data = await response.json();
  if (!data.ok) throw new Error(`API error at ${endpoint}: ${data.error}`);
  return data;
}

async function apiDelete(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
  const data = await response.json();
  if (!data.ok) throw new Error(`API error at ${endpoint}: ${data.error}`);
  return data;
}

// ═══════════════════════════════════════════════════════
//  CLEANUP
// ═══════════════════════════════════════════════════════

const ALL_KNOWN_TILE_NAMES = [
  ...TILES.map(t => t.name),
  'Dashboard Header', 'Active Users', 'Page Views', 'Conversion Actions',
  'Avg. Page Engagement', 'Avg. Engagement', 'User Growth', 'Product Usage Trend',
  'Engagement Trend', 'Conversion Trend', 'Users & Conversions', 'Users & Conv. Rate', 'Conv. Rate', 'Form Conv. Rate',
  'Most Visited Sections', 'User Action Categories', 'Top Conversion Actions', 'Top CTAs',
  'Product Adoption Funnel', 'Form Completion by Type', 'Content Scroll Depth',
  'Growth', 'Behavior', 'Conversion', 'Engagement',
];

async function cleanupOldDashboards() {
  console.log('  Cleaning up...');
  try {
    const { dashboards } = await apiGet(`/dashboards?app_key=${APP_KEY}`);
    const demoDashboards = dashboards.filter(d =>
      d.name.includes('ProjectFlow') || d.name.includes('Analytics')
    );
    for (const d of demoDashboards) {
      await apiDelete(`/dashboards/${d.id}`);
      console.log(`    - dashboard: ${d.name}`);
    }
  } catch (e) { /* no dashboards */ }

  try {
    const { tiles } = await apiGet(`/tiles?app_key=${APP_KEY}`);
    const demoTiles = tiles.filter(t => ALL_KNOWN_TILE_NAMES.includes(t.name));
    for (const t of demoTiles) {
      await apiDelete(`/tiles/${t.id}`);
    }
    if (demoTiles.length > 0) console.log(`    - ${demoTiles.length} tiles removed`);
  } catch (e) { /* no tiles */ }
}

// ═══════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════

async function main() {
  console.log('\n  ProjectFlow — Product Intelligence (v3)\n');
  console.log(`  API: ${API_BASE}  |  App: ${APP_KEY}  |  ${TILES.length} tiles\n`);

  await cleanupOldDashboards();

  console.log('\n  Creating tiles...');
  const tileIds = [];
  for (const tile of TILES) {
    const data = await apiPost('/tiles', {
      app_key: APP_KEY,
      name: tile.name,
      description: tile.description || '',
      tile_type: tile.tile_type || 'chart',
      config: tile.config,
    });
    tileIds.push(data.tile.id);
    const ct = tile.config.chartType || 'section';
    console.log(`    ✓ [${ct}] ${tile.name}`);
  }

  console.log('\n  Creating dashboard...');
  const dashData = await apiPost('/dashboards', {
    name: 'ProjectFlow — Product Intelligence',
    description: 'Scale, growth, behavior, conversion, and engagement depth.',
    app_key: APP_KEY,
  });
  const dashboardId = dashData.dashboard.id;

  const layouts = buildLayout(tileIds);
  for (let i = 0; i < tileIds.length; i++) {
    const l = layouts.lg[i];
    await apiPost(`/dashboards/${dashboardId}/tiles`, {
      tile_id: tileIds[i],
      layout_config: { x: l.x, y: l.y, w: l.w, h: l.h, minW: l.minW, minH: l.minH },
    });
  }

  await apiPut(`/dashboards/${dashboardId}/layout`, { layouts });

  console.log(`\n  ✓ Dashboard ready: http://localhost:3002/dashboards/${dashboardId}`);
  console.log();
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
