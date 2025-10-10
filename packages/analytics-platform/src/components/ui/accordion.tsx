'use client';

import React, { createContext, useContext, useState } from 'react';
import { ChevronDown } from 'lucide-react';

type AccordionContextType = {
  openItems: string[];
  toggleItem: (value: string) => void;
  type?: 'single' | 'multiple';
};

const AccordionContext = createContext<AccordionContextType | undefined>(undefined);

interface AccordionProps {
  type?: 'single' | 'multiple';
  children: React.ReactNode;
  className?: string;
  defaultValue?: string[];
}

export function Accordion({ type = 'single', children, className = '', defaultValue = [] }: AccordionProps) {
  const [openItems, setOpenItems] = useState<string[]>(defaultValue);

  const toggleItem = (value: string) => {
    if (type === 'single') {
      setOpenItems(openItems.includes(value) ? [] : [value]);
    } else {
      setOpenItems(prev =>
        prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
      );
    }
  };

  return (
    <AccordionContext.Provider value={{ openItems, toggleItem, type }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function AccordionItem({ value, children, className = '' }: AccordionItemProps) {
  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg mb-4 overflow-hidden ${className}`}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { value } as any);
        }
        return child;
      })}
    </div>
  );
}

interface AccordionTriggerProps {
  value?: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export function AccordionTrigger({ value, children, className = '', icon }: AccordionTriggerProps) {
  const context = useContext(AccordionContext);
  if (!context || !value) return null;

  const isOpen = context.openItems.includes(value);

  return (
    <button
      onClick={() => context.toggleItem(value)}
      className={`w-full flex items-center justify-between gap-3 p-4 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${className}`}
    >
      <div className="flex items-center gap-3">
        {icon && <div className="text-gray-600 dark:text-gray-400">{icon}</div>}
        <span className="text-base font-medium text-gray-900 dark:text-gray-100">{children}</span>
      </div>
      <ChevronDown
        className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`}
      />
    </button>
  );
}

interface AccordionContentProps {
  value?: string;
  children: React.ReactNode;
  className?: string;
}

export function AccordionContent({ value, children, className = '' }: AccordionContentProps) {
  const context = useContext(AccordionContext);
  if (!context || !value) return null;

  const isOpen = context.openItems.includes(value);

  return (
    <div
      className={`transition-all duration-200 ${
        isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}
    >
      <div className={`p-4 pt-0 bg-white dark:bg-gray-800 ${className}`}>{children}</div>
    </div>
  );
}

