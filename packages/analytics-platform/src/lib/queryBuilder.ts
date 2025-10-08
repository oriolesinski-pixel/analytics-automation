// lib/queryBuilder.ts
// Query builder logic for tile queries

import { TileConfig, Dimension, Filter } from './tile-types';

export interface TileQueryRequest {
  app_key: string;
  event_type?: string;
  measure: {
    aggregation: string;
    field?: string;
  };
  dimensions: Array<{
    field: string;
    bucket?: string; // For temporal dimensions: 'hour', 'day', 'week', 'month'
    type: string;
  }>;
  filters: Array<{
    field: string;
    operator: string;
    value: string | number | string[];
  }>;
  date_range: {
    start: string; // ISO string
    end: string; // ISO string
  };
}

export function buildTileQueryRequest(
  config: TileConfig,
  appKey: string
): TileQueryRequest {
  // Handle both Date objects and ISO strings for dateRange
  const startDate = config.dateRange.start instanceof Date 
    ? config.dateRange.start.toISOString()
    : config.dateRange.start;
  const endDate = config.dateRange.end instanceof Date
    ? config.dateRange.end.toISOString()
    : config.dateRange.end;

  return {
    app_key: appKey,
    event_type: config.eventType,
    measure: {
      aggregation: config.measure.aggregation,
      field: config.measure.field,
    },
    dimensions: config.dimensions.map(d => ({
      field: d.field,
      bucket: d.type === 'temporal' ? d.id : undefined,
      type: d.type,
    })),
    filters: config.filters.map(f => ({
      field: f.field,
      operator: f.operator,
      value: f.value,
    })),
    date_range: {
      start: startDate,
      end: endDate,
    },
  };
}

// Transform query result for different chart types
export function transformDataForChart(
  data: Array<Record<string, any>>,
  dimensions: Dimension[],
  measureId: string
): Array<Record<string, any>> {
  if (!data || data.length === 0) {
    return [];
  }

  // For charts, we need to ensure consistent naming
  return data.map(row => {
    const transformed: Record<string, any> = {};
    
    // Add dimension values
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

// Auto-select best chart type based on configuration
export function suggestChartType(dimensions: Dimension[]): string {
  if (dimensions.length === 0) {
    return 'number';
  }
  
  const hasTemporal = dimensions.some(d => d.type === 'temporal');
  const hasCategorical = dimensions.some(d => d.type === 'categorical');
  
  if (hasTemporal) {
    return 'line';
  }
  
  if (hasCategorical && dimensions.length === 1) {
    return 'bar';
  }
  
  if (dimensions.length > 1) {
    return 'table';
  }
  
  return 'bar';
}

// Export data as CSV
export function exportToCSV(
  data: Array<Record<string, any>>,
  filename: string = 'analytics-data.csv'
): void {
  if (data.length === 0) {
    return;
  }
  
  // Get headers from first row
  const headers = Object.keys(data[0]);
  
  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that contain commas
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

