(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Analytics = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  
  class AnalyticsTracker {
    constructor() {
      this.config = {
        appKey: 'demo-next-app',
        endpoint: 'http://localhost:8080/ingest/analytics',
        batchSize: 10,
        flushInterval: 30000
      };
      
      this.eventQueue = [];
      this.sessionId = this.getOrCreateSession();
      this.userId = null;
      
      if (typeof window !== 'undefined') {
        this.setupListeners();
        this.startFlushTimer();
      }
    }

    getOrCreateSession() {
      try {
        let sessionId = sessionStorage.getItem('analytics_session_id');
        if (!sessionId) {
          sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          sessionStorage.setItem('analytics_session_id', sessionId);
        }
        return sessionId;
      } catch {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
    }

    setupListeners() {
      window.addEventListener('beforeunload', () => this.flush());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush();
      });
    }

    startFlushTimer() {
      setInterval(() => {
        if (this.eventQueue.length > 0) this.flush();
      }, this.config.flushInterval);
    }

    trackEvent(eventName, properties = {}) {
      const event = {
        name: eventName,
        props: {
          app_key: this.config.appKey,
          session_id: this.sessionId,
          user_id: this.userId,
          ts: new Date().toISOString(),
          ...properties
        }
      };
      
      this.eventQueue.push(event);
      
      if (this.eventQueue.length >= this.config.batchSize) {
        this.flush();
      }
    }

    trackPageView(page) {
      this.trackEvent('page_view', {
        page_url: page?.url || window.location.href,
        page_title: page?.title || document.title,
        referrer: document.referrer
      });
    }

    identify(userId, traits = {}) {
      this.userId = userId;
      this.trackEvent('identify', { user_id: userId, traits });
    }

    flush() {
      if (this.eventQueue.length === 0) return;
      
      const batch = this.eventQueue.splice(0, this.config.batchSize);
      
      fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_key: this.config.appKey,
          events: batch
        }),
        keepalive: true
      }).catch(err => console.error('Analytics error:', err));
    }
  }

  // Auto-initialize
  if (typeof window !== 'undefined' && !window.analytics) {
    window.analytics = new AnalyticsTracker();
    window.analytics.trackPageView();
  }

  return AnalyticsTracker;
}));