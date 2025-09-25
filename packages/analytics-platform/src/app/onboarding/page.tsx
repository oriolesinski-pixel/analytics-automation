///Users/oriolesinski/analytics-automation/packages/analytics-platform/src/app/onboarding/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Github, Check, Loader2, Code2, GitBranch, BarChart3, ArrowRight, Shield, Zap, Eye, Copy, CheckCircle2, XCircle, AlertCircle, ExternalLink, Terminal, FileCode2, GitPullRequest, Activity, Plus, Key, Settings, ChevronDown, ChevronUp, Lock, Globe, Smartphone, Tablet, Monitor, BookOpen, RefreshCw, ToggleLeft, ToggleRight, Circle, Square, Layers, Home, ShoppingCart, User, Package, CreditCard, Heart, ClipboardCopy, FileSearch, Link } from 'lucide-react';
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
  siteUrl?: string; // Add siteUrl to schema
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
  REPOSITORIES: 'onboarding_repositories',
  AUTO_MERGE: 'onboarding_auto_merge',
  ENABLED_EVENTS: 'onboarding_enabled_events',
  SITE_URL: 'onboarding_site_url' // Add site URL storage key
};

function OnboardingFlow() {
  // Initialize state
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [githubToken, setGithubToken] = useState('');
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [appKey, setAppKey] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [autoMerge, setAutoMerge] = useState(false);
  const [enabledEvents, setEnabledEvents] = useState<Record<string, boolean>>({});
  const [siteUrl, setSiteUrl] = useState(''); // Add siteUrl state

  // Add a flag to track if we've hydrated from storage
  const [isHydrated, setIsHydrated] = useState(false);

  // Non-persisted state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [currentProgressStep, setCurrentProgressStep] = useState(0);

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
    // Helper function to safely load from sessionStorage
    const loadFromSession = (key: string, defaultValue: any) => {
      try {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch {
        return defaultValue;
      }
    };

    // Load all persisted values
    setCurrentStep(loadFromSession(STORAGE_KEYS.CURRENT_STEP, 0));
    setSelectedRepo(loadFromSession(STORAGE_KEYS.SELECTED_REPO, null));
    setGithubToken(loadFromSession(STORAGE_KEYS.GITHUB_TOKEN, ''));
    setGithubUser(loadFromSession(STORAGE_KEYS.GITHUB_USER, null));
    setSchema(loadFromSession(STORAGE_KEYS.SCHEMA, null));
    setAppKey(loadFromSession(STORAGE_KEYS.APP_KEY, ''));
    setPrUrl(loadFromSession(STORAGE_KEYS.PR_URL, ''));
    setRepositories(loadFromSession(STORAGE_KEYS.REPOSITORIES, []));
    setAutoMerge(loadFromSession(STORAGE_KEYS.AUTO_MERGE, false));
    setEnabledEvents(loadFromSession(STORAGE_KEYS.ENABLED_EVENTS, {}));
    setSiteUrl(loadFromSession(STORAGE_KEYS.SITE_URL, ''));

    // Mark as hydrated
    setIsHydrated(true);
  }, []); // Run only once on mount

  // Persist state to sessionStorage (only after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.CURRENT_STEP, JSON.stringify(currentStep));
  }, [currentStep, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem(STORAGE_KEYS.SELECTED_REPO, JSON.stringify(selectedRepo));
  }, [selectedRepo, isHydrated]);

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

  const steps = [
    { id: 'connect', label: 'Connect GitHub', icon: Github },
    { id: 'select', label: 'Select Repository', icon: Code2 },
    { id: 'analyze', label: 'Analyze Code', icon: Terminal },
    { id: 'review', label: 'Review Schema', icon: Eye },
    { id: 'deploy', label: 'Create PR', icon: GitPullRequest },
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

  // Connect to GitHub with personal access token - REAL API
  const connectGitHub = async () => {
    if (!githubToken) {
      setError('Please enter your GitHub token');
      return;
    }

    // Validate site URL if provided
    if (siteUrl && !isValidUrl(siteUrl)) {
      setError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call our backend API to validate token
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

      // Store user info and proceed
      setGithubUser(data.user);

      // Immediately fetch repositories after successful auth
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
        credentials: 'same-origin' // Include cookies
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

  // Analyze repository with proper progress tracking
  const analyzeRepository = async () => {
    if (!selectedRepo) return;

    setIsAnalyzing(true);
    setError(null);
    setCurrentStep(2);
    setAnalysisProgress([]);
    setCurrentProgressStep(0);

    // Progress messages with timing
    const progressSteps = [
      { message: 'Cloning repository', icon: '📦', delay: 500 },
      { message: 'Scanning file structure', icon: '🔍', delay: 2000 },
      { message: 'Detecting framework', icon: '🛠️', delay: 3500 },
      { message: 'Analyzing components', icon: '🧩', delay: 5000 },
      { message: 'Mapping user flows', icon: '🗺️', delay: 6500 },
      { message: 'Generating tracking schema', icon: '📊', delay: 8000 },
      { message: 'Creating integration files', icon: '📝', delay: 9500 }
    ];

    // Start showing progress messages
    const progressTimers: NodeJS.Timeout[] = [];
    let isStillAnalyzing = true;

    progressSteps.forEach((step, index) => {
      const timer = setTimeout(() => {
        if (isStillAnalyzing) {
          setCurrentProgressStep(index);
          setAnalysisProgress(prev => [...prev, { message: step.message, icon: step.icon }]);
        }
      }, step.delay);
      progressTimers.push(timer);
    });

    try {
      // Add a minimum delay to ensure progress is visible
      const [response] = await Promise.all([
        fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            repoId: selectedRepo.id,
            repoName: selectedRepo.name,
            repoOwner: selectedRepo.owner.login,
            defaultBranch: selectedRepo.default_branch,
            siteUrl: siteUrl // Include site URL in analysis request
          })
        }),
        // Minimum 10 second delay to show all progress steps
        new Promise(resolve => setTimeout(resolve, 10000))
      ]);

      // Clear all timers
      isStillAnalyzing = false;
      progressTimers.forEach(timer => clearTimeout(timer));
      setAnalysisProgress([]);
      setCurrentProgressStep(0);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();

      // Store the real analysis results with site URL
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
        siteUrl: siteUrl || data.siteUrl // Store site URL in schema
      });

      setAppKey(data.appKey || '');
      setCurrentStep(3);

    } catch (err) {
      isStillAnalyzing = false;
      progressTimers.forEach(timer => clearTimeout(timer));
      setError((err as Error).message || 'Analysis failed');
      setCurrentStep(1);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Create Pull Request - REAL API
  const createPR = async () => {
    if (!schema || !selectedRepo) return;

    setDeploymentStatus('creating');
    setCurrentStep(4);
    setError(null);

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          repoOwner: selectedRepo.owner.login,
          repoName: selectedRepo.name,
          trackerCode: schema.trackerCode,
          providerCode: schema.providerCode,
          appKey: schema.appKey || appKey,
          autoMerge: autoMerge
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Deployment failed');
      }

      const data = await response.json();
      setPrUrl(data.prUrl);
      setDeploymentStatus('success');

      // Move to completion after a short delay
      setTimeout(() => setCurrentStep(5), 2000);

    } catch (err) {
      setError((err as Error).message || 'Deployment failed');
      setDeploymentStatus('failed');
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
    // Clear all session storage
    Object.values(STORAGE_KEYS).forEach(key => {
      sessionStorage.removeItem(key);
    });

    // Reset state
    setCurrentStep(0);
    setSelectedRepo(null);
    setGithubToken('');
    setGithubUser(null);
    setSchema(null);
    setAppKey('');
    setPrUrl('');
    setRepositories([]);
    setError(null);
    setActiveTab('overview');
    setEnabledEvents({});
    setAutoMerge(false);
    setCurrentProgressStep(0);
    setSiteUrl('');
  };

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
                    Required scopes: repo, read:org
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
                        <div className="flex gap-2 mt-2">
                          <code className="bg-white px-2 py-1 rounded border border-gray-300 text-xs">✓ repo</code>
                          <code className="bg-white px-2 py-1 rounded border border-gray-300 text-xs">✓ read:org</code>
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

        {/* Rest of the steps remain the same */}
        {/* Step 1: Select Repository */}
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
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredRepos.map((repo) => (
                    <div
                      key={repo.id}
                      onClick={() => setSelectedRepo(repo)}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${selectedRepo?.id === repo.id
                        ? 'border-gray-900 bg-gray-50 ring-2 ring-gray-900'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
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
                        {selectedRepo?.id === repo.id && (
                          <CheckCircle2 className="w-5 h-5 text-gray-900 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setCurrentStep(0)}
                  className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={analyzeRepository}
                  disabled={!selectedRepo}
                  className={`px-8 py-3 font-medium rounded-lg transition-all ${selectedRepo
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  Analyze {selectedRepo?.name || 'Repository'}
                  <ChevronRight className="inline w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Analyzing */}
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
                  We're scanning {selectedRepo?.name} to understand its structure and generate optimal tracking configuration.
                </p>

                {/* Progress Messages */}
                <div className="bg-gray-50 rounded-lg p-6 max-w-md mx-auto">
                  <div className="space-y-0">
                    {[
                      { message: 'Cloning repository', icon: '📦', done: analysisProgress.length > 0 },
                      { message: 'Scanning file structure', icon: '🔍', done: analysisProgress.length > 1 },
                      { message: 'Detecting framework', icon: '🛠️', done: analysisProgress.length > 2 },
                      { message: 'Analyzing components', icon: '🧩', done: analysisProgress.length > 3 },
                      { message: 'Mapping user flows', icon: '🗺️', done: analysisProgress.length > 4 },
                      { message: 'Generating tracking schema', icon: '📊', done: analysisProgress.length > 5 },
                      { message: 'Creating integration files', icon: '📝', done: analysisProgress.length > 6 }
                    ].map((step, index) => (
                      <div key={index} className="flex items-start">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${step.done
                            ? 'bg-green-100 border-2 border-green-500'
                            : index === currentProgressStep
                              ? 'bg-indigo-100 border-2 border-indigo-500 animate-pulse'
                              : 'bg-gray-200 border-2 border-gray-300'
                            }`}>
                            {step.done ? (
                              <Check className="w-5 h-5 text-green-600" />
                            ) : index === currentProgressStep ? (
                              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                            ) : (
                              <span className="text-lg">{step.icon}</span>
                            )}
                          </div>
                          {index < 6 && (
                            <div className={`w-0.5 h-8 transition-all ${step.done ? 'bg-green-400' : 'bg-gray-300'
                              }`}></div>
                          )}
                        </div>
                        <div className="ml-4 flex-1 pt-2">
                          <p className={`text-sm font-medium transition-all ${step.done
                            ? 'text-green-700'
                            : index === currentProgressStep
                              ? 'text-indigo-700'
                              : 'text-gray-500'
                            }`}>
                            {step.message}
                          </p>
                          {index === currentProgressStep && (
                            <p className="text-xs text-indigo-600 mt-1">Processing...</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review Schema - Updated with Site Preview */}
        {currentStep === 3 && schema && (
          <div className="space-y-6">
            <div className="bg-white rounded-t-2xl shadow-xl overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Review Analytics Schema</h2>
                    <p className="text-gray-600 mt-1">
                      Customize your tracking configuration for {selectedRepo?.name}
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
                            selectedRepo={selectedRepo}
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

                {/* Events Tab and Structure Tab remain the same */}
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

        {/* Steps 4-5 remain the same */}
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
                    <p className="text-lg text-gray-600">
                      Setting up your analytics integration...
                    </p>
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
                      Your analytics integration is ready
                    </p>
                    {prUrl && (
                      <a
                        href={prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <Github className="w-5 h-5 mr-2" />
                        View on GitHub
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </a>
                    )}
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
                    <button
                      onClick={() => setCurrentStep(3)}
                      className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
                    >
                      Try Again
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {currentStep === 5 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-8 py-16">
              <div className="text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full mb-6">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Setup Complete!
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  {autoMerge ? 'Analytics are now active on your repository!' : 'Once you merge the PR, analytics will start flowing automatically'}
                </p>

                <div className="flex justify-center space-x-4">
                  {prUrl && (
                    <a
                      href={prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-8 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <Github className="w-5 h-5 mr-2 inline" />
                      View Pull Request
                    </a>
                  )}
                  <button
                    onClick={() => window.location.href = `/dashboard?app=${appKey}`}
                    className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Go to Dashboard
                    <ArrowRight className="inline w-5 h-5 ml-2" />
                  </button>
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