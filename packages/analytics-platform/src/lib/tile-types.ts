// lib/tile-types.ts
// Type definitions for the Analytics Tile Builder

export type AggregationType = 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max' | 'custom';
export type DimensionType = 'categorical' | 'temporal' | 'numerical';
export type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
export type ChartType = 'line' | 'area' | 'bar' | 'pie' | 'table' | 'number' | 'funnel' | 'scatter' | 'sankey' | 'flow';
export type SortDirection = 'asc' | 'desc' | 'none';

export interface MeasureCondition {
  field: string;
  operator: string;
  value: string | number;
}

export interface Measure {
  id: string;
  label: string;
  aggregation: AggregationType;
  field?: string; // Optional, for field-specific aggregations
  eventTypes?: string[]; // Optional, restrict to specific event types
  yAxis?: 'left' | 'right'; // For dual-axis charts (default: 'left')
  conditions?: MeasureCondition[]; // Per-measure filter conditions (become CASE WHEN in SQL)
}

export interface Dimension {
  id: string;
  label: string;
  field: string;
  type: DimensionType;
  options?: string[]; // For categorical with known values
  eventTypes?: string[]; // Optional, restrict to specific event types
}

export interface Filter {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string | number | string[];
  label?: string; // Human-readable label
}

export interface DateRange {
  start: Date;
  end: Date;
  label?: string; // e.g., "Last 7 Days"
}

export interface ChartStyle {
  // Colors
  primaryColor?: string;       // Main chart color (hex)
  colorPalette?: string[];     // Multi-series color palette
  gradientEnabled?: boolean;   // Use gradient fill

  // Axis
  showXAxis?: boolean;
  showYAxis?: boolean;
  showGridLines?: boolean;
  axisLabelSize?: number;      // 8-14

  // Labels
  showValueLabels?: boolean;
  valueLabelSize?: number;     // 8-16

  // Bar-specific
  barRadius?: number;          // Border radius 0-12
  barGap?: number;             // Gap percentage 0-50

  // Pie/Donut-specific
  innerRadius?: number;        // 0 = pie, 30-70 = donut
  outerRadius?: number;        // 50-90%

  // Line/Area-specific
  strokeWidth?: number;        // 1-4
  dotSize?: number;            // 0-6 (0 = no dots)
  fillOpacity?: number;        // 0-0.5 for area charts

  // Number tile
  numberSize?: 'compact' | 'default' | 'large';
}

export interface TileConfig {
  id?: string;
  name?: string;
  eventType?: string;
  measures: Measure[];
  dimensions: Dimension[];
  filters: Filter[];
  dateRange: DateRange;
  chartType: ChartType;
  pivotAxis?: boolean;
  showLabels?: boolean;
  sortDirection?: SortDirection;
  flowSteps?: FlowStep[];
  computedFormula?: 'rate';
  style?: ChartStyle;
}

export interface FlowStepCondition {
  id: string;
  field: string; // e.g., 'event_type', 'data->path'
  value: string; // The value to match
}

export interface FlowStep {
  id: string;
  label: string;
  conditions: FlowStepCondition[]; // Multiple conditions (AND logic)
  field?: string; // Deprecated - kept for backward compatibility
  eventType?: string; // Deprecated - kept for backward compatibility
}

export interface QueryResult {
  data: Array<Record<string, any>>;
  metadata: {
    total_rows: number;
    query_time_ms: number;
  };
}

export interface TileBuilderState {
  config: TileConfig;
  queryResult: QueryResult | null;
  isLoading: boolean;
  error: string | null;
}

// Pre-defined measures
export const MEASURES: Measure[] = [
  { 
    id: 'total_events', 
    label: 'Total Events', 
    aggregation: 'count' 
  },
  { 
    id: 'unique_users', 
    label: 'Unique Users', 
    aggregation: 'count_distinct', 
    field: 'user_id' 
  },
  { 
    id: 'unique_sessions', 
    label: 'Unique Sessions', 
    aggregation: 'count_distinct', 
    field: 'session_id' 
  },
  // Event-specific measures
  { 
    id: 'avg_scroll_depth', 
    label: 'Avg Scroll Depth (%)', 
    aggregation: 'avg', 
    field: 'data->depth_percentage',
    eventTypes: ['SCROLL_INTERACTION']
  },
  { 
    id: 'avg_time_on_page', 
    label: 'Avg Time on Page (seconds)', 
    aggregation: 'avg', 
    field: 'data->time_on_page',
    eventTypes: ['PAGE_VIEW']
  },
];

