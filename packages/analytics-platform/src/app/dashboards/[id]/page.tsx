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
  const [isDragging, setIsDragging] = useState(false);
  const [tileFilterAssignments, setTileFilterAssignments] = useState<Record<string, string[]>>({});

  const dashboardId = params.id;

  // Check for edit mode URL parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('edit') === 'true') {
        setIsEditing(true);
      }
    }
  }, []);

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

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragStop = () => {
    setIsDragging(false);
  };

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
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboards')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to dashboards"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{dashboard.name}</h1>
                {dashboard.description && (
                  <p className="text-gray-600 mt-1">{dashboard.description}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push(`/analytics?dashboard=${dashboardId}`)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Create Chart</span>
              </button>

              <button
                onClick={() => setShowCreateMarkdownModal(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center space-x-2 font-medium"
              >
                <FileText className="w-4 h-4" />
                <span>Add Text</span>
              </button>

              <button
                onClick={() => setShowAddTileModal(true)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors flex items-center space-x-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Add Saved Tile</span>
              </button>

              <button
                onClick={() => {
                  setIsEditing(!isEditing);
                  // Clean up URL when exiting edit mode
                  if (isEditing && typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('edit');
                    window.history.replaceState({}, '', url.toString());
                  }
                }}
                className={`px-4 py-2 rounded-lg transition-all flex items-center space-x-2 font-medium ${
                  isEditing
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
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
        tiles={dashboard.tiles.map(t => ({
          tile_id: t.tile_id,
          tile_name: t.tile_name,
          tile_type: t.tile_type
        }))}
        tileFilterAssignments={tileFilterAssignments}
        onTileFilterAssignmentsChange={setTileFilterAssignments}
      />

      {/* Edit Mode Info Banner */}
      {isEditing && (
        <div className="mx-6 mt-6 bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Edit className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 mb-1">Edit Mode Active</h4>
              <p className="text-sm text-blue-700">
                Drag tiles to reposition, resize using corner handles, or click the trash icon to remove. 
                Click on filter pills above to select which tiles they apply to.
              </p>
            </div>
            <button
              onClick={() => {
                setIsEditing(false);
                // Clean up URL when exiting edit mode
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('edit');
                  window.history.replaceState({}, '', url.toString());
                }
              }}
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      
      {/* Filter Info Banner - Show when filters exist but not in edit mode */}
      {!isEditing && (dashboard.global_filters?.length || 0) > 0 && (
        <div className="mx-6 mt-6 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-indigo-600" />
            <p className="text-sm text-indigo-700">
              <span className="font-semibold">{dashboard.global_filters?.length} filter(s) active.</span> Click filter pills to assign them to specific tiles.
            </p>
          </div>
        </div>
      )}

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
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
            layouts={gridLayouts as unknown as ReactGridLayout.Layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
            rowHeight={100}
            isDraggable={isEditing}
            isResizable={isEditing}
            onLayoutChange={handleLayoutChange}
            onDragStart={handleDragStart}
            onDragStop={handleDragStop}
            onResizeStart={handleDragStart}
            onResizeStop={handleDragStop}
            draggableHandle=".drag-handle"
          >
            {dashboard.tiles.map((tile) => (
              <div
                key={tile.tile_id}
                className={`
                  bg-white rounded-xl overflow-hidden transition-all duration-200
                  ${isEditing 
                    ? 'border-2 border-blue-300 shadow-lg hover:shadow-xl' 
                    : 'border border-gray-200 shadow-sm hover:shadow-md'
                  }
                  ${isDragging ? 'opacity-40' : 'opacity-100'}
                `}
              >
                {/* Tile Header - Always visible in edit mode */}
                {isEditing && (
                  <div className="drag-handle cursor-move bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b-2 border-blue-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <GripVertical className="w-5 h-5 text-blue-600" />
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{tile.tile_name}</span>
                        {tile.tile_description && (
                          <p className="text-xs text-gray-600 mt-0.5">{tile.tile_description}</p>
                        )}
                      </div>
                      
                      {/* Filter count badge */}
                      {tile.tile_type !== 'markdown' && (tileFilterAssignments[tile.tile_id] || []).length > 0 && (
                        <span className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                          <FilterIcon className="w-3 h-3" />
                          <span className="font-medium">{(tileFilterAssignments[tile.tile_id] || []).length} filter(s)</span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveTile(tile.tile_id)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title="Remove tile"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                )}

                {/* Tile Name Badge - Shown at top-left when NOT editing */}
                {!isEditing && (
                  <div className="absolute top-3 left-3 z-10">
                    <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
                      <span className="text-xs font-semibold text-gray-900">{tile.tile_name}</span>
                    </div>
                  </div>
                )}

                {/* Tile Content */}
                <div className={`${isEditing ? 'p-4' : 'p-6'} relative`}>
                  {/* Filter indicator badge for non-edit mode */}
                  {!isEditing && tile.tile_type !== 'markdown' && (tileFilterAssignments[tile.tile_id] || []).length > 0 && (
                    <div className="absolute top-3 right-3 z-10">
                      <span className="text-xs text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-full border border-blue-200">
                        <FilterIcon className="w-3 h-3" />
                        <span className="font-medium">{(tileFilterAssignments[tile.tile_id] || []).length} filter(s)</span>
                      </span>
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
                        key={`${tile.tile_id}-${JSON.stringify(tileFilterAssignments[tile.tile_id] || [])}`}
                        tileId={tile.tile_id}
                        config={tile.tile_config as any}
                        appKey={dashboard.app_key}
                        showRefresh={!isEditing}
                        autoRefresh={false}
                        globalFilters={(dashboard.global_filters || []).filter(f => 
                          (tileFilterAssignments[tile.tile_id] || []).includes(f.id)
                        )}
                        ignoreGlobalFilters={false}
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
                    <span>{tile.config.measures?.[0]?.label || 'No measure'}</span>
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
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save & Add to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}

