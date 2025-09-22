'use client';
import React, { useState, useEffect } from 'react';
import { ChevronRight, Github, Check, Loader2, Code2, GitBranch, BarChart3, ArrowRight, Shield, Zap, Eye, Copy, CheckCircle2, XCircle, AlertCircle, ExternalLink, Terminal, FileCode2, GitPullRequest, Activity, Plus, Key, Settings, ChevronDown, ChevronUp, Lock, Globe, Smartphone, Tablet, Monitor } from 'lucide-react';

// Mock data for demonstration
const mockRepos = [
  { id: 1, name: 'test-app-rich-demo', full_name: 'oriolesinski-pixel/test-app-rich-demo', description: 'E-commerce demo with analytics', language: 'TypeScript', private: false, stars: 12, updated_at: '2024-03-20', owner: { login: 'oriolesinski-pixel' } },
  { id: 2, name: 'analytics-dashboard', full_name: 'oriolesinski-pixel/analytics-dashboard', description: 'Analytics visualization dashboard', language: 'JavaScript', private: false, stars: 45, updated_at: '2024-03-19', owner: { login: 'oriolesinski-pixel' } },
  { id: 3, name: 'customer-portal', full_name: 'company/customer-portal', description: 'Customer self-service portal', language: 'TypeScript', private: true, stars: 67, updated_at: '2024-03-18', owner: { login: 'company' } },
];

const mockSchema = {
  events: [
    {
      name: 'PAGE_VIEW',
      description: 'Tracks page navigation',
      fields: [
        { name: 'url', type: 'string', description: 'Full page URL' },
        { name: 'path', type: 'string', description: 'URL path without domain' },
        { name: 'title', type: 'string', description: 'Page title' },
        { name: 'referrer', type: 'string', description: 'Previous page URL' },
        { name: 'is_first_view', type: 'boolean', description: 'First visit to this page' },
        { name: 'entry_type', type: '"direct" | "internal" | "external"', description: 'How user entered page' }
      ]
    },
    {
      name: 'BUTTON_CLICK',
      description: 'Interactive element clicks',
      fields: [
        { name: 'element_text', type: 'string', description: 'Button text content' },
        { name: 'element_id', type: 'string | null', description: 'Element DOM ID' },
        { name: 'element_type', type: '"button" | "link" | "icon" | "tab"', description: 'Type of element' },
        { name: 'surface', type: 'string', description: 'UI surface/component name' },
        { name: 'page_path', type: 'string', description: 'Current page path' },
        { name: 'is_primary_cta', type: 'boolean', description: 'Primary call-to-action' },
        { name: 'cta_category', type: 'string', description: 'CTA category (navigation, action, etc)' }
      ]
    },
    {
      name: 'FORM_INTERACTION',
      description: 'Form submission tracking',
      fields: [
        { name: 'action', type: '"started" | "submitted" | "abandoned"', description: 'Form interaction type' },
        { name: 'form_name', type: 'string', description: 'Form identifier' },
        { name: 'form_id', type: 'string | null', description: 'Form DOM ID' },
        { name: 'form_type', type: 'string', description: 'Type of form (login, checkout, etc)' },
        { name: 'surface', type: 'string', description: 'UI component containing form' },
        { name: 'page_path', type: 'string', description: 'Current page path' },
        { name: 'fields_total', type: 'number', description: 'Total number of fields' },
        { name: 'fields_completed', type: 'number', description: 'Number of filled fields' }
      ]
    },
    {
      name: 'ELEMENT_VISIBILITY',
      description: 'UI element visibility tracking',
      fields: [
        { name: 'action', type: '"shown" | "hidden" | "dismissed"', description: 'Visibility action' },
        { name: 'element_type', type: '"modal" | "popup" | "drawer" | "tooltip" | "dropdown" | "toast"', description: 'Type of element' },
        { name: 'element_name', type: 'string', description: 'Element identifier' },
        { name: 'element_id', type: 'string | null', description: 'Element DOM ID' },
        { name: 'trigger_source', type: 'string', description: 'What triggered the visibility' },
        { name: 'page_path', type: 'string', description: 'Current page path' },
        { name: 'has_cta', type: 'boolean', description: 'Contains call-to-action' }
      ]
    },
    {
      name: 'SCROLL_INTERACTION',
      description: 'User scroll behavior',
      fields: [
        { name: 'action', type: '"depth_reached"', description: 'Scroll action type' },
        { name: 'depth_percentage', type: 'number', description: 'Scroll depth (0-100)' },
        { name: 'milestone', type: '"25%" | "50%" | "75%" | "90%" | "100%" | "none"', description: 'Milestone reached' },
        { name: 'page_path', type: 'string', description: 'Current page path' },
        { name: 'direction', type: '"up" | "down"', description: 'Scroll direction' }
      ]
    }
  ],
  baseFields: [
    { name: 'id', type: 'string', description: 'Unique event ID (auto-generated)' },
    { name: 'ts', type: 'number', description: 'Timestamp (auto-generated)' },
    { name: 'app_key', type: 'string', description: 'Application identifier' },
    { name: 'session_id', type: 'string', description: 'User session ID' },
    { name: 'user_id', type: 'string', description: 'Persistent user ID' },
    { name: 'event_type', type: 'string', description: 'Event type name' }
  ],
  pages: 13,
  components: 11,
  estimatedEvents: '~10K/day'
};

function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [schema, setSchema] = useState(null);
  const [prCreated, setPrCreated] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState('idle');
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [credentials, setCredentials] = useState({ token: '', clientId: '', clientSecret: '' });
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [previewDevice, setPreviewDevice] = useState('desktop');

  const steps = [
    { id: 'connect', label: 'Connect GitHub', icon: Github },
    { id: 'select', label: 'Select Repository', icon: Code2 },
    { id: 'analyze', label: 'Analyze Code', icon: Terminal },
    { id: 'review', label: 'Review Schema', icon: Eye },
    { id: 'deploy', label: 'Create PR', icon: GitPullRequest },
    { id: 'complete', label: 'Start Tracking', icon: Activity }
  ];

  // Simulate analysis
  const analyzeRepository = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setSchema(mockSchema);
      setIsAnalyzing(false);
      setCurrentStep(3);
    }, 3000);
  };

  // Simulate PR creation
  const createPR = () => {
    setDeploymentStatus('creating');
    setTimeout(() => {
      setPrCreated(true);
      setDeploymentStatus('success');
      setCurrentStep(5);
    }, 2000);
  };

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
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Enterprise Edition</span>
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-medium">
                JD
              </div>
            </div>
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
                    <p className={`text-sm font-medium ${isActive ? 'text-indigo-600' : isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Step 0: Connect GitHub with Credentials */}
        {currentStep === 0 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-8 py-12">
              <div className="text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-full mb-6">
                  <Github className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Connect Your GitHub Account
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  Enter your GitHub credentials to securely connect your repositories. We'll analyze your codebase and generate a tailored analytics solution.
                </p>

                {/* Credentials Form */}
                <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <Key className="w-5 h-5 mr-2 text-indigo-600" />
                    GitHub OAuth Credentials
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Personal Access Token
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="password"
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          value={credentials.token}
                          onChange={(e) => setCredentials({ ...credentials, token: e.target.value })}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Required scopes: repo, read:org
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Client ID (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="Iv1.8a61f3b4..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          value={credentials.clientId}
                          onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Client Secret (Optional)
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••••••"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          value={credentials.clientSecret}
                          onChange={(e) => setCredentials({ ...credentials, clientSecret: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <Shield className="w-8 h-8 text-green-600 mb-2 mx-auto" />
                    <p className="text-sm font-medium text-gray-900">Secure OAuth</p>
                    <p className="text-xs text-gray-600 mt-1">Industry-standard authentication</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <Zap className="w-8 h-8 text-yellow-600 mb-2 mx-auto" />
                    <p className="text-sm font-medium text-gray-900">2-Minute Setup</p>
                    <p className="text-xs text-gray-600 mt-1">From connection to insights</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <FileCode2 className="w-8 h-8 text-indigo-600 mb-2 mx-auto" />
                    <p className="text-sm font-medium text-gray-900">Minimal Changes</p>
                    <p className="text-xs text-gray-600 mt-1">Only 2 files modified</p>
                  </div>
                </div>

                <button
                  onClick={() => setCurrentStep(1)}
                  disabled={!credentials.token}
                  className={`inline-flex items-center px-8 py-4 font-medium rounded-lg transition-colors ${credentials.token
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  <Github className="w-5 h-5 mr-2" />
                  Connect with GitHub
                  <ArrowRight className="w-5 h-5 ml-2" />
                </button>

                <p className="text-xs text-gray-500 mt-4">
                  By connecting, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Select Repository with Add New */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Select Repository</h2>
                  <p className="text-gray-600 mt-1">Choose the repository you want to add analytics to</p>
                </div>
                <button
                  onClick={() => setShowAddRepo(true)}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Repository
                </button>
              </div>
            </div>

            <div className="px-8 py-6">
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search repositories..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-3">
                {mockRepos.map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => setSelectedRepo(repo)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${selectedRepo?.id === repo.id
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500'
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
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {repo.language}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{repo.description}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {repo.owner.login} · Updated {repo.updated_at} · ⭐ {repo.stars} stars
                        </p>
                      </div>
                      {selectedRepo?.id === repo.id && (
                        <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Repository Modal */}
              {showAddRepo && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-xl p-6 max-w-md w-full">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Repository</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Repository URL
                        </label>
                        <input
                          type="text"
                          placeholder="https://github.com/username/repo"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Access Token (if private)
                        </label>
                        <input
                          type="password"
                          placeholder="ghp_xxxxxxxxxxxx"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Branch
                        </label>
                        <input
                          type="text"
                          placeholder="main"
                          defaultValue="main"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => setShowAddRepo(false)}
                        className="px-4 py-2 text-gray-700 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setShowAddRepo(false)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        Add Repository
                      </button>
                    </div>
                  </div>
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
                  onClick={() => {
                    setCurrentStep(2);
                    setTimeout(analyzeRepository, 500);
                  }}
                  disabled={!selectedRepo}
                  className={`px-8 py-3 font-medium rounded-lg transition-all ${selectedRepo
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  Continue with {selectedRepo?.name || 'selected repository'}
                  <ChevronRight className="inline w-5 h-5 ml-2" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Analyzing */}
        {currentStep === 2 && (
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
                  We're scanning your repository to understand its structure and generate optimal tracking configuration.
                </p>

                <div className="space-y-4 text-left bg-gray-50 rounded-lg p-6">
                  <AnalysisStep completed step="Cloning repository" />
                  <AnalysisStep completed={!isAnalyzing} active={isAnalyzing} step="Detecting framework (Next.js 14)" />
                  <AnalysisStep active={false} step="Mapping routes & components" />
                  <AnalysisStep active={false} step="Identifying user interactions" />
                  <AnalysisStep active={false} step="Generating tracking schema" />
                </div>

                <div className="mt-8 flex items-center justify-center text-sm text-gray-600">
                  <Activity className="w-4 h-4 mr-2 animate-pulse" />
                  Processing {selectedRepo?.name}...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review Schema with Preview and Site Map */}
        {currentStep === 3 && schema && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Review Analytics Schema</h2>
                  <p className="text-gray-600 mt-1">Customize the events and tracking configuration</p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                  Ready to Deploy
                </span>
              </div>
            </div>

            <div className="px-8 py-6">
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column - Configuration */}
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                      <p className="text-3xl font-bold text-blue-900">{schema.pages}</p>
                      <p className="text-sm text-blue-700 mt-1">Pages Tracked</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                      <p className="text-3xl font-bold text-purple-900">{schema.components}</p>
                      <p className="text-sm text-purple-700 mt-1">Components</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                      <p className="text-3xl font-bold text-green-900">{schema.events.length}</p>
                      <p className="text-sm text-green-700 mt-1">Event Types</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                      <p className="text-3xl font-bold text-orange-900">{schema.estimatedEvents}</p>
                      <p className="text-sm text-orange-700 mt-1">Est. Volume</p>
                    </div>
                  </div>

                  {/* Collapsible Events Section */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <button
                      onClick={() => setEventsExpanded(!eventsExpanded)}
                      className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 mb-4"
                    >
                      <span>Detected Event Schema</span>
                      {eventsExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                    </button>

                    {eventsExpanded ? (
                      <div className="space-y-4">
                        {/* Base fields that all events share */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-3 text-sm">Base Fields (all events)</h4>
                          <div className="space-y-2">
                            {schema.baseFields.map((field) => (
                              <div key={field.name} className="flex items-start justify-between text-xs">
                                <div className="flex items-center space-x-2">
                                  <code className="bg-gray-100 px-2 py-0.5 rounded text-indigo-600 font-mono">
                                    {field.name}
                                  </code>
                                  <span className="text-gray-500">{field.type}</span>
                                </div>
                                <span className="text-gray-400 text-xs">{field.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Individual event types */}
                        {schema.events.map((event) => (
                          <EventTypeCollapsible key={event.name} event={event} />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                          {schema.events.length} event types configured with detailed field schemas
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {schema.events.map((event) => (
                            <span key={event.name} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700">
                              {event.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - App Preview */}
                <div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-medium">App Preview</h3>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setPreviewDevice('mobile')}
                          className={`p-2 rounded ${previewDevice === 'mobile' ? 'bg-gray-700' : 'hover:bg-gray-800'}`}
                        >
                          <Smartphone className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => setPreviewDevice('tablet')}
                          className={`p-2 rounded ${previewDevice === 'tablet' ? 'bg-gray-700' : 'hover:bg-gray-800'}`}
                        >
                          <Tablet className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => setPreviewDevice('desktop')}
                          className={`p-2 rounded ${previewDevice === 'desktop' ? 'bg-gray-700' : 'hover:bg-gray-800'}`}
                        >
                          <Monitor className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>

                    <div className={`bg-white rounded overflow-hidden ${previewDevice === 'mobile' ? 'max-w-xs mx-auto' :
                      previewDevice === 'tablet' ? 'max-w-md mx-auto' :
                        'w-full'
                      }`} style={{ aspectRatio: previewDevice === 'mobile' ? '9/16' : '16/9' }}>
                      {/* Preview iframe or image */}
                      <div className="relative h-full bg-gradient-to-br from-indigo-50 to-purple-50">
                        <div className="absolute top-4 left-4 right-4">
                          <div className="bg-white rounded-lg shadow-sm p-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <div className="flex-1 ml-4 bg-gray-100 rounded h-4"></div>
                            </div>
                          </div>
                        </div>

                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <Globe className="w-16 h-16 text-indigo-300 mx-auto mb-4" />
                            <p className="text-gray-600 font-medium">{selectedRepo?.name}</p>
                            <p className="text-xs text-gray-500 mt-1">Live preview loading...</p>
                          </div>
                        </div>

                        {/* Analytics overlay indicators */}
                        <div className="absolute bottom-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                          Analytics Active
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-center">
                      <a href={`https://${selectedRepo?.name}.vercel.app`} target="_blank" className="text-indigo-400 hover:text-indigo-300 text-sm inline-flex items-center">
                        View live site
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8 mb-8">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-900">Implementation Details</h4>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>• Analytics script will be added to <code className="bg-blue-100 px-1 rounded">public/tracker.js</code></p>
                      <p>• Provider component at <code className="bg-blue-100 px-1 rounded">app/components/analytics-provider.tsx</code></p>
                      <p>• No existing code will be modified</p>
                    </div>
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
                  onClick={() => {
                    setCurrentStep(4);
                    createPR();
                  }}
                  className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <GitPullRequest className="inline w-5 h-5 mr-2" />
                  Create Pull Request
                </button>
              </div>

              {/* Site Map Visualization - Visual Graph */}
              <div className="mt-8 border-t pt-8">
                <SiteMapGraph selectedRepo={selectedRepo} />
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
                    <p className="text-lg text-gray-600">
                      Setting up your analytics integration...
                    </p>
                  </>
                ) : deploymentStatus === 'success' && (
                  <>
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                      <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      Pull Request Created!
                    </h2>
                    <p className="text-lg text-gray-600 mb-8">
                      Your analytics integration is ready for review
                    </p>

                    <div className="bg-gray-50 rounded-lg p-6 text-left mb-8">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            ✨ Add Analytics Tracking
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {selectedRepo?.full_name} • #247
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                          Open
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center text-gray-700">
                          <FileCode2 className="w-4 h-4 mr-2 text-gray-500" />
                          2 files changed
                        </div>
                        <div className="flex items-center text-green-600">
                          <span className="mr-2">+</span> 150 additions
                        </div>
                      </div>

                      <button className="mt-4 w-full px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center">
                        View on GitHub
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </button>
                    </div>

                    <button
                      onClick={() => setCurrentStep(5)}
                      className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Continue to Dashboard
                      <ArrowRight className="inline w-5 h-5 ml-2" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Complete - Updated without Sparkles */}
        {currentStep === 5 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-8 py-16">
              <div className="text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full mb-6">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Setup Complete
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  Once you merge the PR, analytics will start flowing automatically
                </p>

                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 mb-8">
                  <h3 className="font-semibold text-gray-900 mb-4">Next Steps</h3>
                  <div className="space-y-3 text-left">
                    <div className="flex items-start">
                      <div className="flex items-center justify-center w-6 h-6 bg-white rounded-full flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-indigo-600">1</span>
                      </div>
                      <p className="ml-3 text-sm text-gray-700">
                        Review and merge the pull request in GitHub
                      </p>
                    </div>
                    <div className="flex items-start">
                      <div className="flex items-center justify-center w-6 h-6 bg-white rounded-full flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-indigo-600">2</span>
                      </div>
                      <p className="ml-3 text-sm text-gray-700">
                        Analytics will automatically activate after merge
                      </p>
                    </div>
                    <div className="flex items-start">
                      <div className="flex items-center justify-center w-6 h-6 bg-white rounded-full flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-indigo-600">3</span>
                      </div>
                      <p className="ml-3 text-sm text-gray-700">
                        View real-time insights in your dashboard
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Your App Key</h4>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded text-sm font-mono text-gray-700">
                        {selectedRepo?.name}-prod
                      </code>
                      <button className="p-2 hover:bg-gray-200 rounded transition-colors">
                        <Copy className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Dashboard URL</h4>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded text-sm font-mono text-gray-700">
                        analytics.platform.io/dash...
                      </code>
                      <button className="p-2 hover:bg-gray-200 rounded transition-colors">
                        <ExternalLink className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center space-x-4">
                  <button className="px-8 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors">
                    View Pull Request
                  </button>
                  <button className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
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

function AnalysisStep({ completed, active, step }) {
  return (
    <div className="flex items-center space-x-3">
      {completed ? (
        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
      ) : active ? (
        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
      )}
      <span className={`text-sm ${completed ? 'text-green-600' : active ? 'text-indigo-600 font-medium' : 'text-gray-500'}`}>
        {step}
      </span>
    </div>
  );
}

function EventTypeCollapsible({ event }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            defaultChecked
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
          />
          <div className="text-left">
            <code className="font-mono text-sm font-semibold text-gray-900">{event.name}</code>
            <p className="text-xs text-gray-600 mt-0.5">{event.description}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Event Fields ({event.fields.length})
            </div>
            {event.fields.map((field) => (
              <div key={field.name} className="flex items-start justify-between py-1.5 border-l-2 border-gray-100 pl-3 hover:border-indigo-200 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-indigo-600">
                      {field.name}
                    </code>
                    <code className="text-xs text-gray-500 font-mono">
                      {field.type}
                    </code>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{field.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SiteMapGraph({ selectedRepo }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [expandedNode, setExpandedNode] = useState(null);

  // Site structure with connections
  const siteStructure = {
    home: {
      path: "/",
      events: ["page_view", "link_click", "scroll_depth"],
      connections: ["products", "cart", "login", "about", "wishlist"],
      position: { x: 400, y: 50 }
    },
    products: {
      path: "/products",
      events: ["page_view", "search_performed", "scroll_depth"],
      connections: ["product_detail", "cart"],
      position: { x: 200, y: 150 }
    },
    product_detail: {
      path: "/products/:param",
      events: ["page_view", "button_click", "link_click"],
      connections: ["cart", "wishlist"],
      position: { x: 100, y: 250 }
    },
    cart: {
      path: "/cart",
      events: ["page_view", "button_click"],
      connections: ["checkout", "products"],
      position: { x: 400, y: 250 }
    },
    checkout: {
      path: "/checkout",
      events: ["page_view", "form_started", "form_submitted", "form_error"],
      connections: ["checkout_payment"],
      position: { x: 400, y: 350 }
    },
    checkout_payment: {
      path: "/checkout/payment",
      events: ["page_view", "form_started", "form_submitted", "form_error"],
      connections: ["checkout_success"],
      position: { x: 400, y: 450 }
    },
    checkout_success: {
      path: "/checkout/success",
      events: ["page_view"],
      connections: [],
      position: { x: 400, y: 550 }
    },
    login: {
      path: "/auth/login",
      events: ["page_view", "form_started", "form_submitted", "form_error", "modal_opened", "modal_closed"],
      connections: ["register", "home"],
      position: { x: 600, y: 150 }
    },
    register: {
      path: "/auth/register",
      events: ["page_view", "form_started", "form_submitted", "form_error", "modal_opened", "modal_closed"],
      connections: ["login"],
      position: { x: 700, y: 250 }
    },
    wishlist: {
      path: "/wishlist",
      events: ["page_view", "button_click"],
      connections: ["cart", "product_detail"],
      position: { x: 250, y: 350 }
    },
    about: {
      path: "/about",
      events: ["page_view"],
      connections: [],
      position: { x: 550, y: 350 }
    },
    shipping: {
      path: "/shipping",
      events: ["page_view"],
      connections: [],
      position: { x: 650, y: 450 }
    },
    returns: {
      path: "/returns",
      events: ["page_view"],
      connections: [],
      position: { x: 750, y: 450 }
    }
  };

  const handleNodeClick = (pageName) => {
    setExpandedNode(expandedNode === pageName ? null : pageName);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <div className="relative" style={{ height: '650px' }}>
        <svg className="absolute inset-0 w-full h-full">
          {/* Draw connections */}
          {Object.entries(siteStructure).map(([pageName, pageData]) =>
            pageData.connections.map(targetName => {
              const target = siteStructure[targetName];
              if (!target) return null;
              const isHighlighted = hoveredNode === pageName || hoveredNode === targetName;
              return (
                <line
                  key={`${pageName}-${targetName}`}
                  x1={pageData.position.x + 60}
                  y1={pageData.position.y + 25}
                  x2={target.position.x + 60}
                  y2={target.position.y + 25}
                  stroke={isHighlighted ? "#6366f1" : "#e5e7eb"}
                  strokeWidth={isHighlighted ? "2" : "1"}
                  strokeDasharray={isHighlighted ? "0" : "5,5"}
                  opacity={hoveredNode && !isHighlighted ? "0.3" : "1"}
                  style={{ transition: 'all 0.3s ease' }}
                />
              );
            })
          )}
        </svg>

        {/* Draw nodes */}
        {Object.entries(siteStructure).map(([pageName, pageData]) => {
          const isHome = pageName === 'home';
          const isHovered = hoveredNode === pageName;
          const isExpanded = expandedNode === pageName;
          const isConnected = hoveredNode && siteStructure[hoveredNode]?.connections?.includes(pageName);

          return (
            <div
              key={pageName}
              className={`absolute bg-white rounded-lg border-2 p-3 cursor-pointer transition-all ${isHome
                  ? 'border-indigo-500 shadow-lg'
                  : isHovered || isConnected
                    ? 'border-indigo-400 shadow-md z-10'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              style={{
                left: `${pageData.position.x}px`,
                top: `${pageData.position.y}px`,
                width: isExpanded ? '160px' : '120px',
                opacity: hoveredNode && !isHovered && !isConnected ? '0.5' : '1',
                zIndex: isExpanded ? 20 : isHovered ? 10 : 1
              }}
              onMouseEnter={() => setHoveredNode(pageName)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => handleNodeClick(pageName)}
            >
              {isHome && (
                <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-xs px-1.5 py-0.5 rounded">
                  Entry
                </div>
              )}

              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold text-gray-900">
                  {pageName.replace(/_/g, ' ')}
                </h4>
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3 text-gray-400" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                )}
              </div>

              <code className="text-xs text-gray-500 block mb-1.5" style={{ fontSize: '10px' }}>
                {pageData.path}
              </code>

              {!isExpanded ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {pageData.events.length} events
                  </span>
                  {pageData.connections.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {pageData.connections.length} →
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="space-y-1">
                    {pageData.events.map((event, idx) => (
                      <div key={idx} className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded">
                        {event}
                      </div>
                    ))}
                  </div>
                  {pageData.connections.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-400">
                        → {pageData.connections.length} connections
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-2">Site Hierarchy</p>
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 border-2 border-indigo-500 rounded"></div>
              <span className="text-xs text-gray-600">Entry point</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg width="30" height="2">
                <line x1="0" y1="1" x2="30" y2="1" stroke="#6366f1" strokeWidth="2" />
              </svg>
              <span className="text-xs text-gray-600">Active connection</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg width="30" height="2">
                <line x1="0" y1="1" x2="30" y2="1" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="5,5" />
              </svg>
              <span className="text-xs text-gray-600">Page flow</span>
            </div>
            <div className="flex items-center space-x-2">
              <ChevronDown className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-600">Click to expand events</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="absolute bottom-4 right-4 bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center space-x-4 text-xs text-gray-600">
            <span className="font-medium">13 pages</span>
            <span>•</span>
            <span>45+ events</span>
            <span>•</span>
            <span className="text-green-600 font-medium">100% coverage</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingFlow;