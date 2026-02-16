// app/dashboards/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  LayoutDashboard,
  Trash2,
  Eye,
  Loader2,
  X,
} from 'lucide-react';
import { useDashboardStore } from '@/lib/useDashboardStore';
import { useAppKey } from '@/lib/AppKeyContext';
import { GRADIENT_PRESETS, getGradientCss } from '@/lib/gradient-presets';

export default function DashboardsPage() {
  const router = useRouter();
  const dashboardStore = useDashboardStore();
  const { appKey, currentApp, isLoading: appLoading, isAdmin } = useAppKey();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch dashboards when app changes
  useEffect(() => {
    if (appKey) {
      dashboardStore.fetchDashboards(appKey, isAdmin);
    }
  }, [appKey, isAdmin]);

  const handleCreateDashboard = async (name: string, description?: string, gradientId?: string) => {
    try {
      const dashboardId = await dashboardStore.createDashboard(name, description, appKey);
      
      // Save background gradient to dashboard layout
      if (gradientId) {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
        await fetch(`${API_BASE_URL}/dashboards/${dashboardId}/layout`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ background: gradientId }),
        });
      }

      setShowCreateModal(false);
      router.push(`/dashboards/${dashboardId}`);
    } catch (error: any) {
      alert(`Failed to create dashboard: ${error.message}`);
    }
  };

  const handleDeleteDashboard = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dashboard?')) return;
    
    try {
      await dashboardStore.deleteDashboard(id, appKey, isAdmin);
      if (appKey) {
        dashboardStore.fetchDashboards(appKey, isAdmin);
      }
    } catch (error: any) {
      alert(`Failed to delete dashboard: ${error.message}`);
    }
  };

  if (appLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Dashboards</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Dashboards for <span className="font-semibold text-gray-800 dark:text-gray-200">{currentApp?.name || appKey}</span>
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
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>New Dashboard</span>
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
        ) : dashboardStore.dashboards.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <LayoutDashboard className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">No Dashboards</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create your first dashboard to organize your tiles
              </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Dashboard
            </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardStore.dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Dashboard Preview Thumbnail */}
                <div className="h-32 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
                  <div className="grid grid-cols-3 gap-2 h-full">
                    {dashboard.tiles?.slice(0, 6).map((tile, idx) => (
                      <div
                        key={idx}
                        className={`bg-white dark:bg-gray-600 rounded border border-gray-300 dark:border-gray-500 flex items-center justify-center ${
                          idx === 0 ? 'col-span-2 row-span-2' : ''
                        }`}
                      >
                        <LayoutDashboard className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      </div>
                    )) || (
                      <div className="col-span-3 flex items-center justify-center text-gray-400 dark:text-gray-500">
                        <LayoutDashboard className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Dashboard Info */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{dashboard.name}</h3>
                      {dashboard.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{dashboard.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <span>{dashboard.tile_count || 0} tiles</span>
                    <span>{new Date(dashboard.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => router.push(`/dashboards/${dashboard.id}`)}
                      className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center space-x-2 font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </button>
                    
                    <button
                      onClick={() => handleDeleteDashboard(dashboard.id)}
                      className="px-4 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dashboard Modal */}
      {showCreateModal && (
        <CreateDashboardModal
          onSave={handleCreateDashboard}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

function CreateDashboardModal({
  onSave,
  onCancel,
}: {
  onSave: (name: string, description?: string, gradientId?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedGradient, setSelectedGradient] = useState('mesh-default');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave(name.trim(), description.trim() || undefined, selectedGradient);
    } catch (error) {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Dashboard</h2>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Product Analytics"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-sm transition-all"
              autoFocus
              maxLength={255}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={2}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 text-sm resize-none transition-all"
            />
          </div>

          {/* Gradient Background Picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Background
            </label>
            <div className="grid grid-cols-5 gap-2">
              {GRADIENT_PRESETS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGradient(g.id)}
                  className={`group relative rounded-xl h-12 transition-all ${
                    selectedGradient === g.id
                      ? 'ring-2 ring-indigo-500 ring-offset-2 scale-105'
                      : 'ring-1 ring-gray-200 hover:ring-gray-300'
                  }`}
                  style={{ background: g.css }}
                  title={g.label}
                >
                  {selectedGradient === g.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              {GRADIENT_PRESETS.find(g => g.id === selectedGradient)?.label || 'Select a background'}
            </p>
          </div>

          <div className="flex space-x-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm font-semibold shadow-sm"
              disabled={isSaving || !name.trim()}
            >
              {isSaving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
