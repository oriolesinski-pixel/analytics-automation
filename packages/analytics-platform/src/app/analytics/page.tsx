'use client';

import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import TileBuilder from '@/components/TileBuilder';
import { useAppKey } from '@/lib/AppKeyContext';

export default function AnalyticsPage() {
  const router = useRouter();
  const { appKey } = useAppKey();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Analytics Builder</h1>
          <p className="text-gray-600 dark:text-gray-400">Create custom analytics tiles and visualizations</p>
        </div>
      </div>

      {/* Content */}
      {appKey ? (
        <TileBuilder appKey={appKey} />
      ) : (
        <div className="p-8">
          <div className="bg-yellow-50 dark:bg-yellow-500/10 rounded-xl border border-yellow-200 dark:border-yellow-500/30 p-12 text-center max-w-2xl mx-auto shadow-sm">
            <AlertCircle className="w-16 h-16 text-yellow-600 dark:text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No App Selected</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Please select an app from the sidebar to start building analytics tiles.
            </p>
            <button
              onClick={() => router.push('/onboarding')}
              className="px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Complete Onboarding
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
