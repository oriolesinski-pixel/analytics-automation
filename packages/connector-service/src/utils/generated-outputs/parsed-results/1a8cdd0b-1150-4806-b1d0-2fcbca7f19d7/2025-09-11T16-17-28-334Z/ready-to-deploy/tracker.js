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
      endpoint: 'http://localhost:3000/ingest/app',
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
    this.queue.push({
      type: 'pageview',
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      user_agent: navigator.userAgent,
      page_url: page.url,
      page_title: page.title,
      referrer: document.referrer,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight
    });
    this.scheduleFlush();
  }

  trackEvent(name, props) {
    this.queue.push({
      type: 'event',
      name,
      properties: props,
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      user_agent: navigator.userAgent,
      page_url: window.location.href,
      page_title: document.title,
      referrer: document.referrer,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight
    });
    this.scheduleFlush();
  }

  identify(userId, traits) {
    this.queue.push({
      type: 'identify',
      userId,
      traits,
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      user_agent: navigator.userAgent,
      page_url: window.location.href,
      page_title: document.title,
      referrer: document.referrer,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight
    });
    this.scheduleFlush();
  }

  flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.config.batchSize);
    this.sendEvents(batch, 0);
  }

  scheduleFlush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  sendEvents(batch, retryCount) {
    if (typeof window === 'undefined') return;
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
          console.log(`Retrying events (attempt ${retryCount + 1})`);
          setTimeout(() => {
            this.sendEvents(batch, retryCount + 1);
          }, Math.pow(2, retryCount) * 1000);
        } else {
          console.error('Failed to send events after max retries');
        }
      }
    })
    .catch(error => {
      if (retryCount < this.config.maxRetries) {
        console.log(`Retrying events (attempt ${retryCount + 1})`);
        setTimeout(() => {
          this.sendEvents(batch, retryCount + 1);
        }, Math.pow(2, retryCount) * 1000);
      } else {
        console.error('Failed to send events after max retries');
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