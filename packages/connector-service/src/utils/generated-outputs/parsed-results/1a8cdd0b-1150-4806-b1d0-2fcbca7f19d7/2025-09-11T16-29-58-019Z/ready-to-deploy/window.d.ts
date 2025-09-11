interface Window {
  analytics?: {
    trackPageView(page?: string): void;
    trackEvent(eventName: string, properties?: any): void;
    identify(userId: string, traits?: any): void;
    flush(): void;
  };
}