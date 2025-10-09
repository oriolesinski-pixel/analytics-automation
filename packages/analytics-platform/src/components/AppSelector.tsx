'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronDown, Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface App {
  app_key: string;
  name?: string;
  created_at?: string;
}

interface AppSelectorProps {
  variant?: 'sidebar' | 'header';
  onAppChange?: (appKey: string) => void;
}

export function AppSelector({ variant = 'header', onAppChange }: AppSelectorProps) {
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [selectedApp, setSelectedApp] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/apps/list`);
      const data = await response.json();
      
      if (data.ok && data.apps) {
        const formattedApps = data.apps.map((app: any) => ({
          app_key: app.app_key,
          name: app.name || app.app_key,
          created_at: app.created_at
        }));
        
        setApps(formattedApps);
        
        // Check for stored app key first
        const storedKey = localStorage.getItem('app_key') || sessionStorage.getItem('app_key');
        if (storedKey && formattedApps.some((app: App) => app.app_key === storedKey)) {
          setSelectedApp(storedKey);
          onAppChange?.(storedKey);
        } else if (formattedApps.length > 0) {
          const firstApp = formattedApps[0].app_key;
          setSelectedApp(firstApp);
          localStorage.setItem('app_key', firstApp);
          sessionStorage.setItem('app_key', firstApp);
          onAppChange?.(firstApp);
        }
      }
    } catch (error) {
      console.error('Failed to fetch apps:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectApp = (appKey: string) => {
    setSelectedApp(appKey);
    localStorage.setItem('app_key', appKey);
    sessionStorage.setItem('app_key', appKey);
    setIsOpen(false);
    onAppChange?.(appKey);
    
    // Trigger a page refresh to update all components with new app
    window.location.reload();
  };

  const selectedAppData = apps.find(app => app.app_key === selectedApp);

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
    // Simple dropdown for sidebar
    return (
      <select
        value={selectedApp}
        onChange={(e) => handleSelectApp(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
      >
        {apps.map((app) => (
          <option key={app.app_key} value={app.app_key}>
            {app.name || app.app_key}
          </option>
        ))}
      </select>
    );
  }

  // Header variant - custom dropdown
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-w-[240px]"
      >
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-gray-900">
            {selectedAppData?.name || 'Select App'}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {selectedApp || 'No app selected'}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 w-full min-w-[300px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
            {/* Header */}
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

            {/* Apps List */}
            <div className="py-2">
              {apps.map((app) => {
                const isSelected = app.app_key === selectedApp;
                
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

