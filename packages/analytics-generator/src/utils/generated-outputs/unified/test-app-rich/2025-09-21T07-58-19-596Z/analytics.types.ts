// Auto-generated analytics types
export interface PageViewEvent {
  app_key: string;
  session_id: string;
  user_id: string;
  ts: string;
  page_url: string;
  page_title?: string;
  referrer?: string;
  query_params?: string;
  hash?: string;
}

export interface ElementClickEvent {
  app_key: string;
  session_id: string;
  user_id: string;
  ts: string;
  element_text: string;
  element_type: 'button' | 'selector' | 'form' | 'custom';
  element_id?: string;
  element_class?: string;
  element_location?: string;
  component_name?: string;
  context?: object;
  page_title?: string;
  page_url?: string;
}

export interface SelectionChangeEvent {
  app_key: string;
  session_id: string;
  user_id: string;
  ts: string;
  selection_type: string;
  selection_value: string;
  selection_name?: string;
  previous_value?: string;
  component_name?: string;
  page_title?: string;
  page_url?: string;
}

export interface FormStartedEvent {
  app_key: string;
  session_id: string;
  user_id: string;
  ts: string;
  form_name: string;
  form_id?: string;
  first_field_focused?: string;
  context?: object;
  page_title: string;
  page_url?: string;
}

export interface FormSubmittedEvent {
  app_key: string;
  session_id: string;
  user_id: string;
  ts: string;
  form_name: string;
  form_id?: string;
  success: boolean;
  duration_seconds?: number;
  fields_interacted?: number;
  error_message?: string;
  context?: object;
  page_title: string;
  page_url?: string;
}

export interface ScrollDepthEvent {
  app_key: string;
  session_id: string;
  user_id: string;
  ts: string;
  depth_percent: number;
  page_height?: number;
  viewport_height?: number;
  time_on_page_seconds?: number;
  page_title: string;
  page_url?: string;
}

export type AnalyticsEvent = PageViewEvent | ElementClickEvent | SelectionChangeEvent | FormStartedEvent | FormSubmittedEvent | ScrollDepthEvent;

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