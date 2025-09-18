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
        appKey: 'test-app-rich-1758206274927',
        endpoint: 'http://localhost:8082/ingest/analytics',
        batchSize: 10,
        flushInterval: 30000
      };
      
      this.eventQueue = [];
      this.sessionId = this.getOrCreateSession();
      this.userId = null;
      this.pageLoadTime = Date.now();
      this.maxScrollDepth = 0;
      this.formTracking = new WeakMap();
      
      if (typeof window !== 'undefined') {
        this.setupListeners();
        this.startFlushTimer();
        this.initAutoTracking(); // Initialize auto-tracking
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

    // ============ AUTO-TRACKING METHODS ============
    initAutoTracking() {
      console.log('🎯 Analytics auto-tracking initialized for test-app-rich-1758206274927');
      
      // Track initial page view
      this.trackPageView();
      
      // Setup all automatic tracking
      this.trackButtonClicks();
      this.trackLinkClicks();
      this.trackFormInteractions();
      this.trackModals();
      this.trackScrollDepth();
      this.trackRouteChanges();
    }

    trackButtonClicks() {
      document.addEventListener('click', (e) => {
        const button = e.target.closest('button, [role="button"], input[type="submit"], input[type="button"]');
        if (button) {
          const buttonText = (button.innerText || button.value || button.getAttribute('aria-label') || 'Unknown').trim();
          const buttonId = button.id || null;
          const buttonClass = button.className || null;
          
          // Find parent section for context
          const section = button.closest('header, main, footer, aside, nav, section, [role="navigation"], [role="main"]');
          const buttonLocation = section ? (section.tagName.toLowerCase() || section.getAttribute('role')) : 'unknown';
          
          this.trackEvent('button_click', {
            button_text: buttonText.slice(0, 100),
            button_id: buttonId,
            button_class: buttonClass,
            button_location: buttonLocation,
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      }, true);
    }

    trackLinkClicks() {
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && !link.closest('button')) {
          const linkText = (link.innerText || link.getAttribute('aria-label') || 'Unknown').trim();
          const linkHref = link.getAttribute('href') || '';
          const isExternal = linkHref.startsWith('http') && !linkHref.includes(window.location.hostname);
          
          const section = link.closest('header, main, footer, aside, nav, section');
          const linkLocation = section ? section.tagName.toLowerCase() : 'unknown';
          
          this.trackEvent('link_click', {
            link_text: linkText.slice(0, 100),
            link_href: linkHref,
            link_location: linkLocation,
            is_external: isExternal,
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      }, true);
    }

    trackFormInteractions() {
      // Track form starts
      document.addEventListener('focusin', (e) => {
        const field = e.target;
        const form = field.closest('form');
        
        if (form && !this.formTracking.has(form)) {
          this.formTracking.set(form, {
            started: true,
            startTime: Date.now(),
            fieldsInteracted: new Set()
          });
          
          const formName = this.getFormName(form);
          
          this.trackEvent('form_started', {
            form_name: formName,
            form_id: form.id || null,
            first_field_focused: field.name || field.id || field.type,
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
        
        // Track field interactions
        if (form && this.formTracking.has(form)) {
          const tracking = this.formTracking.get(form);
          tracking.fieldsInteracted.add(field.name || field.id || field.type);
        }
      });

      // Track form submissions
      document.addEventListener('submit', (e) => {
        const form = e.target;
        const formName = this.getFormName(form);
        const tracking = this.formTracking.get(form);
        
        this.trackEvent('form_submitted', {
          form_name: formName,
          form_id: form.id || null,
          success: true,
          duration_seconds: tracking ? Math.round((Date.now() - tracking.startTime) / 1000) : null,
          fields_interacted: tracking ? tracking.fieldsInteracted.size : null,
          page_title: document.title,
          page_url: window.location.pathname
        });
        
        // Clear tracking for this form
        this.formTracking.delete(form);
      });

      // Track form errors (validation failures)
      document.addEventListener('invalid', (e) => {
        const field = e.target;
        const form = field.closest('form');
        if (form) {
          const formName = this.getFormName(form);
          this.trackEvent('form_error', {
            form_name: formName,
            field_name: field.name || field.id || field.type,
            error_message: field.validationMessage,
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      }, true);
    }

    getFormName(form) {
      // Try to intelligently determine form name
      const formName = form.getAttribute('name') || 
                      form.getAttribute('aria-label') ||
                      form.id;
      
      if (formName) return formName;
      
      // Guess from content
      const formText = form.innerText.toLowerCase();
      const formHTML = form.innerHTML.toLowerCase();
      
      if (formHTML.includes('password') && formHTML.includes('email')) {
        return formText.includes('sign up') || formText.includes('register') ? 'register' : 'login';
      }
      if (formHTML.includes('email') && formText.includes('subscribe')) return 'subscribe';
      if (formHTML.includes('search')) return 'search';
      if (formText.includes('checkout')) return 'checkout';
      if (formText.includes('payment')) return 'payment';
      if (formText.includes('shipping')) return 'shipping';
      if (formText.includes('contact')) return 'contact';
      if (formText.includes('feedback')) return 'feedback';
      
      return 'form';
    }

    trackModals() {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              // Check for modal patterns
              const isModal = node.matches && (
                node.matches('[role="dialog"], [role="alertdialog"], .modal, .popup, [class*="modal"], [class*="dialog"], [data-modal]') ||
                node.querySelector('[role="dialog"], [role="alertdialog"]')
              );
              
              if (isModal) {
                const modalName = node.getAttribute('aria-label') || 
                                 node.getAttribute('title') ||
                                 node.id ||
                                 node.querySelector('h1, h2, h3')?.innerText ||
                                 'modal';
                
                this.trackEvent('modal_opened', {
                  modal_name: modalName,
                  modal_id: node.id || null,
                  trigger_element: document.activeElement?.tagName || 'unknown',
                  page_title: document.title,
                  page_url: window.location.pathname
                });

                // Track modal close
                this.observeModalClose(node, modalName);
              }
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    observeModalClose(modalElement, modalName) {
      const closeObserver = new MutationObserver(() => {
        if (!document.contains(modalElement)) {
          this.trackEvent('modal_closed', {
            modal_name: modalName,
            modal_id: modalElement.id || null,
            close_method: 'removed_from_dom',
            page_title: document.title,
            page_url: window.location.pathname
          });
          closeObserver.disconnect();
        }
      });
      
      if (modalElement.parentNode) {
        closeObserver.observe(modalElement.parentNode, { childList: true });
      }
      
      // Also track close button clicks within modal
      modalElement.addEventListener('click', (e) => {
        const closeButton = e.target.closest('[aria-label*="close"], [class*="close"], [data-dismiss], button[type="button"]');
        if (closeButton) {
          this.trackEvent('modal_closed', {
            modal_name: modalName,
            modal_id: modalElement.id || null,
            close_method: 'close_button',
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      });
    }

    trackScrollDepth() {
      let scrollTimer;
      
      const checkScrollDepth = () => {
        const scrollPercent = Math.round(
          (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100
        );
        
        // Track milestones: 25%, 50%, 75%, 100%
        const milestones = [25, 50, 75, 100];
        const milestone = milestones.find(m => m <= scrollPercent && m > this.maxScrollDepth);
        
        if (milestone) {
          this.maxScrollDepth = milestone;
          this.trackEvent('scroll_depth', {
            depth_percent: milestone,
            page_height: document.body.scrollHeight,
            viewport_height: window.innerHeight,
            time_on_page_seconds: Math.round((Date.now() - this.pageLoadTime) / 1000),
            page_title: document.title,
            page_url: window.location.pathname
          });
        }
      };
      
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(checkScrollDepth, 500);
      });
      
      // Also check on page unload
      window.addEventListener('beforeunload', checkScrollDepth);
    }

    trackRouteChanges() {
      // For SPAs - track History API changes
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        setTimeout(() => this.trackPageView(), 0);
      };
      
      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        setTimeout(() => this.trackPageView(), 0);
      };
      
      window.addEventListener('popstate', () => {
        this.trackPageView();
      });
      
      // Track hash changes
      window.addEventListener('hashchange', () => {
        this.trackPageView();
      });
    }

    // ============ CORE TRACKING METHODS ============
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
      // Reset scroll depth for new page
      this.maxScrollDepth = 0;
      this.pageLoadTime = Date.now();
      
      this.trackEvent('page_view', {
        page_url: page?.url || window.location.href,
        page_title: page?.title || document.title,
        referrer: document.referrer,
        query_params: window.location.search,
        hash: window.location.hash
      });
    }

    identify(userId, traits = {}) {
      this.userId = userId;
      this.trackEvent('identify', { user_id: userId, traits });
    }

    flush() {
      if (this.eventQueue.length === 0) return;
      
      const batch = [...this.eventQueue];
      this.eventQueue = [];
      
      fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_key: this.config.appKey,
          events: batch
        }),
        keepalive: true
      }).catch(err => {
        console.error('Analytics flush error:', err);
        // Re-add events to queue for retry
        this.eventQueue.unshift(...batch);
      });
    }
  }

  // Auto-initialize
  if (typeof window !== 'undefined' && !window.analytics) {
    window.analytics = new AnalyticsTracker();
    console.log('✅ Analytics tracker initialized with auto-tracking enabled');
  }

  return AnalyticsTracker;
}));