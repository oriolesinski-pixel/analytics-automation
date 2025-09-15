// Auto-generated analytics types
export interface PageviewEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  page_url: '/' | '/page.tsx' | '/pricing';
  page_title?: 'Home';
  referrer?: string;
}

export interface InteractionEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  element_type: 'button' | 'link' | 'form';
  action: 'click' | 'submit' | 'hover';
  element_text?: string;
}

export type AnalyticsEvent = PageviewEvent | InteractionEvent;

export interface AnalyticsTracker {
  trackEvent(eventName: string, properties: Record<string, any>): void;
  trackPageView(page?: { url?: string; title?: string }): void;
  identify(userId: string, traits?: Record<string, any>): void;
  flush(): void;
}

declare global {
  interface Window {
    analytics?: AnalyticsTracker;
  }
}