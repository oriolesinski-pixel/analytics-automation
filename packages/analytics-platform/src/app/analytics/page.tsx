'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import TileBuilder from '@/components/TileBuilder';

export default function AnalyticsPage() {
  const router = useRouter();
  const [appKey, setAppKey] = useState('');

  useEffect(() => {
    // Get app key from storage
    const storedKey = localStorage.getItem('app_key') || sessionStorage.getItem('app_key') || '';
    setAppKey(storedKey);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Builder</h1>
          <p className="text-gray-600">Create custom analytics tiles and visualizations</p>
        </div>
      </div>

      {/* Content */}
      {appKey ? (
        <TileBuilder appKey={appKey} />
      ) : (
        <div className="p-8">
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-12 text-center max-w-2xl mx-auto shadow-sm">
            <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">No App Selected</h2>
            <p className="text-gray-600 mb-6">
              Please select an app from the sidebar to start building analytics tiles.
            </p>
            <button
              onClick={() => router.push('/onboarding')}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Complete Onboarding
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

