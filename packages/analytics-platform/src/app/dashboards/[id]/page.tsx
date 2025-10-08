// app/dashboards/[id]/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Responsive, WidthProvider, Layout as GridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  ArrowLeft,
  Edit,
  Plus,
  Trash2,
  Check,
  Loader2,
  GripVertical,
  Settings,
  X,
  LayoutDashboard,
  FileText,
  Filter as FilterIcon,
} from 'lucide-react';
import { useDashboardStore } from '@/lib/useDashboardStore';
import { Layouts } from '@/lib/dashboard-types';
import { Filter } from '@/lib/tile-types';
import TileLiveChart from '@/components/TileLiveChart';
import DashboardFilterBar from '@/components/DashboardFilterBar';
import MarkdownTile from '@/components/MarkdownTile';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardComposerProps {
  params: {
    id: string;
  };
}

export default function DashboardComposer({ params }: DashboardComposerProps) {
  const router = useRouter();
  const dashboardStore = useDashboardStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddTileModal, setShowAddTileModal] = useState(false);
  const [showCreateMarkdownModal, setShowCreateMarkdownModal] = useState(false);

  const dashboardId = params.id;

  // Fetch dashboard and tiles on mount
  useEffect(() => {
    dashboardStore.fetchDashboard(dashboardId);
    
    // Also fetch saved tiles for the add modal
    if (dashboardStore.currentDashboard?.app_key) {
      dashboardStore.fetchSavedTiles(dashboardStore.currentDashboard.app_key);
    }
  }, [dashboardId]);

  // Fetch saved tiles when dashboard loads
  useEffect(() => {
    if (dashboardStore.currentDashboard?.app_key) {
      dashboardStore.fetchSavedTiles(dashboardStore.currentDashboard.app_key);
    }
  }, [dashboardStore.currentDashboard?.app_key]);

  // Debounced layout save
  const debouncedSaveLayout = useMemo(() => {
    let timeout: NodeJS.Timeout;
    return (layouts: Layouts) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        dashboardStore.updateDashboardLayout(dashboardId, layouts);
      }, 1000); // 1 second debounce
    };
  }, [dashboardId]);

  const handleLayoutChange = useCallback(
    (layout: GridLayout[], layouts: Layouts) => {
      if (isEditing) {
        console.log('Layout changed, saving...', layouts.lg);
        debouncedSaveLayout(layouts);
      }
    },
    [isEditing, debouncedSaveLayout]
  );

  const handleRemoveTile = async (tileId: string) => {
    if (!confirm('Remove this tile from the dashboard?')) return;
    
    try {
      await dashboardStore.removeTileFromDashboard(dashboardId, tileId);
    } catch (error: any) {
      alert(`Failed to remove tile: ${error.message}`);
    }
  };

  const handleAddTile = async (tileId: string) => {
    try {
      // Calculate next position (stack vertically)
      const currentTiles = dashboardStore.currentDashboard?.tiles || [];
      const maxY = currentTiles.reduce((max, tile) => {
        const y = tile.layout?.y || 0;
        const h = tile.layout?.h || 4;
        return Math.max(max, y + h);
      }, 0);

      const layout = {
        x: 0,
        y: maxY,
        w: 6,
        h: 4,
        minW: 3,
        minH: 3,
      };

      await dashboardStore.addTileToDashboard(dashboardId, tileId, layout);
      setShowAddTileModal(false);
    } catch (error: any) {
      alert(`Failed to add tile: ${error.message}`);
    }
  };

  const handleGlobalFiltersChange = async (filters: Filter[]) => {
    if (!dashboardStore.currentDashboard) return;
    
    console.log('Updating global filters:', filters);
    
    try {
      // Update dashboard with new global filters
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082'}/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ global_filters: filters }),
      });
      
      const result = await response.json();
      console.log('Filter update response:', result);
      
      if (!result.ok) {
        throw new Error(result.error);
      }
      
      // Force immediate re-fetch to refresh all tiles with new filters
      await dashboardStore.fetchDashboard(dashboardId);
    } catch (error: any) {
      console.error('Failed to update global filters:', error);
      alert(`Failed to update filters: ${error.message}`);
    }
  };

  if (dashboardStore.isLoading || !dashboardStore.currentDashboard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const dashboard = dashboardStore.currentDashboard;

  // Build layouts for react-grid-layout
  // Use saved layout from dashboard.layout.layouts if exists, otherwise build from tile defaults
  const gridLayouts: Layouts = dashboard.layout?.layouts?.lg?.length > 0
    ? dashboard.layout.layouts
    : {
        // Build initial layouts from tile default positions
        lg: dashboard.tiles.map((tile, idx) => ({
          i: tile.tile_id,
          x: (idx % 2) * 6, // 2 columns
          y: Math.floor(idx / 2) * 4,
          w: 6,
          h: 4,
          minW: 3,
          minH: 3,
        })),
        md: dashboard.tiles.map((tile, idx) => ({
          i: tile.tile_id,
          x: (idx % 2) * 5, // 2 columns
          y: Math.floor(idx / 2) * 4,
          w: 5,
          h: 4,
          minW: 3,
          minH: 3,
        })),
        sm: dashboard.tiles.map((tile, idx) => ({
          i: tile.tile_id,
          x: 0, // Stack on small screens
          y: idx * 4,
          w: 6,
          h: 4,
          minW: 3,
          minH: 3,
        })),
        xs: dashboard.tiles.map((tile, idx) => ({
          i: tile.tile_id,
          x: 0, // Stack on extra small screens
          y: idx * 4,
          w: 4,
          h: 4,
          minW: 2,
          minH: 3,
        })),
      };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboards')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">{dashboard.name}</h1>
                {dashboard.description && (
                  <p className="text-sm text-gray-500">{dashboard.description}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push(`/dashboard?dashboard=${dashboardId}`)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Chart</span>
              </button>

              <button
                onClick={() => setShowCreateMarkdownModal(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>Add Markdown</span>
              </button>

              <button
                onClick={() => setShowAddTileModal(true)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Saved Tile</span>
              </button>

              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                  isEditing
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isEditing ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Done Editing</span>
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4" />
                    <span>Edit Layout</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Filters Bar */}
      <DashboardFilterBar
        filters={dashboard.global_filters || []}
        onFiltersChange={handleGlobalFiltersChange}
      />

      {/* Dashboard Content */}
      <div className="p-6">
        {dashboard.tiles.length === 0 ? (
          // Empty State
          <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-xl bg-white">
            <div className="text-center">
              <LayoutDashboard className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No Tiles Yet</h3>
              <p className="text-gray-600 mb-6">
                Add tiles from your workspace to get started
              </p>
              <button
                onClick={() => setShowAddTileModal(true)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Tiles
              </button>
            </div>
          </div>
        ) : (
          // Grid Layout
          <ResponsiveGridLayout
            className="layout"
            layouts={gridLayouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
            rowHeight={100}
            isDraggable={isEditing}
            isResizable={isEditing}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle"
          >
            {dashboard.tiles.map((tile) => (
              <div
                key={tile.tile_id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
              >
                {/* Tile Header (Drag Handle) */}
                {isEditing && (
                  <div className="drag-handle cursor-move bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{tile.tile_name}</span>
                      
                      {/* Filter Opt-Out for Chart Tiles */}
                      {tile.tile_type !== 'markdown' && (dashboard.global_filters?.length || 0) > 0 && (
                        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!tile.ignore_global_filters}
                            onChange={async (e) => {
                              // Toggle filter application
                              const ignore = !e.target.checked;
                              try {
                                await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082'}/dashboards/${dashboardId}/tiles/${tile.tile_id}/settings`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ ignore_global_filters: ignore }),
                                });
                                // Refresh dashboard
                                dashboardStore.fetchDashboard(dashboardId);
                              } catch (error) {
                                console.error('Failed to update filter setting:', error);
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <span>Apply filters</span>
                        </label>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveTile(tile.tile_id)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                )}

                {/* Tile Content */}
                <div className={`${isEditing ? 'p-4' : 'p-6'}`}>
                  {!isEditing && (
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">{tile.tile_name}</h3>
                      {tile.tile_type !== 'markdown' && (dashboard.global_filters?.length || 0) > 0 && !tile.ignore_global_filters && (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <FilterIcon className="w-3 h-3" />
                          Filtered
                        </span>
                      )}
                    </div>
                  )}
                  <div className="h-full">
                    {tile.tile_type === 'markdown' ? (
                      <MarkdownTile
                        content={(tile.tile_config as any).content || ''}
                        backgroundColor={(tile.tile_config as any).backgroundColor}
                        textColor={(tile.tile_config as any).textColor}
                      />
                    ) : (
                      <TileLiveChart
                        key={`${tile.tile_id}-${JSON.stringify(dashboard.global_filters || [])}`}
                        tileId={tile.tile_id}
                        config={tile.tile_config as any}
                        appKey={dashboard.app_key}
                        showRefresh={!isEditing}
                        autoRefresh={false}
                        globalFilters={dashboard.global_filters || []}
                        ignoreGlobalFilters={tile.ignore_global_filters || false}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      {/* Create Markdown Modal */}
      {showCreateMarkdownModal && (
        <CreateMarkdownModal
          dashboardId={dashboardId}
          appKey={dashboard.app_key}
          onSave={() => {
            setShowCreateMarkdownModal(false);
            dashboardStore.fetchDashboard(dashboardId);
          }}
          onCancel={() => setShowCreateMarkdownModal(false)}
        />
      )}

      {/* Add Tile Modal */}
      {showAddTileModal && (
        <AddTileModal
          availableTiles={dashboardStore.savedTiles.filter(
            tile => !dashboard.tiles.some(dt => dt.tile_id === tile.id)
          )}
          onAdd={handleAddTile}
          onCancel={() => setShowAddTileModal(false)}
        />
      )}
    </div>
  );
}

// Add Tile Modal Component
function AddTileModal({
  availableTiles,
  onAdd,
  onCancel,
}: {
  availableTiles: any[];
  onAdd: (tileId: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (tileId: string) => {
    setIsAdding(true);
    try {
      await onAdd(tileId);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Tiles to Dashboard</h2>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {availableTiles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No tiles available to add</p>
              <p className="text-sm text-gray-500">All your tiles are already in this dashboard, or you haven't created any tiles yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableTiles.map((tile) => (
                <button
                  key={tile.id}
                  onClick={() => handleAdd(tile.id)}
                  disabled={isAdding}
                  className="text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <h3 className="font-semibold text-gray-900 mb-1">{tile.name}</h3>
                  {tile.description && (
                    <p className="text-sm text-gray-500 mb-2">{tile.description}</p>
                  )}
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <span>{tile.config.measure.label}</span>
                    <span>•</span>
                    <span>{tile.config.chartType}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Create Markdown Tile Modal
function CreateMarkdownModal({
  dashboardId,
  appKey,
  onSave,
  onCancel,
}: {
  dashboardId: string;
  appKey: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('# Title\n\nAdd your content here...\n\n- Use **bold** and *italic*\n- Add [links](https://example.com)\n- Create lists');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    // Title is optional - use "Text Tile" as default
    const tileName = name.trim() || 'Text Tile';

    setIsSaving(true);

    try {
      // Create markdown tile
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082'}/tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_key: appKey,
          name: tileName,
          tile_type: 'markdown',
          config: {
            type: 'markdown',
            content,
            backgroundColor: '#ffffff',
            textColor: '#111827',
          },
        }),
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.error);

      // Add to dashboard
      const tileId = data.tile.id;
      const layout = {
        x: 0,
        y: 0,
        w: 6,
        h: 3,
        minW: 3,
        minH: 2,
      };

      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082'}/dashboards/${dashboardId}/tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tile_id: tileId, layout_config: layout }),
      });

      onSave();
    } catch (error: any) {
      alert(`Failed to create text tile: ${error.message}`);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create Text Tile</h2>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tile Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Dashboard Overview (defaults to 'Text Tile')"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              maxLength={255}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 h-96">
            {/* Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Markdown Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm resize-none"
              />
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview
              </label>
              <div className="h-full border border-gray-300 rounded-lg overflow-y-auto bg-white">
                <MarkdownTile content={content} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save & Add to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}

