// lib/dashboard-types.ts
// Type definitions for saved tiles and dashboards

import { TileConfig, Filter } from './tile-types';

export interface SavedTile {
  id: string;
  user_id: string;
  app_key: string;
  name: string;
  description?: string;
  tile_type?: 'chart' | 'markdown'; // Type of tile
  config: TileConfig | MarkdownTileConfig;
  created_at: string;
  updated_at: string;
}

export interface MarkdownTileConfig {
  type: 'markdown';
  content: string;
  backgroundColor?: string;
  textColor?: string;
}

export interface Dashboard {
  id: string;
  user_id: string;
  app_key: string;
  name: string;
  description?: string;
  global_filters?: Filter[]; // Global filters applied to all tiles
  layout: {
    breakpoints: Record<string, number>;
    cols: Record<string, number>;
    layouts: {
      lg: LayoutItem[];
      md: LayoutItem[];
      sm: LayoutItem[];
      xs: LayoutItem[];
    };
  };
  tiles: DashboardTile[];
  tile_count?: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardTile {
  dashboard_tile_id: string;
  tile_id: string;
  tile_name: string;
  tile_description?: string;
  tile_type?: 'chart' | 'markdown';
  tile_config: TileConfig | MarkdownTileConfig;
  layout: LayoutItem;
  ignore_global_filters?: boolean; // Opt-out of global filters
}

export interface LayoutItem {
  i: string; // tile_id
  x: number; // column position (0-11)
  y: number; // row position (0-infinity)
  w: number; // width in columns (3-12)
  h: number; // height in rows (3-10)
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean; // Prevent drag/resize
}

export interface Layouts {
  lg: LayoutItem[];
  md: LayoutItem[];
  sm: LayoutItem[];
  xs: LayoutItem[];
}

// Grid configuration constants
export const GRID_CONFIG = {
  breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480 },
  cols: { lg: 12, md: 10, sm: 6, xs: 4 },
  rowHeight: 100, // pixels
  
  // Tile size constraints
  minW: 3, // Minimum 3 columns (25% width on lg)
  minH: 3, // Minimum 3 rows (300px height)
  maxW: 12, // Maximum full width
  maxH: 10, // Maximum 1000px height
  
  // Default sizes by chart type
  defaultSizes: {
    'number': { w: 3, h: 3 },
    'line': { w: 6, h: 4 },
    'area': { w: 6, h: 4 },
    'bar': { w: 6, h: 4 },
    'pie': { w: 4, h: 4 },
    'funnel': { w: 6, h: 5 },
    'table': { w: 12, h: 6 }
  } as Record<string, { w: number; h: number }>,
};

