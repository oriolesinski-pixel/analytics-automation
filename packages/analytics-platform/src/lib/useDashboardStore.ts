// lib/useDashboardStore.ts
// Zustand store for dashboard and tile management

import { create } from 'zustand';
import { SavedTile, Dashboard, Layouts, GRID_CONFIG } from './dashboard-types';
import { TileConfig } from './tile-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface DashboardStore {
  // State
  dashboards: Dashboard[];
  savedTiles: SavedTile[];
  currentDashboard: Dashboard | null;
  isLoading: boolean;
  error: string | null;
  
  // Dashboards
  fetchDashboards: (appKey: string) => Promise<void>;
  fetchDashboard: (id: string) => Promise<void>;
  createDashboard: (name: string, description: string | undefined, appKey: string) => Promise<string>;
  updateDashboard: (id: string, name?: string, description?: string) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  updateDashboardLayout: (id: string, layouts: Layouts) => Promise<void>;
  
  // Saved Tiles
  fetchSavedTiles: (appKey: string) => Promise<void>;
  saveTile: (name: string, description: string | undefined, config: TileConfig, appKey: string) => Promise<string>;
  updateTile: (id: string, name?: string, description?: string, config?: TileConfig) => Promise<void>;
  deleteTile: (id: string) => Promise<void>;
  
  // Dashboard Composition
  addTileToDashboard: (dashboardId: string, tileId: string, layout: any) => Promise<void>;
  removeTileFromDashboard: (dashboardId: string, tileId: string) => Promise<void>;
  
  // Utility
  reset: () => void;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  dashboards: [],
  savedTiles: [],
  currentDashboard: null,
  isLoading: false,
  error: null,
  
  fetchDashboards: async (appKey: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards?app_key=${appKey}`);
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
  
  fetchDashboard: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards/${id}`);
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
  
  updateDashboard: async (id: string, name?: string, description?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards/${id}`, {
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
  
  deleteDashboard: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards/${id}`, {
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
  
  updateDashboardLayout: async (id: string, layouts: Layouts) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards/${id}/layout`, {
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
  
  fetchSavedTiles: async (appKey: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/tiles?app_key=${appKey}`);
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
  
  updateTile: async (id: string, name?: string, description?: string, config?: TileConfig) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tiles/${id}`, {
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
  
  deleteTile: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tiles/${id}`, {
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
  
  addTileToDashboard: async (dashboardId: string, tileId: string, layout: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards/${dashboardId}/tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tile_id: tileId, layout_config: layout }),
      });
      const data = await response.json();
      if (data.ok) {
        // Refresh dashboard to get updated tiles
        await get().fetchDashboard(dashboardId);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
  
  removeTileFromDashboard: async (dashboardId: string, tileId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboards/${dashboardId}/tiles/${tileId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.ok) {
        // Refresh dashboard to get updated tiles
        await get().fetchDashboard(dashboardId);
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

