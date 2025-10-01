//analytics-automation/packages/analytics-platform/src/app/api/analyze/progress/route.ts
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Github, Check, Loader2, Code2, GitBranch, BarChart3, ArrowRight, Shield, Zap, Eye, Copy, CheckCircle2, XCircle, AlertCircle, ExternalLink, Terminal, FileCode2, GitPullRequest, Activity, Plus, Key, Settings, ChevronDown, ChevronUp, Lock, Globe, Smartphone, Tablet, Monitor, BookOpen, RefreshCw, ToggleLeft, ToggleRight, Circle, Square, Layers, Home, ShoppingCart, User, Package, CreditCard, Heart, ClipboardCopy, FileSearch, Link, GitMerge, FolderOpen } from 'lucide-react';
import { EventDetailsCollapsible, UIGraphVisualization, SitePreviewSandbox } from '@/components/onboarding/ReviewSchema';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

// Add global styles for animations
const globalStyles = `
  @keyframes progress-bar {
    0% { width: 0%; }
    50% { width: 100%; }
    100% { width: 0%; }
  }
  .animate-progress-bar {
    animation: progress-bar 2s ease-in-out infinite;
  }
`;

// Type definitions
interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  private: boolean;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  default_branch: string;
  permissions?: any;
  isMonorepo?: boolean;
}

interface DirectoryItem {
  name: string;
  path: string;
  type: 'dir' | 'file';
  hasPackageJson?: boolean;
  hasFrontendFiles?: boolean;
  framework?: string;
  description?: string;
  scripts?: Record<string, string>;
  children?: DirectoryItem[];
}

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
}

interface AnalysisProgress {
  message: string;
  icon: string;
  timestamp?: number;
}

interface Schema {
  events: any[];
  routes: any[];
  uiGraph: any;
  metadata: any;
  trackerCode: string;
  providerCode: string;
  totalPages: number;
  totalComponents: number;
  estimatedEvents: string;
  appKey?: string;
  siteUrl?: string;
}

// Session storage keys
const STORAGE_KEYS = {
  CURRENT_STEP: 'onboarding_current_step',
  SELECTED_REPO: 'onboarding_selected_repo',
  GITHUB_TOKEN: 'onboarding_github_token',
  GITHUB_USER: 'onboarding_github_user',
  SCHEMA: 'onboarding_schema',
  APP_KEY: 'onboarding_app_key',
  PR_URL: 'onboarding_pr_url',
  PR_NUMBER: 'onboarding_pr_number',
  REPOSITORIES: 'onboarding_repositories',
  AUTO_MERGE: 'onboarding_auto_merge',
  ENABLED_EVENTS: 'onboarding_enabled_events',
  SITE_URL: 'onboarding_site_url',
  DIRECTORY_TREE: 'onboarding_directory_tree',
  EXPANDED_PATHS: 'onboarding_expanded_paths',
  SELECTED_PATH: 'onboarding_selected_path'
};

