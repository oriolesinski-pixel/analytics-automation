#!/usr/bin/env node
/**
 * Demo Dashboard Seed Script — Business-Oriented
 * 
 * Creates a polished "ProjectFlow — Product Intelligence" dashboard
 * focused on users, conversions, and product engagement — not raw events.
 * 
 * Prerequisites:
 *   - Mock data already loaded (run generate-mock-data.js first)
 *   - Analytics service running (port 8082)
 * 
 * Usage: node scripts/seed-demo-dashboard.js [--app-key <key>]
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../packages/analytics-service/.env') });

const API_BASE = process.env.API_URL || 'http://localhost:8082';
const APP_KEY = process.argv.includes('--app-key')
  ? process.argv[process.argv.indexOf('--app-key') + 1]
  : 'demo-test-apps-2026-01-22-mnhctas3am';

// Full date range to capture all mock data
const FULL_RANGE = {
  start: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  end: new Date().toISOString(),
};

// Last 30 days for recent activity
const LAST_30D = {
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  end: new Date().toISOString(),
};

// ═══════════════════════════════════════════════════════
//  TILE DEFINITIONS — Business-Oriented
//  Language: users, visitors, conversions, engagement
//  NOT: events, clicks, impressions
// ═══════════════════════════════════════════════════════

const TILES = [
  // ── Row 0: Dashboard Header ──
  {
    name: 'Dashboard Header',
    description: 'Product intelligence header',
    tile_type: 'markdown',
    config: {
      type: 'markdown',
      content: '# ProjectFlow — Product Intelligence\n\nUser behavior, feature adoption, and conversion analytics for the ProjectFlow project management platform. Tracking **10,000+ users** across all product surfaces.',
      backgroundColor: '#f8fafc',
      textColor: '#1e293b',
    },
  },

  // ── Row 1: Key Business Metrics (4 KPIs) ──
  {
    name: 'Active Users',
    description: 'Total unique users across the platform',
    config: {
      measures: [{ id: 'unique_users', label: 'Active Users', aggregation: 'count_distinct', field: 'user_id' }],
      dimensions: [],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'number',
    },
  },
  {
    name: 'Page Views',
    description: 'Total page views across the product',
    config: {
      eventType: 'PAGE_VIEW',
      measures: [{ id: 'page_views', label: 'Page Views', aggregation: 'count' }],
      dimensions: [],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'number',
    },
  },
  {
    name: 'Conversion Actions',
    description: 'Task creation, project creation, signups, upgrades',
    config: {
      eventType: 'BUTTON_CLICK',
      measures: [{ id: 'conversions', label: 'Conversion Actions', aggregation: 'count' }],
      dimensions: [],
      filters: [{ id: 'f1', field: 'data->cta_category', operator: 'equals', value: 'conversion' }],
      dateRange: FULL_RANGE,
      chartType: 'number',
    },
  },
  {
    name: 'Avg. Page Engagement',
    description: 'Average time users spend on a page (seconds)',
    config: {
      eventType: 'PAGE_VIEW',
      measures: [{ id: 'avg_time', label: 'Avg. Engagement (s)', aggregation: 'avg', field: 'data->time_on_page' }],
      dimensions: [],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'number',
    },
  },

  // ── Row 2: Growth Trends (2 area charts) ──
  {
    name: 'User Growth',
    description: 'Monthly active users showing platform adoption',
    config: {
      measures: [{ id: 'unique_users', label: 'Users', aggregation: 'count_distinct', field: 'user_id' }],
      dimensions: [{ id: 'month', label: 'Month', field: 'ts', type: 'temporal' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'area',
    },
  },
  {
    name: 'Product Usage Trend',
    description: 'Monthly page views showing product engagement',
    config: {
      eventType: 'PAGE_VIEW',
      measures: [{ id: 'page_views', label: 'Page Views', aggregation: 'count' }],
      dimensions: [{ id: 'month', label: 'Month', field: 'ts', type: 'temporal' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'area',
    },
  },

  // ── Row 3: Product Usage Insights (3 tiles) ──
  {
    name: 'Most Visited Sections',
    description: 'Where users spend their time in the product',
    config: {
      eventType: 'PAGE_VIEW',
      measures: [{ id: 'page_views', label: 'Visits', aggregation: 'count' }],
      dimensions: [{ id: 'page_path', label: 'Page Path', field: 'data->path', type: 'categorical' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'bar',
      pivotAxis: true,
      sortDirection: 'desc',
    },
  },
  {
    name: 'User Action Categories',
    description: 'How users interact: conversions, navigation, engagement',
    config: {
      eventType: 'BUTTON_CLICK',
      measures: [{ id: 'actions', label: 'Actions', aggregation: 'count' }],
      dimensions: [{ id: 'cta_category', label: 'CTA Category', field: 'data->cta_category', type: 'categorical' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'pie',
    },
  },
  {
    name: 'Top Conversion Actions',
    description: 'Most performed high-value actions (task creation, project creation, upgrades)',
    config: {
      eventType: 'BUTTON_CLICK',
      measures: [{ id: 'conversions', label: 'Actions', aggregation: 'count' }],
      dimensions: [{ id: 'element_text', label: 'Action', field: 'data->element_text', type: 'categorical' }],
      filters: [{ id: 'f1', field: 'data->cta_category', operator: 'equals', value: 'conversion' }],
      dateRange: FULL_RANGE,
      chartType: 'bar',
      pivotAxis: true,
      sortDirection: 'desc',
    },
  },

  // ── Row 4: Conversion Analytics (2 tiles) ──
  {
    name: 'Product Adoption Funnel',
    description: 'User journey from first visit to completing a task',
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
          label: 'Create a Task',
          conditions: [
            { id: 'c5', field: 'event_type', value: 'BUTTON_CLICK' },
            { id: 'c6', field: 'data->element_id', value: 'create-task-btn' },
          ],
        },
        {
          id: 'step-4',
          label: 'Complete a Task',
          conditions: [
            { id: 'c7', field: 'event_type', value: 'BUTTON_CLICK' },
            { id: 'c8', field: 'data->element_id', value: 'complete-task-btn' },
          ],
        },
      ],
    },
  },
  {
    name: 'Form Completion by Type',
    description: 'Successful form submissions across different product forms',
    config: {
      eventType: 'FORM_INTERACTION',
      measures: [{ id: 'submissions', label: 'Completions', aggregation: 'count' }],
      dimensions: [{ id: 'form_type', label: 'Form Type', field: 'data->form_type', type: 'categorical' }],
      filters: [{ id: 'f1', field: 'data->action', operator: 'equals', value: 'submitted' }],
      dateRange: FULL_RANGE,
      chartType: 'bar',
      sortDirection: 'desc',
    },
  },

  // ── Row 5: Engagement Quality (2 tiles) ──
  {
    name: 'Content Scroll Depth',
    description: 'How deeply users engage with page content',
    config: {
      eventType: 'SCROLL_INTERACTION',
      measures: [{ id: 'scroll_events', label: 'Users', aggregation: 'count' }],
      dimensions: [{ id: 'scroll_milestone', label: 'Scroll Milestone', field: 'data->milestone', type: 'categorical' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'bar',
      sortDirection: 'desc',
    },
  },
  {
    name: 'Feature Discovery',
    description: 'UI components users interact with (modals, drawers, tooltips)',
    config: {
      eventType: 'ELEMENT_VISIBILITY',
      measures: [{ id: 'interactions', label: 'Interactions', aggregation: 'count' }],
      dimensions: [{ id: 'modal_type', label: 'Element Type', field: 'data->element_type', type: 'categorical' }],
      filters: [],
      dateRange: FULL_RANGE,
      chartType: 'pie',
    },
  },
];

// ═══════════════════════════════════════════════════════
//  LAYOUT — Grid positions for each tile
//  12-column grid, rowHeight=100px
// ═══════════════════════════════════════════════════════

function buildLayout(tileIds) {
  const lg = [
    // Row 0: Header (full width, short)
    { i: tileIds[0],  x: 0,  y: 0,  w: 12, h: 2, minW: 6, minH: 2 },

    // Row 1: 4 KPI number tiles
    { i: tileIds[1],  x: 0,  y: 2,  w: 3,  h: 3, minW: 3, minH: 3 },
    { i: tileIds[2],  x: 3,  y: 2,  w: 3,  h: 3, minW: 3, minH: 3 },
    { i: tileIds[3],  x: 6,  y: 2,  w: 3,  h: 3, minW: 3, minH: 3 },
    { i: tileIds[4],  x: 9,  y: 2,  w: 3,  h: 3, minW: 3, minH: 3 },

    // Row 2: 2 wide area charts (growth)
    { i: tileIds[5],  x: 0,  y: 5,  w: 6,  h: 5, minW: 4, minH: 4 },
    { i: tileIds[6],  x: 6,  y: 5,  w: 6,  h: 5, minW: 4, minH: 4 },

    // Row 3: 3 product usage tiles
    { i: tileIds[7],  x: 0,  y: 10, w: 4,  h: 5, minW: 3, minH: 4 },
    { i: tileIds[8],  x: 4,  y: 10, w: 4,  h: 5, minW: 3, minH: 4 },
    { i: tileIds[9],  x: 8,  y: 10, w: 4,  h: 5, minW: 3, minH: 4 },

    // Row 4: Conversion analytics (flow + form completion)
    { i: tileIds[10], x: 0,  y: 15, w: 7,  h: 7, minW: 5, minH: 5 },
    { i: tileIds[11], x: 7,  y: 15, w: 5,  h: 5, minW: 3, minH: 4 },

    // Row 5: Engagement quality
    { i: tileIds[12], x: 0,  y: 22, w: 6,  h: 5, minW: 3, minH: 4 },
    { i: tileIds[13], x: 6,  y: 22, w: 6,  h: 5, minW: 3, minH: 4 },
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
//  CLEANUP — Remove old demo dashboards and tiles
// ═══════════════════════════════════════════════════════

async function cleanupOldDashboards() {
  console.log('  Cleaning up old demo data...');
  try {
    const { dashboards } = await apiGet(`/dashboards?app_key=${APP_KEY}`);
    const demoDashboards = dashboards.filter(d =>
      d.name.includes('ProjectFlow') || d.name.includes('Analytics Overview')
    );
    for (const d of demoDashboards) {
      await apiDelete(`/dashboards/${d.id}`);
      console.log(`    Removed dashboard: ${d.name}`);
    }
  } catch (e) {
    console.log('    No old dashboards found');
  }

  try {
    const { tiles } = await apiGet(`/tiles?app_key=${APP_KEY}`);
    const demoTileNames = TILES.map(t => t.name);
    const demoTiles = tiles.filter(t => demoTileNames.includes(t.name));
    for (const t of demoTiles) {
      await apiDelete(`/tiles/${t.id}`);
      console.log(`    Removed tile: ${t.name}`);
    }
  } catch (e) {
    console.log('    No old tiles found');
  }
}

// ═══════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║   ProjectFlow — Product Intelligence Dashboard     ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
  console.log(`  API:       ${API_BASE}`);
  console.log(`  App Key:   ${APP_KEY}`);
  console.log(`  Tiles:     ${TILES.length}`);
  console.log('');

  // Step 1: Cleanup
  await cleanupOldDashboards();
  console.log('');

  // Step 2: Create all tiles
  console.log('  Creating tiles...');
  const tileIds = [];
  for (let i = 0; i < TILES.length; i++) {
    const tile = TILES[i];
    const body = {
      app_key: APP_KEY,
      name: tile.name,
      description: tile.description,
      tile_type: tile.tile_type || 'chart',
      config: tile.config,
    };

    try {
      const data = await apiPost('/tiles', body);
      tileIds.push(data.tile.id);
      const typeLabel = tile.tile_type === 'markdown' ? 'markdown' : (tile.config.chartType || 'chart');
      console.log(`    ✓ [${typeLabel}] ${tile.name}`);
    } catch (e) {
      console.error(`    ✗ Failed: "${tile.name}":`, e.message);
      process.exit(1);
    }
  }

  console.log(`\n  All ${tileIds.length} tiles created.\n`);

  // Step 3: Create dashboard
  console.log('  Creating dashboard...');
  const dashData = await apiPost('/dashboards', {
    name: 'ProjectFlow — Product Intelligence',
    description: 'User behavior, feature adoption, and conversion analytics. Track how users navigate, engage, and convert across the ProjectFlow platform.',
    app_key: APP_KEY,
  });
  const dashboardId = dashData.dashboard.id;
  console.log(`    ✓ Dashboard created: ${dashboardId}\n`);

  // Step 4: Add tiles to dashboard
  console.log('  Adding tiles to dashboard...');
  const layouts = buildLayout(tileIds);

  for (let i = 0; i < tileIds.length; i++) {
    const tileId = tileIds[i];
    const layoutItem = layouts.lg[i];

    await apiPost(`/dashboards/${dashboardId}/tiles`, {
      tile_id: tileId,
      layout_config: {
        x: layoutItem.x,
        y: layoutItem.y,
        w: layoutItem.w,
        h: layoutItem.h,
        minW: layoutItem.minW,
        minH: layoutItem.minH,
      },
    });
    console.log(`    ✓ ${TILES[i].name}`);
  }
  console.log('');

  // Step 5: Save the full layout
  console.log('  Saving grid layout...');
  await apiPut(`/dashboards/${dashboardId}/layout`, { layouts });
  console.log('    ✓ Layout saved\n');

  // Summary
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   Dashboard Ready!                                ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║   URL: http://localhost:3002/dashboards/${dashboardId}`);
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log('║                                                   ║');
  console.log('║   Layout:                                         ║');
  console.log('║     Row 0: Dashboard Header                       ║');
  console.log('║     Row 1: Active Users | Page Views |            ║');
  console.log('║            Conversion Actions | Avg Engagement    ║');
  console.log('║     Row 2: User Growth | Product Usage Trend      ║');
  console.log('║     Row 3: Most Visited | Action Mix | Top Conv.  ║');
  console.log('║     Row 4: Signup Funnel | Form Completions       ║');
  console.log('║     Row 5: Scroll Depth | Feature Discovery       ║');
  console.log('║                                                   ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
