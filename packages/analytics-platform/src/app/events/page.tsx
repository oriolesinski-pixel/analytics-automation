'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, Database, Plus } from 'lucide-react';
import LiveEventFeed from '@/components/LiveEventFeed';
import SQLSandbox from '@/components/SQLSandbox';
import { useAppKey } from '@/lib/AppKeyContext';

type Tab = 'live' | 'sql';

export default function EventsPage() {
  const { appKey, isLoading: isHydrating } = useAppKey();
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const isHydrated = !isHydrating;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Events & SQL</h1>
              <p className="text-gray-600 dark:text-gray-400">Monitor live events and query your data</p>
            </div>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-sm shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              Add Analytics
            </Link>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="px-8">
          <div className="flex gap-6 border-b border-gray-200 dark:border-gray-700">
            <TabButton
              active={activeTab === 'live'}
              onClick={() => setActiveTab('live')}
              icon={Activity}
            >
              Live Events
            </TabButton>
            <TabButton
              active={activeTab === 'sql'}
              onClick={() => setActiveTab('sql')}
              icon={Database}
            >
              SQL Sandbox
            </TabButton>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {activeTab === 'live' && (
          <div>
            {!isHydrated ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-600 dark:text-gray-400 shadow-sm">
                <div className="inline-block w-8 h-8 border-4 border-gray-200 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin mb-3"></div>
                <p>Loading event stream...</p>
              </div>
            ) : appKey ? (
              <LiveEventFeed appKey={appKey} />
            ) : (
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/30 p-8 space-y-4 max-w-2xl mx-auto shadow-sm">
                <div className="text-4xl mb-2">ℹ️</div>
                <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-300">Complete Onboarding First</h3>
                <p className="text-blue-700 dark:text-blue-400">
                  We couldn't locate your app key in this session. Please finish the onboarding flow or rerun it to generate your analytics configuration.
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-500">
                  Tip: After completing onboarding, the "View Live Events" button will take you directly here with your app ready.
                </p>
                <Link
                  href="/onboarding"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  Start Onboarding →
                </Link>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'sql' && (
          <>
            {!isHydrated ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-600 dark:text-gray-400 shadow-sm">
                <div className="inline-block w-8 h-8 border-4 border-gray-200 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin mb-3"></div>
                <p>Loading SQL Sandbox...</p>
              </div>
            ) : appKey ? (
              <div className="h-[800px]">
                <SQLSandbox appKey={appKey} />
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/30 p-8 space-y-4 max-w-2xl mx-auto shadow-sm">
                <div className="text-4xl mb-2">ℹ️</div>
                <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-300">Complete Onboarding First</h3>
                <p className="text-blue-700 dark:text-blue-400">
                  We couldn't locate your app key in this session. Please finish the onboarding flow or rerun it to generate your analytics configuration.
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-500">
                  Tip: After completing onboarding, you'll be able to query your analytics data using the SQL Sandbox.
                </p>
                <Link
                  href="/onboarding"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium text-sm"
                >
                  Start Onboarding →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children, icon: Icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon: any }) {
  return (
    <button
      onClick={onClick}
      className={`
        pb-3 px-1 text-sm font-medium transition-colors relative flex items-center gap-2
        ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}
      `}
    >
      <Icon className="w-4 h-4" />
      {children}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
      )}
    </button>
  );
}

