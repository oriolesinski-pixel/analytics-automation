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
      appKey: 'demo-fashion-store',
      endpoint: 'http://localhost:8080/ingest/analytics',
      batchSize: 10,
      flushInterval: 30000,
      maxRetries: 3
    };
    this.queue = [];
    this.sessionId = this.getSessionId();
    this.flushTimer = null;
  }

  getSessionId() {
    try {
      let sessionId = localStorage.getItem('session_id');
      if (!sessionId) {
        sessionId = this.generateUUID();
        localStorage.setItem('session_id', sessionId);
      }
      return sessionId;
    } catch (e) {
      return this.generateUUID();
    }
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  trackPageView(page) {
    this.trackEvent('page_view', {
      page_url: page?.url || window.location.href,
      page_title: page?.title || document.title
    });
  }

  trackEvent(name, props) {
    this.queue.push({
      name,
      props: {
        ...props,
        timestamp: new Date().toISOString(),
        session_id: this.sessionId,
        user_agent: navigator.userAgent,
        referrer: document.referrer,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight
      }
    });
    this.scheduleFlush();
  }

  identify(userId, traits) {
    this.trackEvent('identify', {
      user_id: userId,
      ...traits
    });
  }

  flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.config.batchSize);
    this.sendEvents(batch, 0);
  }

  scheduleFlush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), this.config.flushInterval);
  }

  sendEvents(batch, retryCount) {
    fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ app_key: this.config.appKey, events: batch })
    })
    .then(response => {
      if (response.ok) {
        console.log('Events sent successfully');
      } else {
        if (retryCount < this.config.maxRetries) {
          console.error('Failed to send events, retrying...');
          this.sendEvents(batch, retryCount + 1);
        } else {
          console.error('Failed to send events after maximum retries');
        }
      }
    })
    .catch(error => {
      if (retryCount < this.config.maxRetries) {
        console.error('Error sending events, retrying...', error);
        this.sendEvents(batch, retryCount + 1);
      } else {
        console.error('Error sending events after maximum retries', error);
      }
    });
  }
}
  
  // Auto-initialize
  if (typeof window !== 'undefined' && !window.analytics) {
    var tracker = new AnalyticsTracker();
    window.analytics = tracker;
    
    // Auto-track page loads
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        tracker.trackPageView();
      });
    } else {
      tracker.trackPageView();
    }
  }
  
  return AnalyticsTracker;
}));