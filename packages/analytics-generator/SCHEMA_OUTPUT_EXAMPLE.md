# Complete Schema Output Example - After All Fixes

## 📋 Full events-schema.json Structure

```json
{
  "base_fields": {
    "id": { 
      "type": "string", 
      "format": "uuid", 
      "source": "generated" 
    },
    "ts": { 
      "type": "number", 
      "format": "unix_timestamp", 
      "source": "generated" 
    },
    "app_key": { 
      "type": "string", 
      "source": "config" 
    },
    "session_id": { 
      "type": "string", 
      "source": "sessionStorage" 
    },
    "user_id": { 
      "type": "string", 
      "source": "persistent_storage", 
      "description": "8-10 digit string" 
    },
    "event_type": { 
      "type": "string", 
      "source": "code" 
    }
  },
  "events": [
    {
      "event_type": "PAGE_VIEW",
      "description": "Tracks page loads and navigation",
      "base_structure": {
        "id": "string (uuid)",
        "ts": "number (unix timestamp)",
        "app_key": "string",
        "session_id": "string",
        "user_id": "string",
        "event_type": "PAGE_VIEW",
        "data": "Object containing page view fields"
      },
      "data_field_variants": [
        {
          "component": "PageView",
          "locations": ["/all"],
          "pattern_type": null,
          "data_structure": {
            "url": "string (window.location.href)",
            "path": "string (window.location.pathname)",
            "title": "string (document.title)",
            "referrer": "string | null (document.referrer)",
            "is_first_view": "boolean (session flag)",
            "entry_type": "navigation | reload | back_forward | spa_transition"
          },
          "extraction_strategy": {
            "strategy": "global_context",
            "scope_selector": "window",
            "field_extraction": []
          }
        }
      ]
    },
    {
      "event_type": "BUTTON_CLICK",
      "description": "Tracks button/link clicks with component-specific context",
      "base_structure": {
        "id": "string (uuid)",
        "ts": "number (unix timestamp)",
        "app_key": "string",
        "session_id": "string",
        "user_id": "string",
        "event_type": "BUTTON_CLICK",
        "data": "Object containing button click fields and optional context"
      },
      "data_field_variants": [
        {
          "component": "ApproveRequestButton",
          "locations": ["/admin/requests", "/requests"],
          "pattern_type": "item_selection",
          "semantic_action": "approve_request",
          "conversion_relevance": "high",
          "journey_stage": "activation",
          "data_structure": {
            "element_text": "string (innerText or aria-label)",
            "element_id": "string | null",
            "element_type": "button",
            "surface": "string (header|nav|main|footer|modal)",
            "page_path": "string (window.location.pathname)",
            "location": "string (page path where interaction occurred)",
            "is_primary_cta": "boolean",
            "cta_category": "conversion",
            "pattern_type": "item_selection",
            "context": {
              "request_id": "string (from data-attribute: [data-request-id])",
              "request_status": "string (from data-attribute: [data-status])",
              "requester_id": "string (from data-attribute: [data-requester])"
            }
          },
          "extraction_strategy": {
            "strategy": "parent_data",
            "scope_selector": "[data-request-id]",
            "state_tracking": null,
            "field_extraction": [
              {
                "field_name": "request_id",
                "extraction_method": "data-attribute",
                "selector": "[data-request-id]",
                "data_type": "string"
              },
              {
                "field_name": "request_status",
                "extraction_method": "data-attribute",
                "selector": "[data-status]",
                "data_type": "string"
              },
              {
                "field_name": "requester_id",
                "extraction_method": "data-attribute",
                "selector": "[data-requester]",
                "data_type": "string"
              }
            ]
          },
          "pattern_metadata": {
            "description": "Extracts item context from parent container",
            "expected_data_context": "Item ID and metadata from data-* attributes"
          }
        },
        {
          "component": "CreateProjectButton",
          "locations": ["/dashboard", "/projects"],
          "pattern_type": "modal_trigger",
          "semantic_action": "create_project",
          "conversion_relevance": "medium",
          "journey_stage": "adoption",
          "data_structure": {
            "element_text": "string (innerText or aria-label)",
            "element_id": "string | null",
            "element_type": "button",
            "surface": "string (header|nav|main|footer|modal)",
            "page_path": "string (window.location.pathname)",
            "location": "string (page path where interaction occurred)",
            "is_primary_cta": "boolean",
            "cta_category": "conversion",
            "pattern_type": "modal_trigger"
          },
          "extraction_strategy": null,
          "pattern_metadata": {
            "description": "Generic interaction pattern",
            "expected_data_context": "Context based on component structure"
          }
        },
        {
          "component": "SaveButton",
          "locations": ["/global"],
          "pattern_type": "form_submission",
          "semantic_action": "save",
          "conversion_relevance": "medium",
          "data_structure": {
            "element_text": "string (innerText or aria-label)",
            "element_id": "string | null",
            "element_type": "button",
            "surface": "string (header|nav|main|footer|modal)",
            "page_path": "string (window.location.pathname)",
            "location": "string (page path where interaction occurred)",
            "is_primary_cta": "boolean",
            "cta_category": "conversion",
            "pattern_type": "form_submission"
          },
          "extraction_strategy": null,
          "pattern_metadata": {
            "description": "Serializes entire form state at submission",
            "expected_data_context": "All input values within form scope"
          }
        }
      ]
    },
    {
      "event_type": "FORM_INTERACTION",
      "description": "Tracks form lifecycle (started/submitted/abandoned) with form-specific context",
      "base_structure": {
        "id": "string (uuid)",
        "ts": "number (unix timestamp)",
        "app_key": "string",
        "session_id": "string",
        "user_id": "string",
        "event_type": "FORM_INTERACTION",
        "data": "Object containing form interaction fields and form context"
      },
      "data_field_variants": [
        {
          "component": "LoginForm",
          "locations": ["/auth"],
          "pattern_type": "form_submission",
          "form_purpose": "authentication",
          "data_structure": {
            "action": "started | submitted | abandoned",
            "form_name": "string",
            "form_id": "string | null",
            "form_type": "authentication",
            "surface": "string",
            "page_path": "string",
            "location": "string (page path where form interaction occurred)",
            "fields_total": "number",
            "fields_completed": "number",
            "context": {
              "email": "string (value) [ANONYMIZED]",
              "password": "string (value) [ANONYMIZED]",
              "remember_me": "boolean (checked)"
            }
          },
          "extraction_strategy": {
            "strategy": "form_state",
            "scope_selector": "form#login-form",
            "serialization": "all_inputs_at_submission",
            "field_extraction": [
              {
                "field_name": "email",
                "extraction_method": "value",
                "selector": "input[name='email']",
                "data_type": "string",
                "anonymize": true,
                "field_purpose": "authentication_credential"
              },
              {
                "field_name": "password",
                "extraction_method": "value",
                "selector": "input[name='password']",
                "data_type": "string",
                "anonymize": true,
                "field_purpose": "authentication_credential"
              },
              {
                "field_name": "remember_me",
                "extraction_method": "checked",
                "selector": "input[name='remember_me']",
                "data_type": "boolean",
                "anonymize": false,
                "field_purpose": "preference"
              }
            ]
          }
        },
        {
          "component": "CreateProjectForm",
          "locations": ["/projects"],
          "pattern_type": "form_submission",
          "form_purpose": "entity_creation",
          "data_structure": {
            "action": "started | submitted | abandoned",
            "form_name": "string",
            "form_id": "string | null",
            "form_type": "entity_creation",
            "surface": "string",
            "page_path": "string",
            "location": "string (page path where form interaction occurred)",
            "fields_total": "number",
            "fields_completed": "number",
            "context": {
              "project_name": "string (value)",
              "project_description": "string (value)",
              "team_id": "string (value)"
            }
          },
          "extraction_strategy": {
            "strategy": "form_state",
            "scope_selector": "form#create-project-form",
            "serialization": "all_inputs_at_submission",
            "field_extraction": [
              {
                "field_name": "project_name",
                "extraction_method": "value",
                "selector": "input[name='project_name']",
                "data_type": "string",
                "anonymize": false,
                "field_purpose": "entity_identifier"
              },
              {
                "field_name": "project_description",
                "extraction_method": "value",
                "selector": "textarea[name='description']",
                "data_type": "string",
                "anonymize": false,
                "field_purpose": "metadata"
              },
              {
                "field_name": "team_id",
                "extraction_method": "value",
                "selector": "select[name='team']",
                "data_type": "string",
                "anonymize": false,
                "field_purpose": "relationship"
              }
            ]
          }
        }
      ]
    },
    {
      "event_type": "MODAL_INTERACTION",
      "description": "Tracks modal lifecycle (opened/closed/submitted/dismissed) with modal-specific context",
      "base_structure": {
        "id": "string (uuid)",
        "ts": "number (unix timestamp)",
        "app_key": "string",
        "session_id": "string",
        "user_id": "string",
        "event_type": "MODAL_INTERACTION",
        "data": "Object containing modal interaction fields and modal context"
      },
      "data_field_variants": [
        {
          "component": "TaskDetailsModal",
          "locations": ["/tasks"],
          "pattern_type": "modal_lifecycle",
          "data_structure": {
            "action": "opened | closed | submitted | dismissed",
            "modal_name": "string",
            "modal_id": "string | null",
            "trigger_source": "button_click | auto_trigger | other",
            "page_path": "string",
            "location": "string (page path where modal interaction occurred)",
            "context": {
              "task_id": "string (data-attribute: [data-task-id])",
              "task_status": "string (data-attribute: [data-status])",
              "assignee_id": "string (value: select[name='assignee'])"
            }
          },
          "extraction_strategy": {
            "strategy": "modal_scope",
            "scope_selector": "[role=\"dialog\"]#task-details-modal",
            "lifecycle_tracking": {
              "on_open": "capture_trigger_and_initial_state",
              "on_interact": "capture_form_changes",
              "on_close": "capture_outcome_and_final_state"
            },
            "field_extraction": [
              {
                "field_name": "task_id",
                "extraction_method": "data-attribute",
                "selector": "[data-task-id]",
                "data_type": "string"
              },
              {
                "field_name": "task_status",
                "extraction_method": "data-attribute",
                "selector": "[data-status]",
                "data_type": "string"
              },
              {
                "field_name": "assignee_id",
                "extraction_method": "value",
                "selector": "select[name='assignee']",
                "data_type": "string"
              }
            ]
          }
        }
      ]
    },
    {
      "event_type": "ELEMENT_VISIBILITY",
      "description": "Tracks element visibility changes (shown/hidden/dismissed)",
      "base_structure": {
        "id": "string (uuid)",
        "ts": "number (unix timestamp)",
        "app_key": "string",
        "session_id": "string",
        "user_id": "string",
        "event_type": "ELEMENT_VISIBILITY",
        "data": "Object containing element visibility fields"
      },
      "data_field_variants": [
        {
          "component": "VisibilityTracking",
          "locations": ["/all"],
          "pattern_type": "expand_collapse",
          "data_structure": {
            "action": "shown | hidden | dismissed",
            "element_type": "modal | popup | drawer | tooltip | dropdown | toast | unknown",
            "element_name": "string",
            "element_id": "string | null",
            "trigger_source": "button_click | auto_trigger | scroll_trigger | unknown",
            "page_path": "string",
            "has_cta": "boolean"
          },
          "extraction_strategy": {
            "strategy": "component_props",
            "scope_selector": "[role], .modal, .popup, .drawer",
            "field_extraction": []
          }
        }
      ]
    },
    {
      "event_type": "SCROLL_INTERACTION",
      "description": "Tracks scroll depth milestones",
      "base_structure": {
        "id": "string (uuid)",
        "ts": "number (unix timestamp)",
        "app_key": "string",
        "session_id": "string",
        "user_id": "string",
        "event_type": "SCROLL_INTERACTION",
        "data": "Object containing scroll interaction fields"
      },
      "data_field_variants": [
        {
          "component": "ScrollTracking",
          "locations": ["/all"],
          "pattern_type": null,
          "data_structure": {
            "action": "depth_reached",
            "depth_percentage": "number (0-100)",
            "milestone": "25% | 50% | 75% | 90% | 100% | none",
            "page_path": "string",
            "direction": "up | down"
          },
          "extraction_strategy": {
            "strategy": "global_context",
            "scope_selector": "window",
            "field_extraction": []
          }
        }
      ]
    }
  ],
  "ai_components": [
    {
      "name": "ApproveRequestButton",
      "type": "button",
      "selector_patterns": [".approve-btn", "[data-action='approve']"],
      "interaction_type": "click",
      "pattern_type": "item_selection",
      "likely_purpose": "Approve pending request",
      "context_needed": ["request_id", "request_status", "requester_id"],
      "context_collection": {
        "strategy": "parent_data",
        "scope_selector": "[data-request-id]",
        "fields": [
          {
            "field_name": "request_id",
            "selector": "[data-request-id]",
            "extraction_method": "data-attribute",
            "data_type": "string",
            "required": true
          }
        ]
      }
    }
  ],
  "ai_patterns": [
    {
      "component": "ApproveRequestButton",
      "context_collection": {
        "search_parents": [".request-card", "[data-request-id]"],
        "extract_fields": ["request_id", "request_status"],
        "sibling_context": ["requester_name"]
      },
      "state_changes": ["request_status_updated", "notification_sent"]
    }
  ]
}
```

