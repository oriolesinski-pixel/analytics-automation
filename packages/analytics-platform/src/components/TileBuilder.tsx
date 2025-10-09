// components/TileBuilder.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  X,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Table,
  Hash,
  Download,
  Play,
  Save,
  Filter as FilterIcon,
  Calendar,
  TrendingDown,
  CircleDot,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Network,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Activity,
  Layers,
  Clock,
  Tag,
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TileChart from './TileChart';
import SaveTileModal from './SaveTileModal';
import { useTileStore } from '../lib/useTileStore';
import { useDashboardStore } from '../lib/useDashboardStore';
import {
  MEASURES,
  DIMENSIONS,
  EVENT_TYPES,
  DATE_RANGES,
  Measure,
  Dimension,
  Filter,
  ChartType,
  getMeasuresForEventType,
  getDimensionsForEventType,
} from '../lib/tile-types';
import { exportToCSV, suggestChartType } from '../lib/queryBuilder';
import { v4 as uuidv4 } from 'uuid';

interface TileBuilderProps {
  appKey: string;
}

interface DraggableItem {
  id: string;
  type: 'measure' | 'dimension';
  data: Measure | Dimension;
}

function SortableDimensionChip({ dimension, onRemove }: { dimension: Dimension; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dimension.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-md text-sm font-medium text-indigo-700"
    >
      <GripVertical {...attributes} {...listeners} className="w-3 h-3 cursor-grab active:cursor-grabbing text-indigo-400" />
      <span>{dimension.label}</span>
      <button
        onClick={onRemove}
        className="ml-1 hover:bg-indigo-200 rounded-full p-0.5 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function TileBuilder({ appKey }: TileBuilderProps) {
  const router = useRouter();
  const store = useTileStore();
  const dashboardStore = useDashboardStore();
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [returnToDashboard, setReturnToDashboard] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [measuresExpanded, setMeasuresExpanded] = useState(true);
  const [dimensionsExpanded, setDimensionsExpanded] = useState(true);
  const [leftWidth, setLeftWidth] = useState(240);
  const [middleWidth, setMiddleWidth] = useState(350);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingMiddle, setIsResizingMiddle] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const dashboardId = params.get('dashboard');
      if (dashboardId) {
        setReturnToDashboard(dashboardId);
      }
    }
  }, []);

  useEffect(() => {
    store.setAppKey(appKey);
  }, [appKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (appKey && store.config.measure) {
        store.executeQuery();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    store.config.eventType,
    store.config.measure,
    store.config.dimensions,
    store.config.filters,
    store.config.dateRange,
    store.config.sortDirection,
    appKey,
  ]);

  const handleExport = () => {
    if (store.queryResult?.data) {
      exportToCSV(store.queryResult.data, 'analytics-tile-data.csv');
    }
  };

  const handleAutoSelectChart = () => {
    const suggestedType = suggestChartType(store.config.dimensions) as ChartType;
    store.setChartType(suggestedType);
  };

  const handleSaveTile = async (name: string, description?: string) => {
    try {
      const tileId = await dashboardStore.saveTile(name, description, store.config, appKey);
      console.log('Tile saved successfully:', tileId);
      setShowSaveModal(false);
      
      if (returnToDashboard) {
        const layout = {
          x: 0,
          y: 0,
          w: 6,
          h: 4,
          minW: 3,
          minH: 3,
        };
        await dashboardStore.addTileToDashboard(returnToDashboard, tileId, layout);
        router.push(`/dashboards/${returnToDashboard}`);
      } else {
        router.push('/workspace');
      }
    } catch (error: any) {
      console.error('Failed to save tile:', error);
      throw error;
    }
  };

  const availableMeasures = getMeasuresForEventType(store.config.eventType);
  const availableDimensions = getDimensionsForEventType(store.config.eventType);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeData = active.data.current as DraggableItem | undefined;
    const overZone = over.id as string;

    if (activeData?.type === 'measure' && overZone === 'measure-dropzone') {
      store.setMeasure(activeData.data as Measure);
    } else if (activeData?.type === 'dimension' && overZone === 'dimensions-dropzone') {
      if (store.config.dimensions.length < 3) {
        store.addDimension(activeData.data as Dimension);
      }
    } else if (overZone === 'dimensions-dropzone' && active.id !== over.id) {
      // Reordering dimensions
      const oldIndex = store.config.dimensions.findIndex(d => d.id === active.id);
      const newIndex = store.config.dimensions.findIndex(d => d.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newDimensions = arrayMove(store.config.dimensions, oldIndex, newIndex);
        // Update dimensions in order
        store.config.dimensions.forEach(d => store.removeDimension(d.id));
        newDimensions.forEach(d => store.addDimension(d));
      }
    }
  };

  const canPivot = ['bar', 'line'].includes(store.config.chartType) && store.config.dimensions.length > 0;
  const canSort = store.config.dimensions.length > 0 && ['bar', 'line', 'table'].includes(store.config.chartType);
  
  const getSortIcon = () => {
    const sortDir = store.config.sortDirection || 'none';
    if (sortDir === 'desc') return ArrowDown;
    if (sortDir === 'asc') return ArrowUp;
    return ArrowUpDown;
  };
  
  const getSortLabel = () => {
    const sortDir = store.config.sortDirection || 'none';
    if (sortDir === 'desc') return 'High→Low';
    if (sortDir === 'asc') return 'Low→High';
    return 'Sort';
  };

  const getTemporalDimensions = () => availableDimensions.filter(d => d.type === 'temporal');
  const getCategoricalDimensions = () => availableDimensions.filter(d => d.type === 'categorical');

  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        // Calculate new width relative to the viewport, accounting for sidebar
        const sidebarWidth = 220; // approximate left sidebar width
        const newWidth = Math.max(200, Math.min(400, e.clientX - sidebarWidth));
        setLeftWidth(newWidth);
      } else if (isResizingMiddle) {
        // Calculate middle panel width relative to left panel's right edge
        const sidebarWidth = 220;
        const newWidth = Math.max(300, Math.min(500, e.clientX - sidebarWidth - leftWidth));
        setMiddleWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingMiddle(false);
    };

    if (isResizingLeft || isResizingMiddle) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, isResizingMiddle, leftWidth]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col bg-gray-50">
        {/* TOP BAR */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Event Type:</label>
              <select
                value={store.config.eventType || ''}
                onChange={(e) => store.setEventType(e.target.value || undefined)}
                className="min-w-[200px] px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">All Events</option>
                {EVENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-6 w-px bg-gray-300" />

            <div className="flex items-center gap-2 flex-1">
              <FilterIcon className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-semibold text-gray-700">Filters:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {store.config.filters.map((filter) => (
                  <div
                    key={filter.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs"
                  >
                    <span className="font-medium text-blue-900">{filter.field}</span>
                    <span className="text-blue-600">{filter.operator}</span>
                    <span className="text-blue-900">{String(filter.value)}</span>
                    <button
                      onClick={() => store.removeFilter(filter.id)}
                      className="ml-1 p-0.5 hover:bg-blue-100 rounded transition-colors"
                    >
                      <X className="w-3 h-3 text-blue-600" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setShowFilterBuilder(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-medium text-gray-700 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Filter
                </button>
              </div>
            </div>

            <div className="h-6 w-px bg-gray-300" />

            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-600" />
              <select
                value={DATE_RANGES.find(r => r.getRange().start.getTime() === store.config.dateRange.start.getTime())?.value || '7d'}
                onChange={(e) => store.setDateRange(e.target.value)}
                className="min-w-[150px] px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {DATE_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Filter Builder Modal */}
        {showFilterBuilder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <FilterBuilder
                onAdd={(filter) => {
                  store.addFilter(filter);
                  setShowFilterBuilder(false);
                }}
                onCancel={() => setShowFilterBuilder(false)}
              />
            </div>
          </div>
        )}

        {/* Main Content - Three Column Layout */}
        <div className="flex-1 flex gap-0 overflow-hidden relative">
          {/* LEFT SIDEBAR - Resizable */}
          <div 
            className="bg-white border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0"
            style={{ width: `${leftWidth}px` }}
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              
              {/* MEASURES Section */}
              <div>
                <button
                  onClick={() => setMeasuresExpanded(!measuresExpanded)}
                  className="w-full flex items-center justify-between mb-3 px-2 py-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-blue-500" />
                    <span>Measures</span>
                  </div>
                  {measuresExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                
                <div className={`space-y-1 overflow-hidden transition-all duration-200 ${
                  measuresExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  {availableMeasures.map((measure) => (
                    <DraggableMeasure
                      key={measure.id}
                      measure={measure}
                      onClick={() => store.setMeasure(measure)}
                    />
                  ))}
                </div>
              </div>

              {/* DIMENSIONS Section */}
              <div>
                <button
                  onClick={() => setDimensionsExpanded(!dimensionsExpanded)}
                  className="w-full flex items-center justify-between mb-3 px-2 py-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:bg-gray-50 rounded-lg transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-purple-500" />
                    <span>Dimensions</span>
                  </div>
                  {dimensionsExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                
                <div className={`space-y-3 overflow-hidden transition-all duration-200 ${
                  dimensionsExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  {/* Temporal Dimensions */}
                  {getTemporalDimensions().length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-pink-600 uppercase tracking-wider mb-1.5 px-1">
                        <Clock className="w-3 h-3" />
                        <span>Temporal</span>
                      </div>
                      <div className="space-y-1">
                        {getTemporalDimensions().map((dimension) => {
                          const isSelected = store.config.dimensions.some(d => d.id === dimension.id);
                          return (
                            <DraggableDimension
                              key={dimension.id}
                              dimension={dimension}
                              isSelected={isSelected}
                              isTemporal={true}
                              onClick={() => {
                                if (!isSelected && store.config.dimensions.length < 3) {
                                  store.addDimension(dimension);
                                }
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Categorical Dimensions */}
                  {getCategoricalDimensions().length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-1.5 px-1">
                        <Layers className="w-3 h-3" />
                        <span>Categorical</span>
                      </div>
                      <div className="space-y-1">
                        {getCategoricalDimensions().map((dimension) => {
                          const isSelected = store.config.dimensions.some(d => d.id === dimension.id);
                          return (
                            <DraggableDimension
                              key={dimension.id}
                              dimension={dimension}
                              isSelected={isSelected}
                              isTemporal={false}
                              onClick={() => {
                                if (!isSelected && store.config.dimensions.length < 3) {
                                  store.addDimension(dimension);
                                }
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* LEFT RESIZE HANDLE */}
          <div
            className="w-1 bg-gray-200 hover:bg-indigo-400 cursor-col-resize transition-colors relative group flex-shrink-0"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingLeft(true);
            }}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>

          {/* MIDDLE - Drop Zones - Resizable */}
          <div 
            className="bg-gray-50 p-6 space-y-6 overflow-y-auto custom-scrollbar flex-shrink-0"
            style={{ width: `${middleWidth}px` }}
          >
            
            {/* MEASURE Drop Zone */}
            <MeasureDropZone
              measure={store.config.measure}
              onRemove={() => store.setMeasure(availableMeasures[0])}
            />

            {/* DIMENSIONS Drop Zone */}
            <DimensionsDropZone
              dimensions={store.config.dimensions}
              onRemove={(id) => store.removeDimension(id)}
            />
          </div>

          {/* MIDDLE RESIZE HANDLE */}
          <div
            className="w-1 bg-gray-200 hover:bg-indigo-400 cursor-col-resize transition-colors relative group flex-shrink-0"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingMiddle(true);
            }}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>

          {/* RIGHT - Preview (flex) */}
          <div className="flex-1 bg-white p-6 overflow-y-auto custom-scrollbar min-w-0">
            {/* Chart Controls */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
              
              <div className="flex items-center space-x-3">
                {/* Chart Type Selector */}
                <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
                  <ChartTypeButton
                    type="number"
                    icon={Hash}
                    active={store.config.chartType === 'number'}
                    onClick={() => store.setChartType('number')}
                    disabled={store.config.dimensions.length > 0}
                  />
                  <ChartTypeButton
                    type="line"
                    icon={LineChartIcon}
                    active={store.config.chartType === 'line'}
                    onClick={() => store.setChartType('line')}
                  />
                  <ChartTypeButton
                    type="bar"
                    icon={BarChart3}
                    active={store.config.chartType === 'bar'}
                    onClick={() => store.setChartType('bar')}
                  />
                  <ChartTypeButton
                    type="pie"
                    icon={PieChartIcon}
                    active={store.config.chartType === 'pie'}
                    onClick={() => store.setChartType('pie')}
                    disabled={store.config.dimensions.length !== 1}
                  />
                  <ChartTypeButton
                    type="funnel"
                    icon={TrendingDown}
                    active={store.config.chartType === 'funnel'}
                    onClick={() => store.setChartType('funnel')}
                    disabled={store.config.dimensions.length !== 1}
                  />
                  <ChartTypeButton
                    type="scatter"
                    icon={CircleDot}
                    active={store.config.chartType === 'scatter'}
                    onClick={() => store.setChartType('scatter')}
                    disabled={store.config.dimensions.length !== 1}
                  />
                  <ChartTypeButton
                    type="sankey"
                    icon={Network}
                    active={store.config.chartType === 'sankey'}
                    onClick={() => store.setChartType('sankey')}
                    disabled={store.config.dimensions.length > 0}
                  />
                  <ChartTypeButton
                    type="table"
                    icon={Table}
                    active={store.config.chartType === 'table'}
                    onClick={() => store.setChartType('table')}
                  />
                </div>

                {/* Labels Toggle */}
                {['bar', 'line'].includes(store.config.chartType) && (
                  <button
                    onClick={() => setShowLabels(!showLabels)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors font-medium ${
                      showLabels
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                    title="Toggle data labels"
                  >
                    <Tag className="w-4 h-4" />
                    <span>Labels</span>
                  </button>
                )}

                {canSort && (
                  <button
                    onClick={() => {
                      store.toggleSort();
                    }}
                    className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-all font-medium ${
                      store.config.sortDirection && store.config.sortDirection !== 'none'
                        ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                    title={`Sort by value: ${getSortLabel().toLowerCase()}`}
                  >
                    {React.createElement(getSortIcon(), { className: 'w-4 h-4' })}
                    <span>{getSortLabel()}</span>
                  </button>
                )}

                {canPivot && (
                  <button
                    onClick={() => store.setPivotAxis(!store.config.pivotAxis)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors font-medium ${
                      store.config.pivotAxis
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Pivot</span>
                  </button>
                )}

                <button
                  onClick={handleAutoSelectChart}
                  className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                >
                  Auto
                </button>
                
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </button>
                
                <button
                  onClick={handleExport}
                  disabled={!store.queryResult?.data || store.queryResult.data.length === 0}
                  className="p-2 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
                >
                  <Download className="w-4 h-4 text-gray-600" />
                </button>
                
                <button
                  onClick={() => store.executeQuery()}
                  disabled={store.isLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <Play className="w-4 h-4" />
                  <span>Run</span>
                </button>
              </div>
            </div>
            
            {showSaveModal && (
              <SaveTileModal
                onSave={handleSaveTile}
                onCancel={() => setShowSaveModal(false)}
              />
            )}

            {store.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <X className="w-5 h-5 text-red-600 mt-0.5 mr-2" />
                  <div>
                    <h4 className="text-sm font-medium text-red-900">Query Error</h4>
                    <p className="text-sm text-red-700 mt-1">{store.error}</p>
                  </div>
                </div>
              </div>
            )}

            {store.queryResult && !store.isLoading && (
              <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
                <span>
                  {store.queryResult.metadata.total_rows} row{store.queryResult.metadata.total_rows !== 1 ? 's' : ''}
                </span>
                <span>
                  Query time: {store.queryResult.metadata.query_time_ms}ms
                </span>
              </div>
            )}

            <div className="transition-opacity duration-200" style={{ opacity: store.isLoading ? 0.6 : 1 }}>
              <TileChart
                data={store.queryResult?.data || []}
                chartType={store.config.chartType}
                dimensions={store.config.dimensions}
                measureLabel={store.config.measure.label}
                isLoading={store.isLoading}
                pivotAxis={store.config.pivotAxis}
                showLabels={showLabels}
              />
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="px-3 py-2 bg-white border-2 border-indigo-500 rounded-lg shadow-lg opacity-90 transform scale-105">
            <div className="text-xs font-medium">Dragging...</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Draggable Measure Component
function DraggableMeasure({ measure, onClick }: { measure: Measure; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({
    id: measure.id,
    data: { type: 'measure', data: measure } as DraggableItem,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.05 : 1})` : undefined,
    transition: 'transform 0.2s ease',
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`px-2.5 py-2 bg-white border border-gray-300 rounded-lg hover:border-indigo-500 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <Hash className="w-3 h-3 text-blue-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-900 truncate">{measure.label}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{measure.aggregation}</div>
        </div>
      </div>
    </div>
  );
}

// Draggable Dimension Component
function DraggableDimension({
  dimension,
  isSelected,
  isTemporal,
  onClick,
}: {
  dimension: Dimension;
  isSelected: boolean;
  isTemporal: boolean;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({
    id: dimension.id,
    data: { type: 'dimension', data: dimension } as DraggableItem,
    disabled: isSelected,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.05 : 1})` : undefined,
    transition: 'transform 0.2s ease',
    cursor: isSelected ? 'not-allowed' : (isDragging ? 'grabbing' : 'grab'),
  };

  const color = isTemporal ? 'pink' : 'purple';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`px-2.5 py-2 bg-white border rounded-lg transition-all duration-150 ${
        isSelected
          ? 'border-gray-200 opacity-40 cursor-not-allowed'
          : `border-gray-300 hover:border-${color}-500 hover:shadow-sm hover:-translate-y-0.5`
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <ArrowUpDown className={`w-3 h-3 ${isTemporal ? 'text-pink-500' : 'text-purple-500'} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium truncate ${isSelected ? 'text-gray-500' : 'text-gray-900'}`}>
            {dimension.label}
          </div>
          <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}>
            {dimension.type}
          </div>
        </div>
      </div>
    </div>
  );
}

// Measure Drop Zone
function MeasureDropZone({ measure, onRemove }: { measure: Measure; onRemove: () => void }) {
  const { isOver, setNodeRef } = useSortable({
    id: 'measure-dropzone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-4 transition-all duration-200 ${
        isOver
          ? 'border-2 border-indigo-500 bg-blue-50'
          : measure
          ? 'border-2 border-gray-300 bg-white'
          : 'border-2 border-dashed border-gray-300 bg-white'
      }`}
      style={{ minHeight: '120px' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-blue-600" />
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Measure (1)
        </h3>
      </div>

      {measure ? (
        <div className="bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-indigo-900 truncate">{measure.label}</div>
            <div className="text-xs text-indigo-700 mt-0.5">{measure.aggregation}</div>
          </div>
          <button
            onClick={onRemove}
            className="ml-2 p-1 hover:bg-indigo-200 rounded-full transition-colors"
          >
            <X className="w-3 h-3 text-indigo-700" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center h-20 text-center">
          <p className="text-sm text-gray-400">Drop measure here or click to add</p>
        </div>
      )}
    </div>
  );
}

// Dimensions Drop Zone
function DimensionsDropZone({
  dimensions,
  onRemove,
}: {
  dimensions: Dimension[];
  onRemove: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useSortable({
    id: 'dimensions-dropzone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-4 transition-all duration-200 ${
        isOver && dimensions.length < 3
          ? 'border-2 border-indigo-500 bg-blue-50'
          : dimensions.length > 0
          ? 'border-2 border-gray-300 bg-white'
          : 'border-2 border-dashed border-gray-300 bg-white'
      }`}
      style={{ minHeight: '120px' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-purple-600" />
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Dimensions ({dimensions.length}/3)
        </h3>
      </div>

      {dimensions.length > 0 ? (
        <SortableContext items={dimensions.map(d => d.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {dimensions.map((dim) => (
              <SortableDimensionChip
                key={dim.id}
                dimension={dim}
                onRemove={() => onRemove(dim.id)}
              />
            ))}
          </div>
        </SortableContext>
      ) : (
        <div className="flex items-center justify-center h-20 text-center">
          <p className="text-sm text-gray-400">Drop dimensions here or click to add</p>
        </div>
      )}
    </div>
  );
}

// Chart Type Button Component
function ChartTypeButton({
  type,
  icon: Icon,
  active,
  onClick,
  disabled = false,
}: {
  type: string;
  icon: any;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-md transition-all ${
        active
          ? 'bg-white text-indigo-600 shadow-sm'
          : 'text-gray-600 hover:text-gray-900'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      title={type}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

// Filter Builder Component
function FilterBuilder({
  onAdd,
  onCancel,
}: {
  onAdd: (filter: Filter) => void;
  onCancel: () => void;
}) {
  const [field, setField] = useState('');
  const [operator, setOperator] = useState<Filter['operator']>('equals');
  const [value, setValue] = useState('');

  const handleAdd = () => {
    if (!field || !value) return;

    onAdd({
      id: uuidv4(),
      field,
      operator,
      value,
    });
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Filter</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Field</label>
          <input
            type="text"
            placeholder="e.g., data->path, event_type, user_id"
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Operator</label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as Filter['operator'])}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          >
            <option value="equals">Equals</option>
            <option value="not_equals">Not Equals</option>
            <option value="contains">Contains</option>
            <option value="gt">Greater Than</option>
            <option value="lt">Less Than</option>
            <option value="gte">Greater or Equal</option>
            <option value="lte">Less or Equal</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
          <input
            type="text"
            placeholder="Filter value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleAdd}
            disabled={!field || !value}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            Add Filter
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
