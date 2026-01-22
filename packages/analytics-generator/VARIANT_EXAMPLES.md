# Variant Schema Examples

## Complete Event Schema with Variants

### BUTTON_CLICK Event (With 3 Component Variants)

```json
{
  "event_type": "BUTTON_CLICK",
  "description": "Button/link click event with component-specific context",
  "base_fields": {
    "required": [
      "element_text",
      "element_id",
      "element_type",
      "surface",
      "page_path",
      "is_primary_cta",
      "cta_category",
      "pattern_type"
    ]
  },
  "variants": [
    {
      "component": "ApproveRequestButton",
      "location": "/requests",
      "pattern_type": "item_selection",
      "semantic_action": "approve_request",
      "conversion_relevance": "high",
      "journey_stage": "activation",
      "data_fields": {
        "required": ["element_text", "element_id", "element_type", "surface", "page_path"],
        "context": {
          "required": ["request_id", "request_status"],
          "optional": ["requester_id", "priority", "request_type"],
          "field_definitions": {
            "request_id": {
              "data_type": "string",
              "extraction_method": "data-attribute",
              "selector": "[data-request-id]",
              "description": "Unique identifier for the request",
              "anonymize": false
            },
            "request_status": {
              "data_type": "string",
              "extraction_method": "textContent",
              "selector": ".status-badge",
              "description": "Current status of the request",
              "anonymize": false
            },
            "requester_id": {
              "data_type": "string",
              "extraction_method": "data-attribute",
              "selector": "[data-requester-id]",
              "description": "ID of user who created request",
              "anonymize": true
            },
            "priority": {
              "data_type": "string",
              "extraction_method": "data-attribute",
              "selector": "[data-priority]",
              "anonymize": false
            },
            "request_type": {
              "data_type": "string",
              "extraction_method": "textContent",
              "selector": ".request-type",
              "anonymize": false
            }
          }
        }
      },
      "extraction_strategy": {
        "strategy": "parent_data",
        "scope_selector": "[data-request-id]",
        "state_tracking": {
          "before_action": ["request_status"],
          "after_action": ["request_status", "last_updated"]
        }
      },
      "pattern_metadata": {
        "description": "Extracts item context from parent container",
        "expected_context": "Item ID and metadata from data-* attributes on closest item container"
      }
    },
    {
      "component": "BulkApproveButton",
      "location": "/requests",
      "pattern_type": "bulk_action",
      "semantic_action": "bulk_approve",
      "conversion_relevance": "high",
      "journey_stage": "activation",
      "data_fields": {
        "required": ["element_text", "element_id", "element_type", "surface", "page_path"],
        "context": {
          "required": ["selected_ids", "selection_count", "action_type"],
          "optional": ["filter_applied", "page_number"],
          "field_definitions": {
            "selected_ids": {
              "data_type": "array",
              "extraction_method": "data-attribute",
              "selector": "input[type='checkbox']:checked",
              "description": "Array of selected request IDs",
              "anonymize": false
            },
            "selection_count": {
              "data_type": "number",
              "extraction_method": "count",
              "selector": "input[type='checkbox']:checked",
              "description": "Number of items selected",
              "anonymize": false
            },
            "action_type": {
              "data_type": "string",
              "extraction_method": "value",
              "selector": "select[name='bulk-action']",
              "anonymize": false
            }
          }
        }
      },
      "extraction_strategy": {
        "strategy": "accumulated_state",
        "scope_selector": ".request-list-container",
        "state_tracking": {
          "selection_state": "before_action",
          "result_state": "after_action"
        }
      },
      "pattern_metadata": {
        "description": "Captures selection set before action execution",
        "expected_context": "selected_ids[], selection_count, action_type"
      }
    },
    {
      "component": "AddTaskButton",
      "location": "/projects",
      "pattern_type": "modal_trigger",
      "semantic_action": "create_task",
      "conversion_relevance": "medium",
      "journey_stage": "adoption",
      "data_fields": {
        "required": ["element_text", "element_id", "element_type", "surface", "page_path"],
        "context": {
          "required": ["project_id"],
          "optional": ["project_name", "task_count"],
          "field_definitions": {
            "project_id": {
              "data_type": "string",
              "extraction_method": "data-attribute",
              "selector": "[data-project-id]",
              "description": "Project context for new task",
              "anonymize": false
            },
            "project_name": {
              "data_type": "string",
              "extraction_method": "textContent",
              "selector": ".project-title",
              "anonymize": false
            },
            "task_count": {
              "data_type": "number",
              "extraction_method": "data-attribute",
              "selector": "[data-task-count]",
              "anonymize": false
            }
          }
        }
      },
      "extraction_strategy": {
        "strategy": "parent_data",
        "scope_selector": ".project-card",
        "state_tracking": null
      },
      "pattern_metadata": {
        "description": "Generic interaction pattern",
        "expected_context": "Context based on component structure"
      }
    }
  ],
  "properties": {
    "element_text": "string",
    "element_id": "string | null",
    "element_type": "\"button\" | \"link\" | \"icon\" | \"tab\"",
    "surface": "string",
    "page_path": "string",
    "is_primary_cta": "boolean",
    "cta_category": "\"conversion\" | \"navigation\" | \"engagement\"",
    "pattern_type": "string | null",
    "context": "Record<string, any> | undefined"
  }
}
```

