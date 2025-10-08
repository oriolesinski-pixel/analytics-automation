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
} from 'lucide-react';
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

export default function TileBuilder({ appKey }: TileBuilderProps) {
  const router = useRouter();
  const store = useTileStore();
  const dashboardStore = useDashboardStore();
  const [showMeasureDropdown, setShowMeasureDropdown] = useState(false);
  const [showDimensionDropdown, setShowDimensionDropdown] = useState(false);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [returnToDashboard, setReturnToDashboard] = useState<string | null>(null);

  // Check if we should return to a specific dashboard after saving
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const dashboardId = params.get('dashboard');
      if (dashboardId) {
        setReturnToDashboard(dashboardId);
      }
    }
  }, []);

  // Initialize app key
  useEffect(() => {
    store.setAppKey(appKey);
  }, [appKey]);

  // Auto-execute query when config changes (debounced)
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
      
      // If we came from a dashboard, add tile and return there
      if (returnToDashboard) {
        // Add tile to dashboard with default layout
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
        // Otherwise go to workspace
        router.push('/workspace');
      }
    } catch (error: any) {
      console.error('Failed to save tile:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  const availableMeasures = getMeasuresForEventType(store.config.eventType);
  const availableDimensions = getDimensionsForEventType(store.config.eventType);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Main Content - 3 Panel Layout */}
      <div className="flex-1 grid grid-cols-3 gap-6 p-6">
        {/* LEFT PANEL - Metrics & Dimensions */}
        <div className="col-span-1 space-y-6">
          {/* Event Type Selector */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Event Type</h3>
            <select
              value={store.config.eventType || ''}
              onChange={(e) => store.setEventType(e.target.value || undefined)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Events</option>
              {EVENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Measure Selection */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Measure</h3>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => setShowMeasureDropdown(!showMeasureDropdown)}
                className="w-full px-4 py-3 bg-indigo-50 border-2 border-indigo-200 rounded-lg text-left hover:bg-indigo-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-indigo-900">
                      {store.config.measure.label}
                    </div>
                    <div className="text-xs text-indigo-600 mt-0.5">
                      {store.config.measure.aggregation}
                    </div>
                  </div>
                  <Hash className="w-4 h-4 text-indigo-600" />
                </div>
              </button>

              {showMeasureDropdown && (
                <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                  {availableMeasures.map((measure) => (
                    <button
                      key={measure.id}
                      onClick={() => {
                        store.setMeasure(measure);
                        setShowMeasureDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <div className="font-medium text-gray-900">{measure.label}</div>
                      <div className="text-xs text-gray-500">{measure.aggregation}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dimensions */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Dimensions ({store.config.dimensions.length}/2)
              </h3>
              <button
                onClick={() => setShowDimensionDropdown(!showDimensionDropdown)}
                disabled={store.config.dimensions.length >= 2}
                className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4 text-indigo-600" />
              </button>
            </div>

            {/* Selected Dimensions */}
            <div className="space-y-2 mb-3">
              {store.config.dimensions.map((dim) => (
                <div
                  key={dim.id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{dim.label}</div>
                    <div className="text-xs text-gray-500">{dim.type}</div>
                  </div>
                  <button
                    onClick={() => store.removeDimension(dim.id)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    <X className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>

            {/* Dimension Dropdown */}
            {showDimensionDropdown && (
              <div className="space-y-1 max-h-64 overflow-y-auto border-t border-gray-200 pt-3">
                {availableDimensions
                  .filter(d => !store.config.dimensions.some(sd => sd.id === d.id))
                  .map((dim) => (
                    <button
                      key={dim.id}
                      onClick={() => {
                        store.addDimension(dim);
                        if (store.config.dimensions.length >= 1) {
                          setShowDimensionDropdown(false);
                        }
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <div className="font-medium text-gray-900">{dim.label}</div>
                      <div className="text-xs text-gray-500">{dim.type}</div>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Filters ({store.config.filters.length})
              </h3>
              <button
                onClick={() => setShowFilterBuilder(true)}
                className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 text-indigo-600" />
              </button>
            </div>

            {/* Active Filters */}
            <div className="space-y-2">
              {store.config.filters.map((filter) => (
                <div
                  key={filter.id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 text-xs">
                    <span className="font-medium text-gray-700">{filter.field}</span>
                    <span className="text-gray-500 mx-1">{filter.operator}</span>
                    <span className="text-gray-900">{String(filter.value)}</span>
                  </div>
                  <button
                    onClick={() => store.removeFilter(filter.id)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    <X className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>

            {showFilterBuilder && (
              <FilterBuilder
                onAdd={(filter) => {
                  store.addFilter(filter);
                  setShowFilterBuilder(false);
                }}
                onCancel={() => setShowFilterBuilder(false)}
              />
            )}
          </div>

          {/* Date Range */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center mb-4">
              <Calendar className="w-4 h-4 text-gray-600 mr-2" />
              <h3 className="text-sm font-semibold text-gray-900">Date Range</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {DATE_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => store.setDateRange(range.value)}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                    store.config.dateRange.start.getTime() === range.getRange().start.getTime()
                      ? 'bg-indigo-100 text-indigo-900 font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Preview */}
        <div className="col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          {/* Chart Controls */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            
            <div className="flex items-center space-x-3">
              {/* Chart Type Selector */}
              <div className="flex bg-gray-100 rounded-lg p-1">
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
                />
                <ChartTypeButton
                  type="table"
                  icon={Table}
                  active={store.config.chartType === 'table'}
                  onClick={() => store.setChartType('table')}
                />
              </div>

              {/* Actions */}
              <button
                onClick={handleAutoSelectChart}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Auto
              </button>
              
              <button
                onClick={() => setShowSaveModal(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Tile</span>
              </button>
              
              <button
                onClick={handleExport}
                disabled={!store.queryResult?.data || store.queryResult.data.length === 0}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4 text-gray-600" />
              </button>
              
              <button
                onClick={() => store.executeQuery()}
                disabled={store.isLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Run Query</span>
              </button>
            </div>
          </div>
          
          {/* Save Tile Modal */}
          {showSaveModal && (
            <SaveTileModal
              onSave={handleSaveTile}
              onCancel={() => setShowSaveModal(false)}
            />
          )}

          {/* Error Display */}
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

          {/* Query Metadata */}
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

          {/* Chart Display */}
          <TileChart
            data={store.queryResult?.data || []}
            chartType={store.config.chartType}
            dimensions={store.config.dimensions}
            measureLabel={store.config.measure.label}
            isLoading={store.isLoading}
          />
        </div>
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
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Add Filter</h4>
      
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Field (e.g., data->path)"
          value={field}
          onChange={(e) => setField(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        
        <select
          value={operator}
          onChange={(e) => setOperator(e.target.value as Filter['operator'])}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="equals">Equals</option>
          <option value="not_equals">Not Equals</option>
          <option value="contains">Contains</option>
          <option value="gt">Greater Than</option>
          <option value="lt">Less Than</option>
          <option value="gte">Greater or Equal</option>
          <option value="lte">Less or Equal</option>
        </select>
        
        <input
          type="text"
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        
        <div className="flex space-x-2">
          <button
            onClick={handleAdd}
            className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Add
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

