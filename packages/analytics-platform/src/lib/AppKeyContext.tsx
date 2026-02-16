'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export interface AppInfo {
  app_key: string;
  name: string;
  created_at?: string;
}

interface AppKeyContextValue {
  /** The currently selected app key (empty string if none selected) */
  appKey: string;
  /** All available apps */
  apps: AppInfo[];
  /** Info about the currently selected app */
  currentApp: AppInfo | null;
  /** Whether apps are still loading */
  isLoading: boolean;
  /** Whether admin mode is active (see all apps' data) */
  isAdmin: boolean;
  /** Change the selected app */
  setAppKey: (key: string) => void;
  /** Toggle admin mode */
  setAdminMode: (enabled: boolean) => void;
  /** Force refresh the apps list */
  refreshApps: () => Promise<void>;
}

const AppKeyContext = createContext<AppKeyContextValue | null>(null);

export function AppKeyProvider({ children }: { children: React.ReactNode }) {
  const [appKey, setAppKeyState] = useState('');
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const setAppKey = useCallback((key: string) => {
    setAppKeyState(key);
    try {
      localStorage.setItem('app_key', key);
      sessionStorage.setItem('app_key', key);
    } catch {
      // Storage may be unavailable
    }
  }, []);

  const setAdminMode = useCallback((enabled: boolean) => {
    setIsAdmin(enabled);
    try {
      localStorage.setItem('admin_mode', enabled ? 'true' : 'false');
    } catch {
      // Storage may be unavailable
    }
  }, []);

  const fetchApps = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/apps/list`);
      const data = await response.json();

      if (data.apps) {
        const formatted: AppInfo[] = data.apps.map((app: any) => ({
          app_key: app.app_key,
          name: app.name || app.app_key,
          created_at: app.created_at,
        }));
        setApps(formatted);
        return formatted;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch apps:', error);
      return [];
    }
  }, []);

  const refreshApps = useCallback(async () => {
    setIsLoading(true);
    await fetchApps();
    setIsLoading(false);
  }, [fetchApps]);

  // Initialize on mount: load apps and restore persisted selections
  useEffect(() => {
    const init = async () => {
      // Restore admin mode
      try {
        const storedAdmin = localStorage.getItem('admin_mode');
        if (storedAdmin === 'true') setIsAdmin(true);
      } catch {}

      // Restore app key from storage
      let storedKey = '';
      try {
        storedKey =
          localStorage.getItem('app_key') ||
          sessionStorage.getItem('app_key') ||
          sessionStorage.getItem('onboarding_app_key') ||
          localStorage.getItem('onboarding_app_key') ||
          '';
      } catch {}

      const loadedApps = await fetchApps();

      if (storedKey && loadedApps.some((a) => a.app_key === storedKey)) {
        setAppKeyState(storedKey);
      } else if (loadedApps.length > 0) {
        // Auto-select the first app
        const first = loadedApps[0].app_key;
        setAppKeyState(first);
        try {
          localStorage.setItem('app_key', first);
          sessionStorage.setItem('app_key', first);
        } catch {}
      }

      setIsLoading(false);
    };
    init();
  }, [fetchApps]);

  const currentApp = apps.find((a) => a.app_key === appKey) || null;

  return (
    <AppKeyContext.Provider
      value={{
        appKey,
        apps,
        currentApp,
        isLoading,
        isAdmin,
        setAppKey,
        setAdminMode,
        refreshApps,
      }}
    >
      {children}
    </AppKeyContext.Provider>
  );
}

/**
 * Hook to access the current app key and related state.
 * Must be used inside an AppKeyProvider.
 */
export function useAppKey(): AppKeyContextValue {
  const ctx = useContext(AppKeyContext);
  if (!ctx) {
    throw new Error('useAppKey must be used within an AppKeyProvider');
  }
  return ctx;
}
