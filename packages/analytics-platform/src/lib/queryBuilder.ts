// lib/queryBuilder.ts
// Query builder logic for tile queries

import { TileConfig, Dimension, Filter, Measure } from './tile-types';

export interface MeasureRequest {
  aggregation: string;
  field?: string;
  conditions?: Array<{ field: string; operator: string; value: string | number }>;
}

export interface TileQueryRequest {
  app_key: string;
  event_type?: string;
  measure?: MeasureRequest;
  measures?: MeasureRequest[];
  dimensions: Array<{
    field: string;
    bucket?: string;
    type: string;
  }>;
  filters: Array<{
    field: string;
    operator: string;
    value: string | number | string[];
  }>;
  date_range: {
    start: string;
    end: string;
  };
}

function measureToRequest(m: Measure): MeasureRequest {
  const req: MeasureRequest = {
    aggregation: m.aggregation,
  };
  if (m.field) req.field = m.field;
  if (m.conditions && m.conditions.length > 0) req.conditions = m.conditions;
  return req;
}

export function buildTileQueryRequest(
  config: TileConfig,
  appKey: string
): TileQueryRequest {
  const startDate = config.dateRange?.start instanceof Date 
    ? config.dateRange.start.toISOString()
    : config.dateRange?.start;
  const endDate = config.dateRange?.end instanceof Date
    ? config.dateRange.end.toISOString()
    : config.dateRange?.end;

  if (!config.measures || config.measures.length === 0) {
    throw new Error('No measure defined for tile');
  }

  if (!startDate || !endDate) {
    throw new Error('Invalid date range for tile');
  }

  const hasMultipleMeasures = config.measures.length > 1;
  const hasConditions = config.measures.some(m => m.conditions && m.conditions.length > 0);

  const base: TileQueryRequest = {
    app_key: appKey,
    event_type: config.eventType,
    dimensions: (config.dimensions || []).map(d => ({
      field: d.field,
      bucket: d.type === 'temporal' ? d.id : undefined,
      type: d.type,
    })),
    filters: (config.filters || []).map(f => ({
      field: f.field,
      operator: f.operator,
      value: f.value,
    })),
    date_range: {
      start: startDate,
      end: endDate,
    },
  };

  if (hasMultipleMeasures || hasConditions) {
    base.measures = config.measures.map(measureToRequest);
  } else {
    base.measure = measureToRequest(config.measures[0]);
  }

  return base;
}

// Transform query result for different chart types
export function transformDataForChart(
  data: Array<Record<string, any>>,
  dimensions: Dimension[],
  measureId: string,
  measures?: Measure[],
  computedFormula?: 'rate',
): Array<Record<string, any>> {
  if (!data || data.length === 0) {
    return [];
  }

  // Check if response uses multi-measure format (measure_value_0, measure_value_1, ...)
  const isMultiMeasure = data[0] && 'measure_value_0' in data[0];

  return data.map(row => {
    const transformed: Record<string, any> = {};
    
    // Add dimension values
    dimensions.forEach((dim, idx) => {
      const key = `dimension_${idx}`;
      if (row[key] !== undefined) {
        transformed[dim.label] = row[key];
      }
    });
    
    if (isMultiMeasure && measures) {
      // Multi-measure: add each measure as a named key
      const rawValues: number[] = [];
      measures.forEach((m, idx) => {
        rawValues[idx] = row[`measure_value_${idx}`] || 0;
      });

      const hasDimensions = dimensions.length > 0;

      const hasTemporal = dimensions.some(d => d.type === 'temporal');
      if (computedFormula === 'rate' && measures.length >= 2 && hasDimensions && hasTemporal) {
        // Rate mode for time-series: keep measure[0] raw, replace measure[1] with rate per bucket
        transformed[measures[0].label] = rawValues[0];
        const denominator = rawValues[0] || 1;
        transformed[measures[1].label] = parseFloat(((rawValues[1] / denominator) * 100).toFixed(1));
      } else {
        // Aggregate (no dimensions) or non-rate: pass raw values — BigNumber handles rate
        measures.forEach((m, idx) => {
          transformed[m.label] = rawValues[idx];
        });
      }
      transformed.value = rawValues[0];
    } else {
      transformed.value = row.measure_value || 0;
    }
    
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
    return 'area';
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