function OnboardingFlow() {
  // Initialize state
  const [currentStep, setCurrentStep] = useState(0);
  // Removed: const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null); - replaced by selectedPath
  const [githubToken, setGithubToken] = useState('');
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [appKey, setAppKey] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [prNumber, setPrNumber] = useState<number | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [autoMerge, setAutoMerge] = useState(false);
  const [enabledEvents, setEnabledEvents] = useState<Record<string, boolean>>({});
  const [siteUrl, setSiteUrl] = useState('');

  // Recursive directory tree state
  const [directoryTree, setDirectoryTree] = useState<Record<string, DirectoryItem[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<{repo: Repository, item: DirectoryItem} | null>(null);
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [loadingTree, setLoadingTree] = useState(false);

  // Add a flag to track if we've hydrated from storage
  const [isHydrated, setIsHydrated] = useState(false);

  // Non-persisted state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState('idle');
  const [mergeStatus, setMergeStatus] = useState('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [currentProgressStep, setCurrentProgressStep] = useState(0);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);

  // Inject styles only on client
  useEffect(() => {
    if (!document.getElementById('onboarding-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'onboarding-styles';
      styleSheet.textContent = globalStyles;
      document.head.appendChild(styleSheet);
    }
  }, []);

  // Load from sessionStorage AFTER initial render (client-side only)
  useEffect(() => {
    const loadFromSession = (key: string, defaultValue: any) => {
      try {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch {
        return defaultValue;
      }
    };

    setCurrentStep(loadFromSession(STORAGE_KEYS.CURRENT_STEP, 0));
    // Removed: setSelectedRepo - replaced by selectedPath
    setGithubToken(loadFromSession(STORAGE_KEYS.GITHUB_TOKEN, ''));
    setGithubUser(loadFromSession(STORAGE_KEYS.GITHUB_USER, null));
    setSchema(loadFromSession(STORAGE_KEYS.SCHEMA, null));
    setAppKey(loadFromSession(STORAGE_KEYS.APP_KEY, ''));
    setPrUrl(loadFromSession(STORAGE_KEYS.PR_URL, ''));
    setPrNumber(loadFromSession(STORAGE_KEYS.PR_NUMBER, null));
    setRepositories(loadFromSession(STORAGE_KEYS.REPOSITORIES, []));
    setAutoMerge(loadFromSession(STORAGE_KEYS.AUTO_MERGE, false));
    setEnabledEvents(loadFromSession(STORAGE_KEYS.ENABLED_EVENTS, {}));
    setSiteUrl(loadFromSession(STORAGE_KEYS.SITE_URL, ''));
    setDirectoryTree(loadFromSession(STORAGE_KEYS.DIRECTORY_TREE, {}));
    const storedExpandedPaths = loadFromSession(STORAGE_KEYS.EXPANDED_PATHS, []);
    setExpandedPaths(new Set(storedExpandedPaths));
    setSelectedPath(loadFromSession(STORAGE_KEYS.SELECTED_PATH, null));

    setIsHydrated(true);
  }, []);

  // Persist state to sessionStorage (only after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.CURRENT_STEP, JSON.stringify(currentStep));
  }, [currentStep, isHydrated]);

  // Removed: selectedRepo session storage - now handled by selectedPath

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.GITHUB_TOKEN, JSON.stringify(githubToken));
  }, [githubToken, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.GITHUB_USER, JSON.stringify(githubUser));
  }, [githubUser, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify(schema));
  }, [schema, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.APP_KEY, JSON.stringify(appKey));
  }, [appKey, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.PR_URL, JSON.stringify(prUrl));
  }, [prUrl, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.PR_NUMBER, JSON.stringify(prNumber));
  }, [prNumber, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.REPOSITORIES, JSON.stringify(repositories));
  }, [repositories, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.AUTO_MERGE, JSON.stringify(autoMerge));
  }, [autoMerge, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.ENABLED_EVENTS, JSON.stringify(enabledEvents));
  }, [enabledEvents, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.SITE_URL, JSON.stringify(siteUrl));
  }, [siteUrl, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.DIRECTORY_TREE, JSON.stringify(directoryTree));
  }, [directoryTree, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.EXPANDED_PATHS, JSON.stringify(Array.from(expandedPaths)));
  }, [expandedPaths, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.SELECTED_PATH, JSON.stringify(selectedPath));
  }, [selectedPath, isHydrated]);

  const steps = [
    { id: 'connect', label: 'Connect GitHub', icon: Github },
    { id: 'select', label: 'Select Repository', icon: Code2 },
    { id: 'analyze', label: 'Analyze Code', icon: Terminal },
    { id: 'review', label: 'Review Schema', icon: Eye },
    { id: 'deploy', label: 'Create PR', icon: GitPullRequest },
    { id: 'merge', label: 'Merge PR', icon: GitMerge },
    { id: 'complete', label: 'Start Tracking', icon: Activity }
  ];

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleEventToggle = (eventType: string, enabled: boolean) => {
    setEnabledEvents(prev => ({
      ...prev,
      [eventType]: enabled
    }));
  };

  // Validate URL format
  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Fetch directory contents at any depth
  const fetchDirectoryContents = async (repo: Repository, dirPath: string = '') => {
    const pathKey = `${repo.id}:${dirPath}`;
    
    if (loadingPaths.has(pathKey)) return;
    
    setLoadingPaths(prev => new Set(prev).add(pathKey));
    setError(null);

    try {
      const url = `/api/repos?owner=${repo.owner.login}&repo=${repo.name}${
        dirPath ? `&path=${encodeURIComponent(dirPath)}` : ''
      }`;
      
      const response = await fetch(url, {
          method: 'GET',
          credentials: 'same-origin'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch directory contents');
      }

      // Store using repo.id for root level, or update tree recursively for nested
      if (!dirPath) {
        // Root level - store directly with repo.id as key
        setDirectoryTree(prev => ({
          ...prev,
          [repo.id]: data.items || []
        }));
      } else {
        // Nested level - this will be handled by updateTree in togglePathExpansion
        return data.items || [];
      }

      return data.items || [];
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch directory contents');
      return [];
    } finally {
      setLoadingPaths(prev => {
        const next = new Set(prev);
        next.delete(pathKey);
        return next;
      });
    }
  };

  // Recursive function to update tree structure
  const updateTree = (
    currentTree: DirectoryItem[],
    pathSegments: string[],
    newChildren: DirectoryItem[]
  ): DirectoryItem[] => {
    if (pathSegments.length === 0) {
      return newChildren;
    }

    return currentTree.map(node => {
      const currentPathPart = pathSegments[0];
      if (node.path.endsWith(currentPathPart) && node.type === 'dir') {
        if (pathSegments.length === 1) {
          // We found the target - update its children
          return { ...node, children: newChildren };
        } else {
          // Keep going deeper
          return {
            ...node,
            children: updateTree(node.children || [], pathSegments.slice(1), newChildren)
          };
        }
      }
      return node;
    });
  };

  // Toggle expansion for any directory path
  const togglePathExpansion = async (repo: Repository, item: DirectoryItem) => {
    const fullPath = `${repo.id}-${item.path}`;
    const newExpandedPaths = new Set(expandedPaths);
    
    if (expandedPaths.has(fullPath)) {
      // Collapse - remove this path and all children
      Array.from(expandedPaths).forEach(path => {
        if (path.startsWith(fullPath)) {
          newExpandedPaths.delete(path);
        }
      });
      setExpandedPaths(newExpandedPaths);
    } else {
      // Expand
      newExpandedPaths.add(fullPath);
      setExpandedPaths(newExpandedPaths);
      
      // Fetch children if not already loaded
      if (!item.children || item.children.length === 0) {
        const children = await fetchDirectoryContents(repo, item.path);
        
        // Update the tree with the fetched children
        setDirectoryTree(prev => {
          const repoTree = prev[repo.id] || [];
          const pathSegments = item.path.split('/').filter(Boolean);
          const updatedTree = updateTree(repoTree, pathSegments, children);
          return { ...prev, [repo.id]: updatedTree };
        });
      }
    }
  };

  // Toggle repo expansion (root level)
  const toggleRepoExpansion = async (repo: Repository) => {
    const rootKey = `${repo.id}`;
    const newExpandedPaths = new Set(expandedPaths);
    
    if (expandedPaths.has(rootKey)) {
      // Collapse - remove all paths for this repo
      Array.from(expandedPaths).forEach(path => {
        if (path.startsWith(`${repo.id}-`) || path === rootKey) {
          newExpandedPaths.delete(path);
        }
      });
      setExpandedPaths(newExpandedPaths);
    } else {
      // Expand repo root
      newExpandedPaths.add(rootKey);
      setExpandedPaths(newExpandedPaths);
      
      // Fetch root level contents
      if (!directoryTree[rootKey]) {
        await fetchDirectoryContents(repo, '');
      }
    }
  };

  // Connect to GitHub with personal access token - REAL API
  const connectGitHub = async () => {
    if (!githubToken) {
      setError('Please enter your GitHub token');
      return;
    }

    if (siteUrl && !isValidUrl(siteUrl)) {
      setError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: githubToken })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setGithubUser(data.user);
      await fetchRepositories();
      setCurrentStep(1);

    } catch (err) {
      setError((err as Error).message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // Fetch repositories - REAL API
  const fetchRepositories = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/repos', {
        method: 'GET',
        credentials: 'same-origin'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch repositories');
      }

      setRepositories(data.repos || []);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  // Analyze repository with REAL progress tracking



const analyzeRepository = async () => {
  if (!selectedPath) {
    setError('Please select a repository or directory');
    return;
  }

  const { repo, item } = selectedPath;

  setIsAnalyzing(true);
  setError(null);
  setCurrentStep(2);
  setAnalysisProgress([]);
  setCurrentProgressStep(0);
  setAnalysisLogs([]);

  let pollInterval: NodeJS.Timeout | null = null;
  let isStillAnalyzing = true;

  

  try {
    // Start polling for backend progress
    pollInterval = setInterval(async () => {
      if (!isStillAnalyzing) return;

      try {
        const progressResponse = await fetch(
          `/api/analyze/progress?repo_id=${repo.id}&_=${Date.now()}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            },
            cache: 'no-store'
          }
        );

        if (progressResponse.ok) {
          const progress = await progressResponse.json();

          if (progress.step && progress.step > 0) {
            // Update progress to show all steps up to current
            const newProgress = allProgressSteps
              .filter(s => s.step <= progress.step)
              .map(s => ({
                message: s.message,
                icon: s.icon,
                timestamp: Date.now()
              }));
            
            setAnalysisProgress(newProgress);
            setCurrentProgressStep(progress.step);

            // Stop when we reach the final step
            if (progress.step === allProgressSteps.length) {
              isStillAnalyzing = false;
            }
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
      }
    }, 1000); // Poll every second

    // Start the actual analysis
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        repoId: repo.id,
        repoName: repo.name,
        repoOwner: repo.owner.login,
        defaultBranch: repo.default_branch,
        siteUrl: siteUrl,
        subdir: item.path || null,
        subdirName: item.name || null
      })
    });

    isStillAnalyzing = false;
    if (pollInterval) clearInterval(pollInterval);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Analysis failed');
    }

    const data = await response.json();

    // Progress is already tracked via polling - don't override it

    setSchema({
      events: data.events || [],
      routes: data.routes || [],
      uiGraph: data.uiGraph || {},
      metadata: data.metadata || {},
      trackerCode: data.trackerCode || '',
      providerCode: data.providerCode || '',
      totalPages: data.totalPages || 0,
      totalComponents: data.totalComponents || 0,
      estimatedEvents: data.estimatedEvents || '10K/day',
      appKey: data.appKey || '',
      siteUrl: siteUrl || data.siteUrl
    });

    setAppKey(data.appKey || '');

    setTimeout(() => {
      setCurrentStep(3);
    }, 1500);

  } catch (err) {
    isStillAnalyzing = false;
    if (pollInterval) clearInterval(pollInterval);
    setError((err as Error).message || 'Analysis failed');
    setCurrentStep(1);
  } finally {
    setIsAnalyzing(false);
    if (pollInterval) clearInterval(pollInterval);
  }
};
  // Create Pull Request - REAL API
  const createPR = async () => {
    if (!schema || !selectedPath) return;

    setDeploymentStatus('creating');
    setCurrentStep(4);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Token': githubToken
        },
        body: JSON.stringify({
          repoOwner: selectedPath.repo.owner.login,
          repoName: selectedPath.repo.name,
          trackerCode: schema.trackerCode,
          providerCode: schema.providerCode,
          appKey: schema.appKey || appKey,
          autoMerge: autoMerge,
          subdir: selectedPath.item.path || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Deployment failed');
      }

      const data = await response.json();
      setPrUrl(data.prUrl);

      // Extract PR number from URL
      if (data.prUrl) {
        const prMatch = data.prUrl.match(/\/pull\/(\d+)$/);
        if (prMatch) {
          setPrNumber(parseInt(prMatch[1]));
        }
      }

      setDeploymentStatus('success');
      setTimeout(() => setCurrentStep(5), 2000);

    } catch (err) {
      setError((err as Error).message || 'Deployment failed');
      setDeploymentStatus('failed');
    }
  };

  // Merge Pull Request
  const mergePR = async () => {
    if (!prNumber || !selectedPath) return;

    setMergeStatus('merging');
    setError(null);

    try {
      const response = await fetch('/api/onboarding/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Token': githubToken
        },
        body: JSON.stringify({
          repoOwner: selectedPath.repo.owner.login,
          repoName: selectedPath.repo.name,
          prNumber: prNumber
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Merge failed');
      }

      const data = await response.json();
      setMergeStatus('success');

      // Store repo info for dashboard
      sessionStorage.setItem('github_owner', selectedPath.repo.owner.login);
      sessionStorage.setItem('github_repo', selectedPath.repo.name);
      sessionStorage.setItem('github_token', githubToken);

      setTimeout(() => setCurrentStep(6), 2000);

    } catch (err) {
      setError((err as Error).message || 'Merge failed');
      setMergeStatus('failed');
    }
  };

  // Remove Analytics Integration
  const handleRemoveAnalytics = async () => {
    if (!selectedPath) return;
    
    if (!confirm('Are you sure you want to remove analytics from your repository? This will delete the PR and all analytics files.')) {
      return;
    }
    
    setRemoving(true);
    setError(null);
    
    try {
      const response = await fetch('/api/remove-analytics', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-GitHub-Token': githubToken
        },
        body: JSON.stringify({ 
          owner: selectedPath.repo.owner.login, 
          repo: selectedPath.repo.name, 
          token: githubToken 
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Analytics removed successfully! Restarting onboarding...');
        // Reset the flow
        resetFlow();
      } else {
        alert(`Failed to remove analytics: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setRemoving(false);
    }
  };

  // Filter repositories based on search
  const filteredRepos = repositories.filter(repo => {
    const query = searchQuery.toLowerCase();
    return repo.name.toLowerCase().includes(query) ||
      repo.owner.login.toLowerCase().includes(query) ||
      (repo.description && repo.description.toLowerCase().includes(query));
  });

  // Reset the flow and clear session storage
  const resetFlow = () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      sessionStorage.removeItem(key);
    });

    setCurrentStep(0);
    setSelectedPath(null);
    setGithubToken('');
    setGithubUser(null);
    setSchema(null);
    setAppKey('');
    setPrUrl('');
    setPrNumber(null);
    setRepositories([]);
    setError(null);
    setActiveTab('overview');
    setEnabledEvents({});
    setAutoMerge(false);
    setCurrentProgressStep(0);
    setSiteUrl('');
    setDeploymentStatus('idle');
    setMergeStatus('idle');
    setDirectoryTree({});
    setSelectedPath(null);
    setExpandedPaths(new Set());
    setLoadingPaths(new Set());
    setAnalysisLogs([]);
  };

  // Global analysis progress steps (synced with backend)
  const allProgressSteps = [
    { step: 1, message: 'Starting unified analytics generation', icon: '🚀' },
    { step: 2, message: 'Cloning from GitHub', icon: '📦' },
    { step: 3, message: 'Loading project files', icon: '📁' },
    { step: 4, message: 'Scanning file structure', icon: '🔍' },
    { step: 5, message: 'Detecting framework', icon: '🛠️' },
    { step: 6, message: 'Analyzing components', icon: '🧩' },
    { step: 7, message: 'Mapping user flows', icon: '🗺️' },
    { step: 8, message: 'Generating tracking schema', icon: '📊' },
    { step: 9, message: 'Creating integration files', icon: '📝' },
    { step: 10, message: 'Analysis complete!', icon: '✅' }
  ];

  // Show a loading state while hydrating from sessionStorage
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
          <p className="text-gray-600">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">Analytics Platform</h1>
            </div>
            {currentStep > 0 && (
              <button
                onClick={resetFlow}
                className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Start Over
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === index;
              const isCompleted = currentStep > index;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${isCompleted ? 'bg-green-500 border-green-500' :
                    isActive ? 'bg-indigo-600 border-indigo-600' :
                      'bg-white border-gray-300'
                    }`}>
                    {isCompleted ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${isActive ? 'text-indigo-600' :
                      isCompleted ? 'text-green-600' : 'text-gray-500'
                      }`}>
                      {step.label}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${currentStep > index ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Step 0: Connect GitHub with Site URL */}
        {currentStep === 0 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-8 py-12">
              <div className="text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-900 rounded-full mb-6">
                  <Github className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Connect Your GitHub Account
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  Enter your GitHub token and optionally your site URL for better previews.
                </p>

                {/* Site URL Input (Optional) */}
                <div className="bg-blue-50 rounded-lg p-6 mb-6 text-left">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <Globe className="w-5 h-5 mr-2 text-blue-600" />
                    Live Site URL (Optional)
                  </h3>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="url"
                      placeholder="https://your-site.com"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    If your app is deployed, provide the URL for live preview
                  </p>
                </div>

                {/* Token Input */}
                <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <Key className="w-5 h-5 mr-2 text-gray-900" />
                    GitHub Personal Access Token
                  </h3>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Required scopes: repo (full access), read:org
                  </p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 text-left">
                  <p className="text-sm text-yellow-800 font-medium mb-1">⚠️ Important: Full repo access required</p>
                  <p className="text-xs text-yellow-700">
                    The <code className="bg-yellow-100 px-1">repo</code> scope grants read AND write access.
                    This is necessary to create pull requests with your analytics integration.
                    Make sure the entire "repo" checkbox is selected, not just some sub-permissions.
                  </p>
                </div>

                {/* Connect Button */}
                <button
                  onClick={connectGitHub}
                  disabled={!githubToken || loading}
                  className={`inline-flex items-center px-8 py-4 font-medium rounded-lg transition-colors mb-8 ${githubToken && !loading
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Github className="w-5 h-5 mr-2" />
                  )}
                  {loading ? 'Connecting...' : 'Connect with GitHub'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </button>

                {/* Token Instructions */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-200 rounded-lg p-6 text-left">
                  <h4 className="font-semibold text-indigo-900 mb-4 flex items-center">
                    <Key className="w-5 h-5 mr-2" />
                    How to get your GitHub Token
                  </h4>

                  <div className="space-y-3">
                    <div className="flex items-start">
                      <div className="flex flex-col items-center mr-4">
                        <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          1
                        </div>
                        <div className="w-0.5 h-12 bg-indigo-300 mt-2"></div>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm font-medium text-gray-900">Navigate to GitHub Settings</p>
                        <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer"
                          className="text-sm text-indigo-600 hover:text-indigo-800 underline inline-flex items-center mt-1">
                          github.com/settings/tokens
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="flex flex-col items-center mr-4">
                        <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          2
                        </div>
                        <div className="w-0.5 h-12 bg-indigo-300 mt-2"></div>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm font-medium text-gray-900">Generate New Token</p>
                        <p className="text-sm text-gray-600 mt-1">Click "Generate new token (classic)"</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="flex flex-col items-center mr-4">
                        <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          3
                        </div>
                        <div className="w-0.5 h-12 bg-indigo-300 mt-2"></div>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm font-medium text-gray-900">Select Required Scopes</p>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <code className="bg-white px-2 py-1 rounded border border-gray-300 text-xs">✓ repo</code>
                            <span className="text-xs text-gray-600">(Full control - required for PR creation)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="bg-white px-2 py-1 rounded border border-gray-300 text-xs">✓ read:org</code>
                            <span className="text-xs text-gray-600">(Read organization data)</span>
                          </div>
                          <p className="text-xs text-red-600 mt-1">
                            ⚠️ Ensure ALL sub-permissions under "repo" are checked
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="flex flex-col items-center mr-4">
                        <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          4
                        </div>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm font-medium text-gray-900">Copy Your Token</p>
                        <p className="text-sm text-gray-600 mt-1">Format: <code className="bg-white px-2 py-0.5 rounded">ghp_xxxxxxxxxx</code></p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Select Repository with Subdirectory Selection */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Select Repository</h2>
              <p className="text-gray-600 mt-1">
                Choose the repository you want to add analytics to
                {githubUser && <span className="text-sm"> • Connected as @{githubUser.login}</span>}
              </p>
            </div>

            <div className="px-8 py-6">
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search repositories..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                  <p className="text-gray-600 mt-2">Loading repositories...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredRepos.map((repo) => {
                      const repoKey = `${repo.id}`;
                      const isRootExpanded = expandedPaths.has(repoKey);
                      const repoTree = directoryTree[repo.id] || [];
                      const isRepoSelected = selectedPath?.repo.id === repo.id && !selectedPath?.item.path;

                      // Recursive TreeNode Component
                      const TreeNode: React.FC<{ item: DirectoryItem; depth: number }> = ({ item, depth }) => {
                        const fullPath = `${repo.id}-${item.path}`;
                        const isExpanded = expandedPaths.has(fullPath);
                        const isSelected = selectedPath?.repo.id === repo.id && selectedPath?.item.path === item.path;
                        const canBeSelected = item.hasPackageJson || item.hasFrontendFiles;

                        return (
                          <div key={item.path}>
                            <div
                              className={`flex items-center py-2 px-3 cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-indigo-50 border-l-4 border-indigo-500'
                                  : canBeSelected
                                  ? 'hover:bg-gray-100 border-l-4 border-transparent'
                                  : 'opacity-50 border-l-4 border-transparent'
                              }`}
                              style={{ paddingLeft: `${depth * 20 + 12}px` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canBeSelected) {
                                  setSelectedPath({ repo, item });
                                }
                              }}
                            >
                              {item.type === 'dir' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePathExpansion(repo, item);
                                  }}
                                  className="p-1 -ml-1 mr-1 hover:bg-gray-200 rounded transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                  )}
                                </button>
                              )}
                              <FolderOpen className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
                              <span className={`text-sm font-medium flex-1 truncate ${isSelected ? 'text-indigo-700' : 'text-gray-900'}`}>
                                {item.name}
                              </span>
                              {item.hasPackageJson && (
                                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full flex-shrink-0">
                                  App
                                </span>
                              )}
                              {item.hasFrontendFiles && !item.hasPackageJson && (
                                <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full flex-shrink-0">
                                  Frontend
                                </span>
                              )}
                              {item.framework && (
                                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex-shrink-0">
                                  {item.framework}
                                </span>
                              )}
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0 ml-2" />
                              )}
                            </div>
                            {isExpanded && item.children && item.children.length > 0 && (
                              <div>
                                {item.children.map((child) => (
                                  <TreeNode key={child.path} item={child} depth={depth + 1} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      };

                      return (
                        <div key={repo.id} className="border rounded-lg overflow-hidden transition-all">
                          {/* Repository Row */}
                          <div
                            className={`p-4 cursor-pointer transition-all ${
                              isRepoSelected ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-gray-50'
                            }`}
                        >
                          <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-2 flex-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRepoExpansion(repo);
                                  }}
                                  className="mt-0.5 p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                                >
                                  {isRootExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                  )}
                                </button>
                                <div
                                  onClick={() => setSelectedPath({ repo, item: { name: repo.name, path: '', type: 'dir' } })}
                                  className="flex-1"
                                >
                              <div className="flex items-center space-x-2">
                                <h3 className="font-semibold text-gray-900">{repo.name}</h3>
                                {repo.private && (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                    Private
                                  </span>
                                )}
                                {repo.language && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                    {repo.language}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{repo.description}</p>
                              <p className="text-xs text-gray-500 mt-2">
                                {repo.owner.login} · Updated {new Date(repo.updated_at).toLocaleDateString()} · ⭐ {repo.stargazers_count} stars
                              </p>
                            </div>
                              </div>
                              {isRepoSelected && (
                                <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0 ml-2" />
                            )}
                          </div>
                        </div>

                          {/* Recursive Directory Tree */}
                          {isRootExpanded && (
                            <div className="border-t border-gray-200 bg-gray-50">
                              {loadingTree && repoTree.length === 0 ? (
                                <div className="p-4 text-center">
                                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
                                  <p className="text-xs text-gray-600 mt-2">Loading directories...</p>
                            </div>
                              ) : repoTree.length > 0 ? (
                                <div className="divide-y divide-gray-200">
                                  {repoTree.map((item) => (
                                    <TreeNode key={item.path} item={item} depth={0} />
                                  ))}
                              </div>
                            ) : (
                                <div className="p-4 text-center">
                                  <p className="text-xs text-gray-600">No subdirectories found</p>
                                  <p className="text-xs text-gray-500 mt-1">You can analyze the root repository</p>
                                          </div>
                              )}
                                  </div>
                                )}
                              </div>
                      );
                    })}
                  </div>

                  {/* Show selected status */}
                  {selectedPath && selectedPath.item.path && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle2 className="w-5 h-5 text-green-600 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-green-900">
                            Selected: {selectedPath.repo.name}/{selectedPath.item.name}
                          </p>
                          <p className="text-xs text-green-700 mt-1">
                            Path: {selectedPath.item.path}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => {
                    setCurrentStep(0);
                    setSelectedPath(null);
                  }}
                  className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={analyzeRepository}
                  disabled={!selectedPath}
                  className={`px-8 py-3 font-medium rounded-lg transition-all ${
                    selectedPath
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  Analyze {selectedPath?.item.path ? `${selectedPath.repo.name}/${selectedPath.item.name}` : selectedPath?.repo.name || 'Repository'}
                  <ChevronRight className="inline w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Analyzing with Real-time Progress */}
        {currentStep === 2 && isAnalyzing && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-8 py-16">
              <div className="text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-full mb-6">
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Analyzing Your Codebase
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  We're scanning {selectedPath?.item.path ? `${selectedPath.repo.name}/${selectedPath.item.name}` : selectedPath?.repo.name} to understand its structure and generate optimal tracking configuration.
                </p>

                {/* Progress Steps Display */}
                <div className="bg-gray-50 rounded-lg p-6 max-w-md mx-auto">
                  <div className="space-y-0">
                    {/* Show completed and active steps */}
                    {analysisProgress.map((progress, index) => (
                      <div key={`progress-${index}`} className="flex items-start">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${progress.message.includes('complete')
                            ? 'bg-green-100 border-2 border-green-500'
                            : index === analysisProgress.length - 1
                              ? 'bg-indigo-100 border-2 border-indigo-500 animate-pulse'
                              : 'bg-green-100 border-2 border-green-500'
                            }`}>
                            {progress.message.includes('complete') || index < analysisProgress.length - 1 ? (
                              <Check className="w-5 h-5 text-green-600" />
                            ) : (
                              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                            )}
                          </div>
                          {/* Show connecting line for all but last item OR if there are pending steps */}
                          {(index < analysisProgress.length - 1 ||
                            (!progress.message.includes('complete') && analysisProgress.length < 9)) && (
                              <div className={`w-0.5 h-8 transition-all ${index < analysisProgress.length - 1 ? 'bg-green-400' : 'bg-gray-300'
                                }`}></div>
                            )}
                        </div>
                        <div className="ml-4 flex-1 pt-2">
                          <div className="flex items-center">
                            <span className="text-lg mr-2">{progress.icon}</span>
                            <p className={`text-sm font-medium ${progress.message.includes('complete')
                              ? 'text-green-700'
                              : index === analysisProgress.length - 1
                                ? 'text-indigo-700'
                                : 'text-green-700'
                              }`}>
                              {progress.message}
                            </p>
                          </div>
                          {index === analysisProgress.length - 1 && !progress.message.includes('complete') && (
                            <p className="text-xs text-indigo-600 mt-1 ml-7">Processing...</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Show pending steps (grayed out) */}
                    {!analysisProgress.some(p => p.message.includes('complete')) && (
                      <>
                        {allProgressSteps
                          .filter(s => !analysisProgress.some(p => p.message === s.message))
                          .map((step, idx, arr) => (
                            <div key={`pending-${idx}`} className="flex items-start opacity-40">
                              <div className="flex flex-col items-center flex-shrink-0">
                                <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-gray-300 flex items-center justify-center">
                                  <span className="text-lg opacity-50">{step.icon}</span>
                                </div>
                                {idx < arr.length - 1 && (
                                    <div className="w-0.5 h-8 bg-gray-300"></div>
                                  )}
                              </div>
                              <div className="ml-4 flex-1 pt-2">
                                <div className="flex items-center">
                                  <p className="text-sm text-gray-500 ml-7">{step.message}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Raw logs for debugging (optional) */}
                {analysisLogs.length > 0 && (
                  <details className="mt-6 text-left max-w-md mx-auto">
                    <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                      View backend logs ({analysisLogs.length})
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto bg-gray-900 rounded p-3">
                      <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                        {analysisLogs.join('\n')}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Step 3: Review Schema - CONTINUE FROM HERE */}
        {currentStep === 3 && schema && (
          <div className="space-y-6">
            <div className="bg-white rounded-t-2xl shadow-xl overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Review Analytics Schema</h2>
                    <p className="text-gray-600 mt-1">
                      Customize your tracking configuration for {selectedPath?.item.path ? `${selectedPath.repo.name}/${selectedPath.item.name}` : selectedPath?.repo.name}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                    Ready to Deploy
                  </span>
                </div>

                {/* Tab Navigation */}
                <div className="flex space-x-1 mt-6">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'overview'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('events')}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'events'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Events
                  </button>
                  <button
                    onClick={() => setActiveTab('structure')}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'structure'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <GitBranch className="w-4 h-4 mr-2" />
                    Structure
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-8 py-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                        <p className="text-3xl font-bold text-blue-900">
                          {Object.keys(schema.uiGraph?.pages || {}).length || schema.routes?.length || schema.totalPages || 0}
                        </p>
                        <p className="text-sm text-blue-700 mt-1">Pages Tracked</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                        <p className="text-3xl font-bold text-purple-900">
                          {schema.totalComponents ||
                            schema.metadata?.componentCount ||
                            schema.uiGraph?.widgets?.length ||
                            0}
                        </p>
                        <p className="text-sm text-purple-700 mt-1">Components</p>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                        <p className="text-3xl font-bold text-green-900">
                          {schema.events?.length || 0}
                        </p>
                        <p className="text-sm text-green-700 mt-1">Event Types</p>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                        <p className="text-3xl font-bold text-orange-900">
                          {schema.estimatedEvents || '10K/day'}
                        </p>
                        <p className="text-sm text-orange-700 mt-1">Est. Volume</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Left Column - Configuration */}
                      <div className="space-y-4">
                        {/* Framework Detection */}
                        {schema.uiGraph?.framework && (
                          <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                              Framework:
                              <span className="ml-2 font-semibold text-gray-900 capitalize">
                                {schema.uiGraph.framework}
                              </span>
                            </p>
                            {schema.uiGraph?.ai_insights && (
                              <span className="text-xs text-gray-500">
                                {schema.uiGraph.ai_insights.interaction_types?.length || 0} types
                              </span>
                            )}
                          </div>
                        )}

                        {/* App Key Display with Working Copy Button */}
                        {(schema.appKey || appKey) && (
                          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-indigo-900">Application Key</p>
                                <p className="font-mono text-lg text-indigo-700 mt-1">{schema.appKey || appKey}</p>
                              </div>
                              <button
                                onClick={() => copyToClipboard(schema.appKey || appKey, 'appKey')}
                                className="p-2 hover:bg-indigo-100 rounded-lg transition-colors"
                                title="Copy to clipboard"
                              >
                                {copiedField === 'appKey' ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                                ) : (
                                  <ClipboardCopy className="w-5 h-5 text-indigo-600" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Auto-merge option */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <input
                              type="checkbox"
                              id="autoMerge"
                              checked={autoMerge}
                              onChange={(e) => setAutoMerge(e.target.checked)}
                              className="mt-1 rounded text-indigo-600"
                            />
                            <div className="ml-3">
                              <label htmlFor="autoMerge" className="text-sm font-medium text-gray-900">
                                Auto-merge when PR passes checks
                              </label>
                              <p className="text-xs text-gray-600 mt-1">
                                Requires admin permissions
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Site Preview */}
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-700">
                              {schema.siteUrl || siteUrl ? 'Live Site Preview' : 'Site Preview'}
                            </h4>
                            <div className="flex items-center bg-white rounded p-0.5 border border-gray-300">
                              <button
                                onClick={() => setPreviewDevice('mobile')}
                                className={`p-1 rounded transition-colors ${previewDevice === 'mobile' ? 'bg-indigo-100' : 'hover:bg-gray-50'
                                  }`}
                                title="Mobile"
                              >
                                <Smartphone className="w-3.5 h-3.5 text-gray-600" />
                              </button>
                              <button
                                onClick={() => setPreviewDevice('desktop')}
                                className={`p-1 rounded transition-colors ${previewDevice === 'desktop' ? 'bg-indigo-100' : 'hover:bg-gray-50'
                                  }`}
                                title="Desktop"
                              >
                                <Monitor className="w-3.5 h-3.5 text-gray-600" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="h-[400px]">
                          <SitePreviewSandbox
                            selectedRepo={selectedPath?.repo}
                            previewDevice={previewDevice}
                            schema={schema}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={createPR}
                        className="px-8 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <GitPullRequest className="inline w-5 h-5 mr-2" />
                        Create Pull Request
                      </button>
                    </div>
                  </div>
                )}

                {/* Events Tab */}
                {activeTab === 'events' && (
                  <div className="space-y-6">
                    {/* Base Event Schema Display with Working Copy */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Code2 className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">Base Event Structure</h4>
                            <button
                              onClick={() => copyToClipboard(`{
  "id": "uuid",
  "ts": 1234567890,
  "app_key": "app_123",
  "session_id": "sess_x",
  "user_id": "87654321",
  "event_type": "EVENT",
  "data": { ... }
}`, 'eventSchema')}
                              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                              title="Copy schema"
                            >
                              {copiedField === 'eventSchema' ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              ) : (
                                <ClipboardCopy className="w-4 h-4 text-gray-600" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 mb-3">All events include these common fields:</p>
                          <div className="bg-white rounded-lg p-3 font-mono text-xs border border-gray-200">
                            <pre className="text-gray-700">
                              {`{
  "id": "uuid",           // Unique event identifier
  "ts": 1234567890,       // Unix timestamp
  "app_key": "app_123",   // Your application key
  "session_id": "sess_x", // Session identifier
  "user_id": "87654321",  // Persistent user ID
  "event_type": "EVENT",  // Event name (uppercase)
  "data": { ... }         // Event-specific fields
}`}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Events List */}
                    <div>
                      <p className="text-sm text-gray-600 mb-4">
                        Configure which events to track. Each event extends the base structure with custom data fields.
                      </p>
                      {schema.events?.map((event: any, idx: number) => (
                        <EventDetailsCollapsible
                          key={idx}
                          event={typeof event === 'string' ? { event_type: event, data_fields: [] } : event}
                          enabled={enabledEvents[typeof event === 'string' ? event : event.event_type] !== false}
                          onToggle={handleEventToggle}
                        />
                      ))}
                    </div>

                    <div className="flex justify-between mt-6">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={createPR}
                        className="px-8 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <GitPullRequest className="inline w-5 h-5 mr-2" />
                        Create Pull Request
                      </button>
                    </div>
                  </div>
                )}

                {/* Structure Tab */}
                {activeTab === 'structure' && (
                  <div className="space-y-6">
                    <UIGraphVisualization uiGraph={schema.uiGraph} />

                    <div className="flex justify-between">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={createPR}
                        className="px-8 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <GitPullRequest className="inline w-5 h-5 mr-2" />
                        Create Pull Request
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Creating PR */}
        {currentStep === 4 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-8 py-16">
              <div className="text-center max-w-2xl mx-auto">
                {deploymentStatus === 'creating' ? (
                  <>
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-full mb-6">
                      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      Creating Pull Request
                    </h2>
                    <p className="text-lg text-gray-600 mb-8">
                      Setting up your analytics integration...
                    </p>
                    <button
                      onClick={() => {
                        setCurrentStep(3);
                        setDeploymentStatus('idle');
                      }}
                      className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : deploymentStatus === 'success' ? (
                  <>
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                      <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      Pull Request Created!
                    </h2>
                    <p className="text-lg text-gray-600 mb-8">
                      Your analytics integration PR is ready for review
                    </p>

                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <p className="text-sm text-gray-600">Pull Request</p>
                          <p className="font-semibold text-gray-900">
                            #{prNumber || 'New'} - Add Analytics Integration
                          </p>
                        </div>
                        {prUrl && (
                          <a
                            href={prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View on GitHub
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={() => {
                          setCurrentStep(3);
                          setDeploymentStatus('idle');
                        }}
                        className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                      >
                        Back to Review
                      </button>
                      <button
                        onClick={() => setCurrentStep(5)}
                        className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Continue to Merge
                        <ArrowRight className="inline w-5 h-5 ml-2" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                      <XCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      Deployment Failed
                    </h2>
                    <p className="text-lg text-gray-600 mb-8">
                      {error || 'Something went wrong during deployment'}
                    </p>
                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={() => {
                          setCurrentStep(3);
                          setDeploymentStatus('idle');
                          setError(null);
                        }}
                        className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                      >
                        Back to Review
                      </button>
                      <button
                        onClick={createPR}
                        className="px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Merge PR */}
        {currentStep === 5 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-8 py-16">
              <div className="text-center max-w-2xl mx-auto">
                {mergeStatus === 'idle' && (
                  <>
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-full mb-6">
                      <GitMerge className="w-10 h-10 text-amber-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      Ready to Merge
                    </h2>
                    <p className="text-lg text-gray-600 mb-6">
                      Merge your pull request to activate analytics tracking
                    </p>

                    {/* PR Status Card */}
                    <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left max-w-md mx-auto">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-green-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">Pull Request #{prNumber || 'New'}</h4>
                          <p className="text-sm text-gray-600 mt-1">Add Analytics Integration</p>
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center text-sm">
                              <CheckCircle2 className="w-4 h-4 text-green-600 mr-2" />
                              <span className="text-gray-700">Files created</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <CheckCircle2 className="w-4 h-4 text-green-600 mr-2" />
                              <span className="text-gray-700">Ready to merge</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Warning about auto-merge */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 text-left max-w-md mx-auto">
                      <div className="flex">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                        <div className="ml-3">
                          <p className="text-sm text-yellow-800">
                            <strong>Note:</strong> Merging will immediately activate tracking on your main branch.
                            Make sure you're ready to start collecting analytics data.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Remove Analytics Option */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-left max-w-md mx-auto">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-red-800">Changed your mind?</h4>
                          <p className="text-xs text-red-600 mt-1">
                            Remove the PR and analytics files from your repository
                          </p>
                        </div>
                        <button
                          onClick={handleRemoveAnalytics}
                          disabled={removing}
                          className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap ml-3"
                        >
                          {removing ? 'Removing...' : 'Remove Analytics'}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={() => setCurrentStep(4)}
                        className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                      >
                        Back
                      </button>
                      {prUrl && (
                        <a
                          href={prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-6 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <ExternalLink className="w-5 h-5 mr-2" />
                          Review on GitHub
                        </a>
                      )}
                      <button
                        onClick={mergePR}
                        className="px-8 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <GitMerge className="w-5 h-5 mr-2 inline" />
                        Merge Pull Request
                      </button>
                    </div>
                  </>
                )}

                {mergeStatus === 'merging' && (
                  <>
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-full mb-6">
                      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      Merging Pull Request
                    </h2>
                    <p className="text-lg text-gray-600">
                      Activating your analytics integration...
                    </p>
                  </>
                )}

                {mergeStatus === 'success' && (
                  <>
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                      <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      Successfully Merged!
                    </h2>
                    <p className="text-lg text-gray-600">
                      Analytics are now active on your main branch
                    </p>
                  </>
                )}

                {mergeStatus === 'failed' && (
                  <>
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                      <XCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      Merge Failed
                    </h2>
                    <p className="text-lg text-gray-600 mb-4">
                      {error || 'Could not merge the pull request'}
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                      <p className="text-sm text-blue-800">
                        You can manually merge the PR on GitHub, or check if there are any merge conflicts that need to be resolved.
                      </p>
                    </div>
                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={() => {
                          setMergeStatus('idle');
                          setError(null);
                        }}
                        className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                      >
                        Try Again
                      </button>
                      {prUrl && (
                        <a
                          href={prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          <Github className="w-5 h-5 mr-2" />
                          Merge on GitHub
                          <ExternalLink className="w-4 h-4 ml-2" />
                        </a>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Complete */}
        {currentStep === 6 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-8 py-16">
              <div className="text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full mb-6">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Analytics Now Active! 🎉
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  Your analytics integration is live and collecting data from your main branch
                </p>

                {/* Success Summary */}
                <div className="bg-green-50 rounded-lg p-6 mb-8 text-left max-w-md mx-auto">
                  <h3 className="font-semibold text-green-900 mb-3">Integration Complete</h3>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                      <span className="text-gray-700">Analytics files added to main branch</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                      <span className="text-gray-700">Tracking script active at /tracker.js</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                      <span className="text-gray-700">Events flowing to dashboard</span>
                    </div>
                  </div>
                </div>

                {/* App Key Display */}
                {(schema?.appKey || appKey) && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-8 max-w-md mx-auto">
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-sm font-medium text-indigo-900">Your App Key</p>
                        <p className="font-mono text-lg text-indigo-700 mt-1">{schema?.appKey || appKey}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(schema?.appKey || appKey, 'finalAppKey')}
                        className="p-2 hover:bg-indigo-100 rounded-lg transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedField === 'finalAppKey' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <ClipboardCopy className="w-5 h-5 text-indigo-600" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Remove Analytics Option */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 max-w-md mx-auto">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-red-800">Need to remove analytics?</h4>
                      <p className="text-xs text-red-600 mt-1">
                        Remove all analytics files from your repository
                      </p>
                    </div>
                    <button
                      onClick={handleRemoveAnalytics}
                      disabled={removing}
                      className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap ml-3"
                    >
                      {removing ? 'Removing...' : 'Remove Analytics'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => window.location.href = `/dashboard?app=${schema?.appKey || appKey}`}
                    className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <BarChart3 className="w-5 h-5 mr-2 inline" />
                    View Analytics Dashboard
                    <ArrowRight className="inline w-5 h-5 ml-2" />
                  </button>
                </div>

                {/* Next Steps */}
                <div className="mt-12 pt-8 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">What's Next?</h3>
                  <div className="grid grid-cols-3 gap-4 text-left">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <Activity className="w-5 h-5 text-indigo-600 mb-2" />
                      <p className="text-sm font-medium text-gray-900">Monitor Events</p>
                      <p className="text-xs text-gray-600 mt-1">Watch real-time data flow in your dashboard</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <Settings className="w-5 h-5 text-indigo-600 mb-2" />
                      <p className="text-sm font-medium text-gray-900">Configure Alerts</p>
                      <p className="text-xs text-gray-600 mt-1">Set up notifications for key metrics</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <BookOpen className="w-5 h-5 text-indigo-600 mb-2" />
                      <p className="text-sm font-medium text-gray-900">View Docs</p>
                      <p className="text-xs text-gray-600 mt-1">Learn about advanced tracking features</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingFlow;