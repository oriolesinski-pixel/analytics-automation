
'use client';
import { BasicFunnel } from '../../components/BasicFunnel';
import { TopKPIs } from '../../components/TopKPIs';
import { Activity, BarChart3, TrendingUp, Settings, Zap, Monitor, Sparkles } from 'lucide-react';

const analyticsConfig = {
  endpoint: 'http://localhost:8080',
  repoId: 'oriolesinski-pixel/demo-frontend'
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-600/10 rounded-xl border border-blue-500/20">
                <BarChart3 className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-4xl font-mono font-bold text-white tracking-tight">
                  Analytics Automation
                </h1>
                <p className="text-gray-400 font-mono mt-1">
                  Real-time insights for {analyticsConfig.repoId}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-4 py-2 bg-emerald-950/50 border border-emerald-800/30 rounded-lg">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-emerald-400 font-mono text-sm font-medium">Live</span>
              </div>
              <button className="p-2 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors">
                <Settings className="w-5 h-5 text-gray-400 hover:text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-b border-purple-800/30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center space-x-3">
            <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
            <span className="text-purple-300 font-mono text-sm font-medium">
              Analytics Prompt Generation Coming Soon
            </span>
            <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <div className="p-1.5 bg-gray-800 rounded-md">
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <h2 className="text-lg font-mono font-semibold text-white">Key Metrics</h2>
          </div>
          <TopKPIs endpoint={analyticsConfig.endpoint} repoId={analyticsConfig.repoId} />
        </div>

        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <div className="p-1.5 bg-gray-800 rounded-md">
              <Activity className="w-4 h-4 text-gray-400" />
            </div>
            <h2 className="text-lg font-mono font-semibold text-white">User Journey</h2>
          </div>
          <BasicFunnel endpoint={analyticsConfig.endpoint} repoId={analyticsConfig.repoId} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-1.5 bg-gray-800 rounded-md">
                <Zap className="w-4 h-4 text-gray-400" />
              </div>
              <h3 className="text-lg font-mono font-semibold text-white">Pipeline Status</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-md border border-gray-700/50">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="font-mono text-emerald-400 font-medium text-sm">Event Collection</span>
                </div>
                <span className="font-mono text-emerald-400 text-xs">Active</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-md border border-gray-700/50">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="font-mono text-emerald-400 font-medium text-sm">Analytics Endpoints</span>
                </div>
                <span className="font-mono text-emerald-400 text-xs">Live</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-1.5 bg-gray-800 rounded-md">
                <Monitor className="w-4 h-4 text-gray-400" />
              </div>
              <h3 className="text-lg font-mono font-semibold text-white">System Info</h3>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
                <span className="font-mono text-gray-400 text-sm">Backend</span>
                <span className="font-mono text-white text-sm">localhost:8080</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
                <span className="font-mono text-gray-400 text-sm">Repository</span>
                <span className="font-mono text-white text-sm">{analyticsConfig.repoId}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-mono text-gray-400 text-sm">Environment</span>
                <span className="font-mono text-emerald-400 text-sm">Development</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
