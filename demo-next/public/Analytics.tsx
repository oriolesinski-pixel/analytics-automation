'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    analytics?: {
      trackPageView(page?: string): void;
      trackEvent(eventName: string, properties?: any): void;
      identify(userId: string, traits?: any): void;
      flush(): void;
    };
  }
}

export default function Analytics() {
  const pathname = usePathname();
  
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/tracker.js';
    script.async = true;
    document.body.appendChild(script);
    
    script.onload = () => {
      if (window.analytics) {
        console.log('Analytics tracker initialized');
        window.analytics.trackPageView();
      }
    };
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);
  
  useEffect(() => {
    if (window.analytics) {
      window.analytics.trackPageView(pathname);
    }
  }, [pathname]);
  
  return null;
}