'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDataContractsStore } from '@/lib/useDataContractsStore';
// ReactMarkdown removed - using simple rendering

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface PullRequest {
  id: string;
  number: number;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  branch: string;
  githubUrl: string;
  filesChanged: {
    path: string;
    additions: number;
    deletions: number;
    diff: string;
  }[];
  checks: {
    name: string;
    status: 'passed' | 'running' | 'failed';
    duration: string;
  }[];
  canMerge: boolean;
  blockingReason?: string;
}

export default function PRReviewPage() {
  const router = useRouter();
  const params = useParams();
  const prNumber = params?.prNumber as string;

  const {
    setShowMergeConfirm,
    setCommitMessage,
    currentPR,
    setCurrentPR,
  } = useDataContractsStore();

  const [appKey, setAppKey] = useState<string>('');
  const [pr, setPR] = useState<PullRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  // Get app key from storage
  useEffect(() => {
    const storedKey = localStorage.getItem('app_key') || sessionStorage.getItem('app_key');
    if (storedKey) {
      setAppKey(storedKey);
    }
  }, []);

  // Fetch PR data
  useEffect(() => {
    if (!appKey || !prNumber) return;
    fetchPR();

    // Set up WebSocket for real-time updates
    const ws = new WebSocket(
      `${API_BASE_URL.replace('http', 'ws')}/apps/${appKey}/pull-requests/${prNumber}/subscribe`
    );

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setPR((prev) => (prev ? { ...prev, ...update } : null));
    };

    return () => {
      ws.close();
    };
  }, [appKey, prNumber]);

  const fetchPR = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/apps/${appKey}/pull-requests/${prNumber}`
      );
      if (response.ok) {
        const data = await response.json();
        setPR(data.pr);
        setCurrentPR(data.pr);
      }
    } catch (error) {
      console.error('Error fetching PR:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const closePR = async () => {
    if (!confirm('Are you sure you want to close this pull request?')) return;

    setIsClosing(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/apps/${appKey}/pull-requests/${prNumber}/close`,
        { method: 'POST' }
      );
      if (response.ok) {
        router.push('/data-contracts');
      }
    } catch (error) {
      console.error('Error closing PR:', error);
    } finally {
      setIsClosing(false);
    }
  };

  const mergePR = () => {
    if (!pr) return;

    // Set default commit message
    setCommitMessage(`${pr.title} (#${pr.number})`);
    setShowMergeConfirm(true);
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading pull request...</p>
        </div>
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertTitle>Pull Request Not Found</AlertTitle>
          <AlertDescription>
            The pull request #{prNumber} could not be found.
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => router.push('/data-contracts')}
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Data Contracts
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.push('/data-contracts')}
        className="mb-4 gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Data Contracts
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Pull Request #{pr.number}: {pr.title}
          </h1>
          <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
            <Badge
              variant={
                pr.status === 'open'
                  ? 'default'
                  : pr.status === 'merged'
                  ? 'success'
                  : 'secondary'
              }
            >
              {pr.status}
            </Badge>
            <span>Created: {timeAgo(pr.createdAt)}</span>
            <span>Branch: {pr.branch}</span>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => window.open(pr.githubUrl, '_blank')}
          className="gap-2"
        >
          View on GitHub
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="files">
            Files Changed ({pr.filesChanged.length})
          </TabsTrigger>
          <TabsTrigger value="checks">
            Checks ({pr.checks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="p-6">
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
              {pr.description}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          {pr.filesChanged.map((file) => (
            <Card key={file.path} className="p-4">
              <div className="flex justify-between items-center mb-3">
                <code className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                  {file.path}
                </code>
                <Badge variant="secondary">
                  +{file.additions} -{file.deletions}
                </Badge>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs font-mono overflow-x-auto">
                {file.diff.split('\n').map((line, i) => {
                  let className = '';
                  if (line.startsWith('+')) {
                    className = 'text-green-400';
                  } else if (line.startsWith('-')) {
                    className = 'text-red-400';
                  }
                  return (
                    <div key={i} className={className}>
                      {line}
                    </div>
                  );
                })}
              </pre>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="checks" className="space-y-2">
          {pr.checks.map((check) => (
            <Card
              key={check.name}
              className="p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {check.status === 'passed' && (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                )}
                {check.status === 'running' && (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                )}
                {check.status === 'failed' && (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium">{check.name}</span>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {check.duration}
              </span>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <Card className="mt-6 p-6">
        <h3 className="font-semibold text-lg mb-4">Merge Pull Request</h3>

        {!pr.canMerge && pr.blockingReason && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Cannot merge: {pr.blockingReason}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={closePR} disabled={isClosing}>
            {isClosing ? 'Closing...' : 'Close PR'}
          </Button>
          <Button onClick={mergePR} disabled={!pr.canMerge}>
            Approve & Merge
          </Button>
        </div>
      </Card>
    </div>
  );
}