---

### FORM_INTERACTION Event (With 2 Form Variants)

```json
{
  "event_type": "FORM_INTERACTION",
  "description": "Form interaction event with form-specific context",
  "base_fields": {
    "required": [
      "action",
      "form_name",
      "form_id",
      "form_type",
      "surface",
      "page_path",
      "fields_total",
      "fields_completed"
    ]
  },
  "variants": [
    {
      "component": "CreateProjectForm",
      "location": "/projects",
      "pattern_type": "form_submission",
      "form_purpose": "entity_creation",
      "data_fields": {
        "required": ["action", "form_name", "form_id", "form_type", "surface", "page_path"],
        "context": {
          "form_fields": ["project_name", "project_description", "team_id", "start_date"],
          "field_definitions": {
            "project_name": {
              "data_type": "string",
              "extraction_method": "value",
              "selector": "input[name='project_name']",
              "anonymize": false,
              "field_purpose": "entity_identifier"
            },
            "project_description": {
              "data_type": "string",
              "extraction_method": "value",
              "selector": "textarea[name='description']",
              "anonymize": false,
              "field_purpose": "metadata"
            },
            "team_id": {
              "data_type": "string",
              "extraction_method": "value",
              "selector": "select[name='team']",
              "anonymize": false,
              "field_purpose": "relationship"
            },
            "start_date": {
              "data_type": "string",
              "extraction_method": "value",
              "selector": "input[name='start_date']",
              "anonymize": false,
              "field_purpose": "metadata"
            }
          }
        }
      },
      "extraction_strategy": {
        "strategy": "form_state",
        "scope_selector": "form#create-project-form",
        "serialization": "all_inputs_at_submission"
      }
    },
    {
      "component": "LoginForm",
      "location": "/auth",
      "pattern_type": "form_submission",
      "form_purpose": "authentication",
      "data_fields": {
        "required": ["action", "form_name", "form_id", "form_type", "surface", "page_path"],
        "context": {
          "form_fields": ["email", "password", "remember_me"],
          "field_definitions": {
            "email": {
              "data_type": "string",
              "extraction_method": "value",
              "selector": "input[name='email']",
              "anonymize": true,
              "field_purpose": "authentication_credential"
            },
            "password": {
              "data_type": "string",
              "extraction_method": "value",
              "selector": "input[name='password']",
              "anonymize": true,
              "field_purpose": "authentication_credential"
            },
            "remember_me": {
              "data_type": "boolean",
              "extraction_method": "checked",
              "selector": "input[name='remember_me']",
              "anonymize": false,
              "field_purpose": "preference"
            }
          }
        }
      },
      "extraction_strategy": {
        "strategy": "form_state",
        "scope_selector": "form#login-form",
        "serialization": "all_inputs_at_submission"
      }
    }
  ],
  "properties": {
    "action": "\"started\" | \"submitted\" | \"abandoned\"",
    "form_name": "string",
    "form_id": "string | null",
    "form_type": "\"contact\" | \"signup\" | \"login\" | \"checkout\" | \"newsletter\" | \"other\"",
    "surface": "string",
    "page_path": "string",
    "fields_total": "number",
    "fields_completed": "number"
  }
}
```

