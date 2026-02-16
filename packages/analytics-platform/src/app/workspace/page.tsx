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
  BarChart3,
} from 'lucide-react';
import { useDashboardStore } from '@/lib/useDashboardStore';
import TileLiveChart from '@/components/TileLiveChart';
import { useAppKey } from '@/lib/AppKeyContext';

export default function WorkspacePage() {
  const router = useRouter();
  const dashboardStore = useDashboardStore();
  const { appKey, currentApp, isLoading: appLoading, isAdmin } = useAppKey();
  const [showAddToDashboard, setShowAddToDashboard] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  // Fetch saved tiles when app changes
  useEffect(() => {
    if (appKey) {
      dashboardStore.fetchSavedTiles(appKey, isAdmin);
      dashboardStore.fetchDashboards(appKey, isAdmin);
    }
  }, [appKey, isAdmin]);

  const handleDeleteTile = async (tileId: string) => {
    try {
      console.log('Deleting tile:', tileId);
      await dashboardStore.deleteTile(tileId, appKey, isAdmin);
      console.log('Tile deleted successfully');
      setShowDeleteModal(null);
      if (appKey) {
        await dashboardStore.fetchSavedTiles(appKey, isAdmin);
      }
    } catch (error: any) {
      console.error('Failed to delete tile:', error);
      alert(`Failed to delete tile: ${error.message || 'Unknown error'}`);
    }
  };

  const handleAddToDashboard = async (tileId: string, dashboardId: string) => {
    try {
      console.log('Adding tile to dashboard:', { tileId, dashboardId });
      const tile = dashboardStore.savedTiles.find(t => t.id === tileId);
      if (!tile) {
        console.error('Tile not found:', tileId);
        return;
      }

      const layout = {
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        minW: 3,
        minH: 3,
      };

      await dashboardStore.addTileToDashboard(dashboardId, tileId, layout, appKey, isAdmin);
      console.log('Tile added successfully');
      setShowAddToDashboard(null);
      router.push(`/dashboards/${dashboardId}?edit=true`);
    } catch (error: any) {
      console.error('Failed to add tile:', error);
      alert(`Failed to add tile: ${error.message || 'Unknown error'}`);
    }
  };

  if (appLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">My Tiles</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Tiles for <span className="font-semibold text-gray-800 dark:text-gray-200">{currentApp?.name || appKey}</span>
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                  App: {currentApp?.name || appKey}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/analytics')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Tile</span>
              </button>
              
              <button
                onClick={() => router.push('/dashboards')}
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors flex items-center space-x-2 font-medium"
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
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <BarChart3 className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No Saved Tiles</h3>
              <p className="text-gray-600 mb-6">
                Create your first tile to get started
              </p>
              <button
                onClick={() => router.push('/analytics')}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Tile
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardStore.savedTiles.map((tile) => (
              <div
                key={tile.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Tile Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{tile.name}</h3>
                  {tile.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{tile.description}</p>
                  )}
                  <div className="flex items-center space-x-2 mt-2 text-xs text-gray-400">
                    {'measures' in tile.config && tile.config.measures?.[0]?.label && (
                      <>
                        <span>{tile.config.measures[0].label}</span>
                        <span>-</span>
                      </>
                    )}
                    <span>{'chartType' in tile.config ? tile.config.chartType : 'chart'}</span>
                    {'eventType' in tile.config && tile.config.eventType && (
                      <>
                        <span>-</span>
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
                    appKey={appKey}
                  />
                </div>

                {/* Tile Actions */}
                <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/dashboard?tile=${tile.id}`);
                      }}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Edit tile"
                    >
                      <Edit className="w-4 h-4 text-gray-600" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowAddToDashboard(tile.id);
                      }}
                      className="p-2 hover:bg-indigo-100 rounded-lg transition-colors"
                      title="Add to dashboard"
                    >
                      <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowDeleteModal(tile.id);
                      }}
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmationModal
          tileName={dashboardStore.savedTiles.find(t => t.id === showDeleteModal)?.name || 'this tile'}
          onConfirm={() => handleDeleteTile(showDeleteModal)}
          onCancel={() => setShowDeleteModal(null)}
        />
      )}
    </div>
  );
}

function DeleteConfirmationModal({
  tileName,
  onConfirm,
  onCancel,
}: {
  tileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-red-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Delete Tile</h3>
          </div>
        </div>

        <div className="p-6">
          <p className="text-gray-700 mb-2">
            Are you sure you want to delete <span className="font-semibold text-gray-900">{tileName}</span>?
          </p>
          <p className="text-sm text-gray-500">
            This action cannot be undone. The tile will be removed from all dashboards.
          </p>
        </div>

        <div className="px-6 pb-6 flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
