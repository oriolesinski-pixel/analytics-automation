'use client';

import React, { createContext, useContext } from 'react';

interface RadioGroupContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextType | undefined>(undefined);

interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function RadioGroup({ value, onValueChange, children, className = '' }: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </RadioGroupContext.Provider>
  );
}

interface RadioGroupItemProps {
  value: string;
  id: string;
  className?: string;
}

export function RadioGroupItem({ value, id, className = '' }: RadioGroupItemProps) {
  const context = useContext(RadioGroupContext);
  if (!context) return null;

  const isChecked = context.value === value;

  return (
    <input
      type="radio"
      id={id}
      checked={isChecked}
      onChange={() => context.onValueChange(value)}
      className={`w-4 h-4 text-blue-600 focus:ring-blue-500 ${className}`}
      data-state={isChecked ? 'checked' : 'unchecked'}
    />
  );
}

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

export function Label({ children, className = '', ...props }: LabelProps) {
  return (
    <label className={`text-sm font-medium text-gray-900 ${className}`} {...props}>
      {children}
    </label>
  );
}

