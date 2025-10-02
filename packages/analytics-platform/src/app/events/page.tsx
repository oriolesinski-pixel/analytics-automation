'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import LiveEventFeed from '@/components/LiveEventFeed';

export default function EventsPage() {
  const searchParams = useSearchParams();
  const [appKey, setAppKey] = useState<string>('');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const hydrateFromStorage = () => {
      const urlKey = searchParams.get('app');
      if (urlKey && urlKey.trim()) {
        const normalized = urlKey.trim();
        try {
          sessionStorage.setItem('app_key', normalized);
          localStorage.setItem('app_key', normalized);
        } catch (error) {
          console.warn('Unable to persist app key from URL:', error);
        }
        setAppKey(normalized);
        setIsHydrated(true);
        return;
      }

      try {
        const storedAppKey =
          sessionStorage.getItem('app_key') ||
          sessionStorage.getItem('onboarding_app_key') ||
          localStorage.getItem('app_key') ||
          localStorage.getItem('onboarding_app_key');

        // Debug logging to help troubleshoot storage issues
        console.log('App key storage debug:', {
          sessionAppKey: sessionStorage.getItem('app_key'),
          sessionOnboardingKey: sessionStorage.getItem('onboarding_app_key'),
          localAppKey: localStorage.getItem('app_key'),
          localOnboardingKey: localStorage.getItem('onboarding_app_key'),
          finalStoredKey: storedAppKey
        });

        if (storedAppKey) {
          let cleanKey = storedAppKey;

          try {
            const parsed = JSON.parse(storedAppKey);
            if (typeof parsed === 'string') {
              cleanKey = parsed;
            }
          } catch {
            if (
              (cleanKey.startsWith('"') && cleanKey.endsWith('"')) ||
              (cleanKey.startsWith("'") && cleanKey.endsWith("'"))
            ) {
              cleanKey = cleanKey.slice(1, -1);
            }
          }

          cleanKey = cleanKey.trim();

          if (cleanKey) {
            setAppKey(cleanKey);
            setIsHydrated(true);
            return;
          }
        }
      } catch (storageError) {
        console.warn('Unable to hydrate app_key from storage:', storageError);
      }

      const cached = localStorage.getItem('live_events_cache_key');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (typeof parsed === 'string' && parsed.trim()) {
            const normalized = parsed.trim();
            setAppKey(normalized);
            setIsHydrated(true);
            return;
          }
        } catch (cacheError) {
          console.warn('Unable to parse cached app key:', cacheError);
        }
      }

      setIsHydrated(true);
    };

    hydrateFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">🎉 Your Analytics Are Live!</h1>
          <p className="text-gray-600">
            Watch events flow in real-time as users interact with your application.
          </p>
        </header>

        {!isHydrated ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-600">
            Hydrating event stream...
          </div>
        ) : appKey ? (
          <LiveEventFeed appKey={appKey} />
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-3">
            <h3 className="text-lg font-medium text-blue-900">Complete Onboarding First</h3>
            <p className="text-blue-700">
              We couldn't locate your app key in this session. Please finish the onboarding flow or rerun it to generate your analytics configuration.
            </p>
            <p className="text-sm text-blue-600">
              Tip: After completing onboarding, the "View Live Events" button will take you directly here with your app ready.
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Start Onboarding →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

