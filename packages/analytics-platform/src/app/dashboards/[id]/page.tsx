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
  ShieldAlert,
  Compass,
} from 'lucide-react';
import { useDashboardStore } from '@/lib/useDashboardStore';
import { Layouts } from '@/lib/dashboard-types';
import { Filter, TileConfig } from '@/lib/tile-types';
import TileLiveChart from '@/components/TileLiveChart';
import TileExploreModal from '@/components/TileExploreModal';
import DashboardFilterBar from '@/components/DashboardFilterBar';
import MarkdownTile from '@/components/MarkdownTile';
import { useAppKey } from '@/lib/AppKeyContext';
import { getGradientCss } from '@/lib/gradient-presets';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardComposerProps {
  params: {
    id: string;
  };
}

export default function DashboardComposer({ params }: DashboardComposerProps) {
  const router = useRouter();
  const dashboardStore = useDashboardStore();
  const { appKey, isAdmin } = useAppKey();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddTileModal, setShowAddTileModal] = useState(false);
  const [showCreateMarkdownModal, setShowCreateMarkdownModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tileFilterAssignments, setTileFilterAssignments] = useState<Record<string, string[]>>({});
  const [savedLayoutSnapshot, setSavedLayoutSnapshot] = useState<Layouts | null>(null);
  const [pendingLayouts, setPendingLayouts] = useState<Layouts | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [exploreTile, setExploreTile] = useState<{ tileId: string; tileName: string; tileDescription?: string; config: TileConfig } | null>(null);
  const [editMarkdownTile, setEditMarkdownTile] = useState<{ tileId: string; tileName: string; config: Record<string, any> } | null>(null);

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
    dashboardStore.fetchDashboard(dashboardId, appKey, isAdmin);
    
    // Also fetch saved tiles for the add modal
    if (dashboardStore.currentDashboard?.app_key) {
      dashboardStore.fetchSavedTiles(dashboardStore.currentDashboard.app_key, isAdmin);
    }
  }, [dashboardId, appKey, isAdmin]);

  // Fetch saved tiles when dashboard loads
  useEffect(() => {
    if (dashboardStore.currentDashboard?.app_key) {
      dashboardStore.fetchSavedTiles(dashboardStore.currentDashboard.app_key, isAdmin);
    }
  }, [dashboardStore.currentDashboard?.app_key, isAdmin]);

  // Tenant isolation: verify the loaded dashboard belongs to the selected app
  useEffect(() => {
    if (!dashboardStore.currentDashboard || !appKey) return;
    if (isAdmin) {
      setAccessDenied(false);
      return;
    }
    if (dashboardStore.currentDashboard.app_key !== appKey) {
      setAccessDenied(true);
    } else {
      setAccessDenied(false);
    }
  }, [dashboardStore.currentDashboard, appKey, isAdmin]);

  // Auto-assign existing global filters to all chart tiles on load
  useEffect(() => {
    const dashboard = dashboardStore.currentDashboard;
    if (!dashboard) return;
    const globalFilters = dashboard.global_filters || [];
    if (globalFilters.length === 0) return;
    // Only initialize if assignments are empty (first load)
    const hasAny = Object.values(tileFilterAssignments).some(a => a.length > 0);
    if (hasAny) return;

    const chartTileIds = (dashboard.tiles || [])
      .filter(t => t.tile_type !== 'markdown')
      .map(t => t.tile_id);

    const initial: Record<string, string[]> = {};
    for (const tileId of chartTileIds) {
      initial[tileId] = globalFilters.map(f => f.id);
    }
    setTileFilterAssignments(initial);
  }, [dashboardStore.currentDashboard?.id, dashboardStore.currentDashboard?.global_filters]);

  const handleLayoutChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (layout: GridLayout[], layouts: any) => {
      if (isEditing) {
        // Store pending layouts locally — NOT saved until user clicks Done
        setPendingLayouts(layouts as Layouts);
      }
    },
    [isEditing]
  );

  const handleStartEditing = useCallback(() => {
    // Snapshot current layout so we can revert on cancel
    const dashboard = dashboardStore.currentDashboard;
    if (dashboard?.layout?.layouts) {
      setSavedLayoutSnapshot(JSON.parse(JSON.stringify(dashboard.layout.layouts)));
    }
    setPendingLayouts(null);
    setIsEditing(true);
  }, [dashboardStore.currentDashboard]);

  const handleSaveEditing = useCallback(async () => {
    if (pendingLayouts) {
      await dashboardStore.updateDashboardLayout(dashboardId, pendingLayouts, appKey, isAdmin);
    }
    setPendingLayouts(null);
    setSavedLayoutSnapshot(null);
    setIsEditing(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('edit');
      window.history.replaceState({}, '', url.toString());
    }
  }, [dashboardId, pendingLayouts, dashboardStore]);

  const handleCancelEditing = useCallback(async () => {
    // Revert to the snapshot layout
    if (savedLayoutSnapshot) {
      await dashboardStore.updateDashboardLayout(dashboardId, savedLayoutSnapshot, appKey, isAdmin);
      await dashboardStore.fetchDashboard(dashboardId, appKey, isAdmin);
    }
    setPendingLayouts(null);
    setSavedLayoutSnapshot(null);
    setIsEditing(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('edit');
      window.history.replaceState({}, '', url.toString());
    }
  }, [dashboardId, savedLayoutSnapshot, dashboardStore]);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragStop = () => {
    setIsDragging(false);
  };

  const handleRemoveTile = async (tileId: string) => {
    if (!confirm('Remove this tile from the dashboard?')) return;
    
    try {
      await dashboardStore.removeTileFromDashboard(dashboardId, tileId, appKey, isAdmin);
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

      await dashboardStore.addTileToDashboard(dashboardId, tileId, layout, appKey, isAdmin);
      setShowAddTileModal(false);
    } catch (error: any) {
      alert(`Failed to add tile: ${error.message}`);
    }
  };

  const handleGlobalFiltersChange = async (filters: Filter[]) => {
    if (!dashboardStore.currentDashboard) return;
    
    // Auto-assign new filters to ALL chart tiles by default
    const chartTileIds = (dashboardStore.currentDashboard.tiles || [])
      .filter(t => t.tile_type !== 'markdown')
      .map(t => t.tile_id);

    const newAssignments = { ...tileFilterAssignments };
    for (const f of filters) {
      const isNew = !dashboardStore.currentDashboard.global_filters?.some(gf => gf.id === f.id);
      if (isNew) {
        for (const tileId of chartTileIds) {
          if (!newAssignments[tileId]) newAssignments[tileId] = [];
          if (!newAssignments[tileId].includes(f.id)) {
            newAssignments[tileId].push(f.id);
          }
        }
      }
    }
    setTileFilterAssignments(newAssignments);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082'}/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ global_filters: filters }),
      });
      
      const result = await response.json();
      if (!result.ok) throw new Error(result.error);
      
      await dashboardStore.fetchDashboard(dashboardId, appKey, isAdmin);
    } catch (error: any) {
      console.error('Failed to update global filters:', error);
      alert(`Failed to update filters: ${error.message}`);
    }
  };

  const handleExploreSave = async (tileId: string, updatedConfig: TileConfig) => {
    try {
      await dashboardStore.updateTile(tileId, undefined, undefined, updatedConfig, appKey, isAdmin);
      await dashboardStore.fetchDashboard(dashboardId, appKey, isAdmin);
    } catch (error: any) {
      throw error;
    }
  };

  if (dashboardStore.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!dashboardStore.currentDashboard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Dashboard Not Found</h2>
          <p className="text-sm text-gray-500 mb-6">
            {dashboardStore.error || 'This dashboard may have been deleted or the URL is incorrect.'}
          </p>
          <button
            onClick={() => router.push('/dashboards')}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            View All Dashboards
          </button>
        </div>
      </div>
    );
  }

  // Tenant isolation: block access if dashboard belongs to a different app
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-xl shadow-sm border border-red-200">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-500 mb-6">
            This dashboard belongs to a different app. Switch to the correct app in the sidebar, or enable Admin Mode to access all apps.
          </p>
          <button
            onClick={() => router.push('/dashboards')}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            View My Dashboards
          </button>
        </div>
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

  const dashboardBg = getGradientCss((dashboard?.layout as any)?.background);

  return (
    <div className="min-h-screen dashboard-scroll" style={{ background: dashboardBg }}>
      {/* Header — cinematic dark gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1e1b4b] via-[#312e81] to-[#3730a3]">
        {/* Decorative orbs */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 left-1/4 w-40 h-40 bg-violet-400/8 rounded-full blur-2xl" />

        <div className="relative px-8 py-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboards')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Back to dashboards"
              >
                <ArrowLeft className="w-5 h-5 text-indigo-200" />
              </button>
              
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>{dashboard.name}</h1>
                {dashboard.description && (
                  <p className="text-indigo-200/80 mt-0.5 text-sm">{dashboard.description}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/analytics?dashboard=${dashboardId}`)}
                className="h-9 px-3.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold backdrop-blur-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New Chart
              </button>

              <button
                onClick={() => setShowCreateMarkdownModal(true)}
                className="h-9 px-3.5 bg-white/10 hover:bg-white/20 text-indigo-100 border border-white/10 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold backdrop-blur-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                Text
              </button>

              <button
                onClick={() => setShowAddTileModal(true)}
                className="h-9 px-3.5 bg-white/10 hover:bg-white/20 text-indigo-100 border border-white/10 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold backdrop-blur-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Saved Tile
              </button>

              <div className="w-px h-6 bg-white/20 mx-1" />

              {isEditing ? (
                <>
                  <button
                    onClick={handleCancelEditing}
                    className="h-9 px-3.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-red-200 border border-red-300/20 backdrop-blur-sm"
                  >
                    <X className="w-3.5 h-3.5" /> Discard
                  </button>
                  <button
                    onClick={handleSaveEditing}
                    className="h-9 px-3.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25"
                  >
                    <Check className="w-3.5 h-3.5" /> Save
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStartEditing}
                  className="h-9 px-3.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-indigo-100 border border-white/10 backdrop-blur-sm"
                >
                  <Settings className="w-3.5 h-3.5" /> Edit Layout
                </button>
              )}
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
        <div className="mx-6 mt-6 bg-indigo-50/80 backdrop-blur-sm border border-indigo-200/60 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Edit className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-indigo-900 mb-1">Edit Mode</h4>
              <p className="text-xs text-indigo-600">
                Drag to reposition, resize corners, or remove tiles. Click <strong>Save</strong> to keep or <strong>Discard</strong> to revert.
              </p>
            </div>
            <button
              onClick={handleCancelEditing}
              className="text-indigo-400 hover:text-indigo-600 transition-colors"
              title="Discard changes"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      
      {/* Filter Info Banner - Show when filters exist but not in edit mode */}
      {!isEditing && (dashboard.global_filters?.length || 0) > 0 && (
        <div className="mx-6 mt-6 bg-white/60 backdrop-blur-sm border border-indigo-100/50 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-3.5 h-3.5 text-indigo-500" />
            <p className="text-xs text-indigo-600">
              <span className="font-semibold">{dashboard.global_filters?.length} active filter(s).</span> Click pills to assign to specific tiles.
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
            onLayoutChange={handleLayoutChange as any}
            onDragStart={handleDragStart}
            onDragStop={handleDragStop}
            onResizeStart={handleDragStart}
            onResizeStop={handleDragStop}
            draggableHandle=".drag-handle"
          >
            {dashboard.tiles.map((tile) => {
              const tileConf = (tile.tile_config || {}) as Record<string, any>;
              const isSection = tile.tile_type === 'markdown' && !!tileConf.isSection;
              const isNumberTile = tileConf.chartType === 'number';
              return (
              <div
                key={tile.tile_id}
                className={`
                  rounded-2xl overflow-hidden transition-all duration-300
                  ${isSection
                    ? 'bg-transparent border-0 shadow-none'
                    : isEditing 
                      ? 'bg-white border-2 border-blue-300 shadow-lg hover:shadow-xl' 
                      : 'tile-glass rounded-2xl'
                  }
                  ${isDragging ? 'opacity-40' : 'opacity-100'}
                `}
              >
                {/* Tile Header - Always visible in edit mode */}
                {isEditing && (
                  <div className="drag-handle cursor-move bg-gradient-to-r from-indigo-50/80 to-violet-50/80 px-4 py-3 border-b border-indigo-200/60 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <GripVertical className="w-5 h-5 text-indigo-400" />
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{tile.tile_name}</span>
                        {tile.tile_description && (
                          <p className="text-xs text-gray-500 mt-0.5">{tile.tile_description}</p>
                        )}
                      </div>
                      
                      {/* Filter count badge */}
                      {tile.tile_type !== 'markdown' && (tileFilterAssignments[tile.tile_id] || []).length > 0 && (
                        <span className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                          <FilterIcon className="w-3 h-3" />
                          <span className="font-medium">{(tileFilterAssignments[tile.tile_id] || []).length}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {tile.tile_type !== 'markdown' ? (
                        <button
                          onClick={() => setExploreTile({
                            tileId: tile.tile_id,
                            tileName: tile.tile_name,
                            tileDescription: tile.tile_description,
                            config: tile.tile_config as TileConfig,
                          })}
                          className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-lg transition-colors"
                          title="Explore & edit tile"
                        >
                          <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditMarkdownTile({
                            tileId: tile.tile_id,
                            tileName: tile.tile_name,
                            config: tile.tile_config as Record<string, any>,
                          })}
                          className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-lg transition-colors"
                          title="Edit text tile"
                        >
                          <Edit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveTile(tile.tile_id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Remove tile"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Tile Name Badge — hidden for number tiles (label is inside BigNumber) */}
                {!isEditing && !isSection && !isNumberTile && (
                  <div className="absolute top-2.5 left-3 z-10">
                    <span className="text-[11px] font-semibold text-slate-500 tracking-wide uppercase"
                      style={{ fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '0.06em' }}
                    >{tile.tile_name}</span>
                  </div>
                )}

                {/* Tile Content */}
                <div className={`${isEditing ? 'p-4' : isSection ? 'p-0' : isNumberTile ? 'p-2' : 'p-4 pt-8'} relative h-full overflow-auto`}>
                  {/* Filter indicator badge for non-edit mode */}
                  {!isEditing && !isSection && tile.tile_type !== 'markdown' && (tileFilterAssignments[tile.tile_id] || []).length > 0 && (
                    <div className="absolute top-2 right-3 z-10">
                      <span className="text-[10px] text-indigo-500 flex items-center gap-1 bg-indigo-50/80 px-1.5 py-0.5 rounded-full">
                        <FilterIcon className="w-2.5 h-2.5" />
                        {(tileFilterAssignments[tile.tile_id] || []).length}
                      </span>
                    </div>
                  )}
                  <div className="h-full">
                    {tile.tile_type === 'markdown' ? (
                      <MarkdownTile
                        content={tileConf.content || ''}
                        backgroundColor={tileConf.backgroundColor}
                        textColor={tileConf.textColor}
                        isSection={isSection}
                        accentColor={tileConf.accentColor}
                      />
                    ) : (
                      <TileLiveChart
                        key={`${tile.tile_id}-${JSON.stringify(tileFilterAssignments[tile.tile_id] || [])}`}
                        tileId={tile.tile_id}
                        config={tile.tile_config as any}
                        appKey={dashboard.app_key}
                        showRefresh={!isEditing}
                        autoRefresh={false}
                        tileName={tile.tile_name}
                        globalFilters={(dashboard.global_filters || []).filter(f => 
                          (tileFilterAssignments[tile.tile_id] || []).includes(f.id)
                        )}
                        ignoreGlobalFilters={false}
                      />
                    )}
                  </div>
                </div>
              </div>
              );
            })}
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

      {/* Tile Explore Modal */}
      {exploreTile && (
        <TileExploreModal
          tileId={exploreTile.tileId}
          tileName={exploreTile.tileName}
          tileDescription={exploreTile.tileDescription}
          initialConfig={exploreTile.config}
          appKey={dashboard.app_key}
          onSave={handleExploreSave}
          onClose={() => setExploreTile(null)}
        />
      )}

      {/* Edit Markdown Tile Modal */}
      {editMarkdownTile && (
        <EditMarkdownModal
          tileId={editMarkdownTile.tileId}
          tileName={editMarkdownTile.tileName}
          initialConfig={editMarkdownTile.config}
          onSave={async () => {
            setEditMarkdownTile(null);
            await dashboardStore.fetchDashboard(dashboardId, appKey, isAdmin);
          }}
          onCancel={() => setEditMarkdownTile(null)}
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

// Accent color options for section headers
const ACCENT_COLORS = [
  { id: 'indigo', label: 'Indigo', value: '#6366f1' },
  { id: 'violet', label: 'Violet', value: '#8b5cf6' },
  { id: 'blue', label: 'Blue', value: '#3b82f6' },
  { id: 'emerald', label: 'Emerald', value: '#10b981' },
  { id: 'amber', label: 'Amber', value: '#f59e0b' },
  { id: 'rose', label: 'Rose', value: '#f43f5e' },
  { id: 'slate', label: 'Slate', value: '#64748b' },
];

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
  const [mode, setMode] = useState<'rich' | 'section'>('rich');
  const [content, setContent] = useState('# Title\n\nAdd your content here...');
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionSubtitle, setSectionSubtitle] = useState('');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [isSaving, setIsSaving] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const isSection = mode === 'section';
      const tileName = isSection
        ? (sectionTitle.trim() || 'Section')
        : (name.trim() || 'Text Tile');
      
      const tileContent = isSection
        ? `# ${sectionTitle.trim()}\n${sectionSubtitle.trim()}`
        : content;

      const tileConfig: Record<string, any> = {
        type: 'markdown',
        content: tileContent,
        backgroundColor: isSection ? 'transparent' : '#ffffff',
        textColor: '#334155',
      };

      if (isSection) {
        tileConfig.isSection = true;
        tileConfig.accentColor = accentColor;
      }

      const response = await fetch(`${API}/tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_key: appKey,
          name: tileName,
          tile_type: 'markdown',
          config: tileConfig,
        }),
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.error);

      const tileId = data.tile.id;
      const layout = isSection
        ? { x: 0, y: 0, w: 12, h: 1, minW: 6, minH: 1 }
        : { x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 2 };

      await fetch(`${API}/dashboards/${dashboardId}/tiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tile_id: tileId, layout_config: layout }),
      });

      onSave();
    } catch (error: any) {
      alert(`Failed to create tile: ${error.message}`);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Add Text Element</h2>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Mode toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('rich')}
                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  mode === 'rich'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">Rich Text</div>
                <div className="text-[10px] mt-0.5 opacity-70">Markdown content block</div>
              </button>
              <button
                type="button"
                onClick={() => setMode('section')}
                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  mode === 'section'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">Section Header</div>
                <div className="text-[10px] mt-0.5 opacity-70">Divider with accent bar</div>
              </button>
            </div>
          </div>

          {mode === 'section' ? (
            <>
              {/* Section header config */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title</label>
                <input
                  type="text"
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  placeholder="e.g., Growth, Behavior, Conversion"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subtitle (optional)</label>
                <input
                  type="text"
                  value={sectionSubtitle}
                  onChange={(e) => setSectionSubtitle(e.target.value)}
                  placeholder="e.g., Monthly trajectory and conversion efficiency"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Accent Color</label>
                <div className="flex gap-2">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setAccentColor(c.value)}
                      className={`w-8 h-8 rounded-full transition-all ${
                        accentColor === c.value ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Live preview */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Preview</label>
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                  <div className="flex items-start gap-3">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 tracking-wide uppercase" style={{ letterSpacing: '0.08em' }}>
                        {sectionTitle || 'Section Title'}
                      </h3>
                      {sectionSubtitle && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{sectionSubtitle}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Rich text mode */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tile Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Dashboard Overview"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-sm"
                  maxLength={255}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Markdown</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-64 px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 font-mono text-xs resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Preview</label>
                  <div className="h-64 border border-gray-200 rounded-xl overflow-y-auto bg-white">
                    <MarkdownTile content={content} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm font-semibold shadow-sm"
            disabled={isSaving || (mode === 'section' && !sectionTitle.trim())}
          >
            {isSaving ? 'Saving...' : 'Add to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit Markdown Tile Modal — same floating card style as the Explore modal
function EditMarkdownModal({
  tileId,
  tileName,
  initialConfig,
  onSave,
  onCancel,
}: {
  tileId: string;
  tileName: string;
  initialConfig: Record<string, any>;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isInitiallySection = !!initialConfig.isSection;

  // Parse existing section content back to title/subtitle
  const parseSectionContent = (content: string) => {
    const lines = (content || '').split('\n').filter(l => l.trim());
    const title = (lines[0] || '').replace(/^#+\s*/, '');
    const subtitle = lines.slice(1).join(' ').replace(/\*+/g, '').trim();
    return { title, subtitle };
  };

  const sectionParsed = parseSectionContent(initialConfig.content || '');

  const [mode, setMode] = useState<'rich' | 'section'>(isInitiallySection ? 'section' : 'rich');
  const [name, setName] = useState(tileName);
  const [content, setContent] = useState(initialConfig.content || '');
  const [sectionTitle, setSectionTitle] = useState(sectionParsed.title);
  const [sectionSubtitle, setSectionSubtitle] = useState(sectionParsed.subtitle);
  const [accentColor, setAccentColor] = useState(initialConfig.accentColor || '#6366f1');
  const [isSaving, setIsSaving] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const isSection = mode === 'section';
      const newName = isSection
        ? (sectionTitle.trim() || 'Section')
        : (name.trim() || 'Text Tile');

      const tileContent = isSection
        ? `# ${sectionTitle.trim()}\n${sectionSubtitle.trim()}`
        : content;

      const tileConfig: Record<string, any> = {
        type: 'markdown',
        content: tileContent,
        backgroundColor: isSection ? 'transparent' : (initialConfig.backgroundColor || '#ffffff'),
        textColor: initialConfig.textColor || '#334155',
      };

      if (isSection) {
        tileConfig.isSection = true;
        tileConfig.accentColor = accentColor;
      }

      const response = await fetch(`${API}/tiles/${tileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, config: tileConfig }),
      });

      const data = await response.json();
      if (!data.ok) throw new Error(data.error);

      onSave();
    } catch (error: any) {
      alert(`Failed to update tile: ${error.message}`);
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-10 bg-black/40 backdrop-blur-[2px]">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[calc(100vh-6rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200/60 dark:border-gray-700/60">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 text-white rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-tight">Edit: {tileName}</h2>
            <p className="text-[11px] text-indigo-200/80 mt-0.5">{mode === 'section' ? 'Section Header' : 'Rich Text'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="h-8 px-3.5 text-xs font-semibold text-indigo-100 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || (mode === 'section' && !sectionTitle.trim())}
              className="h-8 px-4 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-all shadow-md shadow-emerald-600/30 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white dark:bg-gray-900 rounded-b-2xl">
          {/* Mode toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('rich')}
                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  mode === 'rich'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">Rich Text</div>
                <div className="text-[10px] mt-0.5 opacity-70">Markdown content block</div>
              </button>
              <button
                type="button"
                onClick={() => setMode('section')}
                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  mode === 'section'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">Section Header</div>
                <div className="text-[10px] mt-0.5 opacity-70">Divider with accent bar</div>
              </button>
            </div>
          </div>

          {mode === 'section' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title</label>
                <input
                  type="text"
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  placeholder="e.g., Growth, Behavior, Conversion"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subtitle (optional)</label>
                <input
                  type="text"
                  value={sectionSubtitle}
                  onChange={(e) => setSectionSubtitle(e.target.value)}
                  placeholder="e.g., Monthly trajectory and conversion efficiency"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Accent Color</label>
                <div className="flex gap-2">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setAccentColor(c.value)}
                      className={`w-8 h-8 rounded-full transition-all ${
                        accentColor === c.value ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Live preview */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Preview</label>
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                  <div className="flex items-start gap-3">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: accentColor, minHeight: '24px' }} />
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 tracking-wide uppercase" style={{ letterSpacing: '0.08em' }}>
                        {sectionTitle || 'Section Title'}
                      </h3>
                      {sectionSubtitle && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{sectionSubtitle}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tile Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Dashboard Overview"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-sm"
                  maxLength={255}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Markdown</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-64 px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 font-mono text-xs resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Preview</label>
                  <div className="h-64 border border-gray-200 rounded-xl overflow-y-auto bg-white">
                    <MarkdownTile content={content} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

