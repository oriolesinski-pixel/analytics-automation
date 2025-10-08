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
  ChevronDown,
  X,
} from 'lucide-react';
import { useDashboardStore } from '@/lib/useDashboardStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface App {
  app_key: string;
  name: string;
}

export default function DashboardsPage() {
  const router = useRouter();
  const dashboardStore = useDashboardStore();
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [apps, setApps] = useState<App[]>([]);
  const [showAppDropdown, setShowAppDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  // Fetch dashboards when app changes
  useEffect(() => {
    if (selectedApp) {
      dashboardStore.fetchDashboards(selectedApp);
    }
  }, [selectedApp]);

  const handleCreateDashboard = async (name: string, description?: string) => {
    try {
      const dashboardId = await dashboardStore.createDashboard(name, description, selectedApp);
      setShowCreateModal(false);
      // Redirect to new dashboard
      router.push(`/dashboards/${dashboardId}`);
    } catch (error: any) {
      alert(`Failed to create dashboard: ${error.message}`);
    }
  };

  const handleDeleteDashboard = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dashboard?')) return;
    
    try {
      await dashboardStore.deleteDashboard(id);
      if (selectedApp) {
        dashboardStore.fetchDashboards(selectedApp);
      }
    } catch (error: any) {
      alert(`Failed to delete dashboard: ${error.message}`);
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
              <h1 className="text-2xl font-semibold text-gray-900">Dashboards</h1>

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
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center space-x-2"
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
          // Empty State
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <LayoutDashboard className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No Dashboards</h3>
              <p className="text-gray-600 mb-6">
                Create your first dashboard to organize your tiles
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Dashboard
              </button>
            </div>
          </div>
        ) : (
          // Dashboards List
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardStore.dashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{dashboard.name}</h3>
                    {dashboard.description && (
                      <p className="text-sm text-gray-500">{dashboard.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{dashboard.tile_count || 0} tiles</span>
                  <span>{new Date(dashboard.created_at).toLocaleDateString()}</span>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => router.push(`/dashboards/${dashboard.id}`)}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View</span>
                  </button>
                  
                  <button
                    onClick={() => handleDeleteDashboard(dashboard.id)}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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

// Create Dashboard Modal Component
function CreateDashboardModal({
  onSave,
  onCancel,
}: {
  onSave: (name: string, description?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave(name.trim(), description.trim() || undefined);
    } catch (error) {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create Dashboard</h2>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dashboard Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Analytics Overview"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
              maxLength={255}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your dashboard..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              disabled={isSaving || !name.trim()}
            >
              {isSaving ? 'Creating...' : 'Create Dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