---

### MODAL_INTERACTION Event (With 1 Modal Variant)

```json
{
  "event_type": "MODAL_INTERACTION",
  "description": "Modal interaction event with lifecycle context",
  "base_fields": {
    "required": [
      "action",
      "modal_name",
      "modal_id",
      "trigger_source",
      "page_path",
      "context"
    ]
  },
  "variants": [
    {
      "component": "TaskDetailsModal",
      "location": "/tasks",
      "pattern_type": "modal_lifecycle",
      "data_fields": {
        "required": ["action", "modal_name", "modal_id", "trigger_source", "page_path"],
        "context": {
          "lifecycle_fields": [
            "task_id",
            "task_status",
            "assignee_id",
            "due_date",
            "form_changes",
            "exit_outcome"
          ],
          "field_definitions": {
            "task_id": {
              "data_type": "string",
              "extraction_method": "data-attribute",
              "selector": "[data-task-id]"
            },
            "task_status": {
              "data_type": "string",
              "extraction_method": "data-attribute",
              "selector": "[data-task-status]"
            },
            "assignee_id": {
              "data_type": "string",
              "extraction_method": "value",
              "selector": "select[name='assignee']"
            },
            "due_date": {
              "data_type": "string",
              "extraction_method": "value",
              "selector": "input[name='due_date']"
            },
            "form_changes": {
              "data_type": "object",
              "extraction_method": "value",
              "selector": "form"
            },
            "exit_outcome": {
              "data_type": "string",
              "extraction_method": "data-attribute",
              "selector": "[data-exit-reason]"
            }
          },
          "tracks": ["entry_context", "form_state", "exit_outcome"]
        }
      },
      "extraction_strategy": {
        "strategy": "modal_scope",
        "scope_selector": "[role=\"dialog\"]#task-details-modal",
        "lifecycle_tracking": {
          "on_open": "capture_trigger_and_initial_state",
          "on_interact": "capture_form_changes",
          "on_close": "capture_outcome_and_final_state"
        }
      }
    }
  ],
  "properties": {
    "action": "\"opened\" | \"closed\" | \"submitted\" | \"dismissed\"",
    "modal_name": "string",
    "modal_id": "string | null",
    "trigger_source": "\"button_click\" | \"auto_trigger\" | \"other\"",
    "page_path": "string",
    "context": "Record<string, any>"
  }
}
```

---

## Micro-Pattern Examples

### item_selection
```json
{
  "pattern_type": "item_selection",
  "pattern_metadata": {
    "description": "Extracts item context from parent container",
    "expected_context": "Item ID and metadata from data-* attributes on closest item container"
  },
  "extraction_strategy": {
    "strategy": "parent_data",
    "scope_selector": "[data-item-id]"
  },
  "context": {
    "required": ["item_id"],
    "optional": ["item_name", "item_status"]
  }
}
```

### bulk_action
```json
{
  "pattern_type": "bulk_action",
  "pattern_metadata": {
    "description": "Captures selection set before action execution",
    "expected_context": "selected_ids[], selection_count, action_type"
  },
  "extraction_strategy": {
    "strategy": "accumulated_state",
    "scope_selector": ".list-container"
  },
  "context": {
    "required": ["selected_ids", "selection_count", "action_type"],
    "optional": ["filter_applied"]
  }
}
```

