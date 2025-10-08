// app/workspace/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Edit,
  Trash2,
  LayoutDashboard,
  Loader2,
  ChevronDown,
  BarChart3,
} from 'lucide-react';
import { useDashboardStore } from '@/lib/useDashboardStore';
import TileLiveChart from '@/components/TileLiveChart';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface App {
  app_key: string;
  name: string;
}

export default function WorkspacePage() {
  const router = useRouter();
  const dashboardStore = useDashboardStore();
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [apps, setApps] = useState<App[]>([]);
  const [showAppDropdown, setShowAppDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddToDashboard, setShowAddToDashboard] = useState<string | null>(null);

  // Fetch apps
  useEffect(() => {
    const fetchApps = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/apps/list`);
        const data = await response.json();
        if (data.ok && data.apps) {
          const formattedApps = data.apps.map((app: any) => ({
            app_key: app.app_key,
            name: app.name || app.app_key,
          }));
          setApps(formattedApps);
          if (formattedApps.length > 0) {
            setSelectedApp(formattedApps[0].app_key);
          }
        }
      } catch (error) {
        console.error('Failed to fetch apps:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchApps();
  }, []);

  // Fetch saved tiles when app changes
  useEffect(() => {
    if (selectedApp) {
      dashboardStore.fetchSavedTiles(selectedApp);
      dashboardStore.fetchDashboards(selectedApp);
    }
  }, [selectedApp]);

  const handleDeleteTile = async (tileId: string) => {
    if (!confirm('Are you sure you want to delete this tile?')) return;
    
    try {
      await dashboardStore.deleteTile(tileId);
      // Refresh tiles
      if (selectedApp) {
        dashboardStore.fetchSavedTiles(selectedApp);
      }
    } catch (error: any) {
      alert(`Failed to delete tile: ${error.message}`);
    }
  };

  const handleAddToDashboard = async (tileId: string, dashboardId: string) => {
    try {
      // Get tile to determine default size
      const tile = dashboardStore.savedTiles.find(t => t.id === tileId);
      if (!tile) return;

      // Default layout position
      const layout = {
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        minW: 3,
        minH: 3,
      };

      await dashboardStore.addTileToDashboard(dashboardId, tileId, layout);
      setShowAddToDashboard(null);
      alert('Tile added to dashboard!');
    } catch (error: any) {
      alert(`Failed to add tile: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-semibold text-gray-900">My Tiles</h1>

              {/* App Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowAppDropdown(!showAppDropdown)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <span className="font-medium text-gray-700">
                    {apps.find(a => a.app_key === selectedApp)?.name || 'Select App'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {showAppDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    {apps.map(app => (
                      <button
                        key={app.app_key}
                        onClick={() => {
                          setSelectedApp(app.app_key);
                          setShowAppDropdown(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-gray-700">{app.name}</span>
                        {app.app_key === selectedApp && (
                          <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Tile</span>
              </button>
              
              <button
                onClick={() => router.push('/dashboards')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center space-x-2"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboards</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {dashboardStore.isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : dashboardStore.savedTiles.length === 0 ? (
          // Empty State
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <BarChart3 className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No Saved Tiles</h3>
              <p className="text-gray-600 mb-6">
                Create your first tile to get started
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Tile
              </button>
            </div>
          </div>
        ) : (
          // Tiles Grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardStore.savedTiles.map((tile) => (
              <div
                key={tile.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Tile Header */}
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-1">{tile.name}</h3>
                  {tile.description && (
                    <p className="text-sm text-gray-500">{tile.description}</p>
                  )}
                  <div className="flex items-center space-x-2 mt-2 text-xs text-gray-400">
                    <span>{tile.config.measure.label}</span>
                    <span>•</span>
                    <span>{tile.config.chartType}</span>
                    {tile.config.eventType && (
                      <>
                        <span>•</span>
                        <span>{tile.config.eventType}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Tile Preview */}
                <div className="h-64 p-4 bg-gray-50">
                  <TileLiveChart
                    tileId={tile.id}
                    config={tile.config}
                    appKey={selectedApp}
                  />
                </div>

                {/* Tile Actions */}
                <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        // TODO: Load tile in TileBuilder for editing
                        router.push(`/dashboard?tile=${tile.id}`);
                      }}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Edit tile"
                    >
                      <Edit className="w-4 h-4 text-gray-600" />
                    </button>
                    
                    <button
                      onClick={() => setShowAddToDashboard(tile.id)}
                      className="p-2 hover:bg-indigo-100 rounded-lg transition-colors"
                      title="Add to dashboard"
                    >
                      <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                    </button>
                    
                    <button
                      onClick={() => handleDeleteTile(tile.id)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title="Delete tile"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                  
                  <span className="text-xs text-gray-400">
                    {new Date(tile.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Add to Dashboard Modal */}
                {showAddToDashboard === tile.id && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                      <h3 className="text-lg font-semibold mb-4">Add to Dashboard</h3>
                      
                      {dashboardStore.dashboards.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-gray-600 mb-4">No dashboards yet</p>
                          <button
                            onClick={() => router.push('/dashboards')}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                          >
                            Create Dashboard
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {dashboardStore.dashboards.map((dashboard) => (
                            <button
                              key={dashboard.id}
                              onClick={() => handleAddToDashboard(tile.id, dashboard.id)}
                              className="w-full px-4 py-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <div className="font-medium text-gray-900">{dashboard.name}</div>
                              {dashboard.description && (
                                <div className="text-sm text-gray-500">{dashboard.description}</div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => setShowAddToDashboard(null)}
                          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

