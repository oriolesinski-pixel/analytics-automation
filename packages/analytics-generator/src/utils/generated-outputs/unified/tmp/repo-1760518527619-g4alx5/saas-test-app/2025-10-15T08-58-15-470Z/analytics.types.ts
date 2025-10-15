// Auto-generated analytics types with new event schema
export interface BaseEvent {
  id: string;
  ts: number;
  app_key: string;
  session_id: string;
  user_id: string;
  event_type: string;
  data: Record<string, any>;
}

export interface PageViewEvent extends BaseEvent {
  event_type: 'PAGE_VIEW';
  data: {
    url: string;
    path: string;
    title: string;
    referrer: string | null;
    is_first_view: boolean;
    entry_type: 'navigation' | 'reload' | 'back_forward' | 'spa_transition';
  };
}

export interface ButtonClickEvent extends BaseEvent {
  event_type: 'BUTTON_CLICK';
  data: {
    element_text: string;
    element_id: string | null;
    element_type: 'button' | 'link' | 'icon' | 'tab';
    surface: string;
    page_path: string;
    is_primary_cta: boolean;
    cta_category: 'conversion' | 'navigation' | 'engagement';
    pattern_type: string | null;
    context: Record<string, any>;
  };
}

export interface FormInteractionEvent extends BaseEvent {
  event_type: 'FORM_INTERACTION';
  data: {
    action: 'started' | 'submitted' | 'abandoned';
    form_name: string;
    form_id: string | null;
    form_type: 'contact' | 'signup' | 'login' | 'checkout' | 'newsletter' | 'other';
    surface: string;
    page_path: string;
    fields_total: number;
    fields_completed: number;
  };
}

export interface ModalInteractionEvent extends BaseEvent {
  event_type: 'MODAL_INTERACTION';
  data: {
    action: 'opened' | 'closed' | 'submitted' | 'dismissed';
    modal_name: string;
    modal_id: string | null;
    trigger_source: 'button_click' | 'auto_trigger' | 'other';
    page_path: string;
    context: Record<string, any>;
  };
}

export interface ElementVisibilityEvent extends BaseEvent {
  event_type: 'ELEMENT_VISIBILITY';
  data: {
    action: 'shown' | 'hidden' | 'dismissed';
    element_type: 'modal' | 'popup' | 'drawer' | 'tooltip' | 'dropdown' | 'toast' | 'unknown';
    element_name: string;
    element_id: string | null;
    trigger_source: 'button_click' | 'auto_trigger' | 'scroll_trigger' | 'unknown';
    page_path: string;
    has_cta: boolean;
  };
}

export interface ScrollInteractionEvent extends BaseEvent {
  event_type: 'SCROLL_INTERACTION';
  data: {
    action: 'depth_reached';
    depth_percentage: number;
    milestone: '25%' | '50%' | '75%' | '90%' | '100%' | 'none';
    page_path: string;
    direction: 'up' | 'down';
  };
}

export type AnalyticsEvent = 
  | PageViewEvent 
  | ButtonClickEvent 
  | FormInteractionEvent 
  | ModalInteractionEvent
  | ElementVisibilityEvent 
  | ScrollInteractionEvent;

export interface AnalyticsTracker {
  trackEvent(eventType: string, data: Record<string, any>): void;
  flush(): void;
}

declare global {
  interface Window {
    analytics?: AnalyticsTracker;
  }
}