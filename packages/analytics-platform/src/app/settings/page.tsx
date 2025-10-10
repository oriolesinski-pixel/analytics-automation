'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  GitBranch,
  BarChart3,
  Palette,
  Code2,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Download,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Globe,
  Calendar,
  Clock,
  Database,
  Key,
  TrendingUp,
  Zap,
  Shield,
  Package,
  FileCode,
  Lock,
  Users,
  GitMerge,
  CheckCircle2
} from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem, Label } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/components/ui/toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface Settings {
  general: {
    applicationName: string;
    timeZone: string;
    dateFormat: string;
    defaultDateRange: number;
  };
  git: {
    connectedRepo: string;
    defaultBranch: string;
    autoMerge: boolean;
    prReviewer: string;
  };
  analytics: {
    ingestionEndpoint: string;
    apiKey: string;
    dataRetention: number | 'forever';
    sampleRate: number;
  };
  display: {
    numberFormatting: 'comma' | 'abbreviated' | 'plain';
    sidebarCollapsed: boolean;
  };
  tracker: {
    version: string;
    autoUpdate: boolean;
    debug: boolean;
  };
  artifacts: {
    schemaVersion: string;
    schemaLocked: boolean;
  };
}

export default function SettingsPage() {
  const [appId, setAppId] = useState<string>('');
  const [appKey, setAppKey] = useState<string>('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const { theme, setTheme: setThemeValue } = useTheme();
  const { showToast } = useToast();

  // Dialog states
  const [showRegenerateKeyDialog, setShowRegenerateKeyDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [collectionPaused, setCollectionPaused] = useState(false);

  // Remove integration options
  const [removeOptions, setRemoveOptions] = useState({
    removeTrackerFiles: false,
    createCleanupPR: false,
    deleteData: false
  });

  // Debounced save
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Get app from URL or localStorage (using 'app_key' as the storage key)
    const params = new URLSearchParams(window.location.search);
    const appFromUrl = params.get('app');
    const storedApp = localStorage.getItem('app_key') || sessionStorage.getItem('app_key');
    const currentApp = appFromUrl || storedApp || '';
    
    if (currentApp) {
      setAppId(currentApp);
      setAppKey(currentApp);
      loadSettings(currentApp);
    } else {
      setLoading(false);
    }
  }, []);

  const loadSettings = async (app: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/settings/${app}`);
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        // Initialize with defaults if no settings exist
        setSettings({
          general: {
            applicationName: app,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            dateFormat: 'MM/DD/YYYY',
            defaultDateRange: 7
          },
          git: {
            connectedRepo: '',
            defaultBranch: 'main',
            autoMerge: false,
            prReviewer: ''
          },
          analytics: {
            ingestionEndpoint: `${API_BASE_URL}/events/ingest/${app}`,
            apiKey: 'sk_' + Math.random().toString(36).substring(2, 15),
            dataRetention: 90,
            sampleRate: 100
          },
          display: {
            numberFormatting: 'comma',
            sidebarCollapsed: false
          },
          tracker: {
            version: '1.0.0',
            autoUpdate: true,
            debug: false
          },
          artifacts: {
            schemaVersion: '1.0.0',
            schemaLocked: false
          }
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updatedSettings: Settings) => {
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/settings/${appId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });

      if (response.ok) {
        showToast('Settings saved', 'success');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('Failed to save settings', 'error');
      // Revert on error
      loadSettings(appId);
    } finally {
      setSaving(false);
    }
  };

  const debouncedSave = (updatedSettings: Settings) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    const timeout = setTimeout(() => {
      saveSettings(updatedSettings);
    }, 500);
    setSaveTimeout(timeout);
  };

  const updateSetting = <K extends keyof Settings>(
    section: K,
    key: keyof Settings[K],
    value: any,
    immediate = false
  ) => {
    if (!settings) return;

    const updated = {
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value
      }
    };
    setSettings(updated);

    if (immediate) {
      saveSettings(updated);
    } else {
      debouncedSave(updated);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard`, 'success');
    } catch (error) {
      showToast('Failed to copy', 'error');
    }
  };

  const regenerateApiKey = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/keys/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId })
      });

      if (response.ok) {
        const { apiKey } = await response.json();
        updateSetting('analytics', 'apiKey', apiKey, true);
        showToast('API key regenerated', 'success');
        setShowRegenerateKeyDialog(false);
      }
    } catch (error) {
      showToast('Failed to regenerate API key', 'error');
    }
  };

  const regenerateArtifacts = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/artifacts/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId })
      });

      if (response.ok) {
        showToast('Artifacts regenerated successfully', 'success');
        loadSettings(appId);
      }
    } catch (error) {
      showToast('Failed to regenerate artifacts', 'error');
    } finally {
      setSaving(false);
    }
  };

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      showToast(`${filename} downloaded`, 'success');
    } catch (error) {
      showToast('Failed to download file', 'error');
    }
  };

  const toggleCollection = async (pause: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, pause })
      });

      if (response.ok) {
        setCollectionPaused(pause);
        showToast(pause ? 'Data collection paused' : 'Data collection resumed', 'success');
        setShowPauseDialog(false);
      }
    } catch (error) {
      showToast('Failed to update collection status', 'error');
    }
  };

  const resetAnalyticsData = async () => {
    if (resetConfirmText !== 'RESET') {
      showToast('Please type RESET to confirm', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/events/all?appId=${appId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showToast('Analytics data reset', 'success');
        setShowResetDialog(false);
        setResetConfirmText('');
      }
    } catch (error) {
      showToast('Failed to reset data', 'error');
    }
  };

  const removeIntegration = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/integration/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, ...removeOptions })
      });

      if (response.ok) {
        showToast('Integration removed', 'success');
        setShowRemoveDialog(false);
      }
    } catch (error) {
      showToast('Failed to remove integration', 'error');
    }
  };

  const deleteApplication = async () => {
    if (deleteConfirmText !== settings?.general.applicationName) {
      showToast('Please type the exact application name', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/applications/${appId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showToast('Application deleted', 'success');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      }
    } catch (error) {
      showToast('Failed to delete application', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Application Selected</h2>
          <p className="text-gray-600 mb-4">Please select an application from the dashboard</p>
          <Button onClick={() => window.location.href = '/dashboard'}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const timeZones = Intl.supportedValuesOf('timeZone');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-indigo-600/20 dark:via-purple-600/20 dark:to-blue-600/20 border-b border-blue-700 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/10 dark:border-indigo-500/30">
              <SettingsIcon className="w-6 h-6 text-white dark:text-indigo-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white dark:text-gray-100">Settings</h1>
              <p className="text-blue-100 dark:text-gray-400">Configure your application and analytics preferences</p>
            </div>
          </div>
          {saving && (
            <div className="flex items-center gap-2 mt-4 px-4 py-2 bg-white/20 dark:bg-indigo-500/20 rounded-lg backdrop-blur-sm w-fit border border-white/10 dark:border-indigo-500/30">
              <Loader2 className="w-4 h-4 animate-spin text-white dark:text-indigo-300" />
              <span className="text-sm text-white dark:text-gray-200 font-medium">Saving changes...</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        <Accordion type="multiple" defaultValue={['general']}>
          {/* GENERAL SECTION */}
          <AccordionItem value="general">
            <AccordionTrigger value="general" icon={<Globe className="w-5 h-5" />}>
              General Settings
            </AccordionTrigger>
            <AccordionContent value="general">
              <div className="space-y-6">
                {/* Application Name */}
                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <Label className="block mb-1 font-semibold text-gray-900 dark:text-gray-100">Application Name</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">The display name for your application</p>
                      <Input
                        value={settings.general.applicationName}
                        onChange={(e) => updateSetting('general', 'applicationName', e.target.value)}
                        placeholder="My Application"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Time Zone */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <Label className="font-semibold text-gray-900 dark:text-gray-100">Time Zone</Label>
                    </div>
                    <Select
                      value={settings.general.timeZone}
                      onChange={(e) => updateSetting('general', 'timeZone', e.target.value)}
                    >
                      {timeZones.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </Select>
                  </div>

                  {/* Date Format */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <Label className="font-semibold text-gray-900 dark:text-gray-100">Date Format</Label>
                    </div>
                    <Select
                      value={settings.general.dateFormat}
                      onChange={(e) => updateSetting('general', 'dateFormat', e.target.value)}
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </Select>
                  </div>
                </div>

                {/* Default Date Range */}
                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <Label className="font-semibold text-gray-900 dark:text-gray-100">Default Date Range</Label>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Default time period for analytics dashboards</p>
                  <Select
                    value={settings.general.defaultDateRange.toString()}
                    onChange={(e) => updateSetting('general', 'defaultDateRange', parseInt(e.target.value))}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* GIT INTEGRATION SECTION */}
          <AccordionItem value="git">
            <AccordionTrigger value="git" icon={<GitBranch className="w-5 h-5" />}>
              Git Integration
            </AccordionTrigger>
            <AccordionContent value="git">
              <div className="space-y-6">
                {/* Connected Repository */}
                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <Label className="block mb-1 font-semibold text-gray-900 dark:text-gray-100">Connected Repository</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Your linked GitHub repository</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={settings.git.connectedRepo || 'Not connected'}
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => window.location.href = '/auth/github'}
                    >
                      <GitBranch className="w-4 h-4 mr-2" />
                      Reconnect
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Default Branch */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <GitBranch className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <Label className="font-semibold text-gray-900 dark:text-gray-100">Default Branch</Label>
                    </div>
                    <Input
                      value={settings.git.defaultBranch}
                      onChange={(e) => updateSetting('git', 'defaultBranch', e.target.value)}
                      placeholder="main"
                    />
                  </div>

                  {/* PR Reviewer */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <Label className="font-semibold text-gray-900 dark:text-gray-100">PR Reviewer</Label>
                    </div>
                    <Input
                      value={settings.git.prReviewer}
                      onChange={(e) => updateSetting('git', 'prReviewer', e.target.value)}
                      placeholder="@username"
                    />
                  </div>
                </div>

                {/* Auto-merge PRs */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-500/10 dark:via-purple-500/5 dark:to-blue-500/10 p-4 rounded-lg border border-purple-200 dark:border-purple-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-white dark:bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <GitMerge className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <Label className="block mb-1 font-semibold text-gray-900 dark:text-gray-100">Auto-merge PRs</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Automatically merge approved pull requests</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.git.autoMerge}
                      onCheckedChange={(checked) => updateSetting('git', 'autoMerge', checked, true)}
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ANALYTICS CONFIG SECTION */}
          <AccordionItem value="analytics">
            <AccordionTrigger value="analytics" icon={<BarChart3 className="w-5 h-5" />}>
              Analytics Configuration
            </AccordionTrigger>
            <AccordionContent value="analytics">
              <div className="space-y-6">
                {/* Ingestion Endpoint */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:via-cyan-500/5 dark:to-blue-500/10 p-4 rounded-lg border border-blue-200 dark:border-blue-500/30">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-white dark:bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <Label className="block mb-1 font-semibold text-gray-900 dark:text-gray-100">Ingestion Endpoint</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Send analytics events to this URL</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={settings.analytics.ingestionEndpoint}
                      readOnly
                      className="flex-1 bg-white dark:bg-gray-700 font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(settings.analytics.ingestionEndpoint, 'Endpoint')}
                      className="bg-white dark:bg-gray-700"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* API Key */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:via-orange-500/5 dark:to-amber-500/10 p-4 rounded-lg border border-amber-200 dark:border-amber-500/30">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-white dark:bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <Label className="block mb-1 font-semibold text-gray-900 dark:text-gray-100">API Key</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Authentication key for your application</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings.analytics.apiKey}
                      readOnly
                      className="flex-1 bg-white dark:bg-gray-700 font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKey(!showApiKey)}
                      title={showApiKey ? 'Hide' : 'Show'}
                      className="bg-white dark:bg-gray-700"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowRegenerateKeyDialog(true)}
                      title="Regenerate"
                      className="bg-white dark:bg-gray-700"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(settings.analytics.apiKey, 'API Key')}
                      title="Copy"
                      className="bg-white dark:bg-gray-700"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Data Retention */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <Label className="font-semibold text-gray-900 dark:text-gray-100">Data Retention</Label>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">How long to keep analytics data</p>
                    <Select
                      value={settings.analytics.dataRetention.toString()}
                      onChange={(e) => updateSetting('analytics', 'dataRetention', 
                        e.target.value === 'forever' ? 'forever' : parseInt(e.target.value)
                      )}
                    >
                      <option value="30">30 days</option>
                      <option value="60">60 days</option>
                      <option value="90">90 days</option>
                      <option value="180">180 days</option>
                      <option value="365">1 year</option>
                      <option value="forever">Forever</option>
                    </Select>
                  </div>

                  {/* Sample Rate */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <Label className="font-semibold text-gray-900 dark:text-gray-100">Sample Rate</Label>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Percentage of events to collect</p>
                    <Select
                      value={settings.analytics.sampleRate.toString()}
                      onChange={(e) => updateSetting('analytics', 'sampleRate', parseInt(e.target.value))}
                    >
                      <option value="100">100% (All events)</option>
                      <option value="50">50% (Half)</option>
                      <option value="25">25% (Quarter)</option>
                      <option value="10">10% (Sample)</option>
                    </Select>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* DISPLAY & APPEARANCE SECTION */}
          <AccordionItem value="display">
            <AccordionTrigger value="display" icon={<Palette className="w-5 h-5" />}>
              Display & Appearance
            </AccordionTrigger>
            <AccordionContent value="display">
              <div className="space-y-6">
                {/* Theme Selection */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-500/10 dark:via-indigo-500/10 dark:to-pink-500/10 p-5 rounded-lg border border-purple-200 dark:border-purple-500/30">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
                      <Palette className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <Label className="font-semibold text-gray-900 dark:text-gray-100 text-base">Theme Selection</Label>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Choose your preferred color scheme</p>
                  <RadioGroup
                    value={theme}
                    onValueChange={(value) => {
                      const newTheme = value as 'light' | 'dark' | 'system';
                      setThemeValue(newTheme);
                      showToast(`Theme changed to ${newTheme === 'system' ? 'system default' : newTheme}`, 'success');
                    }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                  >
                    {/* Light Theme */}
                    <div className="relative">
                      <RadioGroupItem value="light" id="light" className="peer sr-only" />
                      <Label
                        htmlFor="light"
                        className="flex flex-col items-center justify-between rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 hover:border-blue-400 hover:shadow-md peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-blue-200 cursor-pointer transition-all"
                      >
                        {theme === 'light' && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className="w-full h-32 rounded border-2 border-gray-200 bg-white mb-3 overflow-hidden">
                          <div className="p-3 space-y-2">
                            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                            <div className="h-2 bg-gray-100 rounded w-full mt-4"></div>
                            <div className="h-2 bg-gray-50 rounded w-2/3"></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Sun className="w-5 h-5 text-yellow-500" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Light</span>
                        </div>
                      </Label>
                    </div>

                    {/* System Theme */}
                    <div className="relative">
                      <RadioGroupItem value="system" id="system" className="peer sr-only" />
                      <Label
                        htmlFor="system"
                        className="flex flex-col items-center justify-between rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 hover:border-blue-400 hover:shadow-md peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-blue-200 cursor-pointer transition-all"
                      >
                        {theme === 'system' && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className="w-full h-32 rounded border-2 border-gray-200 mb-3 flex overflow-hidden">
                          <div className="w-1/2 bg-white p-2 border-r border-gray-200">
                            <div className="h-2 bg-gray-200 rounded mb-1"></div>
                            <div className="h-2 bg-gray-100 rounded w-2/3 mb-2"></div>
                            <div className="h-1.5 bg-gray-100 rounded w-full"></div>
                          </div>
                          <div className="w-1/2 bg-gray-900 p-2">
                            <div className="h-2 bg-gray-700 rounded mb-1"></div>
                            <div className="h-2 bg-gray-800 rounded w-2/3 mb-2"></div>
                            <div className="h-1.5 bg-gray-800 rounded w-full"></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Monitor className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Match system</span>
                        </div>
                      </Label>
                    </div>

                    {/* Dark Theme */}
                    <div className="relative">
                      <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                      <Label
                        htmlFor="dark"
                        className="flex flex-col items-center justify-between rounded-lg border-2 border-gray-700 bg-gray-950 text-white p-4 hover:border-blue-500 hover:shadow-md peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-blue-400 cursor-pointer transition-all"
                      >
                        {theme === 'dark' && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className="w-full h-32 rounded border-2 border-gray-700 bg-gray-900 mb-3 overflow-hidden">
                          <div className="p-3 space-y-2">
                            <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-800 rounded w-1/2"></div>
                            <div className="h-2 bg-gray-800 rounded w-full mt-4"></div>
                            <div className="h-2 bg-gray-700 rounded w-2/3"></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Moon className="w-5 h-5 text-blue-400" />
                          <span className="text-sm font-semibold">Dark</span>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Number Formatting */}
                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <Label className="font-semibold text-gray-900 dark:text-gray-100">Number Formatting</Label>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">How numbers are displayed in charts and tables</p>
                  <RadioGroup
                    value={settings.display.numberFormatting}
                    onValueChange={(value) => {
                      updateSetting('display', 'numberFormatting', value, true);
                      showToast('Number format updated', 'success');
                    }}
                    className="flex flex-wrap gap-3"
                  >
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 transition-all">
                      <RadioGroupItem value="comma" id="comma" />
                      <Label htmlFor="comma" className="cursor-pointer font-medium text-gray-900 dark:text-gray-100">1,000 <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">(Comma)</span></Label>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 transition-all">
                      <RadioGroupItem value="abbreviated" id="abbreviated" />
                      <Label htmlFor="abbreviated" className="cursor-pointer font-medium text-gray-900 dark:text-gray-100">1K <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">(Abbreviated)</span></Label>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 transition-all">
                      <RadioGroupItem value="plain" id="plain" />
                      <Label htmlFor="plain" className="cursor-pointer font-medium text-gray-900 dark:text-gray-100">1000 <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">(Plain)</span></Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Sidebar Collapsed */}
                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Monitor className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <Label className="block mb-1 font-semibold text-gray-900 dark:text-gray-100">Collapse Sidebar by Default</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Start with sidebar minimized on load</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.display.sidebarCollapsed}
                      onCheckedChange={(checked) => {
                        updateSetting('display', 'sidebarCollapsed', checked, true);
                        showToast(`Sidebar will ${checked ? 'start collapsed' : 'start expanded'}`, 'success');
                      }}
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* TRACKER CONFIG SECTION */}
          <AccordionItem value="tracker">
            <AccordionTrigger value="tracker" icon={<Code2 className="w-5 h-5" />}>
              Tracker Configuration
            </AccordionTrigger>
            <AccordionContent value="tracker">
              <div className="space-y-6">
                {/* Current Version */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-500/10 dark:via-emerald-500/5 dark:to-green-500/10 p-4 rounded-lg border border-green-200 dark:border-green-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white dark:bg-green-500/20 rounded-lg flex items-center justify-center">
                        <FileCode className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <Label className="block font-semibold text-gray-900 dark:text-gray-100">Current Version</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Tracker library version</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-base px-4 py-1">
                      v{settings.tracker.version}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Auto-update */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <Label className="block mb-1 font-semibold text-gray-900 dark:text-gray-100">Auto-update Tracker</Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Automatically update to the latest version</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.tracker.autoUpdate}
                        onCheckedChange={(checked) => updateSetting('tracker', 'autoUpdate', checked, true)}
                      />
                    </div>
                  </div>

                  {/* Debug Mode */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
                        </div>
                        <div>
                          <Label className="block mb-1 font-semibold text-gray-900 dark:text-gray-100">Debug Mode</Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Enable console logging for troubleshooting</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.tracker.debug}
                        onCheckedChange={(checked) => updateSetting('tracker', 'debug', checked, true)}
                      />
                    </div>
                  </div>
                </div>

                {settings.tracker.debug && (
                  <Alert variant="warning">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                      <div>
                        <strong className="block mb-1">Debug mode is active</strong>
                        <p className="text-sm">Console logging is enabled in production. This may expose sensitive data and impact performance.</p>
                      </div>
                    </div>
                  </Alert>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ARTIFACT MANAGEMENT SECTION */}
          <AccordionItem value="artifacts">
            <AccordionTrigger value="artifacts" icon={<Package className="w-5 h-5" />}>
              Artifact Management
            </AccordionTrigger>
            <AccordionContent value="artifacts">
              <div className="space-y-6">
                {/* Schema Version */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:via-purple-500/5 dark:to-indigo-500/10 p-4 rounded-lg border border-indigo-200 dark:border-indigo-500/30">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white dark:bg-indigo-500/20 rounded-lg flex items-center justify-center">
                        <FileCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <Label className="block font-semibold text-gray-900 dark:text-gray-100">Schema Version</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Current schema configuration</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="text-base px-4 py-1">{settings.artifacts.schemaVersion}</Badge>
                      <Button variant="link" size="sm" onClick={() => window.open('/changelog', '_blank')}>
                        View Changelog
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Regenerate Artifacts */}
                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <Label className="block mb-1 font-semibold text-gray-900 dark:text-gray-100">Regenerate Artifacts</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Rebuild schema, graph, and tracker files from source</p>
                      <Button
                        onClick={regenerateArtifacts}
                        loading={saving}
                        variant="outline"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate All Artifacts
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Schema Lock */}
                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <Label className="block mb-1 font-semibold text-gray-900 dark:text-gray-100">Schema Lock</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Prevent accidental schema modifications</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.artifacts.schemaLocked}
                      onCheckedChange={(checked) => updateSetting('artifacts', 'schemaLocked', checked, true)}
                    />
                  </div>
                </div>

                {/* Download Section */}
                <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-slate-800/50 dark:to-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <Label className="font-semibold text-gray-900 dark:text-gray-100">Download Artifacts</Label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(`${API_BASE_URL}/api/artifacts/schema.json`, 'schema.json')}
                      className="justify-start"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Schema JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(`${API_BASE_URL}/api/artifacts/graph.json`, 'graph.json')}
                      className="justify-start"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Site Graph
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(`${API_BASE_URL}/api/artifacts/tracker.js`, 'tracker.js')}
                      className="justify-start"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Tracker JS
                    </Button>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* DANGER ZONE SECTION */}
          <AccordionItem value="danger" className="border-red-200 dark:border-red-900/50 border-l-4 border-l-red-500 dark:border-l-red-600 bg-red-50 dark:bg-red-900/10">
            <AccordionTrigger value="danger" icon={<AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500" />}>
              <span className="text-red-600 dark:text-red-500">Danger Zone</span>
            </AccordionTrigger>
            <AccordionContent value="danger">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800/50 rounded-lg border border-red-200 dark:border-red-500/30">
                  <div>
                    <Label className="block mb-1 text-gray-900 dark:text-gray-100">Pause Data Collection</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Temporarily stop collecting analytics events</p>
                  </div>
                  <Switch
                    checked={collectionPaused}
                    onCheckedChange={() => setShowPauseDialog(true)}
                  />
                </div>

                <div className="p-4 bg-white dark:bg-gray-800/50 rounded-lg border border-red-200 dark:border-red-500/30">
                  <Button
                    variant="destructive"
                    onClick={() => setShowResetDialog(true)}
                  >
                    Reset Analytics Data
                  </Button>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Permanently delete all collected analytics data
                  </p>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800/50 rounded-lg border border-red-200 dark:border-red-500/30">
                  <Button
                    variant="destructive"
                    onClick={() => setShowRemoveDialog(true)}
                  >
                    Remove Integration
                  </Button>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Remove analytics integration from your repository
                  </p>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800/50 rounded-lg border border-red-200 dark:border-red-500/30">
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    Delete Application
                  </Button>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Permanently delete this application and all associated data
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* DIALOGS */}
      
      {/* Regenerate API Key Dialog */}
      <AlertDialog open={showRegenerateKeyDialog} onOpenChange={setShowRegenerateKeyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate your current API key. Any applications using the old key will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateKeyDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={regenerateApiKey}>
              Regenerate Key
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pause Collection Dialog */}
      <AlertDialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {collectionPaused ? 'Resume' : 'Pause'} Data Collection?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {collectionPaused
                ? 'Your application will resume collecting analytics events.'
                : 'Your application will stop collecting analytics events until you resume.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowPauseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => toggleCollection(!collectionPaused)}>
              {collectionPaused ? 'Resume' : 'Pause'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Data Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Analytics Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all collected analytics data. This action cannot be undone.
              <br /><br />
              Type <strong>RESET</strong> to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="Type RESET"
            className="mt-2"
          />
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => {
              setShowResetDialog(false);
              setResetConfirmText('');
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={resetAnalyticsData}
              disabled={resetConfirmText !== 'RESET'}
            >
              Reset Data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Integration Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Integration</DialogTitle>
            <DialogDescription>
              Select what you'd like to remove:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={removeOptions.removeTrackerFiles}
                onCheckedChange={(checked) =>
                  setRemoveOptions(prev => ({ ...prev, removeTrackerFiles: checked }))
                }
                id="removeFiles"
              />
              <Label htmlFor="removeFiles" className="cursor-pointer">
                Remove tracker files from repository
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                checked={removeOptions.createCleanupPR}
                onCheckedChange={(checked) =>
                  setRemoveOptions(prev => ({ ...prev, createCleanupPR: checked }))
                }
                id="createPR"
              />
              <Label htmlFor="createPR" className="cursor-pointer">
                Create cleanup PR
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                checked={removeOptions.deleteData}
                onCheckedChange={(checked) =>
                  setRemoveOptions(prev => ({ ...prev, deleteData: checked }))
                }
                id="deleteData"
              />
              <Label htmlFor="deleteData" className="cursor-pointer">
                Delete all collected data
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={removeIntegration}>
              Remove Integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Application Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{settings.general.applicationName}</strong> and all
              associated data including analytics events, schemas, and configurations.
              <br /><br />
              Type the exact application name to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={settings.general.applicationName}
            className="mt-2"
          />
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDeleteDialog(false);
              setDeleteConfirmText('');
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteApplication}
              disabled={deleteConfirmText !== settings.general.applicationName}
            >
              Delete Application
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