### toggle_state
```json
{
  "pattern_type": "toggle_state",
  "pattern_metadata": {
    "description": "Tracks state change with before/after values",
    "expected_context": "previous_value, new_value, toggle_target"
  },
  "extraction_strategy": {
    "strategy": "component_props",
    "state_tracking": {
      "before_action": ["current_state"],
      "after_action": ["new_state"]
    }
  },
  "context": {
    "required": ["previous_value", "new_value", "toggle_target"]
  }
}
```

### modal_lifecycle
```json
{
  "pattern_type": "modal_lifecycle",
  "pattern_metadata": {
    "description": "Tracks modal open/interact/close with accumulated context",
    "expected_context": "trigger_element, form_data, exit_outcome"
  },
  "extraction_strategy": {
    "strategy": "modal_scope",
    "lifecycle_tracking": {
      "on_open": "capture_trigger_and_initial_state",
      "on_interact": "capture_form_changes",
      "on_close": "capture_outcome_and_final_state"
    }
  },
  "context": {
    "tracks": ["entry_context", "form_state", "exit_outcome"]
  }
}
```

---

## Location Inference Examples

### From Selector Pattern
```typescript
Component: DeleteButton
Selector: "[data-page='tasks'] .delete-action"
→ location: "tasks"
```

### From Surface Inference
```typescript
Component: CreateProjectButton
Surface: "project_list_header"
→ location: "/projects"
```

### From Component Name
```typescript
Component: LoginButton
Name analysis: contains 'login'
→ location: "/auth"
```

### From Form Purpose
```typescript
Component: CheckoutForm
Form purpose: "payment"
→ location: "/checkout"
```

### Global Component
```typescript
Component: Header
No specific indicators
→ location: "/global"  // Appears on all pages
```

---

## Complete Example Output

```json
{
  "base_fields": {
    "id": { "type": "string", "format": "uuid", "source": "generated" },
    "ts": { "type": "number", "format": "unix_timestamp", "source": "generated" },
    "app_key": { "type": "string", "source": "config" },
    "session_id": { "type": "string", "source": "sessionStorage" },
    "user_id": { "type": "string", "source": "persistent_storage" },
    "event_type": { "type": "string", "source": "code" }
  },
  "events": [
    {
      "event_type": "PAGE_VIEW",
      "description": "Page view event with navigation context",
      "data_fields": ["url", "path", "title", "referrer", "is_first_view", "entry_type"],
      "base_fields": null,
      "variants": [],
      "properties": { ... }
    },
    {
      "event_type": "BUTTON_CLICK",
      "description": "Button/link click event with component-specific context",
      "data_fields": [],
      "base_fields": {
        "required": ["element_text", "element_id", "element_type", "surface", "page_path"]
      },
      "variants": [
        { ... ApproveRequestButton variant ... },
        { ... BulkApproveButton variant ... },
        { ... AddTaskButton variant ... }
      ],
      "properties": { ... }
    },
    {
      "event_type": "FORM_INTERACTION",
      "description": "Form interaction event with form-specific context",
      "data_fields": [],
      "base_fields": {
        "required": ["action", "form_name", "form_id", "form_type", "surface", "page_path"]
      },
      "variants": [
        { ... CreateProjectForm variant ... },
        { ... LoginForm variant ... }
      ],
      "properties": { ... }
    }
  ],
  "ai_components": [ ... ],
  "ai_patterns": [ ... ]
}
```

---

**This schema now provides:**
- ✅ Component-specific context fields
- ✅ Location-aware tracking
- ✅ Micro-pattern-driven extraction
- ✅ Exact selectors and methods
- ✅ Semantic actions and journey stages
- ✅ Domain-agnostic patterns

