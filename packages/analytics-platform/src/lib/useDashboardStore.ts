// lib/useDashboardStore.ts
// Zustand store for dashboard and tile management
// All operations pass app_key for tenant isolation

import { create } from 'zustand';
import { SavedTile, Dashboard, Layouts, GRID_CONFIG } from './dashboard-types';
import { TileConfig } from './tile-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

/** Build query string with app_key and optional admin flag */
function tenantQuery(appKey?: string, admin?: boolean): string {
  const params = new URLSearchParams();
  if (appKey) params.set('app_key', appKey);
  if (admin) params.set('admin', 'true');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

interface DashboardStore {
  // State
  dashboards: Dashboard[];
  savedTiles: SavedTile[];
  currentDashboard: Dashboard | null;
  isLoading: boolean;
  error: string | null;
  
  // Dashboards
  fetchDashboards: (appKey: string, admin?: boolean) => Promise<void>;
  fetchDashboard: (id: string, appKey?: string, admin?: boolean) => Promise<void>;
  createDashboard: (name: string, description: string | undefined, appKey: string) => Promise<string>;
  updateDashboard: (id: string, name?: string, description?: string, appKey?: string, admin?: boolean) => Promise<void>;
  deleteDashboard: (id: string, appKey?: string, admin?: boolean) => Promise<void>;
  updateDashboardLayout: (id: string, layouts: Layouts, appKey?: string, admin?: boolean) => Promise<void>;
  
  // Saved Tiles
  fetchSavedTiles: (appKey: string, admin?: boolean) => Promise<void>;
  saveTile: (name: string, description: string | undefined, config: TileConfig, appKey: string) => Promise<string>;
  updateTile: (id: string, name?: string, description?: string, config?: TileConfig, appKey?: string, admin?: boolean) => Promise<void>;
  deleteTile: (id: string, appKey?: string, admin?: boolean) => Promise<void>;
  
  // Dashboard Composition
  addTileToDashboard: (dashboardId: string, tileId: string, layout: any, appKey?: string, admin?: boolean) => Promise<void>;
  removeTileFromDashboard: (dashboardId: string, tileId: string, appKey?: string, admin?: boolean) => Promise<void>;
  
  // Utility
  reset: () => void;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  dashboards: [],
  savedTiles: [],
  currentDashboard: null,
  isLoading: false,
  error: null,
  
  fetchDashboards: async (appKey: string, admin?: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards${tenantQuery(appKey, admin)}`);
      const data = await response.json();
      if (data.ok) {
        set({ dashboards: data.dashboards, isLoading: false });
      } else {
        set({ error: data.error, isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  fetchDashboard: async (id: string, appKey?: string, admin?: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards/${id}${tenantQuery(appKey, admin)}`);
      const data = await response.json();
      if (data.ok) {
        set({ currentDashboard: data.dashboard, isLoading: false });
      } else {
        set({ error: data.error, isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  createDashboard: async (name: string, description: string | undefined, appKey: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, app_key: appKey }),
      });
      const data = await response.json();
      if (data.ok) {
        set(state => ({ dashboards: [data.dashboard, ...state.dashboards] }));
        return data.dashboard.id;
      }
      throw new Error(data.error);
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  updateDashboard: async (id: string, name?: string, description?: string, appKey?: string, admin?: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards/${id}${tenantQuery(appKey, admin)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const data = await response.json();
      if (data.ok) {
        set(state => ({
          dashboards: state.dashboards.map(d => d.id === id ? data.dashboard : d),
          currentDashboard: state.currentDashboard?.id === id ? data.dashboard : state.currentDashboard,
        }));
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  deleteDashboard: async (id: string, appKey?: string, admin?: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards/${id}${tenantQuery(appKey, admin)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.ok) {
        set(state => ({
          dashboards: state.dashboards.filter(d => d.id !== id),
        }));
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  updateDashboardLayout: async (id: string, layouts: Layouts, appKey?: string, admin?: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards/${id}/layout${tenantQuery(appKey, admin)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layouts }),
      });
      const data = await response.json();
      if (data.ok) {
        set(state => ({
          currentDashboard: state.currentDashboard?.id === id 
            ? { ...state.currentDashboard, layout: { ...state.currentDashboard.layout, layouts } }
            : state.currentDashboard,
        }));
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error updating layout:', error);
      set({ error: error.message });
    }
  },
  
  fetchSavedTiles: async (appKey: string, admin?: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/tiles${tenantQuery(appKey, admin)}`);
      const data = await response.json();
      if (data.ok) {
        set({ savedTiles: data.tiles, isLoading: false });
      } else {
        set({ error: data.error, isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  saveTile: async (name: string, description: string | undefined, config: TileConfig, appKey: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, config, app_key: appKey }),
      });
      const data = await response.json();
      if (data.ok) {
        set(state => ({ savedTiles: [data.tile, ...state.savedTiles] }));
        return data.tile.id;
      }
      throw new Error(data.error);
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  updateTile: async (id: string, name?: string, description?: string, config?: TileConfig, appKey?: string, admin?: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tiles/${id}${tenantQuery(appKey, admin)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, config }),
      });
      const data = await response.json();
      if (data.ok) {
        set(state => ({
          savedTiles: state.savedTiles.map(t => t.id === id ? data.tile : t),
        }));
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  deleteTile: async (id: string, appKey?: string, admin?: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tiles/${id}${tenantQuery(appKey, admin)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.ok) {
        set(state => ({
          savedTiles: state.savedTiles.filter(t => t.id !== id),
        }));
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  addTileToDashboard: async (dashboardId: string, tileId: string, layout: any, appKey?: string, admin?: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards/${dashboardId}/tiles${tenantQuery(appKey, admin)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tile_id: tileId, layout_config: layout }),
      });
      const data = await response.json();
      if (data.ok) {
        await get().fetchDashboard(dashboardId, appKey, admin);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  removeTileFromDashboard: async (dashboardId: string, tileId: string, appKey?: string, admin?: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards/${dashboardId}/tiles/${tileId}${tenantQuery(appKey, admin)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.ok) {
        await get().fetchDashboard(dashboardId, appKey, admin);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  reset: () => {
    set({
      dashboards: [],
      savedTiles: [],
      currentDashboard: null,
      isLoading: false,
      error: null,
    });
  },
}));
