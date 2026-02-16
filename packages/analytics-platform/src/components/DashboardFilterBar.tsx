// components/DashboardFilterBar.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Filter as FilterIcon, Plus, X, Check, Edit2, ChevronDown } from 'lucide-react';
import { Filter, DIMENSIONS } from '../lib/tile-types';
import CompactFilterBuilder from './CompactFilterBuilder';

function formatFilterValue(field: string, value: any): string {
  const v = typeof value === 'string' ? value : String(value);
  // If it looks like a timestamp (large number), format as date
  const num = Number(v);
  if (!isNaN(num) && num > 1_000_000_000_000 && num < 2_000_000_000_000) {
    return new Date(num).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (!isNaN(num) && num > 1_000_000_000 && num < 2_000_000_000) {
    return new Date(num * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return v;
}

interface DashboardFilterBarProps {
  filters: Filter[];
  onFiltersChange: (filters: Filter[]) => void;
  tiles?: Array<{ tile_id: string; tile_name: string; tile_type?: string }>;
  tileFilterAssignments?: Record<string, string[]>;
  onTileFilterAssignmentsChange?: (assignments: Record<string, string[]>) => void;
}

export default function DashboardFilterBar({
  filters,
  onFiltersChange,
  tiles = [],
  tileFilterAssignments = {},
  onTileFilterAssignmentsChange,
}: DashboardFilterBarProps) {
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const chartTiles = tiles.filter(t => t.tile_type !== 'markdown');

  const handleRemoveFilter = (filterId: string) => {
    onFiltersChange(filters.filter(f => f.id !== filterId));
  };

  const handleAddFilter = (filter: Filter) => {
    onFiltersChange([...filters, filter]);
    setShowAddFilter(false);
  };

  const handleUpdateFilter = (filterId: string, field: string, operator: Filter['operator'], value: string) => {
    onFiltersChange(filters.map(f =>
      f.id === filterId ? { ...f, field, operator, value } : f
    ));
  };

  const toggleTileFilter = (filterId: string, tileId: string) => {
    if (!onTileFilterAssignmentsChange) return;
    const current = tileFilterAssignments[tileId] || [];
    const updated = current.includes(filterId)
      ? current.filter(id => id !== filterId)
      : [...current, filterId];
    onTileFilterAssignmentsChange({ ...tileFilterAssignments, [tileId]: updated });
  };

  const toggleAllTiles = (filterId: string) => {
    if (!onTileFilterAssignmentsChange) return;
    const allApplied = chartTiles.every(t =>
      (tileFilterAssignments[t.tile_id] || []).includes(filterId)
    );
    const newAssignments = { ...tileFilterAssignments };
    for (const t of chartTiles) {
      const current = newAssignments[t.tile_id] || [];
      if (allApplied) {
        newAssignments[t.tile_id] = current.filter(id => id !== filterId);
      } else {
        if (!current.includes(filterId)) {
          newAssignments[t.tile_id] = [...current, filterId];
        }
      }
    }
    onTileFilterAssignmentsChange(newAssignments);
  };

  const getAppliedTileCount = (filterId: string) =>
    Object.values(tileFilterAssignments).filter(a => a.includes(filterId)).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setEditingFilterId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-white/60 backdrop-blur-md border-b border-indigo-100/50 px-8 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg">
            <FilterIcon className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Filters</span>
        </div>

        {filters.length === 0 && !showAddFilter && (
          <span className="text-xs text-gray-400">No filters — showing all data</span>
        )}

        {filters.map(filter => {
          const appliedCount = getAppliedTileCount(filter.id);
          const isEditing = editingFilterId === filter.id;

          return (
            <div key={filter.id} className="relative">
              <button
                onClick={() => setEditingFilterId(isEditing ? null : filter.id)}
                className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-lg text-xs transition-all border ${
                  isEditing
                    ? 'bg-indigo-50 border-indigo-300 shadow-md'
                    : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                }`}
              >
                <span className="font-semibold text-gray-800">{filter.field}</span>
                <span className="text-indigo-500 font-medium">{filter.operator}</span>
                <span className="text-gray-900 font-semibold">&quot;{formatFilterValue(filter.field, filter.value)}&quot;</span>

                <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  appliedCount > 0
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {appliedCount}/{chartTiles.length} tiles
                </span>

                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isEditing ? 'rotate-180' : ''}`} />

                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveFilter(filter.id); }}
                  className="ml-0.5 hover:bg-red-100 rounded p-0.5"
                  title="Remove filter"
                >
                  <X className="w-3 h-3 text-red-500" />
                </button>
              </button>

              {isEditing && (
                <FilterConfigDropdown
                  ref={dropdownRef}
                  filter={filter}
                  tiles={chartTiles}
                  tileFilterAssignments={tileFilterAssignments}
                  onUpdateFilter={handleUpdateFilter}
                  onToggleTile={toggleTileFilter}
                  onToggleAll={toggleAllTiles}
                  onClose={() => setEditingFilterId(null)}
                />
              )}
            </div>
          );
        })}

        {showAddFilter ? (
          <CompactFilterBuilder onAdd={handleAddFilter} onCancel={() => setShowAddFilter(false)} />
        ) : (
          <button
            onClick={() => setShowAddFilter(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs transition-colors font-medium shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Filter</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Filter Configuration Dropdown ───────────────────────

const FilterConfigDropdown = React.forwardRef<
  HTMLDivElement,
  {
    filter: Filter;
    tiles: Array<{ tile_id: string; tile_name: string; tile_type?: string }>;
    tileFilterAssignments: Record<string, string[]>;
    onUpdateFilter: (filterId: string, field: string, operator: Filter['operator'], value: string) => void;
    onToggleTile: (filterId: string, tileId: string) => void;
    onToggleAll: (filterId: string) => void;
    onClose: () => void;
  }
>(({ filter, tiles, tileFilterAssignments, onUpdateFilter, onToggleTile, onToggleAll, onClose }, ref) => {
  const [selectedDimension, setSelectedDimension] = useState(
    DIMENSIONS.find(d => d.field === filter.field) || DIMENSIONS[0]
  );
  const [operator, setOperator] = useState<Filter['operator']>(filter.operator);
  const [value, setValue] = useState(String(filter.value));

  const getOperatorsForType = (type: string) => {
    switch (type) {
      case 'temporal':
        return [
          { value: 'gte', label: 'After (≥)' },
          { value: 'lte', label: 'Before (≤)' },
          { value: 'equals', label: 'Equals (=)' },
        ];
      case 'categorical':
        return [
          { value: 'equals', label: 'Equals (=)' },
          { value: 'not_equals', label: 'Not Equals (≠)' },
          { value: 'contains', label: 'Contains' },
        ];
      default:
        return [
          { value: 'equals', label: 'Equals (=)' },
          { value: 'not_equals', label: 'Not Equals (≠)' },
          { value: 'gt', label: 'Greater Than (>)' },
          { value: 'lt', label: 'Less Than (<)' },
        ];
    }
  };

  const availableOperators = selectedDimension ? getOperatorsForType(selectedDimension.type) : [];

  const appliedCount = Object.values(tileFilterAssignments).filter(a =>
    a.includes(filter.id)
  ).length;
  const allApplied = tiles.length > 0 && tiles.every(t =>
    (tileFilterAssignments[t.tile_id] || []).includes(filter.id)
  );

  const handleSave = () => {
    if (!selectedDimension) return;
    onUpdateFilter(filter.id, selectedDimension.field, operator, value);
  };

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1.5 w-[380px] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
    >
      {/* Filter Config */}
      <div className="p-4 space-y-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Filter Condition</h4>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Field</label>
          <select
            value={selectedDimension?.id || ''}
            onChange={(e) => {
              const dim = DIMENSIONS.find(d => d.id === e.target.value);
              if (dim) {
                setSelectedDimension(dim);
                const ops = getOperatorsForType(dim.type);
                setOperator(ops[0].value as Filter['operator']);
                handleSave();
              }
            }}
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            {DIMENSIONS.map((dim) => (
              <option key={dim.id} value={dim.id}>{dim.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Operator</label>
            <select
              value={operator}
              onChange={(e) => { setOperator(e.target.value as Filter['operator']); handleSave(); }}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              {availableOperators.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Value</label>
            {selectedDimension?.options ? (
              <select
                value={value}
                onChange={(e) => { setValue(e.target.value); handleSave(); }}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                {selectedDimension.options.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleSave}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Enter value"
              />
            )}
          </div>
        </div>
      </div>

      {/* Apply to Tiles — prominent section */}
      <div className="p-4 bg-slate-50/80">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-3.5 h-3.5 text-indigo-500" />
            <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Apply to Tiles</h5>
          </div>
          <button
            onClick={() => onToggleAll(filter.id)}
            className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {allApplied ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="space-y-0.5 max-h-56 overflow-y-auto rounded-lg bg-white border border-gray-200 p-1">
          {tiles.map(tile => {
            const isApplied = (tileFilterAssignments[tile.tile_id] || []).includes(filter.id);
            return (
              <button
                key={tile.tile_id}
                onClick={() => onToggleTile(filter.id, tile.tile_id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-left ${
                  isApplied
                    ? 'bg-indigo-50 hover:bg-indigo-100'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span className={`text-xs ${isApplied ? 'text-indigo-800 font-semibold' : 'text-gray-600'}`}>
                  {tile.tile_name}
                </span>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  isApplied
                    ? 'bg-indigo-500 border-indigo-500'
                    : 'border-gray-300 bg-white'
                }`}>
                  {isApplied && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
              </button>
            );
          })}
          {tiles.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">No chart tiles in this dashboard</p>
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">{appliedCount} of {tiles.length} tiles selected</p>
      </div>

      {/* Footer */}
      <div className="p-2.5 border-t border-gray-100 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
});

FilterConfigDropdown.displayName = 'FilterConfigDropdown';
