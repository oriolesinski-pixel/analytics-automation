// Auto-generated analytics types
export interface PageviewEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  page_url: '/' | '/pricing';
  page_title?: 'Create Next App' | 'Pricing';
  referrer?: string;
  viewport_width?: number;
}

export interface ButtonclickEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  button_text: 'Deploy now' | 'Read our docs';
  button_href: 'https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app' | 'https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app';
  button_type?: 'primary' | 'secondary';
}

export interface FooterlinkclickEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  link_text: 'Learn' | 'Examples' | 'Go to nextjs.org →';
  link_href: 'https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app' | 'https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app' | 'https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app';
  icon_type?: 'file' | 'window' | 'globe';
}

export interface CodesnippetinteractionEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  action: 'view' | 'hover' | 'copy';
  code_text?: 'src/app/page.tsx';
}

export type AnalyticsEvent = PageviewEvent | ButtonclickEvent | FooterlinkclickEvent | CodesnippetinteractionEvent;

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