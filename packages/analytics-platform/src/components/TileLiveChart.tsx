// components/TileLiveChart.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import TileChart from './TileChart';
import { TileConfig, Filter, Measure } from '../lib/tile-types';
import { buildTileQueryRequest, transformDataForChart } from '../lib/queryBuilder';
import { RefreshCw } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface TileLiveChartProps {
  tileId: string;
  config: TileConfig | any;
  appKey: string;
  showRefresh?: boolean;
  autoRefresh?: boolean;
  globalFilters?: Filter[];
  ignoreGlobalFilters?: boolean;
  tileName?: string;
}

export default function TileLiveChart({
  tileId,
  config,
  appKey,
  showRefresh = false,
  autoRefresh = false,
  globalFilters = [],
  ignoreGlobalFilters = false,
  tileName,
}: TileLiveChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<number[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchCountRef = useRef(0);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const tileConfig = config as TileConfig;
      
      const measures: Measure[] = tileConfig.measures || [(tileConfig as any).measure];
      if (!measures || !measures[0]) {
        setIsLoading(false);
        setData([]);
        return;
      }

      // Flow chart queries use a different endpoint
      if (tileConfig.chartType === 'flow' && tileConfig.flowSteps && tileConfig.flowSteps.length > 0) {
        const startDate = tileConfig.dateRange?.start instanceof Date
          ? tileConfig.dateRange.start.toISOString()
          : tileConfig.dateRange?.start;
        const endDate = tileConfig.dateRange?.end instanceof Date
          ? tileConfig.dateRange.end.toISOString()
          : tileConfig.dateRange?.end;

        const flowRequest = {
          app_key: appKey,
          flow_steps: tileConfig.flowSteps,
          measure: {
            aggregation: measures[0].aggregation,
            field: measures[0].field,
          },
          date_range: { start: startDate, end: endDate },
        };

        const response = await fetch(`${API_BASE_URL}/query/flow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flowRequest),
        });

        if (!response.ok) {
          throw new Error(`Flow query failed: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.ok) {
          throw new Error(result.error || 'Flow query failed');
        }

        setData(result.data || []);
        setIsLoading(false);
        return;
      }

      // Regular tile query
      const normalizedConfig: TileConfig = {
        ...tileConfig,
        measures: measures,
        filters: ignoreGlobalFilters 
          ? tileConfig.filters || []
          : [...(globalFilters || []), ...(tileConfig.filters || [])],
      };

      const queryRequest = buildTileQueryRequest(normalizedConfig, appKey);

      const response = await fetch(`${API_BASE_URL}/query/tile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryRequest),
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Query failed');
      }

      const transformedData = transformDataForChart(
        result.data || [],
        normalizedConfig.dimensions || [],
        measures[0]?.id || 'total_events',
        measures.length > 1 ? measures : undefined,
        tileConfig.computedFormula,
      );

      setData(transformedData);

      // For number tiles, fetch monthly trend for sparkline
      if (tileConfig.chartType === 'number') {
        try {
          const isRateTile = tileConfig.computedFormula === 'rate' && measures.length >= 2;
          const trendDateRange = {
            start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString(),
          };

          const buildMeasurePayload = (m: Measure) => ({
            id: m.id,
            label: m.label,
            aggregation: m.aggregation,
            ...(m.field ? { field: m.field } : {}),
            ...(m.conditions && m.conditions.length > 0 ? { conditions: m.conditions } : {}),
          });

          if (isRateTile) {
            // For rate tiles: fetch both measures monthly, compute rate per month
            const trendRequest: Record<string, any> = {
              app_key: appKey,
              measures: measures.map(buildMeasurePayload),
              dimensions: [{ id: 'trend_month', label: 'Month', field: 'ts', type: 'temporal', bucket: 'month' }],
              filters: normalizedConfig.filters || [],
              date_range: trendDateRange,
            };
            if (tileConfig.eventType) trendRequest.event_type = tileConfig.eventType;

            const trendResponse = await fetch(`${API_BASE_URL}/query/tile`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(trendRequest),
            });
            if (trendResponse.ok) {
              const trendResult = await trendResponse.json();
              if (trendResult.ok && trendResult.data) {
                const sorted = (trendResult.data as any[])
                  .sort((a: any, b: any) => String(a.dimension_0 || '').localeCompare(String(b.dimension_0 || '')));
                const last12 = sorted.slice(-12);
                const values = last12.map((row: any) => {
                  const num = Number(row.measure_value_0) || 0;
                  const denom = Number(row.measure_value_1) || 1;
                  return denom > 0 ? Math.round((num / denom) * 1000) / 10 : 0;
                });
                if (values.length >= 2) setTrendData(values);
              }
            }
          } else {
            // Single measure trend
            const firstMeasure = measures[0];
            const trendRequest: Record<string, any> = {
              app_key: appKey,
              measures: [buildMeasurePayload(firstMeasure)],
              dimensions: [{ id: 'trend_month', label: 'Month', field: 'ts', type: 'temporal', bucket: 'month' }],
              filters: normalizedConfig.filters || [],
              date_range: trendDateRange,
            };
            if (tileConfig.eventType) trendRequest.event_type = tileConfig.eventType;

            const trendResponse = await fetch(`${API_BASE_URL}/query/tile`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(trendRequest),
            });
            if (trendResponse.ok) {
              const trendResult = await trendResponse.json();
              if (trendResult.ok && trendResult.data) {
                const sorted = (trendResult.data as any[])
                  .sort((a: any, b: any) => String(a.dimension_0 || '').localeCompare(String(b.dimension_0 || '')));
                const last12 = sorted.slice(-12);
                const values = last12.map((row: any) => Number(row.measure_value) || 0);
                if (values.length >= 2) setTrendData(values);
              }
            }
          }
        } catch (trendErr) {
          // Trend is non-critical — sparkline just won't show
        }
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error('Error fetching tile data:', err);
      setError(err.message || 'Failed to load data');
      setIsLoading(false);
    }
  };

  const configKey = useMemo(() => JSON.stringify(config), [config]);
  const filtersKey = useMemo(() => JSON.stringify(globalFilters), [globalFilters]);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [tileId, appKey, configKey, filtersKey, ignoreGlobalFilters]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center p-4">
          <p className="text-sm text-red-700">Failed to load tile data</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const tileConfig = config as TileConfig;
  const measures: Measure[] = tileConfig.measures || [(tileConfig as any).measure];
  // For number tiles, use the tile name as the label (shown under the big number)
  const measureLabel = (tileConfig.chartType === 'number' && tileName) ? tileName : (measures?.[0]?.label || 'Value');

  return (
    <div className="h-full relative">
      {showRefresh && (
        <div className="absolute top-0 right-0 z-10">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-1 hover:bg-gray-100/80 rounded transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      <div className="h-full">
        <TileChart
          data={data}
          chartType={tileConfig.chartType || 'bar'}
          dimensions={tileConfig.dimensions || []}
          measures={measures}
          measureLabel={measureLabel}
          isLoading={isLoading}
          pivotAxis={tileConfig.pivotAxis}
          showLabels={tileConfig.showLabels}
          flowSteps={tileConfig.flowSteps}
          computedFormula={tileConfig.computedFormula}
          trendData={trendData}
        />
      </div>
    </div>
  );
}

