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
    constructor(appKey) {
      // ✅ MULTI-TENANCY: Include app_key in storage key for isolation
      // This ensures that multiple apps on the same domain have separate user IDs
      this.appKey = appKey;
      this.STORAGE_KEY = 'analytics_user_id_' + appKey;
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
      // 🎯 ANALYTICS ENDPOINT
      // This tracker connects to the analytics service.
      // Each app is identified by its unique app_key.
      this.config = {
        appKey: 'demo-test-apps-2025-10-15-ido8ggbdcsl',
        endpoint: 'https://analytics-service-production-0f0c.up.railway.app/ingest/analytics',
        batchSize: 10,
        flushInterval: 10000  // Reduced to 10 seconds for faster event delivery
      };
      
      // Privacy controls
      this.disabled = false;
      
      // Check Do Not Track
      if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') {
        console.log('📵 Analytics disabled: Do Not Track enabled');
        this.disabled = true;
        return;
      }
      
      // Check consent
      try {
        this.hasConsent = localStorage.getItem('analytics_consent_' + this.config.appKey) === 'true';
        
        // Auto-accept for test app (remove in production or prompt user)
        if (!this.hasConsent) {
          localStorage.setItem('analytics_consent_' + this.config.appKey, 'true');
          this.hasConsent = true;
          console.log('✅ Analytics consent: auto-accepted for test');
        }
      } catch (e) {
        this.hasConsent = false;
      }
      
      if (!this.hasConsent) {
        console.log('🚫 Analytics disabled: No consent');
        this.disabled = true;
        return;
      }
      
      this.eventQueue = [];
      this.sessionId = this.getOrCreateSession();
      this.userIdGenerator = new UserIdGenerator(this.config.appKey);
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
      
      // Performance optimization: cache selector matches
      this.selectorCache = new WeakMap();
      
      // AI-discovered component patterns
      this.componentDetectors = [
        {
            name: 'CheckoutStepContinue',
            type: 'button',
            pattern_type: 'multi_step_flow',
            selectors: ["button[type='button']"],
            purpose: 'Continue to payment step',
            contextNeeded: ["plan","billing_cycle","amount","step"],
            context_collection: {"strategy":"global_context","scope_selector":"body","fields":[{"field_name":"plan","selector":"body","extraction_method":"data-attribute","data_type":"string","attribute_name":"searchParams.plan","required":true,"description":"Selected plan type"},{"field_name":"billing_cycle","selector":"body","extraction_method":"data-attribute","data_type":"string","attribute_name":"searchParams.cycle","required":true,"description":"Monthly or annual billing"},{"field_name":"step","selector":"body","extraction_method":"data-attribute","data_type":"number","required":true,"description":"Current checkout step"}],"state_tracking":{"track_previous_value":true,"track_change_delta":false,"track_timing":true},"fallback_sources":["URL parameters"]},
            relationships: {"triggers":["checkout_step_viewed"],"affects":["step state"],"depends_on":["plan selection"]}
        },

        {
            name: 'CheckoutPaymentForm',
            type: 'form',
            pattern_type: 'form_submission,multi_step_flow',
            selectors: ["form"],
            purpose: 'Submit payment details',
            contextNeeded: ["card_number","expiry","cvv","cardholder_name","billing_address","city","state","zip","plan","billing_cycle","total"],
            context_collection: {"strategy":"form_state","scope_selector":"form","fields":[{"field_name":"card_number","selector":"input[name='cardNumber']","extraction_method":"value","data_type":"string","required":true,"description":"Credit card number"},{"field_name":"expiry","selector":"input[name='expiry']","extraction_method":"value","data_type":"string","required":true,"description":"Card expiration date"},{"field_name":"cvv","selector":"input[name='cvv']","extraction_method":"value","data_type":"string","required":true,"description":"Card CVV code"},{"field_name":"cardholder_name","selector":"input[name='cardholderName']","extraction_method":"value","data_type":"string","required":true,"description":"Name on card"},{"field_name":"billing_address","selector":"input[name='billingAddress']","extraction_method":"value","data_type":"string","required":true,"description":"Billing street address"},{"field_name":"city","selector":"input[name='city']","extraction_method":"value","data_type":"string","required":true,"description":"Billing city"},{"field_name":"state","selector":"input[name='state']","extraction_method":"value","data_type":"string","required":true,"description":"Billing state"},{"field_name":"zip","selector":"input[name='zip']","extraction_method":"value","data_type":"string","required":true,"description":"Billing ZIP code"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":true},"fallback_sources":[]},
            relationships: {"triggers":["checkout_completed"],"affects":["subscription status"],"depends_on":["plan selection","step 1 completion"]}
        },

        {
            name: 'CheckoutSuccessGetStarted',
            type: 'button',
            pattern_type: 'modal_lifecycle',
            selectors: ["button"],
            purpose: 'Navigate to dashboard after upgrade',
            contextNeeded: ["upgrade_completed"],
            context_collection: {"strategy":"global_context","scope_selector":"body","fields":[{"field_name":"page_type","selector":"body","extraction_method":"data-attribute","data_type":"string","required":true,"description":"Success page identifier"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":false},"fallback_sources":[]},
            relationships: {"triggers":["upgrade_success_viewed"],"affects":["navigation"],"depends_on":["checkout completion"]}
        },

        {
            name: 'CreateProjectForm',
            type: 'form',
            pattern_type: 'form_submission',
            selectors: ["form"],
            purpose: 'Create new project',
            contextNeeded: ["name","description","workspace_id"],
            context_collection: {"strategy":"form_state","scope_selector":"form","fields":[{"field_name":"name","selector":"input[name='name']","extraction_method":"value","data_type":"string","required":true,"description":"Project name"},{"field_name":"description","selector":"textarea[name='description']","extraction_method":"value","data_type":"string","required":false,"description":"Project description"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":true},"fallback_sources":[]},
            relationships: {"triggers":["created_project"],"affects":["project list"],"depends_on":["workspace membership"]}
        },

        {
            name: 'CreateTaskButton',
            type: 'button',
            pattern_type: 'modal_lifecycle',
            selectors: ["button"],
            purpose: 'Open create task modal',
            contextNeeded: ["project_id"],
            context_collection: {"strategy":"global_context","scope_selector":"body","fields":[{"field_name":"project_id","selector":"body","extraction_method":"data-attribute","data_type":"string","required":true,"description":"Current project ID"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":false},"fallback_sources":["URL params"]},
            relationships: {"triggers":["modal open"],"affects":["modal visibility"],"depends_on":["project context"]}
        },

        {
            name: 'CreateTaskForm',
            type: 'form',
            pattern_type: 'form_submission,modal_lifecycle',
            selectors: ["form"],
            purpose: 'Create new task',
            contextNeeded: ["title","description","priority","assigned_to","due_date","project_id"],
            context_collection: {"strategy":"modal_scope","scope_selector":"[role='dialog']","fields":[{"field_name":"title","selector":"input[name='title']","extraction_method":"value","data_type":"string","required":true,"description":"Task title"},{"field_name":"description","selector":"textarea[name='description']","extraction_method":"value","data_type":"string","required":false,"description":"Task description"},{"field_name":"priority","selector":"select[name='priority']","extraction_method":"value","data_type":"string","required":true,"description":"Task priority level"},{"field_name":"assigned_to","selector":"select[name='assigned_to']","extraction_method":"value","data_type":"string","required":false,"description":"Assigned team member ID"},{"field_name":"due_date","selector":"input[type='date']","extraction_method":"value","data_type":"string","required":false,"description":"Task due date"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":true},"fallback_sources":[]},
            relationships: {"triggers":["created_task"],"affects":["task list"],"depends_on":["project context"]}
        },

        {
            name: 'TaskStatusDropdown',
            type: 'select',
            pattern_type: 'toggle_state,item_selection',
            selectors: ["select"],
            purpose: 'Change task status',
            contextNeeded: ["task_id","previous_status","new_status"],
            context_collection: {"strategy":"parent_data","scope_selector":"[data-task-id]","fields":[{"field_name":"task_id","selector":"[data-task-id]","extraction_method":"data-attribute","data_type":"string","attribute_name":"data-task-id","required":true,"description":"Task identifier"},{"field_name":"previous_status","selector":"select","extraction_method":"value","data_type":"string","required":true,"description":"Status before change"},{"field_name":"new_status","selector":"select","extraction_method":"value","data_type":"string","required":true,"description":"Status after change"}],"state_tracking":{"track_previous_value":true,"track_change_delta":true,"track_timing":true},"fallback_sources":[]},
            relationships: {"triggers":["task status change"],"affects":["task state"],"depends_on":["task context"]}
        },

        {
            name: 'TaskActionMenu',
            type: 'button',
            pattern_type: 'item_selection',
            selectors: ["button[aria-haspopup='menu']"],
            purpose: 'Open task actions menu',
            contextNeeded: ["task_id"],
            context_collection: {"strategy":"parent_data","scope_selector":"[data-task-id]","fields":[{"field_name":"task_id","selector":"[data-task-id]","extraction_method":"data-attribute","data_type":"string","attribute_name":"data-task-id","required":true,"description":"Task identifier"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":false},"fallback_sources":[]},
            relationships: {"triggers":["menu open"],"affects":["dropdown visibility"],"depends_on":["task context"]}
        },

        {
            name: 'EditTaskMenuItem',
            type: 'button',
            pattern_type: 'modal_lifecycle,item_selection',
            selectors: ["[role='menuitem']"],
            purpose: 'Open edit task modal',
            contextNeeded: ["task_id"],
            context_collection: {"strategy":"parent_data","scope_selector":"[data-task-id]","fields":[{"field_name":"task_id","selector":"[data-task-id]","extraction_method":"data-attribute","data_type":"string","attribute_name":"data-task-id","required":true,"description":"Task to edit"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":false},"fallback_sources":[]},
            relationships: {"triggers":["edit modal open"],"affects":["modal state"],"depends_on":["task selection"]}
        },

        {
            name: 'DeleteTaskMenuItem',
            type: 'button',
            pattern_type: 'item_selection',
            selectors: ["[role='menuitem']"],
            purpose: 'Delete task',
            contextNeeded: ["task_id","task_title"],
            context_collection: {"strategy":"parent_data","scope_selector":"[data-task-id]","fields":[{"field_name":"task_id","selector":"[data-task-id]","extraction_method":"data-attribute","data_type":"string","attribute_name":"data-task-id","required":true,"description":"Task to delete"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":false},"fallback_sources":[]},
            relationships: {"triggers":["task deleted"],"affects":["task list"],"depends_on":["task selection"]}
        },

        {
            name: 'ProjectCard',
            type: 'link',
            pattern_type: 'item_selection',
            selectors: ["a[href*='/dashboard/projects/']"],
            purpose: 'Navigate to project detail',
            contextNeeded: ["project_id","project_name"],
            context_collection: {"strategy":"parent_data","scope_selector":"[data-project-id]","fields":[{"field_name":"project_id","selector":"a","extraction_method":"data-attribute","data_type":"string","attribute_name":"href","required":true,"description":"Project ID from URL"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":false},"fallback_sources":["href attribute"]},
            relationships: {"triggers":["project viewed"],"affects":["navigation"],"depends_on":["project list"]}
        },

        {
            name: 'InviteTeamMemberButton',
            type: 'button',
            pattern_type: 'modal_lifecycle',
            selectors: ["button"],
            purpose: 'Open invite member modal',
            contextNeeded: ["workspace_id"],
            context_collection: {"strategy":"global_context","scope_selector":"body","fields":[{"field_name":"workspace_id","selector":"body","extraction_method":"data-attribute","data_type":"string","required":true,"description":"Current workspace"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":false},"fallback_sources":[]},
            relationships: {"triggers":["invite modal open"],"affects":["modal visibility"],"depends_on":["workspace context"]}
        },

        {
            name: 'InviteMemberForm',
            type: 'form',
            pattern_type: 'form_submission,modal_lifecycle',
            selectors: ["form"],
            purpose: 'Send team invitation',
            contextNeeded: ["email","workspace_id"],
            context_collection: {"strategy":"modal_scope","scope_selector":"[role='dialog']","fields":[{"field_name":"email","selector":"input[type='email']","extraction_method":"value","data_type":"string","required":true,"description":"Invitee email address"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":true},"fallback_sources":[]},
            relationships: {"triggers":["invited_member"],"affects":["team list","invitations"],"depends_on":["workspace membership"]}
        },

        {
            name: 'RemoveMemberMenuItem',
            type: 'button',
            pattern_type: 'item_selection',
            selectors: ["[role='menuitem']"],
            purpose: 'Remove team member',
            contextNeeded: ["user_id","workspace_id"],
            context_collection: {"strategy":"parent_data","scope_selector":"[data-user-id]","fields":[{"field_name":"user_id","selector":"[data-user-id]","extraction_method":"data-attribute","data_type":"string","attribute_name":"data-user-id","required":true,"description":"Member to remove"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":false},"fallback_sources":[]},
            relationships: {"triggers":["member removed"],"affects":["team list"],"depends_on":["member selection"]}
        },

        {
            name: 'SettingsTabs',
            type: 'tab',
            pattern_type: 'tab_switch',
            selectors: ["[role='tab']"],
            purpose: 'Switch settings section',
            contextNeeded: ["previous_tab","new_tab","unsaved_changes"],
            context_collection: {"strategy":"sibling_state","scope_selector":"[role='tablist']","fields":[{"field_name":"previous_tab","selector":"[role='tab'][aria-selected='true']","extraction_method":"data-attribute","data_type":"string","attribute_name":"data-value","required":true,"description":"Previously active tab"},{"field_name":"new_tab","selector":"[role='tab']","extraction_method":"data-attribute","data_type":"string","attribute_name":"data-value","required":true,"description":"Newly selected tab"}],"state_tracking":{"track_previous_value":true,"track_change_delta":false,"track_timing":false},"fallback_sources":[]},
            relationships: {"triggers":["tab switched"],"affects":["visible content"],"depends_on":["form state"]}
        },

        {
            name: 'SaveProfileButton',
            type: 'button',
            pattern_type: 'form_submission',
            selectors: ["button[type='submit']"],
            purpose: 'Save profile changes',
            contextNeeded: ["full_name","email"],
            context_collection: {"strategy":"form_state","scope_selector":"form","fields":[{"field_name":"full_name","selector":"input[name='fullName']","extraction_method":"value","data_type":"string","required":true,"description":"User full name"},{"field_name":"email","selector":"input[type='email']","extraction_method":"value","data_type":"string","required":true,"description":"User email"}],"state_tracking":{"track_previous_value":true,"track_change_delta":true,"track_timing":true},"fallback_sources":[]},
            relationships: {"triggers":["updated_settings"],"affects":["profile data"],"depends_on":["form validation"]}
        },

        {
            name: 'NotificationToggles',
            type: 'toggle',
            pattern_type: 'toggle_state',
            selectors: ["button[role='switch']"],
            purpose: 'Toggle notification preferences',
            contextNeeded: ["setting_name","previous_state","new_state"],
            context_collection: {"strategy":"component_props","scope_selector":"button[role='switch']","fields":[{"field_name":"setting_name","selector":"button[role='switch']","extraction_method":"data-attribute","data_type":"string","attribute_name":"data-setting","required":true,"description":"Notification setting identifier"},{"field_name":"previous_state","selector":"button[role='switch']","extraction_method":"aria-attribute","data_type":"boolean","attribute_name":"aria-checked","required":true,"description":"State before toggle"},{"field_name":"new_state","selector":"button[role='switch']","extraction_method":"aria-attribute","data_type":"boolean","attribute_name":"aria-checked","required":true,"description":"State after toggle"}],"state_tracking":{"track_previous_value":true,"track_change_delta":true,"track_timing":false},"fallback_sources":[]},
            relationships: {"triggers":["preference changed"],"affects":["notification settings"],"depends_on":["user preferences"]}
        },

        {
            name: 'UpgradeToPremiumButton',
            type: 'button',
            pattern_type: 'modal_lifecycle',
            selectors: ["button","a[href='/pricing']"],
            purpose: 'Navigate to pricing page',
            contextNeeded: ["source_page","workspace_plan"],
            context_collection: {"strategy":"global_context","scope_selector":"body","fields":[{"field_name":"source_page","selector":"body","extraction_method":"data-attribute","data_type":"string","required":true,"description":"Page where upgrade clicked"},{"field_name":"current_plan","selector":"body","extraction_method":"data-attribute","data_type":"string","required":true,"description":"Current subscription plan"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":false},"fallback_sources":["URL path"]},
            relationships: {"triggers":["upgrade_clicked"],"affects":["navigation"],"depends_on":["workspace plan"]}
        },

        {
            name: 'ManageSubscriptionButton',
            type: 'button',
            pattern_type: 'item_selection',
            selectors: ["button"],
            purpose: 'Manage billing subscription',
            contextNeeded: ["workspace_id","current_plan","billing_cycle"],
            context_collection: {"strategy":"global_context","scope_selector":"body","fields":[{"field_name":"current_plan","selector":"body","extraction_method":"data-attribute","data_type":"string","required":true,"description":"Active subscription plan"},{"field_name":"billing_cycle","selector":"body","extraction_method":"data-attribute","data_type":"string","required":true,"description":"Monthly or annual"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":false},"fallback_sources":[]},
            relationships: {"triggers":["manage_subscription_clicked"],"affects":["billing portal"],"depends_on":["subscription status"]}
        },

        {
            name: 'DownloadInvoiceButton',
            type: 'button',
            pattern_type: 'item_selection',
            selectors: ["button"],
            purpose: 'Download invoice PDF',
            contextNeeded: ["invoice_id","invoice_date","amount"],
            context_collection: {"strategy":"parent_data","scope_selector":"[data-invoice-id]","fields":[{"field_name":"invoice_id","selector":"[data-invoice-id]","extraction_method":"data-attribute","data_type":"string","attribute_name":"data-invoice-id","required":true,"description":"Invoice identifier"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":false},"fallback_sources":[]},
            relationships: {"triggers":["invoice_downloaded"],"affects":["download"],"depends_on":["invoice data"]}
        },

        {
            name: 'BackButton',
            type: 'link',
            pattern_type: 'item_selection',
            selectors: ["a","button"],
            purpose: 'Navigate back',
            contextNeeded: ["source_page","destination"],
            context_collection: {"strategy":"global_context","scope_selector":"body","fields":[{"field_name":"source_page","selector":"body","extraction_method":"data-attribute","data_type":"string","required":true,"description":"Current page path"}],"state_tracking":{"track_previous_value":false,"track_change_delta":false,"track_timing":false},"fallback_sources":["URL"]},
            relationships: {"triggers":["navigation"],"affects":["page view"],"depends_on":["navigation history"]}
        }
      ];
      
      // Load persisted events from previous session
      this.loadQueueFromStorage();
      
      if (typeof window !== 'undefined') {
        this.setupListeners();
        this.startFlushTimer();
        this.initAutoTracking();
        
        // Save queue on page unload
        window.addEventListener('beforeunload', () => this.saveQueueToStorage());
      }
    }
    
    // Privacy: Opt out of tracking
    optOut() {
      try {
        localStorage.removeItem('analytics_user_id_' + this.config.appKey);
        localStorage.removeItem('analytics_consent_' + this.config.appKey);
        this.disabled = true;
        this.eventQueue = [];
        console.log('📵 Analytics: Opted out');
      } catch (e) {
        console.error('Failed to opt out:', e);
      }
    }
    
    // Offline persistence: Save queue to localStorage
    saveQueueToStorage() {
      if (this.eventQueue.length === 0) return;
      
      try {
        const queueKey = 'analytics_queue_' + this.config.appKey;
        localStorage.setItem(queueKey, JSON.stringify(this.eventQueue));
        console.debug('💾 Saved', this.eventQueue.length, 'events to storage');
      } catch (e) {
        console.debug('Failed to save queue:', e);
      }
    }
    
    // Offline persistence: Load queue from localStorage
    loadQueueFromStorage() {
      try {
        const queueKey = 'analytics_queue_' + this.config.appKey;
        const saved = localStorage.getItem(queueKey);
        if (saved) {
          const parsedQueue = JSON.parse(saved);
          this.eventQueue = parsedQueue;
          localStorage.removeItem(queueKey);
          console.log('📦 Restored', parsedQueue.length, 'events from storage');
          
          // Flush restored events immediately
          if (this.eventQueue.length > 0) {
            setTimeout(() => this.flush(), 1000);
          }
        }
      } catch (e) {
        console.debug('Failed to load queue:', e);
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
      console.log('[demo-test-apps-2025-10-15-ido8ggbdcsl] 🤖 AI-Enhanced Analytics initialized');
      console.log('[demo-test-apps-2025-10-15-ido8ggbdcsl] 📊 Tracking 21 discovered components');
      console.log('[demo-test-apps-2025-10-15-ido8ggbdcsl] 🔑 User ID:', this.userId);
      console.log('[demo-test-apps-2025-10-15-ido8ggbdcsl] 📍 Session ID:', this.sessionId);
      
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

    // ============ ENHANCED CONTEXT EXTRACTION SYSTEM ============
    extractContext(element, componentInfo) {
      const context = {};
      
      // If no AI pattern matched, use smart fallbacks
      if (!componentInfo || !componentInfo.context_collection) {
        // Fallback 1: Extract from nearest form
        const form = element.closest('form');
        if (form) {
          context.form_action = this.inferFormAction(form);
          const formData = this.getFormFieldValues(form);
          Object.assign(context, formData);
        }
        
        // Fallback 2: Extract from URL parameters
        const urlParams = this.getURLParams();
        if (Object.keys(urlParams).length > 0) {
          Object.assign(context, urlParams);
        }
        
        // Fallback 3: Extract from page-level data attributes
        if (document.body.dataset.pageType) {
          context.page_type = document.body.dataset.pageType;
        } else {
          context.page_type = this.inferPageType();
        }
        
        // Fallback 4: Extract from nearest container with data attributes
        const container = element.closest('[data-item-id], [data-task-id], [data-project-id], [data-id]');
        if (container) {
          for (const attr of container.attributes) {
            if (attr.name.startsWith('data-')) {
              const key = attr.name.replace('data-', '');
              context[key] = attr.value;
            }
          }
        }
        
        return context;
      }
      
      // Use AI-discovered pattern for extraction
      const scope = this.findContextScope(element, componentInfo.context_collection.scope_selector);
      if (!scope) return context;
      
      // Extract configured fields
      for (const fieldConfig of componentInfo.context_collection.fields) {
        try {
          const value = this.extractFieldValue(scope, fieldConfig);
          if (value !== null && value !== undefined) {
            context[fieldConfig.field_name] = value;
            
            // Track previous value if configured
            if (componentInfo.context_collection.state_tracking?.track_previous_value) {
              const prevValue = this.getPreviousValue(scope, fieldConfig);
              if (prevValue !== null) {
                context[fieldConfig.field_name + '_previous'] = prevValue;
              }
            }
          }
        } catch (error) {
          console.debug(`[demo-test-apps-2025-10-15-ido8ggbdcsl] Context extraction failed for ${fieldConfig.field_name}`, error);
        }
      }
      
      // Add timing if configured
      if (componentInfo.context_collection.state_tracking?.track_timing) {
        context._interaction_timestamp = Date.now();
      }
      
      // Always add page type and URL params as supplementary context
      context.page_type = context.page_type || this.inferPageType();
      const urlParams = this.getURLParams();
      if (Object.keys(urlParams).length > 0) {
        context.url_params = urlParams;
      }
      
      return context;
    }

    findContextScope(element, scopeSelector) {
      if (!scopeSelector) return element;
      
      // Try exact scope first
      let scope = element.closest(scopeSelector);
      if (scope) return scope;
      
      // Fallback to common patterns
      return element.closest('form') ||
             element.closest('[role="dialog"]') ||
             element.closest('[data-form]') ||
             element.closest('[data-component]') ||
             element.closest('[data-item-id]') ||
             element.closest('tr') ||
             element.closest('li') ||
             element.closest('section') ||
             element;
    }

    extractFieldValue(scope, fieldConfig) {
      let targetElement;
      
      // Handle special 'count' extraction
      if (fieldConfig.extraction_method === 'count') {
        const elements = scope.querySelectorAll(fieldConfig.selector);
        return elements.length;
      }
      
      targetElement = scope.querySelector(fieldConfig.selector);
      if (!targetElement) return null;
      
      switch (fieldConfig.extraction_method) {
        case 'value':
          return this.coerceType(targetElement.value, fieldConfig.data_type);
        
        case 'checked':
          if (fieldConfig.data_type === 'array') {
            // Multiple checkboxes - collect all checked values
            const checked = scope.querySelectorAll(fieldConfig.selector + ':checked');
            const values = Array.from(checked).map(el => {
              return fieldConfig.attribute_name ? 
                el.getAttribute(fieldConfig.attribute_name) : 
                el.value;
            });
            return values;
          }
          return targetElement.checked;
        
        case 'textContent':
          return targetElement.textContent.trim();
        
        case 'data-attribute':
          const attrName = fieldConfig.attribute_name || 'data-value';
          return this.coerceType(
            targetElement.getAttribute(attrName), 
            fieldConfig.data_type
          );
        
        case 'aria-attribute':
          const ariaAttr = 'aria-' + (fieldConfig.attribute_name || 'value');
          return targetElement.getAttribute(ariaAttr);
        
        case 'class-state':
          // Extract state from class names
          const classes = Array.from(targetElement.classList);
          if (fieldConfig.attribute_name) {
            // Look for specific class pattern
            const pattern = new RegExp(fieldConfig.attribute_name);
            const match = classes.find(c => pattern.test(c));
            return match || null;
          }
          return classes.join(' ');
        
        case 'computed-style':
          const style = window.getComputedStyle(targetElement);
          return style[fieldConfig.attribute_name || 'display'];
        
        default:
          return targetElement.value || targetElement.textContent;
      }
    }

    getPreviousValue(scope, fieldConfig) {
      const el = scope.querySelector(fieldConfig.selector);
      if (!el) return null;
      
      // Check for data-previous-value attribute
      const prevAttr = el.getAttribute('data-previous-value');
      if (prevAttr) return this.coerceType(prevAttr, fieldConfig.data_type);
      
      // Check for aria-valuenow vs aria-valuemin (state change)
      const ariaNow = el.getAttribute('aria-valuenow');
      if (ariaNow) return this.coerceType(ariaNow, fieldConfig.data_type);
      
      return null;
    }

    coerceType(value, dataType) {
      if (value === null || value === undefined) return value;
      if (!dataType) return value;
      
      switch (dataType) {
        case 'number':
          const num = Number(value);
          return isNaN(num) ? null : num;
        case 'boolean':
          return value === 'true' || value === true || value === '1';
        case 'array':
          return Array.isArray(value) ? value : [value];
        case 'object':
          try {
            return typeof value === 'string' ? JSON.parse(value) : value;
          } catch {
            return value;
          }
        default:
          return String(value);
      }
    }

    // ============ SMART CONTEXT FALLBACK HELPERS ============
    
    inferPageType() {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/pricing')) return 'pricing';
      if (path.includes('/checkout')) return 'checkout';
      if (path.includes('/dashboard')) return 'dashboard';
      if (path.includes('/settings')) return 'settings';
      if (path.includes('/team')) return 'team';
      if (path.includes('/projects')) return 'projects';
      if (path.includes('/tasks')) return 'tasks';
      if (path.includes('/activity')) return 'activity';
      if (path.includes('/billing')) return 'billing';
      if (path === '/' || path === '') return 'home';
      return 'other';
    }
    
    getURLParams() {
      const params = {};
      try {
        const urlParams = new URLSearchParams(window.location.search);
        for (const [key, value] of urlParams) {
          params[key] = value;
        }
      } catch (e) {
        console.debug('Failed to parse URL params:', e);
      }
      return params;
    }
    
    inferFormAction(form) {
      // Try to infer action from form attributes
      if (form.action && form.action !== window.location.href) {
        const actionPath = new URL(form.action, window.location.origin).pathname;
        if (actionPath.includes('project')) return 'create_project';
        if (actionPath.includes('task')) return 'create_task';
        if (actionPath.includes('checkout')) return 'checkout';
        if (actionPath.includes('payment')) return 'payment';
        if (actionPath.includes('invite')) return 'invite_team';
        if (actionPath.includes('settings')) return 'update_settings';
        return actionPath;
      }
      
      // Infer from form ID or name
      const formId = (form.id || form.name || '').toLowerCase();
      if (formId.includes('project')) return 'create_project';
      if (formId.includes('task')) return 'create_task';
      if (formId.includes('checkout')) return 'checkout';
      if (formId.includes('payment')) return 'payment';
      if (formId.includes('invite')) return 'invite_team';
      if (formId.includes('login')) return 'login';
      if (formId.includes('signup')) return 'signup';
      if (formId.includes('settings')) return 'update_settings';
      
      // Infer from submit button text
      const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitButton) {
        const buttonText = (submitButton.textContent || submitButton.value || '').toLowerCase();
        if (buttonText.includes('project')) return 'create_project';
        if (buttonText.includes('task')) return 'create_task';
        if (buttonText.includes('checkout') || buttonText.includes('pay')) return 'checkout';
        if (buttonText.includes('invite')) return 'invite_team';
        if (buttonText.includes('save')) return 'save_changes';
      }
      
      return 'form_submit';
    }
    
    getFormFieldValues(form) {
      const data = {};
      
      try {
        const formData = new FormData(form);
        for (const [key, value] of formData) {
          // Skip empty values and passwords
          if (!value || key.toLowerCase().includes('password')) continue;
          
          // Sanitize sensitive fields
          if (key.toLowerCase().includes('card') || key.toLowerCase().includes('cvv')) {
            data[key] = '[REDACTED]';
          } else if (key.toLowerCase().includes('email')) {
            // Anonymize email
            data[key] = this.anonymizeEmail(value);
          } else {
            // Truncate long values
            data[key] = String(value).slice(0, 100);
          }
        }
      } catch (e) {
        console.debug('Failed to extract form data:', e);
      }
      
      return data;
    }
    
    anonymizeEmail(email) {
      try {
        const [local, domain] = email.split('@');
        if (!domain) return '[EMAIL]';
        const maskedLocal = local.charAt(0) + '***' + local.charAt(local.length - 1);
        return maskedLocal + '@' + domain;
      } catch {
        return '[EMAIL]';
      }
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
          
          // Extract rich context using pattern-based extraction
          const contextData = componentInfo ? this.extractContext(element, componentInfo) : {};
          
          this.trackEvent('BUTTON_CLICK', {
            element_text: this.getElementText(element).slice(0, 100),
            element_id: element.id || null,
            element_type: this.getButtonType(element),
            surface: this.getSurface(element),
            page_path: window.location.pathname,
            is_primary_cta: this.isPrimaryCTA(element),
            cta_category: this.getCTACategory(element, componentInfo),
            pattern_type: componentInfo?.pattern_type || null,
            context: contextData
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
        
        // If form is inside a modal, also track MODAL_INTERACTION with submitted action
        const modal = form.closest('[role="dialog"]') || 
                      form.closest('.modal') || 
                      form.closest('[data-modal]') ||
                      form.closest('[class*="modal"]');
        
        if (modal) {
          const componentInfo = this.detectComponent(modal);
          const context = componentInfo ? this.extractContext(modal, componentInfo) : {};
          
          this.trackEvent('MODAL_INTERACTION', {
            action: 'submitted',
            modal_name: this.getElementName(modal),
            modal_id: modal.id || null,
            trigger_source: 'button_click',
            page_path: window.location.pathname,
            context: context
          });
        }
        
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
      // Track modal/popup/dialog visibility with debouncing for performance
      let mutationTimer;
      const debouncedHandler = (mutations) => {
        clearTimeout(mutationTimer);
        mutationTimer = setTimeout(() => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName === 'class' || 
               mutation.attributeName === 'style' || 
                 mutation.attributeName === 'aria-hidden' ||
                 mutation.attributeName === 'data-state')) {
            
            const element = mutation.target;
            const isOverlay = this.isOverlayElement(element);
            
            if (isOverlay) {
              const isVisible = this.isElementVisible(element);
              const wasVisible = this.visibleElements.get(element);
                const overlayType = this.getOverlayType(element);
                const isModal = overlayType === 'modal' || element.getAttribute('role') === 'dialog';
              
              if (isVisible && !wasVisible) {
                this.visibleElements.set(element, true);
                
                // Use MODAL_INTERACTION for modals, ELEMENT_VISIBILITY for others
                if (isModal) {
                  const componentInfo = this.detectComponent(element);
                  const context = componentInfo ? this.extractContext(element, componentInfo) : {};
                  
                  this.trackEvent('MODAL_INTERACTION', {
                    action: 'opened',
                    modal_name: this.getElementName(element),
                    modal_id: element.id || null,
                    trigger_source: 'button_click',
                    page_path: window.location.pathname,
                    context: context
                  });
                } else {
                this.trackEvent('ELEMENT_VISIBILITY', {
                  action: 'shown',
                    element_type: overlayType,
                  element_name: this.getElementName(element),
                  element_id: element.id || null,
                  trigger_source: 'auto_trigger',
                  page_path: window.location.pathname,
                  has_cta: this.hasCallToAction(element)
                });
                }
              } else if (!isVisible && wasVisible) {
                this.visibleElements.set(element, false);
                
                // Use MODAL_INTERACTION for modals, ELEMENT_VISIBILITY for others
                if (isModal) {
                  const componentInfo = this.detectComponent(element);
                  const context = componentInfo ? this.extractContext(element, componentInfo) : {};
                  
                  this.trackEvent('MODAL_INTERACTION', {
                    action: 'closed',
                    modal_name: this.getElementName(element),
                    modal_id: element.id || null,
                    trigger_source: 'button_click',
                    page_path: window.location.pathname,
                    context: context
                  });
                } else {
                this.trackEvent('ELEMENT_VISIBILITY', {
                  action: 'hidden',
                    element_type: overlayType,
                  element_name: this.getElementName(element),
                  element_id: element.id || null,
                  trigger_source: 'button_click',
                  page_path: window.location.pathname,
                  has_cta: this.hasCallToAction(element)
                });
                }
              }
            }
          }
        });
        }, 50);  // 50ms debounce
      };
      
      const observer = new MutationObserver(debouncedHandler);

      observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'style', 'aria-hidden', 'data-state']
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
      // Check if tracking is disabled
      if (this.disabled) return;
      
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
      })
      .then(response => {
        if (!response.ok) {
          console.error('[demo-test-apps-2025-10-15-ido8ggbdcsl] Analytics flush failed:', response.status);
          // Re-add to queue and persist on failure
        this.eventQueue.unshift(...batch);
          this.saveQueueToStorage();
        } else {
          console.debug('[demo-test-apps-2025-10-15-ido8ggbdcsl] Flushed', batch.length, 'events');
        }
      })
      .catch(err => {
        console.error('[demo-test-apps-2025-10-15-ido8ggbdcsl] Analytics flush error:', err);
        // Re-add to queue and persist on failure
        this.eventQueue.unshift(...batch);
        this.saveQueueToStorage();
      });
    }
  }

  // Auto-initialize
  if (typeof window !== 'undefined' && !window.analytics) {
    window.analytics = new AnalyticsTracker();
    console.log('[demo-test-apps-2025-10-15-ido8ggbdcsl] ✅ AI-Enhanced Analytics tracker with new event schema initialized');
  }

  return AnalyticsTracker;
}));