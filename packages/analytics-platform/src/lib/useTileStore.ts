// lib/useTileStore.ts
// State management for Tile Builder using Zustand

import { create } from 'zustand';
import {
  TileConfig,
  QueryResult,
  Measure,
  Dimension,
  Filter,
  ChartType,
  DATE_RANGES,
  MEASURES,
} from './tile-types';
import { buildTileQueryRequest } from './queryBuilder';

interface TileStore {
  config: TileConfig;
  queryResult: QueryResult | null;
  isLoading: boolean;
  error: string | null;
  appKey: string;
  
  // Actions
  setAppKey: (appKey: string) => void;
  setEventType: (eventType?: string) => void;
  setMeasure: (measure: Measure) => void;
  addDimension: (dimension: Dimension) => void;
  removeDimension: (dimensionId: string) => void;
  addFilter: (filter: Filter) => void;
  removeFilter: (filterId: string) => void;
  updateFilter: (filterId: string, updates: Partial<Filter>) => void;
  setDateRange: (rangeKey: string) => void;
  setChartType: (chartType: ChartType) => void;
  executeQuery: () => Promise<void>;
  reset: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

// Default config
const getDefaultConfig = (): TileConfig => ({
  measure: MEASURES[0], // Total Events
  dimensions: [],
  filters: [],
  dateRange: DATE_RANGES[2].getRange(), // Last 7 days
  chartType: 'bar',
});

export const useTileStore = create<TileStore>((set, get) => ({
  config: getDefaultConfig(),
  queryResult: null,
  isLoading: false,
  error: null,
  appKey: '',

  setAppKey: (appKey: string) => {
    set({ appKey });
  },

  setEventType: (eventType?: string) => {
    set((state) => ({
      config: {
        ...state.config,
        eventType,
      },
    }));
  },

  setMeasure: (measure: Measure) => {
    set((state) => ({
      config: {
        ...state.config,
        measure,
      },
    }));
  },

  addDimension: (dimension: Dimension) => {
    set((state) => {
      // Limit to 2 dimensions for now
      if (state.config.dimensions.length >= 2) {
        return state;
      }

      // Don't add duplicate dimensions
      if (state.config.dimensions.some(d => d.id === dimension.id)) {
        return state;
      }

      return {
        config: {
          ...state.config,
          dimensions: [...state.config.dimensions, dimension],
        },
      };
    });
  },

  removeDimension: (dimensionId: string) => {
    set((state) => ({
      config: {
        ...state.config,
        dimensions: state.config.dimensions.filter(d => d.id !== dimensionId),
      },
    }));
  },

  addFilter: (filter: Filter) => {
    set((state) => ({
      config: {
        ...state.config,
        filters: [...state.config.filters, filter],
      },
    }));
  },

  removeFilter: (filterId: string) => {
    set((state) => ({
      config: {
        ...state.config,
        filters: state.config.filters.filter(f => f.id !== filterId),
      },
    }));
  },

  updateFilter: (filterId: string, updates: Partial<Filter>) => {
    set((state) => ({
      config: {
        ...state.config,
        filters: state.config.filters.map(f =>
          f.id === filterId ? { ...f, ...updates } : f
        ),
      },
    }));
  },

  setDateRange: (rangeKey: string) => {
    const range = DATE_RANGES.find(r => r.value === rangeKey);
    if (range) {
      set((state) => ({
        config: {
          ...state.config,
          dateRange: range.getRange(),
        },
      }));
    }
  },

  setChartType: (chartType: ChartType) => {
    set((state) => ({
      config: {
        ...state.config,
        chartType,
      },
    }));
  },

  executeQuery: async () => {
    const { config, appKey } = get();

    if (!appKey) {
      set({ error: 'Please select an application' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const queryRequest = buildTileQueryRequest(config, appKey);

      const response = await fetch(`${API_BASE_URL}/query/tile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryRequest),
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Query failed');
      }

      // Transform data for chart rendering
      const transformedData = transformQueryResult(result.data, config.dimensions);

      set({
        queryResult: {
          data: transformedData,
          metadata: result.metadata,
        },
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Query execution error:', error);
      set({
        error: error.message || 'Failed to execute query',
        isLoading: false,
        queryResult: null,
      });
    }
  },

  reset: () => {
    set({
      config: getDefaultConfig(),
      queryResult: null,
      isLoading: false,
      error: null,
    });
  },
}));

// Transform raw query result to chart-friendly format
function transformQueryResult(
  data: Array<Record<string, any>>,
  dimensions: Dimension[]
): Array<Record<string, any>> {
  return data.map((row) => {
    const transformed: Record<string, any> = {};

    // Map dimension_N to dimension labels
    dimensions.forEach((dim, idx) => {
      const key = `dimension_${idx}`;
      if (row[key] !== undefined) {
        transformed[dim.label] = row[key];
      }
    });

    // Add measure value
    transformed.value = row.measure_value || 0;

    return transformed;
  });
}