// Pre-defined dimensions
export const DIMENSIONS: Dimension[] = [
  // Temporal dimensions
  { 
    id: 'hour', 
    label: 'Hour', 
    field: 'ts', 
    type: 'temporal' 
  },
  { 
    id: 'day', 
    label: 'Day', 
    field: 'ts', 
    type: 'temporal' 
  },
  { 
    id: 'week', 
    label: 'Week', 
    field: 'ts', 
    type: 'temporal' 
  },
  { 
    id: 'month', 
    label: 'Month', 
    field: 'ts', 
    type: 'temporal' 
  },
  
  // Categorical - Base
  { 
    id: 'event_type', 
    label: 'Event Type', 
    field: 'event_type', 
    type: 'categorical',
    options: ['PAGE_VIEW', 'BUTTON_CLICK', 'FORM_INTERACTION', 'ELEMENT_VISIBILITY', 'SCROLL_INTERACTION'] 
  },
  { 
    id: 'app_key', 
    label: 'Application', 
    field: 'app_key', 
    type: 'categorical' 
  },
  
  // PAGE_VIEW specific
  { 
    id: 'page_path', 
    label: 'Page Path', 
    field: 'data->path', 
    type: 'categorical',
    eventTypes: ['PAGE_VIEW']
  },
  { 
    id: 'entry_type', 
    label: 'Entry Type', 
    field: 'data->entry_type', 
    type: 'categorical',
    options: ['navigation', 'reload', 'back_forward', 'spa_transition'],
    eventTypes: ['PAGE_VIEW']
  },
  
  // BUTTON_CLICK specific
  { 
    id: 'element_type', 
    label: 'Element Type', 
    field: 'data->element_type', 
    type: 'categorical',
    options: ['button', 'link', 'icon', 'tab'],
    eventTypes: ['BUTTON_CLICK']
  },
  { 
    id: 'cta_category', 
    label: 'CTA Category', 
    field: 'data->cta_category', 
    type: 'categorical',
    options: ['conversion', 'navigation', 'engagement'],
    eventTypes: ['BUTTON_CLICK']
  },
  { 
    id: 'surface', 
    label: 'Surface', 
    field: 'data->surface', 
    type: 'categorical',
    eventTypes: ['BUTTON_CLICK']
  },
  
  // FORM_INTERACTION specific
  { 
    id: 'form_type', 
    label: 'Form Type', 
    field: 'data->form_type', 
    type: 'categorical',
    options: ['contact', 'signup', 'login', 'checkout', 'newsletter', 'other'],
    eventTypes: ['FORM_INTERACTION']
  },
  { 
    id: 'form_action', 
    label: 'Form Action', 
    field: 'data->action', 
    type: 'categorical',
    options: ['started', 'submitted', 'abandoned'],
    eventTypes: ['FORM_INTERACTION']
  },
  
  // ELEMENT_VISIBILITY specific
  { 
    id: 'visibility_action', 
    label: 'Visibility Action', 
    field: 'data->action', 
    type: 'categorical',
    options: ['shown', 'hidden', 'dismissed'],
    eventTypes: ['ELEMENT_VISIBILITY']
  },
  { 
    id: 'modal_type', 
    label: 'Element Type', 
    field: 'data->element_type', 
    type: 'categorical',
    options: ['modal', 'popup', 'drawer', 'tooltip', 'dropdown', 'toast'],
    eventTypes: ['ELEMENT_VISIBILITY']
  },
  
  // SCROLL_INTERACTION specific
  { 
    id: 'scroll_milestone', 
    label: 'Scroll Milestone', 
    field: 'data->milestone', 
    type: 'categorical',
    options: ['25%', '50%', '75%', '90%', '100%'],
    eventTypes: ['SCROLL_INTERACTION']
  },
];

// Helper function to get dimensions for a specific event type
export function getDimensionsForEventType(eventType?: string): Dimension[] {
  if (!eventType) {
    return DIMENSIONS;
  }
  return DIMENSIONS.filter(d => !d.eventTypes || d.eventTypes.includes(eventType));
}

// Helper function to get measures for a specific event type
export function getMeasuresForEventType(eventType?: string): Measure[] {
  if (!eventType) {
    return MEASURES;
  }
  return MEASURES.filter(m => !m.eventTypes || m.eventTypes.includes(eventType));
}

// Pre-defined date ranges
export const DATE_RANGES = [
  {
    value: '1h',
    label: 'Last Hour',
    getRange: () => ({
      start: new Date(Date.now() - 60 * 60 * 1000),
      end: new Date(),
    })
  },
  {
    value: '24h',
    label: 'Last 24 Hours',
    getRange: () => ({
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    })
  },
  {
    value: '7d',
    label: 'Last 7 Days',
    getRange: () => ({
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    })
  },
  {
    value: '30d',
    label: 'Last 30 Days',
    getRange: () => ({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
    })
  },
  {
    value: '90d',
    label: 'Last 90 Days',
    getRange: () => ({
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      end: new Date(),
    })
  },
  {
    value: '6m',
    label: 'Last 6 Months',
    getRange: () => ({
      start: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      end: new Date(),
    })
  },
  {
    value: '1y',
    label: 'Last Year',
    getRange: () => ({
      start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      end: new Date(),
    })
  },
  {
    value: '2y',
    label: 'Last 2 Years',
    getRange: () => ({
      start: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000),
      end: new Date(),
    })
  },
];

// Event type options
export const EVENT_TYPES = [
  { value: 'PAGE_VIEW', label: 'Page View' },
  { value: 'BUTTON_CLICK', label: 'Button Click' },
  { value: 'FORM_INTERACTION', label: 'Form Interaction' },
  { value: 'ELEMENT_VISIBILITY', label: 'Element Visibility' },
  { value: 'SCROLL_INTERACTION', label: 'Scroll Interaction' },
];

