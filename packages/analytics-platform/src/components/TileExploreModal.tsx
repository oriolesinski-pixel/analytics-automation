// components/TileExploreModal.tsx
// Looker-style Explore modal for editing dashboard tiles in-place.
// Opens a self-contained analytics workspace pre-loaded with the tile's config.
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  X,
  Play,
  Save,
  Plus,
  Hash,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Layers,
  Activity,
  Clock,
  Calendar,
  Filter as FilterIcon,
  Tag,
  Palette,
  Loader2,
  BarChart3,
  LineChart as LineChartIcon,
  AreaChart as AreaChartIcon,
  PieChart as PieChartIcon,
  Table,
  TrendingDown,
  CircleDot,
  Network,
  Compass,
} from 'lucide-react';
import TileChart from './TileChart';
import CompactFilterBuilder from './CompactFilterBuilder';
import {
  TileConfig,
  Measure,
  Dimension,
  Filter,
  ChartType,
  ChartStyle,
  FlowStep,
  FlowStepCondition,
  SortDirection,
  MEASURES,
  DIMENSIONS,
  EVENT_TYPES,
  DATE_RANGES,
  getMeasuresForEventType,
  getDimensionsForEventType,
} from '../lib/tile-types';
import { buildTileQueryRequest, transformDataForChart, suggestChartType } from '../lib/queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

/* ─── Props ──────────────────────────────────────────── */

interface TileExploreModalProps {
  tileId: string;
  tileName: string;
  tileDescription?: string;
  initialConfig: TileConfig;
  appKey: string;
  onSave: (tileId: string, config: TileConfig) => Promise<void>;
  onClose: () => void;
}

/* ─── Helpers ────────────────────────────────────────── */

function dateRangeKeyFromConfig(config: TileConfig): string {
  const now = Date.now();
  const start = config.dateRange?.start instanceof Date
    ? config.dateRange.start.getTime()
    : new Date(config.dateRange?.start || 0).getTime();
  const diffMs = now - start;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 0.1) return '1h';
  if (diffDays <= 1.5) return '24h';
  if (diffDays <= 10) return '7d';
  if (diffDays <= 45) return '30d';
  if (diffDays <= 100) return '90d';
  if (diffDays <= 200) return '6m';
  if (diffDays <= 400) return '1y';
  return '2y';
}

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#3b82f6', '#0ea5e9',
  '#14b8a6', '#10b981', '#22c55e', '#eab308', '#f59e0b',
  '#f97316', '#ef4444', '#ec4899', '#64748b', '#1e293b',
];

/* ─── Main Component ─────────────────────────────────── */

