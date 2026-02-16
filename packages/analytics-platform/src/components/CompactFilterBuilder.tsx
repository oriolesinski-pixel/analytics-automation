// components/CompactFilterBuilder.tsx
'use client';

import React, { useState } from 'react';
import { X, Calendar, Check } from 'lucide-react';
import { Filter, DIMENSIONS, Dimension } from '../lib/tile-types';
import { v4 as uuidv4 } from 'uuid';

interface CompactFilterBuilderProps {
  onAdd: (filter: Filter) => void;
  onCancel: () => void;
}

export default function CompactFilterBuilder({
  onAdd,
  onCancel,
}: CompactFilterBuilderProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDimension, setSelectedDimension] = useState<Dimension | null>(null);
  const [operator, setOperator] = useState<Filter['operator']>('equals');
  const [value, setValue] = useState('');
  const [dateValue, setDateValue] = useState('');

  const getOperatorsForType = (type: string) => {
    switch (type) {
      case 'temporal':
        return [
          { value: 'gte', label: 'After (≥)', symbol: '≥' },
          { value: 'lte', label: 'Before (≤)', symbol: '≤' },
        ];
      case 'numerical':
        return [
          { value: 'gt', label: 'Greater (>)', symbol: '>' },
          { value: 'lt', label: 'Less (<)', symbol: '<' },
          { value: 'gte', label: 'Greater or Equal (≥)', symbol: '≥' },
          { value: 'lte', label: 'Less or Equal (≤)', symbol: '≤' },
        ];
      case 'categorical':
      default:
        return [
          { value: 'equals', label: 'Equals', symbol: '=' },
          { value: 'not_equals', label: 'Not Equals', symbol: '≠' },
          { value: 'contains', label: 'Contains', symbol: '⊃' },
        ];
    }
  };

  const handleDimensionSelect = (dimId: string) => {
    const dim = DIMENSIONS.find(d => d.id === dimId);
    if (dim) {
      setSelectedDimension(dim);
      const operators = getOperatorsForType(dim.type);
      setOperator(operators[0].value as Filter['operator']);
      setStep(3); // Show all steps immediately
    }
  };

  const handleComplete = () => {
    if (!selectedDimension) return;

    let filterValue: string | number | string[];
    let displayLabel: string;

    if (selectedDimension.type === 'temporal') {
      if (!dateValue) return;
      const d = new Date(dateValue);
      filterValue = d.getTime();
      displayLabel = `${selectedDimension.label} ${operator} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      if (!value.trim()) return;
      filterValue = value.trim();
      displayLabel = `${selectedDimension.label} ${operator} ${filterValue}`;
    }

    onAdd({
      id: uuidv4(),
      field: selectedDimension.field,
      operator,
      value: filterValue,
      label: displayLabel,
    });
  };

  const availableOperators = selectedDimension 
    ? getOperatorsForType(selectedDimension.type)
    : [];

  return (
    <div className="inline-flex items-center gap-2 p-2 bg-white border-2 border-blue-400 rounded-lg shadow-lg">
      {/* Step 1: Dimension */}
      {step >= 1 && (
        <select
          value={selectedDimension?.id || ''}
          onChange={(e) => handleDimensionSelect(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus={step === 1}
        >
          <option value="">Select field...</option>
          {DIMENSIONS.map((dim) => (
            <option key={dim.id} value={dim.id}>
              {dim.label}
            </option>
          ))}
        </select>
      )}

      {/* Step 2: Operator */}
      {selectedDimension && (
        <select
          value={operator}
          onChange={(e) => setOperator(e.target.value as Filter['operator'])}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
        >
          {availableOperators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.symbol} {op.label}
            </option>
          ))}
        </select>
      )}

      {/* Step 3: Value */}
      {selectedDimension && (
        <>
          {selectedDimension.type === 'temporal' ? (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="datetime-local"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          ) : selectedDimension.options && selectedDimension.options.length > 0 ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
              autoFocus
            >
              <option value="">Select...</option>
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
              placeholder="Enter value..."
              className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
              autoFocus
            />
          )}

          <button
            onClick={handleComplete}
            disabled={selectedDimension.type === 'temporal' ? !dateValue : !value}
            className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
            title="Add filter"
          >
            <Check className="w-4 h-4" />
          </button>
        </>
      )}

      <button
        onClick={onCancel}
        className="p-1.5 hover:bg-gray-200 rounded transition-colors"
        title="Cancel"
      >
        <X className="w-4 h-4 text-gray-600" />
      </button>
    </div>
  );
}

