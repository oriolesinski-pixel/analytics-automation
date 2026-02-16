'use client';

import { useState } from 'react';
import { Check, ChevronDown, Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppKey, AppInfo } from '@/lib/AppKeyContext';

interface AppSelectorProps {
  variant?: 'sidebar' | 'header';
}

export function AppSelector({ variant = 'header' }: AppSelectorProps) {
  const router = useRouter();
  const { appKey, apps, currentApp, isLoading, setAppKey } = useAppKey();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectApp = (key: string) => {
    setAppKey(key);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${variant === 'sidebar' ? 'px-3 py-2' : 'px-4 py-2'} bg-gray-50 rounded-lg border border-gray-200`}>
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Loading apps...</span>
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className={`flex items-center justify-between gap-2 ${variant === 'sidebar' ? 'px-3 py-2' : 'px-4 py-2'} bg-yellow-50 rounded-lg border border-yellow-200`}>
        <span className="text-sm text-yellow-700">No apps found</span>
        <button
          onClick={() => router.push('/onboarding')}
          className="text-xs px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
        >
          Setup
        </button>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-left text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex items-center justify-between gap-2"
        >
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{currentApp?.name || 'Select App'}</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate">{appKey}</div>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-80 overflow-y-auto">
              {apps.map((app) => {
                const isSelected = app.app_key === appKey;
                return (
                  <button
                    key={app.app_key}
                    onClick={() => handleSelectApp(app.app_key)}
                    className={`w-full px-3 py-2.5 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                        {app.name || app.app_key}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate mt-0.5">
                        {app.app_key}
                      </div>
                      {app.created_at && (
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // Header variant
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-w-[240px]"
      >
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-gray-900">
            {currentApp?.name || 'Select App'}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {appKey || 'No app selected'}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-full min-w-[300px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Your Applications</h3>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/onboarding');
                  }}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  New App
                </button>
              </div>
            </div>

            <div className="py-2">
              {apps.map((app) => {
                const isSelected = app.app_key === appKey;
                return (
                  <button
                    key={app.app_key}
                    onClick={() => handleSelectApp(app.app_key)}
                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex-1 text-left">
                      <div className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                        {app.name || app.app_key}
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        {app.app_key}
                      </div>
                      {app.created_at && (
                        <div className="text-xs text-gray-400 mt-1">
                          Created {new Date(app.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
