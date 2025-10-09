// components/DashboardFilterBar.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Filter as FilterIcon, Plus, X, Check, Edit2 } from 'lucide-react';
import { Filter, DIMENSIONS } from '../lib/tile-types';
import CompactFilterBuilder from './CompactFilterBuilder';
import { v4 as uuidv4 } from 'uuid';

interface DashboardFilterBarProps {
  filters: Filter[];
  onFiltersChange: (filters: Filter[]) => void;
  tiles?: Array<{ tile_id: string; tile_name: string; tile_type?: string }>;
  tileFilterAssignments?: Record<string, string[]>; // tile_id -> filter_ids
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
    
    const currentAssignments = tileFilterAssignments[tileId] || [];
    const newAssignments = currentAssignments.includes(filterId)
      ? currentAssignments.filter(id => id !== filterId)
      : [...currentAssignments, filterId];
    
    onTileFilterAssignmentsChange({
      ...tileFilterAssignments,
      [tileId]: newAssignments
    });
  };

  const getAppliedTileCount = (filterId: string) => {
    return Object.values(tileFilterAssignments).filter(assignments => 
      assignments.includes(filterId)
    ).length;
  };

  // Close dropdown when clicking outside
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
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200 px-8 py-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <FilterIcon className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-sm font-bold text-blue-900">Dashboard Filters:</span>
        </div>

        {filters.length === 0 && !showAddFilter && (
          <span className="text-sm text-blue-700">No filters applied - all data shown</span>
        )}

        {filters.map(filter => {
          const appliedCount = getAppliedTileCount(filter.id);
          const isEditing = editingFilterId === filter.id;
          
          return (
            <div key={filter.id} className="relative">
              <button
                onClick={() => setEditingFilterId(isEditing ? null : filter.id)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-blue-300 rounded-lg text-sm hover:border-blue-400 hover:shadow-md transition-all"
                title="Click to configure"
              >
                <span className="font-semibold text-blue-900">{filter.field}</span>
                <span className="text-blue-600 font-medium">{filter.operator}</span>
                <span className="text-gray-900 font-medium">{String(filter.value)}</span>
                
                {appliedCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                    {appliedCount}
                  </span>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFilter(filter.id);
                  }}
                  className="ml-1 hover:bg-red-100 rounded-full p-1"
                  title="Remove filter"
                >
                  <X className="w-3 h-3 text-red-600" />
                </button>
              </button>

              {/* Filter Configuration Dropdown */}
              {isEditing && (
                <FilterConfigDropdown
                  ref={dropdownRef}
                  filter={filter}
                  tiles={tiles}
                  tileFilterAssignments={tileFilterAssignments}
                  onUpdateFilter={handleUpdateFilter}
                  onToggleTile={toggleTileFilter}
                  onClose={() => setEditingFilterId(null)}
                />
              )}
            </div>
          );
        })}

        {showAddFilter ? (
          <CompactFilterBuilder
            onAdd={handleAddFilter}
            onCancel={() => setShowAddFilter(false)}
          />
        ) : (
          <button
            onClick={() => setShowAddFilter(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors font-medium shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Add Filter</span>
          </button>
        )}
      </div>

    </div>
  );
}

// Filter Configuration Dropdown Component
const FilterConfigDropdown = React.forwardRef<
  HTMLDivElement,
  {
    filter: Filter;
    tiles: Array<{ tile_id: string; tile_name: string; tile_type?: string }>;
    tileFilterAssignments: Record<string, string[]>;
    onUpdateFilter: (filterId: string, field: string, operator: Filter['operator'], value: string) => void;
    onToggleTile: (filterId: string, tileId: string) => void;
    onClose: () => void;
  }
>(({ filter, tiles, tileFilterAssignments, onUpdateFilter, onToggleTile, onClose }, ref) => {
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
  
  const appliedCount = Object.values(tileFilterAssignments).filter(assignments => 
    assignments.includes(filter.id)
  ).length;

  const handleSave = () => {
    if (!selectedDimension) return;
    onUpdateFilter(filter.id, selectedDimension.field, operator, value);
  };

  return (
    <div 
      ref={ref}
      className="absolute top-full left-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border-2 border-blue-300 z-50"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-gray-900">Configure Filter</h4>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-100 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Filter Configuration */}
      <div className="p-4 space-y-3 border-b border-gray-200">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Field</label>
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
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {DIMENSIONS.map((dim) => (
              <option key={dim.id} value={dim.id}>
                {dim.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Operator</label>
            <select
              value={operator}
              onChange={(e) => {
                const newOp = e.target.value as Filter['operator'];
                setOperator(newOp);
                handleSave();
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {availableOperators.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Value</label>
            {selectedDimension?.options ? (
              <select
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  handleSave();
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {selectedDimension.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleSave}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter value"
              />
            )}
          </div>
        </div>
      </div>

      {/* Apply to Tiles */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-xs font-bold text-gray-900">Apply to Tiles</h5>
          <span className="text-xs text-gray-500">{appliedCount > 0 ? `${appliedCount} selected` : 'None'}</span>
        </div>
        
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {tiles
            .filter(t => t.tile_type !== 'markdown')
            .map(tile => {
              const isApplied = (tileFilterAssignments[tile.tile_id] || []).includes(filter.id);
              
              return (
                <button
                  key={tile.tile_id}
                  onClick={() => onToggleTile(filter.id, tile.tile_id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    isApplied ? 'bg-blue-50 hover:bg-blue-100 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <span className={`text-sm ${isApplied ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
                    {tile.tile_name}
                  </span>
                  {isApplied && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <button
          onClick={onClose}
          className="w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
});

FilterConfigDropdown.displayName = 'FilterConfigDropdown';


