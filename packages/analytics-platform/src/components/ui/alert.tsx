'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, XCircle, Info } from 'lucide-react';

interface AlertProps {
  variant?: 'default' | 'destructive' | 'warning' | 'success';
  className?: string;
  children: React.ReactNode;
}

export function Alert({ variant = 'default', className = '', children }: AlertProps) {
  const variants = {
    default: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100',
    destructive: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100',
    warning: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100',
    success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100'
  };

  const icons = {
    default: Info,
    destructive: XCircle,
    warning: AlertCircle,
    success: CheckCircle2
  };

  const Icon = icons[variant];

  return (
    <div className={`flex gap-3 items-start p-4 rounded-lg border ${variants[variant]} ${className}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

interface AlertDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

export function AlertDescription({ className = '', children }: AlertDescriptionProps) {
  return (
    <div className={`text-sm ${className}`}>
      {children}
    </div>
  );
}

interface AlertTitleProps {
  className?: string;
  children: React.ReactNode;
}

export function AlertTitle({ className = '', children }: AlertTitleProps) {
  return (
    <h5 className={`font-medium leading-none tracking-tight ${className}`}>
      {children}
    </h5>
  );
}

