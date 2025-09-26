(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Analytics = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  
  // ============ USER ID GENERATOR ============
  class UserIdGenerator {
    constructor() {
      this.STORAGE_KEY = 'analytics_user_id';
      this.userId = null;
    }

    init() {
      this.userId = this.getOrCreateUserId();
      return this.userId;
    }

    getOrCreateUserId() {
      // Try to get existing user ID from storage
      let userId = this.getFromStorage();
      
      if (!userId) {
        // Generate new 8-10 digit integer ID
        userId = this.generateUserId();
        this.saveToStorage(userId);
      }
      
      return userId;
    }

    generateUserId() {
      // Generate a random 8-10 digit integer
      const min = 10000000;   // 8 digits minimum
      const max = 9999999999;  // 10 digits maximum
      
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        // Use crypto for better randomness
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        
        // Scale the random value to our range
        const randomNum = min + (array[0] % (max - min + 1));
        return Math.abs(randomNum).toString();
      }
      
      // Fallback for older browsers
      const randomNum = min + Math.floor(Math.random() * (max - min + 1));
      return randomNum.toString();
    }

    getFromStorage() {
      // Try multiple storage methods for resilience
      try {
        // Try localStorage first (most persistent)
        const localStorageId = localStorage.getItem(this.STORAGE_KEY);
        if (localStorageId) return localStorageId;
      } catch (e) {
        console.debug('localStorage not available');
      }
      
      try {
        // Try cookies
        const cookieMatch = document.cookie.match(new RegExp('(^| )' + this.STORAGE_KEY + '=([^;]+)'));
        if (cookieMatch) return cookieMatch[2];
      } catch (e) {
        console.debug('Cookies not available');
      }
      
      try {
        // Fallback to sessionStorage (least persistent)
        return sessionStorage.getItem(this.STORAGE_KEY);
      } catch (e) {
        return null;
      }
    }

    saveToStorage(userId) {
      // Save to multiple storage locations for resilience
      try {
        localStorage.setItem(this.STORAGE_KEY, userId);
        localStorage.setItem(this.STORAGE_KEY + '_created', new Date().toISOString());
      } catch (e) {
        console.debug('localStorage write failed');
      }
      
      try {
        // Set cookie with 1 year expiration
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);
        document.cookie = this.STORAGE_KEY + '=' + userId + '; expires=' + expires.toUTCString() + '; path=/; SameSite=Lax';
      } catch (e) {
        console.debug('Cookie write failed');
      }
      
      try {
        sessionStorage.setItem(this.STORAGE_KEY, userId);
      } catch (e) {
        console.debug('sessionStorage write failed');
      }
    }
  }
  
  // ============ MAIN ANALYTICS TRACKER ============
  class AnalyticsTracker {
    constructor() {
      this.config = {
        appKey: 'test-app-rich-demo-2025-09-25-5tqqpvt9fxo',
        endpoint: 'http://localhost:8082/ingest/analytics',
        batchSize: 10,
        flushInterval: 30000
      };
      
      this.eventQueue = [];
      this.sessionId = this.getOrCreateSession();
      this.userIdGenerator = new UserIdGenerator();
      this.userId = this.userIdGenerator.init();
      this.pageLoadTime = Date.now();
      this.maxScrollDepth = 0;
      this.hasViewedPage = false;
      this.scrollDirection = 'down';
      this.lastScrollY = 0;
      this.reachedMilestones = new Set();
      this.formTracking = new WeakMap();
      this.clickedElements = new WeakSet();
      this.visibleElements = new WeakMap();
      this.pageContext = {};
      
      // AI-discovered component patterns
      this.componentDetectors = [
        {
            name: 'Button',
            type: 'button',
            selectors: [".bg-blue-600",".hover:bg-blue-700",".px-6",".py-3",".rounded-lg"],
            purpose: 'Primary action buttons (e.g. Continue Shopping, Log In, Create Account)',
            contextNeeded: [],
            contextCollection: {"search_parents":[".product-card","[data-product]"],"extract_fields":["product-id"],"sibling_context":[],"data_attributes":["data-product-id"]}
        },

        {
            name: 'Link',
            type: 'link',
            selectors: [".font-medium",".text-blue-600",".hover:text-blue-500"],
            purpose: 'Secondary links (e.g. Sign in to existing account, Create new account)',
            contextNeeded: [],
            contextCollection: {"search_parents":[".product-card","[data-product]"],"extract_fields":["product-id"],"sibling_context":[],"data_attributes":["data-product-id"]}
        },

        {
            name: 'QuantitySelector',
            type: 'selector',
            selectors: [".flex",".items-center",".gap-2",".p-1",".hover:bg-gray-100",".rounded"],
            purpose: 'Quantity control for cart items',
            contextNeeded: ["product_id","quantity"],
            contextCollection: {"search_parents":[".product-card","[data-product]","form"],"extract_fields":["product-id","quantity"],"sibling_context":["input[name='size']",".color-selector.active"],"data_attributes":["data-product-id"]}
        },

        {
            name: 'RemoveFromCart',
            type: 'button',
            selectors: [".text-red-500",".hover:text-red-700"],
            purpose: 'Remove item from cart',
            contextNeeded: ["product_id"],
            contextCollection: {"search_parents":[".cart-item"],"extract_fields":["product-id"],"sibling_context":[],"data_attributes":["data-product-id"]}
        },

        {
            name: 'EmailInput',
            type: 'form_input',
            selectors: ["#email",".appearance-none",".rounded-none",".relative",".block",".w-full",".px-3",".py-2",".border",".border-gray-300",".placeholder-gray-500",".text-gray-900",".rounded-t-md",".focus:outline-none",".focus:ring-blue-500",".focus:border-blue-500",".focus:z-10",".sm:text-sm"],
            purpose: 'Email input field for login/registration',
            contextNeeded: ["email"],
            contextCollection: {"search_parents":["form"],"extract_fields":["email"],"sibling_context":[],"data_attributes":[]}
        },

        {
            name: 'PasswordInput',
            type: 'form_input',
            selectors: ["#password",".appearance-none",".rounded-none",".relative",".block",".w-full",".px-3",".py-2",".border",".border-gray-300",".placeholder-gray-500",".text-gray-900",".rounded-b-md",".focus:outline-none",".focus:ring-blue-500",".focus:border-blue-500",".focus:z-10",".sm:text-sm"],
            purpose: 'Password input field for login/registration',
            contextNeeded: ["password"],
            contextCollection: {"search_parents":["form"],"extract_fields":["password"],"sibling_context":[],"data_attributes":[]}
        },

        {
            name: 'LoginForm',
            type: 'form',
            selectors: [".mt-8",".space-y-6",".onSubmit={handleSubmit}"],
            purpose: 'Login form submission',
            contextNeeded: ["email","password"],
            contextCollection: {"search_parents":["form"],"extract_fields":["email","password"],"sibling_context":[],"data_attributes":[]}
        },

        {
            name: 'RegisterForm',
            type: 'form',
            selectors: [".mt-8",".space-y-6",".onSubmit={handleSubmit}"],
            purpose: 'Registration form submission',
            contextNeeded: ["name","email","password","confirmPassword"],
            contextCollection: {"search_parents":["form"],"extract_fields":["name","email","password","confirmPassword"],"sibling_context":[],"data_attributes":[]}
        },

        {
            name: 'AddToCartButton',
            type: 'button',
            selectors: [".bg-blue-600",".text-white",".px-6",".py-3",".rounded-lg",".hover:bg-blue-700"],
            purpose: 'Add product to cart',
            contextNeeded: ["product_id"],
            contextCollection: {"search_parents":[".product-card","[data-product]"],"extract_fields":["product-id"],"sibling_context":[],"data_attributes":["data-product-id"]}
        },

        {
            name: 'RemoveFromCartButton',
            type: 'button',
            selectors: [".text-red-500",".hover:text-red-700"],
            purpose: 'Remove item from cart',
            contextNeeded: ["product_id"],
            contextCollection: {"search_parents":[".cart-item"],"extract_fields":["product-id"],"sibling_context":[],"data_attributes":["data-product-id"]}
        },

        {
            name: 'QuantityInput',
            type: 'form_input',
            selectors: [".w-12",".text-center"],
            purpose: 'Quantity input for cart items',
            contextNeeded: ["product_id","quantity"],
            contextCollection: {"search_parents":[".cart-item"],"extract_fields":["product-id","quantity"],"sibling_context":[],"data_attributes":["data-product-id"]}
        },

        {
            name: 'ClearCartButton',
            type: 'button',
            selectors: [".text-red-500",".hover:text-red-700"],
            purpose: 'Clear all items from cart',
            contextNeeded: [],
            contextCollection: {"search_parents":["#cart"],"extract_fields":[],"sibling_context":[],"data_attributes":[]}
        },

        {
            name: 'ShippingInfoForm',
            type: 'form',
            selectors: [".space-y-4",".onSubmit={handleSubmit}"],
            purpose: 'Shipping information form submission',
            contextNeeded: ["firstName","lastName","email","phone","address","city","state","zipCode","country"],
            contextCollection: {"search_parents":["form"],"extract_fields":["firstName","lastName","email","phone","address","city","state","zipCode","country"],"sibling_context":[],"data_attributes":[]}
        },

        {
            name: 'PaymentForm',
            type: 'form',
            selectors: [".space-y-4",".onSubmit={handleSubmit}"],
            purpose: 'Payment form submission',
            contextNeeded: ["cardNumber","cardName","expiryDate","cvv","saveCard"],
            contextCollection: {"search_parents":["form"],"extract_fields":["cardNumber","cardName","expiryDate","cvv","saveCard"],"sibling_context":[],"data_attributes":[]}
        },

        {
            name: 'Carousel',
            type: 'custom',
            selectors: [".relative",".w-full",".h-\\[400px\\]",".md:h-\\[500px\\]",".overflow-hidden",".rounded-lg"],
            purpose: 'Carousel of featured products or promotions',
            contextNeeded: ["product_id","product_link"],
            contextCollection: {"search_parents":[".carousel"],"extract_fields":["product-id","product-link"],"sibling_context":[],"data_attributes":[]}
        },

        {
            name: 'CarouselNavigation',
            type: 'button',
            selectors: [".absolute",".left-4",".top-1/2",".-translate-y-1/2",".bg-white/30",".hover:bg-white/50",".text-white",".p-2",".rounded-full",".backdrop-blur-sm",".transition-colors"],
            purpose: 'Navigate to previous/next slide in carousel',
            contextNeeded: ["currentSlide"],
            contextCollection: {"search_parents":[".carousel"],"extract_fields":["currentSlide"],"sibling_context":[],"data_attributes":[]}
        },

        {
            name: 'CarouselIndicator',
            type: 'button',
            selectors: [".absolute",".bottom-4",".left-1/2",".-translate-x-1/2",".flex",".gap-2",".w-2",".h-2",".rounded-full",".transition-all"],
            purpose: 'Navigate to a specific slide in carousel',
            contextNeeded: ["currentSlide"],
            contextCollection: {"search_parents":[".carousel"],"extract_fields":["currentSlide"],"sibling_context":[],"data_attributes":[]}
        },

        {
            name: 'ProductLink',
            type: 'link',
            selectors: [".relative",".w-full",".h-full"],
            purpose: 'Navigate to product details page',
            contextNeeded: ["product_id"],
            contextCollection: {"search_parents":[".product-card","[data-product]"],"extract_fields":["product-id"],"sibling_context":[],"data_attributes":["data-product-id"]}
        },

        {
            name: 'WishlistButton',
            type: 'button',
            selectors: [".relative",".text-gray-700",".hover:text-blue-600",".transition-colors"],
            purpose: 'Add/remove product from wishlist',
            contextNeeded: ["product_id"],
            contextCollection: {"search_parents":[".product-card","[data-product]"],"extract_fields":["product-id"],"sibling_context":[],"data_attributes":["data-product-id"]}
        },

        {
            name: 'CartButton',
            type: 'button',
            selectors: [".relative",".text-gray-700",".hover:text-blue-600",".transition-colors"],
            purpose: 'Navigate to cart page',
            contextNeeded: ["itemCount"],
            contextCollection: {"search_parents":["#header"],"extract_fields":["itemCount"],"sibling_context":[],"data_attributes":[]}
        },

        {
            name: 'UserMenu',
            type: 'custom',
            selectors: [".flex",".items-center",".space-x-3"],
            purpose: 'User menu with login/logout options',
            contextNeeded: ["user","isAuthenticated"],
            contextCollection: {"search_parents":["#header"],"extract_fields":["user","isAuthenticated"],"sibling_context":[],"data_attributes":[]}
        },

        {
            name: 'MobileMenuButton',
            type: 'button',
            selectors: [".md:hidden",".text-gray-700"],
            purpose: 'Toggle mobile menu',
            contextNeeded: ["mobileMenuOpen"],
            contextCollection: {"search_parents":["#header"],"extract_fields":["mobileMenuOpen"],"sibling_context":[],"data_attributes":[]}
        }
      ];
      
      if (typeof window !== 'undefined') {
        this.setupListeners();
        this.startFlushTimer();
        this.initAutoTracking();
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

    // ============ AI-ENHANCED AUTO-TRACKING ============
    initAutoTracking() {
      console.log('🤖 AI-Enhanced Analytics initialized for test-app-rich-demo-2025-09-25-5tqqpvt9fxo');
      console.log('📊 Tracking 22 discovered components');
      console.log('🔑 User ID:', this.userId);
      
      this.trackPageView();
      this.trackAllClicks();
      this.trackFormInteractions();
      this.trackScrollDepth();
      this.trackRouteChanges();
      this.trackElementVisibility();
    }

    // Detect component using AI-discovered patterns
    detectComponent(element) {
      for (const detector of this.componentDetectors) {
        for (const selector of detector.selectors) {
          try {
            if (element.matches(selector) || element.closest(selector)) {
              return detector;
            }
          } catch (e) {
            // Invalid selector, skip
          }
        }
      }
      return null;
    }

    // Enhanced click tracking with new BUTTON_CLICK event
    trackAllClicks() {
      document.addEventListener('click', (e) => {
        const target = e.target;
        
        if (this.clickedElements.has(target)) return;
        this.clickedElements.add(target);
        setTimeout(() => this.clickedElements.delete(target), 100);
        
        // Try AI component detection first
        const componentInfo = this.detectComponent(target);
        
        // Find clickable element
        const clickable = target.closest(`
          button, [role="button"], [onclick], input[type="submit"], input[type="button"],
          [class*="button"], [class*="btn"], svg, [class*="icon"], [data-clickable],
          [style*="cursor: pointer"], a
        `);
        
        if (clickable || componentInfo) {
          const element = clickable || target;
          
          this.trackEvent('BUTTON_CLICK', {
            element_text: this.getElementText(element).slice(0, 100),
            element_id: element.id || null,
            element_type: this.getButtonType(element),
            surface: this.getSurface(element),
            page_path: window.location.pathname,
            is_primary_cta: this.isPrimaryCTA(element),
            cta_category: this.getCTACategory(element, componentInfo)
          });
        }
      }, true);
    }

    trackFormInteractions() {
      document.addEventListener('focusin', (e) => {
        const field = e.target;
        const form = field.closest('form');
        
        if (form && !this.formTracking.has(form)) {
          this.formTracking.set(form, {
            started: true,
            startTime: Date.now(),
            fieldsInteracted: new Set()
          });
          
          this.trackEvent('FORM_INTERACTION', {
            action: 'started',
            form_name: this.getFormName(form),
            form_id: form.id || null,
            form_type: this.getFormType(form),
            surface: this.getSurface(form),
            page_path: window.location.pathname,
            fields_total: form.elements ? form.elements.length : 0,
            fields_completed: 0
          });
        }
        
        if (form && this.formTracking.has(form)) {
          const tracking = this.formTracking.get(form);
          tracking.fieldsInteracted.add(field.name || field.id || field.type);
        }
      });

      document.addEventListener('submit', (e) => {
        const form = e.target;
        const tracking = this.formTracking.get(form);
        
        this.trackEvent('FORM_INTERACTION', {
          action: 'submitted',
          form_name: this.getFormName(form),
          form_id: form.id || null,
          form_type: this.getFormType(form),
          surface: this.getSurface(form),
          page_path: window.location.pathname,
          fields_total: form.elements ? form.elements.length : 0,
          fields_completed: tracking ? tracking.fieldsInteracted.size : 0
        });
        
        this.formTracking.delete(form);
      });

      // Track form abandonment
      window.addEventListener('beforeunload', () => {
        this.formTracking.forEach((tracking, form) => {
          if (tracking.started && Date.now() - tracking.startTime > 1000) {
            this.trackEvent('FORM_INTERACTION', {
              action: 'abandoned',
              form_name: this.getFormName(form),
              form_id: form.id || null,
              form_type: this.getFormType(form),
              surface: this.getSurface(form),
              page_path: window.location.pathname,
              fields_total: form.elements ? form.elements.length : 0,
              fields_completed: tracking.fieldsInteracted.size
            });
          }
        });
      });
    }

    trackElementVisibility() {
      // Track modal/popup/dialog visibility
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName === 'class' || 
               mutation.attributeName === 'style' || 
               mutation.attributeName === 'aria-hidden')) {
            
            const element = mutation.target;
            const isOverlay = this.isOverlayElement(element);
            
            if (isOverlay) {
              const isVisible = this.isElementVisible(element);
              const wasVisible = this.visibleElements.get(element);
              
              if (isVisible && !wasVisible) {
                this.visibleElements.set(element, true);
                this.trackEvent('ELEMENT_VISIBILITY', {
                  action: 'shown',
                  element_type: this.getOverlayType(element),
                  element_name: this.getElementName(element),
                  element_id: element.id || null,
                  trigger_source: 'auto_trigger',
                  page_path: window.location.pathname,
                  has_cta: this.hasCallToAction(element)
                });
              } else if (!isVisible && wasVisible) {
                this.visibleElements.set(element, false);
                this.trackEvent('ELEMENT_VISIBILITY', {
                  action: 'hidden',
                  element_type: this.getOverlayType(element),
                  element_name: this.getElementName(element),
                  element_id: element.id || null,
                  trigger_source: 'button_click',
                  page_path: window.location.pathname,
                  has_cta: this.hasCallToAction(element)
                });
              }
            }
          }
        });
      });

      observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'style', 'aria-hidden']
      });
    }

    trackScrollDepth() {
      let scrollTimer;
      
      const checkScrollDepth = () => {
        const currentY = window.scrollY;
        this.scrollDirection = currentY > this.lastScrollY ? 'down' : 'up';
        this.lastScrollY = currentY;
        
        const scrollPercent = Math.round(
          (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100
        );
        
        const milestones = [25, 50, 75, 90, 100];
        const milestone = milestones.find(m => 
          m <= scrollPercent && !this.reachedMilestones.has(m)
        );
        
        if (milestone) {
          this.reachedMilestones.add(milestone);
          this.trackEvent('SCROLL_INTERACTION', {
            action: 'depth_reached',
            depth_percentage: milestone,
            milestone: milestone + '%',
            page_path: window.location.pathname,
            direction: this.scrollDirection
          });
        }
      };
      
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(checkScrollDepth, 500);
      });
    }

    trackRouteChanges() {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        setTimeout(() => {
          this.pageContext = {};
          this.reachedMilestones.clear();
          this.trackPageView();
        }, 0);
      };
      
      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        setTimeout(() => {
          this.pageContext = {};
          this.reachedMilestones.clear();
          this.trackPageView();
        }, 0);
      };
      
      window.addEventListener('popstate', () => {
        this.pageContext = {};
        this.reachedMilestones.clear();
        this.trackPageView();
      });
    }

    // ============ HELPER METHODS ============
    getElementText(element) {
      return element.innerText || 
             element.textContent ||
             element.value ||
             element.getAttribute('aria-label') ||
             element.getAttribute('title') ||
             'Unknown';
    }

    getElementName(element) {
      return element.getAttribute('aria-label') ||
             element.getAttribute('title') ||
             element.dataset.name ||
             element.id ||
             'unnamed';
    }

    getFormName(form) {
      return form.getAttribute('name') || 
             form.getAttribute('aria-label') ||
             form.id ||
             'form';
    }

    getEntryType() {
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const navType = performance.getEntriesByType('navigation')[0];
        if (navType && navType.type) {
          switch(navType.type) {
            case 'reload': return 'reload';
            case 'back_forward': return 'back_forward';
            default: return 'navigation';
          }
        }
      }
      return 'navigation';
    }

    getSurface(element) {
      const section = element.closest('header, nav, main, footer, aside, section[data-component], [data-surface]');
      if (section) {
        return section.dataset.surface || 
               section.dataset.component ||
               section.tagName.toLowerCase();
      }
      return 'unknown';
    }

    getButtonType(element) {
      if (element.tagName === 'A') return 'link';
      if (element.querySelector('svg') || (element.className && element.className.toString().includes('icon'))) return 'icon';
      if (element.getAttribute('role') === 'tab') return 'tab';
      return 'button';
    }

    isPrimaryCTA(element) {
      const classes = (element.className || '').toString().toLowerCase();
      return classes.includes('primary') || 
             classes.includes('cta') ||
             classes.includes('hero') ||
             element.dataset.primary === 'true';
    }

    getCTACategory(element, componentInfo) {
      const text = this.getElementText(element).toLowerCase();
      const purpose = componentInfo?.purpose || '';
      
      if (text.match(/buy|purchase|checkout|cart|order/)) return 'conversion';
      if (text.match(/learn|view|browse|explore|next|previous/)) return 'navigation';
      return 'engagement';
    }

    getFormType(form) {
      const formId = (form.id || '').toLowerCase();
      const formName = (form.name || '').toLowerCase();
      const inputs = form.elements ? Array.from(form.elements) : [];
      
      if (formId.includes('checkout') || formName.includes('checkout')) return 'checkout';
      if (formId.includes('login') || formName.includes('login')) return 'login';
      if (formId.includes('signup') || formName.includes('signup')) return 'signup';
      if (formId.includes('newsletter') || inputs.length === 1) return 'newsletter';
      if (formId.includes('contact') || formName.includes('contact')) return 'contact';
      
      return 'other';
    }

    getOverlayType(element) {
      const role = element.getAttribute('role');
      const classes = (element.className || '').toString().toLowerCase();
      
      if (role === 'dialog' || classes.includes('modal')) return 'modal';
      if (classes.includes('popup')) return 'popup';
      if (classes.includes('drawer')) return 'drawer';
      if (classes.includes('tooltip')) return 'tooltip';
      if (classes.includes('dropdown')) return 'dropdown';
      if (classes.includes('toast')) return 'toast';
      
      return 'unknown';
    }

    isOverlayElement(element) {
      const role = element.getAttribute('role');
      const classes = (element.className || '').toString().toLowerCase();
      
      return role === 'dialog' ||
             classes.includes('modal') ||
             classes.includes('popup') ||
             classes.includes('drawer') ||
             classes.includes('overlay') ||
             classes.includes('tooltip') ||
             classes.includes('dropdown') ||
             classes.includes('toast');
    }

    isElementVisible(element) {
      const style = window.getComputedStyle(element);
      const ariaHidden = element.getAttribute('aria-hidden');
      
      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             style.opacity !== '0' &&
             ariaHidden !== 'true' &&
             element.offsetParent !== null;
    }

    hasCallToAction(element) {
      return element.querySelector('button, a[href], [role="button"]') !== null;
    }

    // ============ CORE METHODS WITH NEW SCHEMA ============
    generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    trackEvent(eventType, data = {}) {
      // All 6 base fields are REQUIRED and NEVER null
      const event = {
        id: this.generateUUID(),                  // Always generated, never null
        ts: Math.floor(Date.now() / 1000),       // Unix timestamp, never null
        app_key: this.config.appKey,             // From config, never null
        session_id: this.sessionId,              // Generated on init, never null
        user_id: this.userId,                    // Generated/retrieved on init, never null
        event_type: eventType,                   // Passed parameter, never null
        data: data                               // Event-specific data object
      };
      
      this.eventQueue.push(event);
      
      if (this.eventQueue.length >= this.config.batchSize) {
        this.flush();
      }
    }

    trackPageView(page) {
      this.maxScrollDepth = 0;
      this.pageLoadTime = Date.now();
      
      this.trackEvent('PAGE_VIEW', {
        url: page?.url || window.location.href,
        path: window.location.pathname,
        title: page?.title || document.title,
        referrer: document.referrer || null,
        is_first_view: !this.hasViewedPage,
        entry_type: this.getEntryType()
      });
      
      this.hasViewedPage = true;
    }

    identify(userId, traits = {}) {
      // Update the user ID if explicitly identified
      if (userId) {
        this.userId = userId;
        this.userIdGenerator.saveToStorage(userId);
      }
      // Note: identify events are not part of the new schema, 
      // but keeping for backwards compatibility
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
        this.eventQueue.unshift(...batch);
      });
    }
  }

  // Auto-initialize
  if (typeof window !== 'undefined' && !window.analytics) {
    window.analytics = new AnalyticsTracker();
    console.log('✅ AI-Enhanced Analytics tracker with new event schema initialized');
  }

  return AnalyticsTracker;
}));