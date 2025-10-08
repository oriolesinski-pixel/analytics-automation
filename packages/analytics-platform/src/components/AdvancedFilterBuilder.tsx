// components/AdvancedFilterBuilder.tsx
'use client';

import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { Filter, DIMENSIONS, Dimension } from '../lib/tile-types';
import { v4 as uuidv4 } from 'uuid';

interface AdvancedFilterBuilderProps {
  onAdd: (filter: Filter) => void;
  onCancel: () => void;
}

export default function AdvancedFilterBuilder({
  onAdd,
  onCancel,
}: AdvancedFilterBuilderProps) {
  const [selectedDimension, setSelectedDimension] = useState<Dimension | null>(null);
  const [operator, setOperator] = useState<Filter['operator']>('equals');
  const [value, setValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Get operators based on dimension type
  const getOperatorsForType = (type: string) => {
    switch (type) {
      case 'temporal':
        return [
          { value: 'gte', label: 'After or Equal (≥)' },
          { value: 'lte', label: 'Before or Equal (≤)' },
          { value: 'equals', label: 'Equals' },
        ];
      case 'numerical':
        return [
          { value: 'equals', label: 'Equals (=)' },
          { value: 'not_equals', label: 'Not Equals (≠)' },
          { value: 'gt', label: 'Greater Than (>)' },
          { value: 'lt', label: 'Less Than (<)' },
          { value: 'gte', label: 'Greater or Equal (≥)' },
          { value: 'lte', label: 'Less or Equal (≤)' },
        ];
      case 'categorical':
      default:
        return [
          { value: 'equals', label: 'Equals (=)' },
          { value: 'not_equals', label: 'Not Equals (≠)' },
          { value: 'contains', label: 'Contains' },
          { value: 'in', label: 'In List' },
        ];
    }
  };

  const handleAdd = () => {
    if (!selectedDimension) return;

    let filterValue: string | number | string[];

    // Handle temporal dimensions with date inputs
    if (selectedDimension.type === 'temporal') {
      if (operator === 'gte' || operator === 'lte' || operator === 'equals') {
        if (!startDate) {
          alert('Please select a date');
          return;
        }
        // Convert to Unix timestamp (milliseconds)
        filterValue = new Date(startDate).getTime();
      } else {
        return;
      }
    } else if (operator === 'in') {
      // Handle "in" operator - comma-separated values
      filterValue = value.split(',').map(v => v.trim()).filter(v => v);
      if (filterValue.length === 0) {
        alert('Please enter at least one value (comma-separated)');
        return;
      }
    } else {
      if (!value.trim()) {
        alert('Please enter a value');
        return;
      }
      filterValue = value.trim();
    }

    onAdd({
      id: uuidv4(),
      field: selectedDimension.field,
      operator,
      value: filterValue,
      label: `${selectedDimension.label} ${operator} ${filterValue}`,
    });

    // Reset form
    setSelectedDimension(null);
    setOperator('equals');
    setValue('');
    setStartDate('');
    setEndDate('');
  };

  const availableOperators = selectedDimension 
    ? getOperatorsForType(selectedDimension.type)
    : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Dashboard Filter</h2>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Step 1: Select Dimension */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              1. Select Dimension
            </label>
            <select
              value={selectedDimension?.id || ''}
              onChange={(e) => {
                const dim = DIMENSIONS.find(d => d.id === e.target.value);
                setSelectedDimension(dim || null);
                // Reset operator when dimension changes
                if (dim?.type === 'temporal') {
                  setOperator('gte');
                } else if (dim?.type === 'categorical') {
                  setOperator('equals');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a dimension...</option>
              {DIMENSIONS.map((dim) => (
                <option key={dim.id} value={dim.id}>
                  {dim.label} ({dim.type})
                </option>
              ))}
            </select>
          </div>

          {selectedDimension && (
            <>
              {/* Step 2: Select Operator */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  2. Select Operator
                </label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as Filter['operator'])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableOperators.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Enter Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  3. Enter Value
                </label>

                {selectedDimension.type === 'temporal' ? (
                  // Date picker for temporal dimensions
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <input
                        type="datetime-local"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Select the date/time threshold for this filter
                    </p>
                  </div>
                ) : selectedDimension.options && selectedDimension.options.length > 0 ? (
                  // Dropdown for dimensions with known options
                  <select
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a value...</option>
                    {selectedDimension.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : operator === 'in' ? (
                  // Comma-separated input for "in" operator
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="value1, value2, value3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">
                      Enter multiple values separated by commas
                    </p>
                  </div>
                ) : (
                  // Regular text input
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Enter value..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Preview */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-1">Filter Preview:</p>
                <p className="text-sm text-gray-900">
                  <span className="font-semibold">{selectedDimension.label}</span>{' '}
                  <span className="text-blue-600">{operator}</span>{' '}
                  <span className="font-semibold">
                    {selectedDimension.type === 'temporal' && startDate
                      ? new Date(startDate).toLocaleString()
                      : value || '(not set)'}
                  </span>
                </p>
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            disabled={!selectedDimension || (selectedDimension.type === 'temporal' ? !startDate : !value)}
          >
            Add Filter
          </button>
        </div>
      </div>
    </div>
  );
}

