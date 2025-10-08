// components/DashboardFilterBar.tsx
'use client';

import React, { useState } from 'react';
import { Filter as FilterIcon, Plus, X } from 'lucide-react';
import { Filter, DIMENSIONS } from '../lib/tile-types';
import CompactFilterBuilder from './CompactFilterBuilder';

interface DashboardFilterBarProps {
  filters: Filter[];
  onFiltersChange: (filters: Filter[]) => void;
}

export default function DashboardFilterBar({
  filters,
  onFiltersChange,
}: DashboardFilterBarProps) {
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [editingFilter, setEditingFilter] = useState<Filter | null>(null);

  const handleRemoveFilter = (filterId: string) => {
    onFiltersChange(filters.filter(f => f.id !== filterId));
  };

  const handleAddFilter = (filter: Filter) => {
    onFiltersChange([...filters, filter]);
    setShowAddFilter(false);
  };

  const handleEditFilter = (updatedFilter: Filter) => {
    onFiltersChange(filters.map(f => f.id === updatedFilter.id ? updatedFilter : f));
    setEditingFilter(null);
  };

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FilterIcon className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">Dashboard Filters:</span>
        </div>

        {filters.length === 0 && !showAddFilter && (
          <span className="text-sm text-blue-600 italic">No filters applied</span>
        )}

        {filters.map(filter => (
          <button
            key={filter.id}
            onClick={() => setEditingFilter(filter)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 border border-blue-300 rounded-lg text-sm hover:bg-blue-200 transition-colors cursor-pointer"
            title="Click to edit"
          >
            <span className="font-medium text-blue-900">{filter.field}</span>
            <span className="text-blue-700">{filter.operator}</span>
            <span className="text-blue-900 font-medium">{String(filter.value)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFilter(filter.id);
              }}
              className="ml-1 p-0.5 hover:bg-blue-300 rounded transition-colors"
            >
              <X className="w-3 h-3 text-blue-700" />
            </button>
          </button>
        ))}

        {showAddFilter ? (
          <CompactFilterBuilder
            onAdd={handleAddFilter}
            onCancel={() => setShowAddFilter(false)}
          />
        ) : (
          <button
            onClick={() => setShowAddFilter(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Filter
          </button>
        )}
      </div>

      {/* Edit Filter Modal */}
      {editingFilter && (
        <EditFilterModal
          filter={editingFilter}
          onSave={handleEditFilter}
          onCancel={() => setEditingFilter(null)}
        />
      )}
    </div>
  );
}

// Edit Filter Modal - 100% Editable
function EditFilterModal({
  filter,
  onSave,
  onCancel,
}: {
  filter: Filter;
  onSave: (filter: Filter) => void;
  onCancel: () => void;
}) {
  const [selectedDimension, setSelectedDimension] = useState(
    DIMENSIONS.find(d => d.field === filter.field) || null
  );
  const [operator, setOperator] = useState<Filter['operator']>(filter.operator);
  const [value, setValue] = useState(String(filter.value));
  const [dateValue, setDateValue] = useState('');

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
        ];
    }
  };

  const availableOperators = selectedDimension 
    ? getOperatorsForType(selectedDimension.type)
    : [];

  const handleSave = () => {
    if (!selectedDimension) return;

    let finalValue = value.trim();
    if (selectedDimension.type === 'temporal' && dateValue) {
      finalValue = String(new Date(dateValue).getTime());
    }

    onSave({
      ...filter,
      field: selectedDimension.field,
      operator,
      value: finalValue,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Filter</h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Field/Dimension</label>
            <select
              value={selectedDimension?.id || ''}
              onChange={(e) => {
                const dim = DIMENSIONS.find(d => d.id === e.target.value);
                setSelectedDimension(dim || null);
                if (dim) {
                  const ops = getOperatorsForType(dim.type);
                  setOperator(ops[0].value as Filter['operator']);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select dimension...</option>
              {DIMENSIONS.map((dim) => (
                <option key={dim.id} value={dim.id}>
                  {dim.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value as Filter['operator'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableOperators.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
            {selectedDimension?.type === 'temporal' ? (
              <input
                type="datetime-local"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : selectedDimension?.options ? (
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select value...</option>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

