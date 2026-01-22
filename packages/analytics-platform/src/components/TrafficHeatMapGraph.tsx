'use client';

import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Flame, Activity } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface TrafficHeatMapGraphProps {
  uiGraph: any;
  appKey: string;
}

export function TrafficHeatMapGraph({ uiGraph, appKey }: TrafficHeatMapGraphProps) {
  const [eventData, setEventData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    if (!appKey) return;
    fetchEventData();
  }, [appKey, timeRange]);

  const fetchEventData = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const rangeMap: Record<string, number> = {
        '1h': 1,
        '24h': 24,
        '7d': 24 * 7,
        '30d': 24 * 30
      };
      const hours = rangeMap[timeRange] || 24;
      const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

      const response = await fetch(`${API_BASE_URL}/query/tile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_key: appKey,
          event_type: 'PAGE_VIEW',
          measure: {
            aggregation: 'count',
            label: 'Page Views'
          },
          dimensions: ['data->path'],
          date_range: {
            start: startTime.toISOString(),
            end: now.toISOString()
          }
        })
      });

      const result = await response.json();
      if (result.ok) {
        setEventData(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch event data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate traffic intensity for each page
  const pageTraffic = useMemo(() => {
    const traffic: Record<string, number> = {};
    
    eventData.forEach((item: any) => {
      const path = item['data->path'] || item.path || '';
      const count = item.value || 0;
      if (path) {
        traffic[path] = (traffic[path] || 0) + count;
      }
    });

    return traffic;
  }, [eventData]);

  const maxTraffic = Math.max(...Object.values(pageTraffic), 1);

  // Get heat map color based on traffic
  const getHeatColor = (path: string) => {
    const traffic = pageTraffic[path] || 0;
    const intensity = traffic / maxTraffic;
    
    if (intensity === 0) return 'bg-gray-100 border-gray-300';
    if (intensity < 0.2) return 'bg-blue-100 border-blue-300';
    if (intensity < 0.4) return 'bg-blue-200 border-blue-400';
    if (intensity < 0.6) return 'bg-orange-200 border-orange-400';
    if (intensity < 0.8) return 'bg-orange-300 border-orange-500';
    return 'bg-red-300 border-red-500';
  };

  const getTrafficLabel = (path: string) => {
    const traffic = pageTraffic[path] || 0;
    if (traffic === 0) return 'No traffic';
    if (traffic < 10) return 'Low';
    if (traffic < 50) return 'Medium';
    if (traffic < 100) return 'High';
    return 'Very High';
  };

  const pages = useMemo(() => {
    if (!uiGraph?.pages) return [];
    return Object.entries(uiGraph.pages).map(([key, page]: [string, any]) => ({
      id: key,
      path: key,
      ...page,
      traffic: pageTraffic[key] || 0,
      heatColor: getHeatColor(key),
      trafficLabel: getTrafficLabel(key)
    }));
  }, [uiGraph, pageTraffic]);

  const sortedPages = [...pages].sort((a, b) => b.traffic - a.traffic);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-600" />
          <h3 className="text-sm font-bold text-gray-900">Traffic Heat Map</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {['1h', '24h', '7d', '30d'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-gray-600 font-medium">Traffic:</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
          <span className="text-gray-600">None</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-200 border border-blue-400 rounded"></div>
          <span className="text-gray-600">Low</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-200 border border-orange-400 rounded"></div>
          <span className="text-gray-600">Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-300 border border-red-500 rounded"></div>
          <span className="text-gray-600">High</span>
        </div>
      </div>

      {isLoading ? (
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <Activity className="w-8 h-8 animate-pulse text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading traffic data...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Visual Heat Map */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-xs font-bold text-gray-900 mb-3">Page Flow</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sortedPages.map((page) => (
                <div
                  key={page.id}
                  className={`p-3 rounded-lg border-2 transition-all hover:shadow-md ${page.heatColor}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-gray-900">
                        {page.name || page.id}
                      </div>
                      <div className="text-xs text-gray-600 font-mono mt-0.5">
                        {page.path || page.id}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {page.traffic.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">
                        {page.trafficLabel}
                      </div>
                    </div>
                  </div>

                  {/* Widgets on this page */}
                  {page.widgets && page.widgets.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-300/50">
                      <div className="text-xs text-gray-600">
                        {page.widgets.length} component{page.widgets.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Top Pages Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-xs font-bold text-gray-900 mb-3">Top Pages</h4>
            <div className="space-y-2">
              {sortedPages.slice(0, 10).map((page, idx) => {
                const percentage = maxTraffic > 0 ? (page.traffic / maxTraffic) * 100 : 0;
                
                return (
                  <div key={page.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-mono text-xs">#{idx + 1}</span>
                        <span className="text-gray-900 font-medium truncate max-w-[200px]">
                          {page.name || page.path}
                        </span>
                      </div>
                      <span className="text-gray-900 font-bold">
                        {page.traffic.toLocaleString()}
                      </span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              
              {sortedPages.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No page view data yet
                </div>
              )}
            </div>

            {/* Total Stats */}
            {sortedPages.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-900">
                      {Object.values(pageTraffic).reduce((a, b) => a + b, 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-700 mt-1">Total Views</div>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-indigo-900">
                      {sortedPages.filter(p => p.traffic > 0).length}
                    </div>
                    <div className="text-xs text-indigo-700 mt-1">Active Pages</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

