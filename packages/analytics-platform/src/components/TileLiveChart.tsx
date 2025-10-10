// components/TileLiveChart.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import TileChart from './TileChart';
import { TileConfig, Filter } from '../lib/tile-types';
import { buildTileQueryRequest, transformDataForChart } from '../lib/queryBuilder';
import { RefreshCw } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface TileLiveChartProps {
  tileId: string;
  config: TileConfig | any;
  appKey: string;
  showRefresh?: boolean;
  autoRefresh?: boolean; // Auto-refresh every 5 minutes
  globalFilters?: Filter[]; // Dashboard-level filters
  ignoreGlobalFilters?: boolean; // Opt-out of global filters
}

export default function TileLiveChart({
  tileId,
  config,
  appKey,
  showRefresh = false,
  autoRefresh = false,
  globalFilters = [],
  ignoreGlobalFilters = false,
}: TileLiveChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchCountRef = useRef(0);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if this is a valid chart config
      const tileConfig = config as TileConfig;
      
      // Handle both old (singular 'measure') and new (plural 'measures') format
      const measures = tileConfig.measures || [(tileConfig as any).measure];
      if (!measures || !measures[0]) {
        setIsLoading(false);
        setData([]);
        return;
      }

      // Normalize config to use 'measures' (plural)
      const normalizedConfig = {
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

      // Transform data for chart
      const transformedData = transformDataForChart(
        result.data || [],
        normalizedConfig.dimensions || [],
        measures[0]?.id || 'total_events'
      );

      setData(transformedData);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error fetching tile data:', err);
      setError(err.message || 'Failed to load data');
      setIsLoading(false);
    }
  };

  // Create stable keys for dependency tracking
  const configKey = useMemo(() => JSON.stringify(config), [config]);
  const filtersKey = useMemo(() => JSON.stringify(globalFilters), [globalFilters]);

  useEffect(() => {
    fetchData();

    // Optional: Auto-refresh every 5 minutes
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

  // Handle both old (singular 'measure') and new (plural 'measures') format for display
  const tileConfig = config as TileConfig;
  const measures = tileConfig.measures || [(tileConfig as any).measure];
  const measureLabel = measures?.[0]?.label || 'Value';

  return (
    <div className="h-full flex flex-col">
      {showRefresh && (
        <div className="flex justify-end mb-2">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}
      
      <TileChart
        data={data}
        chartType={tileConfig.chartType || 'bar'}
        dimensions={tileConfig.dimensions || []}
        measureLabel={measureLabel}
        isLoading={isLoading}
      />
    </div>
  );
}

