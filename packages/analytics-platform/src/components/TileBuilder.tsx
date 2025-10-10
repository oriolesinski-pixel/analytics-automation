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
  FlowStep,
  FlowStepCondition,
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

function SortableMeasureChip({ measure, onRemove }: { measure: Measure; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: measure.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-sm font-medium text-blue-700"
    >
      <GripVertical {...attributes} {...listeners} className="w-3 h-3 cursor-grab active:cursor-grabbing text-blue-400" />
      <div className="flex flex-col">
        <span className="text-xs">{measure.label}</span>
        <span className="text-[10px] text-blue-600">{measure.aggregation}</span>
      </div>
      <button
        onClick={onRemove}
        className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
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
      if (appKey && store.config.measures.length > 0) {
        // For flow charts, only execute if we have flow steps
        if (store.config.chartType === 'flow') {
          if (store.config.flowSteps && store.config.flowSteps.length > 0) {
            store.executeQuery();
          }
        } else {
          store.executeQuery();
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    store.config.eventType,
    store.config.measures,
    store.config.dimensions,
    store.config.filters,
    store.config.dateRange,
    store.config.sortDirection,
    store.config.flowSteps,
    store.config.chartType,
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

    if (activeData?.type === 'measure' && overZone === 'measures-dropzone') {
      store.addMeasure(activeData.data as Measure);
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
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Event Type:</label>
              <select
                value={store.config.eventType || ''}
                onChange={(e) => store.setEventType(e.target.value || undefined)}
                className="min-w-[200px] px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                  className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors"
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
                className="min-w-[150px] px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md">
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
            className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden flex-shrink-0"
            style={{ width: `${leftWidth}px` }}
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              
              {/* MEASURES Section */}
              <div>
                <button
                  onClick={() => setMeasuresExpanded(!measuresExpanded)}
                  className="w-full flex items-center justify-between mb-3 px-2 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                    <span>Measures</span>
                  </div>
                  {measuresExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </button>
                
                <div className={`space-y-1 overflow-hidden transition-all duration-200 ${
                  measuresExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  {availableMeasures.map((measure) => {
                    const isSelected = store.config.measures.some(m => m.id === measure.id);
                    return (
                      <DraggableMeasure
                        key={measure.id}
                        measure={measure}
                        isSelected={isSelected}
                        onClick={() => {
                          if (!isSelected) {
                            store.addMeasure(measure);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* DIMENSIONS Section */}
              <div>
                <button
                  onClick={() => setDimensionsExpanded(!dimensionsExpanded)}
                  className="w-full flex items-center justify-between mb-3 px-2 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                    <span>Dimensions</span>
                  </div>
                  {dimensionsExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </button>
                
                <div className={`space-y-3 overflow-hidden transition-all duration-200 ${
                  dimensionsExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  {/* Temporal Dimensions */}
                  {getTemporalDimensions().length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wider mb-1.5 px-1">
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
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1.5 px-1">
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
            className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-indigo-400 dark:hover:bg-indigo-500 cursor-col-resize transition-colors relative group flex-shrink-0"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingLeft(true);
            }}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>

          {/* MIDDLE - Drop Zones - Resizable */}
          <div 
            className="bg-gray-50 dark:bg-gray-900 p-6 space-y-6 overflow-y-auto custom-scrollbar flex-shrink-0"
            style={{ width: `${middleWidth}px` }}
          >
            
            {/* MEASURES Drop Zone */}
            <MeasuresDropZone
              measures={store.config.measures}
              onRemove={(id) => store.removeMeasure(id)}
            />

            {/* DIMENSIONS Drop Zone or Flow Steps */}
            {store.config.chartType === 'flow' ? (
              <FlowStepsZone
                flowSteps={store.config.flowSteps || []}
                onAdd={(step) => {
                  const newSteps = [...(store.config.flowSteps || []), step];
                  store.setFlowSteps(newSteps);
                }}
                onRemove={(id) => {
                  const newSteps = (store.config.flowSteps || []).filter(s => s.id !== id);
                  store.setFlowSteps(newSteps);
                }}
                onReorder={(steps) => {
                  store.setFlowSteps(steps);
                }}
              />
            ) : (
              <DimensionsDropZone
                dimensions={store.config.dimensions}
                onRemove={(id) => store.removeDimension(id)}
              />
            )}
          </div>

          {/* MIDDLE RESIZE HANDLE */}
          <div
            className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-indigo-400 dark:hover:bg-indigo-500 cursor-col-resize transition-colors relative group flex-shrink-0"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingMiddle(true);
            }}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>

          {/* RIGHT - Preview (flex) */}
          <div className="flex-1 bg-white dark:bg-gray-800 p-6 overflow-y-auto custom-scrollbar min-w-0">
            {/* Chart Controls */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Preview</h2>
              
              <div className="flex items-center space-x-3">
                {/* Chart Type Selector */}
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-0.5">
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
                    type="Flow"
                    icon={Network}
                    active={store.config.chartType === 'flow'}
                    onClick={() => store.setChartType('flow')}
                    disabled={false}
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
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                    title="Toggle data labels"
                  >
                    <Tag className="w-4 h-4" />
                    <span>Labels</span>
                  </button>
                )}

                {canSort && store.config.chartType !== 'flow' && (
                  <button
                    onClick={() => {
                      store.toggleSort();
                    }}
                    className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-all font-medium ${
                      store.config.sortDirection && store.config.sortDirection !== 'none'
                        ? 'bg-purple-50 dark:bg-purple-500/20 border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-400 shadow-sm'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                    title={`Sort by value: ${getSortLabel().toLowerCase()}`}
                  >
                    {React.createElement(getSortIcon(), { className: 'w-4 h-4' })}
                    <span>{getSortLabel()}</span>
                  </button>
                )}

                {canPivot && store.config.chartType !== 'flow' && (
                  <button
                    onClick={() => store.setPivotAxis(!store.config.pivotAxis)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors font-medium ${
                      store.config.pivotAxis
                        ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/30 text-blue-700 dark:text-blue-400'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Pivot</span>
                  </button>
                )}

                <button
                  onClick={handleAutoSelectChart}
                  className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
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
                measureLabel={store.config.measures.length > 0 ? store.config.measures[0].label : 'Value'}
                isLoading={store.isLoading}
                pivotAxis={store.config.pivotAxis}
                showLabels={showLabels}
                flowSteps={store.config.flowSteps}
              />
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="px-3 py-2 bg-white dark:bg-gray-800 border-2 border-indigo-500 dark:border-indigo-400 rounded-lg shadow-lg opacity-90 transform scale-105">
            <div className="text-xs font-medium text-gray-900 dark:text-gray-100">Dragging...</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Draggable Measure Component
function DraggableMeasure({ measure, isSelected, onClick }: { measure: Measure; isSelected: boolean; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({
    id: measure.id,
    data: { type: 'measure', data: measure } as DraggableItem,
    disabled: isSelected,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.05 : 1})` : undefined,
    transition: 'transform 0.2s ease',
    cursor: isSelected ? 'not-allowed' : (isDragging ? 'grabbing' : 'grab'),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`px-2.5 py-2 bg-white dark:bg-gray-700 border rounded-lg transition-all duration-150 ${
        isSelected
          ? 'border-gray-200 dark:border-gray-600 opacity-40 cursor-not-allowed'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-sm hover:-translate-y-0.5'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <Hash className="w-3 h-3 text-blue-500 dark:text-blue-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium truncate ${isSelected ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
            {measure.label}
          </div>
          <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-gray-400 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'}`}>
            {measure.aggregation}
          </div>
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
      className={`px-2.5 py-2 bg-white dark:bg-gray-700 border rounded-lg transition-all duration-150 ${
        isSelected
          ? 'border-gray-200 dark:border-gray-600 opacity-40 cursor-not-allowed'
          : `border-gray-300 dark:border-gray-600 hover:border-${color}-500 dark:hover:border-${color}-400 hover:shadow-sm hover:-translate-y-0.5`
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <ArrowUpDown className={`w-3 h-3 ${isTemporal ? 'text-pink-500 dark:text-pink-400' : 'text-purple-500 dark:text-purple-400'} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium truncate ${isSelected ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
            {dimension.label}
          </div>
          <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-gray-400 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'}`}>
            {dimension.type}
          </div>
        </div>
      </div>
    </div>
  );
}

// Measures Drop Zone
function MeasuresDropZone({
  measures,
  onRemove,
}: {
  measures: Measure[];
  onRemove: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useSortable({
    id: 'measures-dropzone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-4 transition-all duration-200 ${
        isOver
          ? 'border-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-500/10'
          : measures.length > 0
          ? 'border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
          : 'border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
      }`}
      style={{ minHeight: '120px' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Measures ({measures.length})
        </h3>
      </div>

      {measures.length > 0 ? (
        <SortableContext items={measures.map(m => m.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {measures.map((measure) => (
              <SortableMeasureChip
                key={measure.id}
                measure={measure}
                onRemove={() => onRemove(measure.id)}
              />
            ))}
          </div>
        </SortableContext>
      ) : (
        <div className="flex items-center justify-center h-20 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">Drop measures here or click to add</p>
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
          ? 'border-2 border-indigo-500 dark:border-indigo-400 bg-blue-50 dark:bg-indigo-500/10'
          : dimensions.length > 0
          ? 'border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
          : 'border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
      }`}
      style={{ minHeight: '120px' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
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
          <p className="text-sm text-gray-400 dark:text-gray-500">Drop dimensions here or click to add</p>
        </div>
      )}
    </div>
  );
}

// Flow Steps Zone Component
function FlowStepsZone({
  flowSteps,
  onAdd,
  onRemove,
  onReorder,
}: {
  flowSteps: FlowStep[];
  onAdd: (step: FlowStep) => void;
  onRemove: (id: string) => void;
  onReorder: (steps: FlowStep[]) => void;
}) {
  const [showAddStep, setShowAddStep] = useState(false);
  const [newStepLabel, setNewStepLabel] = useState('');
  const [newStepConditions, setNewStepConditions] = useState<FlowStepCondition[]>([
    { id: uuidv4(), field: 'event_type', value: '' }
  ]);

  // Smart suggestions based on field type
  const getFieldSuggestions = (field: string): string[] => {
    switch (field) {
      case 'event_type':
        return ['PAGE_VIEW', 'BUTTON_CLICK', 'FORM_INTERACTION', 'ELEMENT_VISIBILITY', 'SCROLL_INTERACTION'];
      case 'data->path':
        return ['/', '/about', '/products', '/cart', '/checkout', '/auth/login', '/auth/register', '/pricing'];
      case 'data->element_id':
        return ['cta-button', 'signup-btn', 'checkout-btn', 'add-to-cart', 'contact-form'];
      case 'data->form_type':
        return ['contact', 'signup', 'login', 'checkout', 'newsletter'];
      case 'data->cta_category':
        return ['conversion', 'navigation', 'engagement'];
      case 'data->element_type':
        return ['button', 'link', 'modal', 'dropdown', 'form'];
      default:
        return [];
    }
  };

  const addCondition = () => {
    setNewStepConditions([
      ...newStepConditions,
      { id: uuidv4(), field: 'event_type', value: '' }
    ]);
  };

  const removeCondition = (conditionId: string) => {
    if (newStepConditions.length > 1) {
      setNewStepConditions(newStepConditions.filter(c => c.id !== conditionId));
    }
  };

  const updateConditionField = (conditionId: string, field: string) => {
    setNewStepConditions(newStepConditions.map(c =>
      c.id === conditionId ? { ...c, field, value: '' } : c
    ));
  };

  const updateConditionValue = (conditionId: string, value: string) => {
    setNewStepConditions(newStepConditions.map(c =>
      c.id === conditionId ? { ...c, value } : c
    ));
  };

  const handleAddStep = () => {
    if (!newStepLabel || newStepConditions.some(c => !c.value)) return;

    onAdd({
      id: uuidv4(),
      label: newStepLabel,
      conditions: newStepConditions,
    });

    // Reset form
    setNewStepLabel('');
    setNewStepConditions([{ id: uuidv4(), field: 'event_type', value: '' }]);
    setShowAddStep(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = flowSteps.findIndex(s => s.id === active.id);
    const newIndex = flowSteps.findIndex(s => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newSteps = arrayMove(flowSteps, oldIndex, newIndex);
      onReorder(newSteps);
    }
  };

  return (
    <div className="rounded-xl p-4 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" style={{ minHeight: '120px' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Flow Steps ({flowSteps.length})
          </h3>
        </div>
        <button
          onClick={() => setShowAddStep(!showAddStep)}
          className="flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded text-xs font-medium transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Step
        </button>
      </div>

      {showAddStep && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Step Name</label>
            <input
              type="text"
              placeholder="e.g., Landing Page, Product View, Checkout"
              value={newStepLabel}
              onChange={(e) => setNewStepLabel(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-700">Conditions</label>
              <span className="text-[10px] text-gray-500 italic">All conditions must match (AND)</span>
            </div>
            
            <div className="space-y-2">
              {newStepConditions.map((condition, index) => {
                const suggestions = getFieldSuggestions(condition.field);
                return (
                  <div key={condition.id} className="bg-white border border-gray-200 rounded-lg p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      {index > 0 && (
                        <span className="text-[10px] font-semibold text-gray-500 uppercase">AND</span>
                      )}
                      <select
                        value={condition.field}
                        onChange={(e) => updateConditionField(condition.id, e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="event_type">Event Type</option>
                        <option value="data->path">Page Path</option>
                        <option value="data->element_id">Element ID</option>
                        <option value="data->form_type">Form Type</option>
                        <option value="data->cta_category">CTA Category</option>
                        <option value="data->element_type">Element Type</option>
                      </select>
                      {newStepConditions.length > 1 && (
                        <button
                          onClick={() => removeCondition(condition.id)}
                          className="p-1 hover:bg-red-50 rounded transition-colors"
                          title="Remove condition"
                        >
                          <X className="w-3 h-3 text-red-600" />
                        </button>
                      )}
                    </div>
                    
                    <div>
                      {suggestions.length > 0 ? (
                        <div className="space-y-1.5">
                          <select
                            value={condition.value}
                            onChange={(e) => updateConditionValue(condition.id, e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                          >
                            <option value="">Select or type custom...</option>
                            {suggestions.map((suggestion) => (
                              <option key={suggestion} value={suggestion}>
                                {suggestion}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Or enter custom value"
                            value={condition.value}
                            onChange={(e) => updateConditionValue(condition.id, e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Enter value"
                          value={condition.value}
                          onChange={(e) => updateConditionValue(condition.id, e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              
              <button
                onClick={addCondition}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-white border border-dashed border-gray-400 hover:border-indigo-500 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded text-xs font-medium transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Condition
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAddStep}
              disabled={!newStepLabel || newStepConditions.some(c => !c.value)}
              className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
            >
              Add Step
            </button>
            <button
              onClick={() => {
                setShowAddStep(false);
                setNewStepLabel('');
                setNewStepConditions([{ id: uuidv4(), field: 'event_type', value: '' }]);
              }}
              className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {flowSteps.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={flowSteps.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {flowSteps.map((step, index) => (
                <SortableFlowStep
                  key={step.id}
                  step={step}
                  index={index}
                  onRemove={() => onRemove(step.id)}
                  onEdit={(updatedStep) => {
                    const newSteps = flowSteps.map(s => 
                      s.id === step.id ? updatedStep : s
                    );
                    onReorder(newSteps);
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="flex items-center justify-center h-20 text-center">
          <p className="text-sm text-gray-400">Add flow steps to track user journeys</p>
        </div>
      )}
    </div>
  );
}

// Sortable Flow Step Component
function SortableFlowStep({
  step,
  index,
  onRemove,
  onEdit,
}: {
  step: FlowStep;
  index: number;
  onRemove: () => void;
  onEdit: (updatedStep: FlowStep) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(step.label);
  const [editConditions, setEditConditions] = useState<FlowStepCondition[]>(
    step.conditions || (step.field && step.eventType ? [{
      id: uuidv4(),
      field: step.field,
      value: step.eventType
    }] : [{ id: uuidv4(), field: 'event_type', value: '' }])
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, disabled: isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Support both old and new format
  const conditions = step.conditions || (step.field && step.eventType ? [{
    id: '1',
    field: step.field,
    value: step.eventType
  }] : []);

  const handleSaveEdit = () => {
    if (!editLabel || editConditions.some(c => !c.value)) return;
    
    onEdit({
      ...step,
      label: editLabel,
      conditions: editConditions,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditLabel(step.label);
    setEditConditions(conditions);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="px-3 py-3 bg-white border-2 border-indigo-400 rounded-md shadow-md"
      >
        <EditFlowStepForm
          label={editLabel}
          conditions={editConditions}
          onLabelChange={setEditLabel}
          onConditionsChange={setEditConditions}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-md group"
    >
      <GripVertical {...attributes} {...listeners} className="w-3 h-3 cursor-grab active:cursor-grabbing text-indigo-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center justify-center w-5 h-5 bg-indigo-600 text-white text-xs font-bold rounded-full flex-shrink-0">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-indigo-900 truncate">{step.label}</span>
        </div>
        <div className="text-xs text-indigo-600 space-y-0.5 ml-7">
          {conditions.map((condition, idx) => (
            <div key={idx} className="flex items-center gap-1">
              {idx > 0 && <span className="text-[10px] font-semibold text-indigo-400">AND</span>}
              <span className="truncate">
                {condition.field} = <span className="font-medium">{condition.value}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setIsEditing(true)}
          className="hover:bg-indigo-200 rounded p-1 transition-colors flex-shrink-0"
          title="Edit step"
        >
          <svg className="w-3 h-3 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={onRemove}
          className="hover:bg-indigo-200 rounded-full p-1 transition-colors flex-shrink-0"
          title="Remove step"
        >
          <X className="w-3 h-3 text-indigo-700" />
        </button>
      </div>
    </div>
  );
}

// Edit Flow Step Form Component
function EditFlowStepForm({
  label,
  conditions,
  onLabelChange,
  onConditionsChange,
  onSave,
  onCancel,
}: {
  label: string;
  conditions: FlowStepCondition[];
  onLabelChange: (label: string) => void;
  onConditionsChange: (conditions: FlowStepCondition[]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const getFieldSuggestions = (field: string): string[] => {
    switch (field) {
      case 'event_type':
        return ['PAGE_VIEW', 'BUTTON_CLICK', 'FORM_INTERACTION', 'ELEMENT_VISIBILITY', 'SCROLL_INTERACTION'];
      case 'data->path':
        return ['/', '/about', '/products', '/cart', '/checkout', '/auth/login', '/auth/register', '/pricing'];
      case 'data->element_id':
        return ['cta-button', 'signup-btn', 'checkout-btn', 'add-to-cart', 'contact-form'];
      case 'data->form_type':
        return ['contact', 'signup', 'login', 'checkout', 'newsletter'];
      case 'data->cta_category':
        return ['conversion', 'navigation', 'engagement'];
      case 'data->element_type':
        return ['button', 'link', 'modal', 'dropdown', 'form'];
      default:
        return [];
    }
  };

  const addCondition = () => {
    onConditionsChange([
      ...conditions,
      { id: uuidv4(), field: 'event_type', value: '' }
    ]);
  };

  const removeCondition = (conditionId: string) => {
    if (conditions.length > 1) {
      onConditionsChange(conditions.filter(c => c.id !== conditionId));
    }
  };

  const updateConditionField = (conditionId: string, field: string) => {
    onConditionsChange(conditions.map(c =>
      c.id === conditionId ? { ...c, field, value: '' } : c
    ));
  };

  const updateConditionValue = (conditionId: string, value: string) => {
    onConditionsChange(conditions.map(c =>
      c.id === conditionId ? { ...c, value } : c
    ));
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Step name"
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      
      <div className="space-y-1.5">
        {conditions.map((condition, index) => {
          const suggestions = getFieldSuggestions(condition.field);
          return (
            <div key={condition.id} className="bg-gray-50 border border-gray-200 rounded p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                {index > 0 && <span className="text-[10px] font-semibold text-gray-500">AND</span>}
                <select
                  value={condition.field}
                  onChange={(e) => updateConditionField(condition.id, e.target.value)}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="event_type">Event Type</option>
                  <option value="data->path">Page Path</option>
                  <option value="data->element_id">Element ID</option>
                  <option value="data->form_type">Form Type</option>
                  <option value="data->cta_category">CTA Category</option>
                  <option value="data->element_type">Element Type</option>
                </select>
                {conditions.length > 1 && (
                  <button
                    onClick={() => removeCondition(condition.id)}
                    className="p-0.5 hover:bg-red-50 rounded transition-colors"
                  >
                    <X className="w-3 h-3 text-red-600" />
                  </button>
                )}
              </div>
              
              {suggestions.length > 0 ? (
                <input
                  type="text"
                  list={`suggestions-${condition.id}`}
                  placeholder="Value"
                  value={condition.value}
                  onChange={(e) => updateConditionValue(condition.id, e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <input
                  type="text"
                  placeholder="Value"
                  value={condition.value}
                  onChange={(e) => updateConditionValue(condition.id, e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
              {suggestions.length > 0 && (
                <datalist id={`suggestions-${condition.id}`}>
                  {suggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
            </div>
          );
        })}
        
        <button
          onClick={addCondition}
          className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-white border border-dashed border-gray-400 hover:border-indigo-500 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded text-xs font-medium transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Condition
        </button>
      </div>
      
      <div className="flex gap-1.5 pt-1">
        <button
          onClick={onSave}
          disabled={!label || conditions.some(c => !c.value)}
          className="flex-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded transition-colors"
        >
          Cancel
        </button>
      </div>
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
          ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
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
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Add Filter</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Field</label>
          <input
            type="text"
            placeholder="e.g., data->path, event_type, user_id"
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Operator</label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as Filter['operator'])}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Value</label>
          <input
            type="text"
            placeholder="Filter value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleAdd}
            disabled={!field || !value}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            Add Filter
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
