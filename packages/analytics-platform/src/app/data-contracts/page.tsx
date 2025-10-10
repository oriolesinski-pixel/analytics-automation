'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDataContractsStore } from '@/lib/useDataContractsStore';
import { UIGraph } from '@/components/data-contracts/UIGraph';
import { PageEventsView } from '@/components/data-contracts/PageEventsView';
import { EventEditorModal } from '@/components/data-contracts/EventEditorModal';
import { PreviewChangesModal } from '@/components/data-contracts/PreviewChangesModal';
import { CreatePRModal } from '@/components/data-contracts/CreatePRModal';
import { MergeConfirmationModal } from '@/components/data-contracts/MergeConfirmationModal';
import { DeploymentMonitorModal } from '@/components/data-contracts/DeploymentMonitorModal';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface UIGraphData {
  pages: Record<string, any>;
  widgets: string[];
  metadata: any;
}

export default function DataContractsPage() {
  const router = useRouter();
  const { 
    selectedPageId, 
    setSelectedPageId,
    schemaVersion,
    lastUpdated,
    setLastUpdated
  } = useDataContractsStore();

  const [appKey, setAppKey] = useState<string>('');
  const [uiGraph, setUIGraph] = useState<UIGraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Get app key from storage
  useEffect(() => {
    const storedKey = localStorage.getItem('app_key') || sessionStorage.getItem('app_key');
    if (storedKey) {
      setAppKey(storedKey);
    } else {
      // No app selected, redirect to onboarding
      router.push('/onboarding');
    }
  }, [router]);

  // Fetch UI Graph with event annotations
  useEffect(() => {
    if (!appKey) return;
    fetchUIGraph();
  }, [appKey]);

  const fetchUIGraph = async () => {
    setIsLoading(true);
    try {
      // Use Next.js API route (relative path)
      const response = await fetch(`/api/apps/${appKey}/ui-graph`);
      if (response.ok) {
        const data = await response.json();
        console.log('UI Graph data:', data);
        setUIGraph(data.uiGraph);
      } else {
        console.error('Failed to fetch UI graph:', response.status);
      }
    } catch (error) {
      console.error('Error fetching UI graph:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncFromRepo = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/apps/${appKey}/sync-schema`, {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        setLastUpdated(new Date().toISOString());
        await fetchUIGraph();
      }
    } catch (error) {
      console.error('Error syncing from repo:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleNodeClick = (pageId: string) => {
    setSelectedPageId(pageId);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading data contracts...</p>
        </div>
      </div>
    );
  }

  // If a page is selected, show PageEventsView
  if (selectedPageId && uiGraph?.pages[selectedPageId]) {
    return (
      <>
        <PageEventsView 
          page={uiGraph.pages[selectedPageId]} 
          pageId={selectedPageId}
          appKey={appKey}
        />
        <EventEditorModal appKey={appKey} />
        <PreviewChangesModal />
        <CreatePRModal appKey={appKey} />
        <MergeConfirmationModal appKey={appKey} />
        <DeploymentMonitorModal />
      </>
    );
  }

  // Default view: UI Graph
  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Data Contracts
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Schema v{schemaVersion} • Last updated {formatDate(lastUpdated)}
          </p>
        </div>
        <Button 
          onClick={syncFromRepo}
          disabled={isSyncing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync from Repo'}
        </Button>
      </div>

      {/* UI Graph with Event Annotations */}
      {uiGraph && uiGraph.pages && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <UIGraph 
            pages={uiGraph.pages}
            onNodeClick={handleNodeClick}
          />
        </div>
      )}

      {/* Info Alert */}
      <Alert>
        <AlertDescription className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          Click any page node to view and edit tracked events
        </AlertDescription>
      </Alert>

      {/* Modals */}
      <EventEditorModal appKey={appKey} />
      <PreviewChangesModal />
      <CreatePRModal appKey={appKey} />
      <MergeConfirmationModal appKey={appKey} />
      <DeploymentMonitorModal />
    </div>
  );
}

