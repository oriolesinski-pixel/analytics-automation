// Auto-generated analytics types
export interface PageViewEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  page_url: '/' | '/about' | '/auth/login' | '/auth/register' | '/cart' | '/checkout' | '/checkout/payment' | '/checkout/success' | '/products/:param' | '/products' | '/returns' | '/shipping' | '/wishlist';
  page_title?: string;
  referrer?: string;
  query_params?: string;
  hash?: string;
}

export interface ButtonClickEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  button_text: 'Sign in' | 'Create a new account' | 'Continue Shopping' | 'Add to Cart' | 'Remove' | '+' | '-' | 'Proceed to Checkout' | 'Place Order' | 'Save Card';
  button_type?: string;
  button_location?: string;
}

export interface LinkClickEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  link_text: 'sign in to existing account' | 'create a new account' | 'Products' | 'About' | 'Shipping' | 'Returns' | 'Continue Shopping' | 'Back to Home';
  link_url: '/auth/login' | '/auth/register' | '/products' | '/about' | '/shipping' | '/returns' | '/products' | '/';
  link_type?: string;
}

export interface FormStartedEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  form_name: 'Login' | 'Register' | 'Checkout Shipping' | 'Checkout Payment';
  form_type?: 'login' | 'register' | 'shipping' | 'payment';
}

export interface FormSubmittedEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  form_name: 'Login' | 'Register' | 'Checkout Shipping' | 'Checkout Payment';
  form_type?: 'login' | 'register' | 'shipping' | 'payment';
  form_valid: boolean;
}

export interface FormErrorEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  form_name: 'Login' | 'Register' | 'Checkout Shipping' | 'Checkout Payment';
  form_type?: 'login' | 'register' | 'shipping' | 'payment';
  error_message: 'Passwords do not match' | 'Password must be at least 6 characters' | 'Invalid email or password' | 'An error occurred. Please try again.';
  field_name?: string;
}

export interface ModalOpenedEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  modal_name: 'Login' | 'Register';
  modal_type?: 'login' | 'register';
}

export interface ModalClosedEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  modal_name: 'Login' | 'Register';
  modal_type?: 'login' | 'register';
}

export interface ScrollDepthEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  page_url: '/' | '/about' | '/auth/login' | '/auth/register' | '/cart' | '/checkout' | '/checkout/payment' | '/checkout/success' | '/products/:param' | '/products' | '/returns' | '/shipping' | '/wishlist';
  scroll_percentage: number;
  scroll_position?: number;
}

export interface SearchPerformedEvent {
  app_key: string;
  session_id: string;
  user_id: string | null;
  ts: string;
  search_query: string;
  search_filters?: string;
}

export type AnalyticsEvent = PageViewEvent | ButtonClickEvent | LinkClickEvent | FormStartedEvent | FormSubmittedEvent | FormErrorEvent | ModalOpenedEvent | ModalClosedEvent | ScrollDepthEvent | SearchPerformedEvent;

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