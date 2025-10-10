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
  SortDirection,
  FlowStep,
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
  addMeasure: (measure: Measure) => void;
  removeMeasure: (measureId: string) => void;
  addDimension: (dimension: Dimension) => void;
  removeDimension: (dimensionId: string) => void;
  addFilter: (filter: Filter) => void;
  removeFilter: (filterId: string) => void;
  updateFilter: (filterId: string, updates: Partial<Filter>) => void;
  setDateRange: (rangeKey: string) => void;
  setChartType: (chartType: ChartType) => void;
  setPivotAxis: (pivot: boolean) => void;
  toggleSort: () => void;
  addFlowStep: (step: FlowStep) => void;
  removeFlowStep: (stepId: string) => void;
  updateFlowStep: (stepId: string, updates: Partial<FlowStep>) => void;
  setFlowSteps: (steps: FlowStep[]) => void;
  executeQuery: () => Promise<void>;
  reset: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

// Default config
const getDefaultConfig = (): TileConfig => ({
  measures: [MEASURES[0]], // Total Events by default
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

  addMeasure: (measure: Measure) => {
    set((state) => {
      // Don't add duplicate measures
      if (state.config.measures.some(m => m.id === measure.id)) {
        return state;
      }

      return {
        config: {
          ...state.config,
          measures: [...state.config.measures, measure],
        },
      };
    });
  },

  removeMeasure: (measureId: string) => {
    set((state) => ({
      config: {
        ...state.config,
        measures: state.config.measures.filter(m => m.id !== measureId),
      },
    }));
  },

  addDimension: (dimension: Dimension) => {
    set((state) => {
      // Limit to 3 dimensions
      if (state.config.dimensions.length >= 3) {
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

  setPivotAxis: (pivot: boolean) => {
    set((state) => ({
      config: {
        ...state.config,
        pivotAxis: pivot,
      },
    }));
  },

  toggleSort: () => {
    set((state) => {
      const currentSort = state.config.sortDirection || 'none';
      let newSort: SortDirection;
      
      // Cycle: none -> desc -> asc -> none
      if (currentSort === 'none') {
        newSort = 'desc';
      } else if (currentSort === 'desc') {
        newSort = 'asc';
      } else {
        newSort = 'none';
      }

      return {
        config: {
          ...state.config,
          sortDirection: newSort,
        },
      };
    });
  },

  addFlowStep: (step: FlowStep) => {
    set((state) => ({
      config: {
        ...state.config,
        flowSteps: [...(state.config.flowSteps || []), step],
      },
    }));
  },

  removeFlowStep: (stepId: string) => {
    set((state) => ({
      config: {
        ...state.config,
        flowSteps: (state.config.flowSteps || []).filter(s => s.id !== stepId),
      },
    }));
  },

  updateFlowStep: (stepId: string, updates: Partial<FlowStep>) => {
    set((state) => ({
      config: {
        ...state.config,
        flowSteps: (state.config.flowSteps || []).map(s =>
          s.id === stepId ? { ...s, ...updates } : s
        ),
      },
    }));
  },

  setFlowSteps: (steps: FlowStep[]) => {
    set((state) => ({
      config: {
        ...state.config,
        flowSteps: steps,
      },
    }));
  },

  executeQuery: async () => {
    const { config, appKey } = get();

    if (!appKey) {
      set({ error: 'Please select an application' });
      return;
    }

    if (config.measures.length === 0) {
      set({ error: 'Please select at least one measure' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Use flow query endpoint for flow chart type
      if (config.chartType === 'flow') {
        if (!config.flowSteps || config.flowSteps.length === 0) {
          set({ 
            error: 'Please add at least one flow step',
            isLoading: false,
          });
          return;
        }

        const flowQueryRequest = {
          app_key: appKey,
          flow_steps: config.flowSteps,
          measure: {
            aggregation: config.measures[0].aggregation,
            field: config.measures[0].field,
          },
          date_range: {
            start: config.dateRange.start instanceof Date 
              ? config.dateRange.start.toISOString()
              : config.dateRange.start,
            end: config.dateRange.end instanceof Date
              ? config.dateRange.end.toISOString()
              : config.dateRange.end,
          },
        };

        const response = await fetch(`${API_BASE_URL}/query/flow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(flowQueryRequest),
        });

        if (!response.ok) {
          throw new Error(`Flow query failed: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.ok) {
          throw new Error(result.error || 'Flow query failed');
        }

        set({
          queryResult: {
            data: result.data,
            metadata: result.metadata,
          },
          isLoading: false,
          error: null,
        });
        return;
      }

      // Regular tile query
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
      let transformedData = transformQueryResult(result.data, config.dimensions);
      
      // Apply sorting if specified
      if (config.sortDirection && config.sortDirection !== 'none') {
        transformedData = transformedData.sort((a, b) => {
          const aVal = a.value || 0;
          const bVal = b.value || 0;
          return config.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        });
      }

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