---

## 🎯 Key Features Preserved

### 1. **7-Field Base Structure** ✅
Every event documents the runtime structure:
```json
{
  "id": "uuid",
  "ts": 1234567890,
  "app_key": "my-app",
  "session_id": "sess_123",
  "user_id": "12345678",
  "event_type": "BUTTON_CLICK",
  "data": { ... }
}
```

### 2. **Component-Specific data_structure** ✅
Each variant shows exactly what goes in `event.data`:
```json
"data_structure": {
  "element_text": "string (innerText or aria-label)",
  "location": "string (page path where interaction occurred)",  // ← TYPE not VALUE
  "context": {
    "request_id": "string (from data-attribute: [data-request-id])"
  }
}
```

### 3. **Deterministic Deduplication** ✅
Same component = single variant with multiple locations:
```json
{
  "component": "ApproveRequestButton",
  "locations": ["/admin/requests", "/requests"],  // ← Sorted array
  "data_structure": { ... }
}
```

### 4. **Extraction Strategies** ✅
Field-level detail preserved:
```json
"extraction_strategy": {
  "strategy": "parent_data",
  "scope_selector": "[data-request-id]",
  "field_extraction": [
    {
      "field_name": "request_id",
      "extraction_method": "data-attribute",
      "selector": "[data-request-id]",
      "data_type": "string"
    }
  ]
}
```

### 5. **AI Component Discovery** ✅
Original discovery data preserved:
```json
"ai_components": [ ... ],
"ai_patterns": [ ... ]
```

---

## ✅ Verification Points

- ✅ **base_structure** shows 7 fields for every event
- ✅ **data_field_variants** is an array of component-specific variants
- ✅ **locations** is an array (not single string)
- ✅ **location** in data_structure is TYPE description (not value)
- ✅ **context** shows field types with extraction methods
- ✅ **extraction_strategy** has field-level detail
- ✅ **pattern_metadata** documents micro-patterns
- ✅ Deduplication groups same components
- ✅ AI discovery data preserved separately

---

**This is the complete schema structure that will be generated.** All fundamental structure is preserved and correctly aligned with the runtime 7-field event structure.