export default function TileExploreModal({
  tileId,
  tileName,
  tileDescription,
  initialConfig,
  appKey,
  onSave,
  onClose,
}: TileExploreModalProps) {
  // ── Config state ──
  const [config, setConfig] = useState<TileConfig>(() => ({
    ...initialConfig,
    measures: initialConfig.measures?.length ? initialConfig.measures : [MEASURES[0]],
    dimensions: initialConfig.dimensions || [],
    filters: initialConfig.filters || [],
    dateRange: initialConfig.dateRange || DATE_RANGES[3].getRange(),
    chartType: initialConfig.chartType || 'bar',
    style: initialConfig.style || {},
  }));
  const [dateRangeKey, setDateRangeKey] = useState(() => dateRangeKeyFromConfig(initialConfig));

  // ── Query state ──
  const [queryResult, setQueryResult] = useState<{ data: any[]; metadata: any } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── UI state ──
  const [isSaving, setIsSaving] = useState(false);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [measuresExpanded, setMeasuresExpanded] = useState(true);
  const [dimensionsExpanded, setDimensionsExpanded] = useState(true);

  const queryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Available measures / dimensions based on event type ──
  const availableMeasures = useMemo(() => getMeasuresForEventType(config.eventType), [config.eventType]);
  const availableDimensions = useMemo(() => getDimensionsForEventType(config.eventType), [config.eventType]);
  const temporalDimensions = useMemo(() => availableDimensions.filter(d => d.type === 'temporal'), [availableDimensions]);
  const categoricalDimensions = useMemo(() => availableDimensions.filter(d => d.type === 'categorical'), [availableDimensions]);

  // ── Config helpers ──
  const updateConfig = useCallback((patch: Partial<TileConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
  }, []);

  const addMeasure = useCallback((m: Measure) => {
    setConfig(prev => {
      if (prev.measures.some(x => x.id === m.id)) return prev;
      return { ...prev, measures: [...prev.measures, m] };
    });
  }, []);

  const removeMeasure = useCallback((id: string) => {
    setConfig(prev => ({ ...prev, measures: prev.measures.filter(m => m.id !== id) }));
  }, []);

  const addDimension = useCallback((d: Dimension) => {
    setConfig(prev => {
      if (prev.dimensions.length >= 3 || prev.dimensions.some(x => x.id === d.id)) return prev;
      return { ...prev, dimensions: [...prev.dimensions, d] };
    });
  }, []);

  const removeDimension = useCallback((id: string) => {
    setConfig(prev => ({ ...prev, dimensions: prev.dimensions.filter(d => d.id !== id) }));
  }, []);

  const addFilter = useCallback((f: Filter) => {
    setConfig(prev => ({ ...prev, filters: [...prev.filters, f] }));
    setShowFilterBuilder(false);
  }, []);

  const removeFilter = useCallback((id: string) => {
    setConfig(prev => ({ ...prev, filters: prev.filters.filter(f => f.id !== id) }));
  }, []);

  const setChartType = useCallback((chartType: ChartType) => {
    updateConfig({ chartType });
  }, [updateConfig]);

  const handleDateRangeChange = useCallback((key: string) => {
    const range = DATE_RANGES.find(r => r.value === key);
    if (range) {
      setDateRangeKey(key);
      updateConfig({ dateRange: range.getRange() });
    }
  }, [updateConfig]);

  const toggleSort = useCallback(() => {
    setConfig(prev => {
      const current = prev.sortDirection || 'none';
      const next: SortDirection = current === 'none' ? 'desc' : current === 'desc' ? 'asc' : 'none';
      return { ...prev, sortDirection: next };
    });
  }, []);

  const toggleMeasureAxis = useCallback((measureId: string) => {
    setConfig(prev => ({
      ...prev,
      measures: prev.measures.map(m =>
        m.id === measureId ? { ...m, yAxis: (m.yAxis || 'left') === 'left' ? 'right' as const : 'left' as const } : m
      ),
    }));
  }, []);

  const setStyle = useCallback((updates: Partial<ChartStyle>) => {
    setConfig(prev => ({ ...prev, style: { ...(prev.style || {}), ...updates } }));
  }, []);

  // ── Query execution ──
  const executeQuery = useCallback(async () => {
    if (!appKey || config.measures.length === 0) return;

    if (config.chartType === 'flow') {
      if (!config.flowSteps || config.flowSteps.length === 0) return;

      setIsLoading(true);
      setError(null);
      try {
        const startDate = config.dateRange?.start instanceof Date
          ? config.dateRange.start.toISOString() : config.dateRange?.start;
        const endDate = config.dateRange?.end instanceof Date
          ? config.dateRange.end.toISOString() : config.dateRange?.end;

        const res = await fetch(`${API_BASE_URL}/query/flow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_key: appKey,
            flow_steps: config.flowSteps,
            measure: { aggregation: config.measures[0].aggregation, field: config.measures[0].field },
            date_range: { start: startDate, end: endDate },
          }),
        });
        const result = await res.json();
        if (!result.ok) throw new Error(result.error || 'Flow query failed');
        setQueryResult({ data: result.data, metadata: result.metadata });
      } catch (err: any) {
        setError(err.message);
        setQueryResult(null);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const queryRequest = buildTileQueryRequest(config, appKey);
      const res = await fetch(`${API_BASE_URL}/query/tile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryRequest),
      });
      const result = await res.json();
      if (!result.ok) throw new Error(result.error || 'Query failed');

      let transformed = transformDataForChart(
        result.data || [],
        config.dimensions || [],
        config.measures[0]?.id || 'total_events',
        config.measures.length > 1 ? config.measures : undefined,
        config.computedFormula,
      );

      if (config.sortDirection && config.sortDirection !== 'none') {
        transformed = transformed.sort((a, b) => {
          const av = a.value || 0;
          const bv = b.value || 0;
          return config.sortDirection === 'asc' ? av - bv : bv - av;
        });
      }

      setQueryResult({ data: transformed, metadata: result.metadata });
    } catch (err: any) {
      setError(err.message);
      setQueryResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [appKey, config]);

  // Auto-execute query on config changes (debounced)
  useEffect(() => {
    if (queryTimerRef.current) clearTimeout(queryTimerRef.current);
    queryTimerRef.current = setTimeout(() => {
      if (config.measures.length > 0) executeQuery();
    }, 600);
    return () => { if (queryTimerRef.current) clearTimeout(queryTimerRef.current); };
  }, [
    config.eventType,
    config.measures,
    config.dimensions,
    config.filters,
    config.dateRange,
    config.sortDirection,
    config.flowSteps,
    config.chartType,
  ]);

  // ── Save handler ──
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(tileId, config);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Computed ──
  const canPivot = ['bar', 'line', 'area'].includes(config.chartType) && config.dimensions.length > 0;
  const canSort = config.dimensions.length > 0 && ['bar', 'line', 'area', 'table'].includes(config.chartType);
  const showAxisToggle = config.measures.length >= 2 && ['line', 'area', 'bar'].includes(config.chartType);
  const sortDir = config.sortDirection || 'none';
  const SortIcon = sortDir === 'desc' ? ArrowDown : sortDir === 'asc' ? ArrowUp : ArrowUpDown;
  const sortLabel = sortDir === 'desc' ? 'High→Low' : sortDir === 'asc' ? 'Low→High' : 'Sort';

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-10 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-[1400px] h-[calc(100vh-5rem)] lg:h-[calc(100vh-6rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200/60 dark:border-gray-700/60">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 text-white shadow-lg flex-shrink-0 rounded-t-2xl">
        <div className="px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-white/15 rounded-lg">
              <Compass className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight leading-tight">
                Explore: {tileName}
              </h2>
              {tileDescription && (
                <p className="text-[11px] text-indigo-200/80 mt-0.5 leading-tight">{tileDescription}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-8 px-3.5 text-xs font-semibold text-indigo-100 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="h-8 px-4 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-all shadow-md shadow-emerald-600/30 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isSaving ? 'Saving…' : 'Apply & Save'}
            </button>
          </div>
        </div>

        {/* ── Toolbar Row ── */}
        <div className="px-5 pb-3 flex items-center gap-3 flex-wrap">
          {/* Event Type */}
          <select
            value={config.eventType || ''}
            onChange={(e) => updateConfig({ eventType: e.target.value || undefined })}
            className="h-7 px-2 text-[11px] font-medium bg-white/15 border border-white/20 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-white/40 appearance-none cursor-pointer"
          >
            <option value="" className="text-gray-900">All Events</option>
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value} className="text-gray-900">{t.label}</option>)}
          </select>

          <div className="w-px h-5 bg-white/20" />

          {/* Date Range */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-indigo-200" />
            <select
              value={dateRangeKey}
              onChange={(e) => handleDateRangeChange(e.target.value)}
              className="h-7 px-2 text-[11px] font-medium bg-white/15 border border-white/20 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-white/40 appearance-none cursor-pointer"
            >
              {DATE_RANGES.map(r => <option key={r.value} value={r.value} className="text-gray-900">{r.label}</option>)}
            </select>
          </div>

          <div className="w-px h-5 bg-white/20" />

          {/* Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <FilterIcon className="w-3 h-3 text-indigo-200" />
            {config.filters.map(f => (
              <span key={f.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-white/15 border border-white/20 rounded text-[10px] text-white font-medium">
                {f.field} {f.operator} {String(f.value)}
                <button onClick={() => removeFilter(f.id)} className="hover:bg-white/20 rounded p-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            {showFilterBuilder ? (
              <div className="relative">
                <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 min-w-[280px]">
                  <CompactFilterBuilder
                    onAdd={addFilter}
                    onCancel={() => setShowFilterBuilder(false)}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowFilterBuilder(true)}
                className="inline-flex items-center gap-1 h-6 px-2 text-[10px] font-semibold bg-white/15 hover:bg-white/25 border border-white/20 rounded text-indigo-100 transition-colors"
              >
                <Plus className="w-2.5 h-2.5" /> Filter
              </button>
            )}
          </div>

          <div className="flex-1" />

          {/* Run */}
          <button
            onClick={executeQuery}
            disabled={isLoading}
            className="h-7 px-3 text-[11px] font-bold bg-white/20 hover:bg-white/30 rounded-md text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Run
          </button>
        </div>
      </div>

      {/* ── Body: sidebar + main ── */}
      <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-gray-900 rounded-b-2xl">
        {/* ── Left Sidebar: Measures & Dimensions ── */}
        <div className="w-56 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto custom-scrollbar">
          <div className="p-3 space-y-3">
            {/* Measures */}
            <div>
              <button
                onClick={() => setMeasuresExpanded(!measuresExpanded)}
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-all"
              >
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-blue-500" />
                  Measures
                </span>
                {measuresExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {measuresExpanded && (
                <div className="mt-1.5 space-y-0.5">
                  {availableMeasures.map(m => {
                    const isSelected = config.measures.some(x => x.id === m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => isSelected ? removeMeasure(m.id) : addMeasure(m)}
                        className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-all ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-500/30'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Hash className="w-3 h-3 text-blue-400 flex-shrink-0" />
                          <span className="truncate">{m.label}</span>
                        </div>
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 ml-4.5 block">{m.aggregation}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dimensions */}
            <div>
              <button
                onClick={() => setDimensionsExpanded(!dimensionsExpanded)}
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-all"
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-purple-500" />
                  Dimensions
                </span>
                {dimensionsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {dimensionsExpanded && (
                <div className="mt-1.5 space-y-2">
                  {temporalDimensions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-pink-500 dark:text-pink-400 uppercase tracking-wider mb-1 px-1.5">
                        <Clock className="w-2.5 h-2.5" /> Temporal
                      </div>
                      <div className="space-y-0.5">
                        {temporalDimensions.map(d => {
                          const isSelected = config.dimensions.some(x => x.id === d.id);
                          return (
                            <button
                              key={d.id}
                              onClick={() => isSelected ? removeDimension(d.id) : addDimension(d)}
                              disabled={!isSelected && config.dimensions.length >= 3}
                              className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-all ${
                                isSelected
                                  ? 'bg-pink-50 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 font-semibold border border-pink-200 dark:border-pink-500/30'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent disabled:opacity-40 disabled:cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <ArrowUpDown className="w-3 h-3 text-pink-400 flex-shrink-0" />
                                <span className="truncate">{d.label}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {categoricalDimensions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-purple-500 dark:text-purple-400 uppercase tracking-wider mb-1 px-1.5">
                        <Layers className="w-2.5 h-2.5" /> Categorical
                      </div>
                      <div className="space-y-0.5">
                        {categoricalDimensions.map(d => {
                          const isSelected = config.dimensions.some(x => x.id === d.id);
                          return (
                            <button
                              key={d.id}
                              onClick={() => isSelected ? removeDimension(d.id) : addDimension(d)}
                              disabled={!isSelected && config.dimensions.length >= 3}
                              className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-all ${
                                isSelected
                                  ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-500/30'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent disabled:opacity-40 disabled:cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <ArrowUpDown className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                <span className="truncate">{d.label}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Main Area ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Selected config pills + chart type bar */}
          <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-5 py-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Selected Measures */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Measures:</span>
                {config.measures.map(m => (
                  <span key={m.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 rounded text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                    {m.label}
                    {showAxisToggle && (
                      <button
                        onClick={() => toggleMeasureAxis(m.id)}
                        className={`ml-0.5 px-1 py-px text-[8px] font-bold rounded transition-colors ${
                          (m.yAxis || 'left') === 'right'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/30 dark:text-amber-300'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-300'
                        }`}
                      >
                        {(m.yAxis || 'left') === 'right' ? 'R' : 'L'}
                      </button>
                    )}
                    <button onClick={() => removeMeasure(m.id)} className="hover:bg-blue-100 dark:hover:bg-blue-500/30 rounded p-0.5">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>

              {config.dimensions.length > 0 && (
                <>
                  <div className="w-px h-4 bg-gray-200 dark:bg-gray-600" />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Split by:</span>
                    {config.dimensions.map(d => (
                      <span key={d.id} className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded text-[10px] font-semibold border ${
                        d.type === 'temporal'
                          ? 'bg-pink-50 dark:bg-pink-500/15 border-pink-200 dark:border-pink-500/30 text-pink-700 dark:text-pink-300'
                          : 'bg-purple-50 dark:bg-purple-500/15 border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300'
                      }`}>
                        {d.label}
                        <button onClick={() => removeDimension(d.id)} className="hover:bg-gray-100 dark:hover:bg-gray-600 rounded p-0.5">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div className="flex-1" />

              {/* Chart controls */}
              <div className="flex items-center gap-1.5">
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-md p-0.5 gap-px">
                  {([
                    { type: 'number' as ChartType, icon: Hash, disabled: config.dimensions.length > 0 },
                    { type: 'line' as ChartType, icon: LineChartIcon, disabled: false },
                    { type: 'area' as ChartType, icon: AreaChartIcon, disabled: false },
                    { type: 'bar' as ChartType, icon: BarChart3, disabled: false },
                    { type: 'pie' as ChartType, icon: PieChartIcon, disabled: config.dimensions.length !== 1 },
                    { type: 'funnel' as ChartType, icon: TrendingDown, disabled: config.dimensions.length !== 1 },
                    { type: 'scatter' as ChartType, icon: CircleDot, disabled: config.dimensions.length !== 1 },
                    { type: 'flow' as ChartType, icon: Network, disabled: false },
                    { type: 'table' as ChartType, icon: Table, disabled: false },
                  ]).map(({ type, icon: Icon, disabled }) => (
                    <button
                      key={type}
                      onClick={() => setChartType(type as ChartType)}
                      disabled={disabled}
                      className={`p-1.5 rounded transition-all ${
                        config.chartType === type
                          ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                      title={type}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>

                {['bar', 'line', 'area'].includes(config.chartType) && (
                  <button
                    onClick={() => setShowLabels(!showLabels)}
                    className={`p-1.5 rounded-md border text-[10px] font-semibold transition-all ${
                      showLabels
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                    }`}
                    title="Toggle labels"
                  >
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                )}

                {canSort && config.chartType !== 'flow' && (
                  <button
                    onClick={toggleSort}
                    className={`p-1.5 rounded-md border text-[10px] font-semibold transition-all ${
                      sortDir !== 'none'
                        ? 'bg-purple-50 dark:bg-purple-500/20 border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-400'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                    }`}
                    title={sortLabel}
                  >
                    <SortIcon className="w-3.5 h-3.5" />
                  </button>
                )}

                {canPivot && config.chartType !== 'flow' && (
                  <button
                    onClick={() => updateConfig({ pivotAxis: !config.pivotAxis })}
                    className={`p-1.5 rounded-md border text-[10px] font-semibold transition-all ${
                      config.pivotAxis
                        ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/30 text-blue-700 dark:text-blue-400'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                    }`}
                    title="Pivot"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => setShowStylePanel(!showStylePanel)}
                  className={`p-1.5 rounded-md border text-[10px] font-semibold transition-all ${
                    showStylePanel
                      ? 'bg-indigo-50 dark:bg-indigo-500/20 border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                  }`}
                  title="Appearance"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Chart area */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            {/* Style panel (collapsible) */}
            {showStylePanel && (
              <ExploreStylePanel chartType={config.chartType} style={config.style || {}} onChange={setStyle} />
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
                <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Query metadata */}
            {queryResult && !isLoading && (
              <div className="mb-3 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>{queryResult.metadata?.total_rows ?? 0} row{(queryResult.metadata?.total_rows ?? 0) !== 1 ? 's' : ''}</span>
                <span>Query: {queryResult.metadata?.query_time_ms ?? 0}ms</span>
              </div>
            )}

            {/* Chart */}
            <div
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-opacity duration-200"
              style={{ opacity: isLoading ? 0.5 : 1, minHeight: '320px' }}
            >
              <TileChart
                data={queryResult?.data || []}
                chartType={config.chartType}
                dimensions={config.dimensions}
                measures={config.measures}
                measureLabel={config.measures.length > 0 ? config.measures[0].label : 'Value'}
                isLoading={isLoading}
                pivotAxis={config.pivotAxis}
                showLabels={showLabels}
                flowSteps={config.flowSteps}
                style={config.style}
              />
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

/* ─── Compact Style Panel for Explore ─────────────────── */

function ExploreStylePanel({ chartType, style, onChange }: {
  chartType: ChartType;
  style: ChartStyle;
  onChange: (updates: Partial<ChartStyle>) => void;
}) {
  const isBar = chartType === 'bar';
  const isPie = chartType === 'pie';
  const isLine = chartType === 'line';
  const isArea = chartType === 'area';
  const isNumber = chartType === 'number';
  const isChart = isBar || isPie || isLine || isArea;

  return (
    <div className="mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Palette className="w-3 h-3" /> Appearance
        </h3>
      </div>
      <div className="p-4 space-y-4">
        {isChart && (
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Color</label>
            <div className="flex flex-wrap gap-1">
              {CHART_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => onChange({ primaryColor: c })}
                  className={`w-5 h-5 rounded transition-all ${
                    (style.primaryColor || '#6366f1') === c ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        )}

        {isChart && !isPie && (
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Toggles</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'showXAxis', label: 'X Axis', val: style.showXAxis !== false },
                { key: 'showYAxis', label: 'Y Axis', val: style.showYAxis !== false },
                { key: 'showGridLines', label: 'Grid', val: style.showGridLines !== false },
                { key: 'showValueLabels', label: 'Values', val: style.showValueLabels === true },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => onChange({ [t.key]: !t.val } as any)}
                  className={`px-2 py-0.5 text-[9px] font-semibold rounded border transition-all ${
                    t.val ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isBar && (
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-gray-400 w-16 flex-shrink-0">Radius</span>
            <input type="range" min={0} max={12} value={style.barRadius ?? 4}
              onChange={e => onChange({ barRadius: Number(e.target.value) })}
              className="flex-1 h-1 bg-gray-200 rounded-full appearance-none accent-indigo-500" />
            <span className="text-[9px] text-gray-400 w-6 text-right">{style.barRadius ?? 4}</span>
          </div>
        )}

        {(isLine || isArea) && (
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-gray-400 w-16 flex-shrink-0">Stroke</span>
            <input type="range" min={1} max={4} value={style.strokeWidth ?? 2}
              onChange={e => onChange({ strokeWidth: Number(e.target.value) })}
              className="flex-1 h-1 bg-gray-200 rounded-full appearance-none accent-indigo-500" />
            <span className="text-[9px] text-gray-400 w-6 text-right">{style.strokeWidth ?? 2}</span>
          </div>
        )}

        {isPie && (
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-gray-400 w-16 flex-shrink-0">Inner R</span>
            <input type="range" min={0} max={70} value={style.innerRadius ?? 35}
              onChange={e => onChange({ innerRadius: Number(e.target.value) })}
              className="flex-1 h-1 bg-gray-200 rounded-full appearance-none accent-indigo-500" />
            <span className="text-[9px] text-gray-400 w-6 text-right">{style.innerRadius ?? 35}%</span>
          </div>
        )}

        {isNumber && (
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Size</label>
            <div className="flex gap-1.5">
              {(['compact', 'default', 'large'] as const).map(s => (
                <button key={s} onClick={() => onChange({ numberSize: s })}
                  className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded border transition-all capitalize ${
                    (style.numberSize || 'default') === s
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
