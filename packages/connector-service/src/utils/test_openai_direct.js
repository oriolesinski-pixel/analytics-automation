// packages/connector-service/src/lib/analytics-intelligence-generator.ts
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { detectFrameworks, type Detected } from './detectFrameworks';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Base directory for outputs
const OUTPUTS_DIR = '/Users/oriolesinski/analytics-automation/packages/connector-service/src/utils/generated-outputs';

// Required fields that MUST be in every event
const REQUIRED_FIELDS = ['app_key', 'session_id', 'user_id', 'ts'] as const;

interface EventSchema {
  name: string;
  required: string[];
  optional: string[];
  properties?: Record<string, string>;
}

interface GeneratorInput {
  repoId: string;
  appKey: string;
  domain?: string;
  backendUrl?: string;
  frameworks?: string[];
  schema?: {
    events: EventSchema[];
  };
  uiStructure?: {
    pages?: Array<{ name: string; route: string; components: string[] }>;
    modals?: Array<{ id: string; trigger: string; parentPages: string[] }>;
    widgets?: Array<{ type: string; pages: string[] }>;
  };
}

interface GeneratorOutput {
  'tracker.js': string;
  'events-schema.json': any;
  'ui-graph.json': any;
  'analytics-components.tsx': string;
  'analytics-provider.tsx': string;
  'analytics.types.ts': string;
  'integration-guide.md': string;
  metadata: {
    generatedAt: string;
    appKey: string;
    eventCount: number;
    frameworksDetected: string[];
  };
}

export class AnalyticsIntelligenceGenerator {
  private anthropic: Anthropic;
  private supabase: any;

  constructor() {
    this.anthropic = anthropic;
    this.supabase = supabase;
  }

  /**
   * Load the latest schema from the database
   */
  async loadSchema(repoId: string): Promise<any> {
    // Try override first, then original schema
    const { data: override } = await this.supabase
      .from('events')
      .select('metadata')
      .eq('repo_id', repoId)
      .eq('verb', 'schema_override')
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (override?.metadata?.suggested) {
      return override.metadata.suggested;
    }

    const { data: schema } = await this.supabase
      .from('events')
      .select('metadata')
      .eq('repo_id', repoId)
      .eq('verb', 'schema')
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle();

    return schema?.metadata?.suggested || null;
  }

  /**
   * Ensure all events have required fields
   */
  private ensureRequiredFields(events: EventSchema[]): EventSchema[] {
    return events.map(event => ({
      ...event,
      required: Array.from(new Set([...REQUIRED_FIELDS, ...(event.required || [])]))
    }));
  }

  /**
   * Generate the complete analytics implementation
   */
  async generate(input: GeneratorInput): Promise<GeneratorOutput> {
    // Load schema if not provided
    let schema = input.schema;
    if (!schema) {
      const loadedSchema = await this.loadSchema(input.repoId);
      if (!loadedSchema) {
        throw new Error('No schema found for repository. Run analyzer first.');
      }
      schema = loadedSchema;
    }

    // Ensure we have a valid schema structure
    if (!schema.events) {
      schema.events = [];
    }

    // Ensure required fields in all events
    const eventsWithRequiredFields = this.ensureRequiredFields(schema.events);

    // Generate all components using a single LLM call for consistency
    const systemPrompt = `You are an expert analytics engineer. Generate a complete, production-ready analytics implementation.

CRITICAL REQUIREMENTS:
1. Every event MUST include these fields: app_key, session_id, user_id (nullable), ts (timestamp)
2. Generate cohesive, interoperable components that work together
3. Use TypeScript for type safety
4. Follow React best practices for components
5. Ensure the tracker works in both modern and legacy browsers`;

    const userPrompt = `Generate a complete analytics implementation for:
- App Key: ${input.appKey}
- Domain: ${input.domain || 'localhost:3000'}
- Backend: ${input.backendUrl || 'http://localhost:8080/ingest/analytics'}
- Frameworks: ${(input.frameworks || ['react']).join(', ')}

Event Schema (with required fields enforced):
${JSON.stringify(eventsWithRequiredFields, null, 2)}

Generate these exact components:
1. tracker.js - Browser-compatible UMD tracker that manages session, batching, and required fields
2. events-schema.json - Complete schema with required fields marked
3. ui-graph.json - UI component relationships and event contexts
4. analytics-components.tsx - React components with built-in tracking
5. analytics-provider.tsx - Context provider for required fields
6. analytics.types.ts - TypeScript definitions

Return as JSON with these exact keys.`;

    const response = await this.anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 8000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: userPrompt
      }]
    });

    let generatedComponents: any = {};
    
    try {
      // Extract JSON from response
      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        generatedComponents = JSON.parse(jsonMatch[1]);
      } else {
        // Fallback to parsing the whole content
        generatedComponents = JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to parse LLM response, using fallback generation');
      generatedComponents = this.generateFallbackComponentsData(input, eventsWithRequiredFields);
    }

    // Ensure we have all required components
    const output = this.validateAndCompleteOutput(generatedComponents, input, eventsWithRequiredFields);

    // Save to disk
    await this.saveOutput(output, input.repoId, input.appKey);

    return output;
  }

  /**
   * Generate fallback components if LLM fails
   */
  private generateFallbackComponentsData(
    input: GeneratorInput, 
    events: EventSchema[]
  ): Partial<GeneratorOutput> {
    const backend = input.backendUrl || 'http://localhost:8080/ingest/analytics';

    return {
      'tracker.js': this.generateFallbackTracker(input.appKey, backend),
      'events-schema.json': {
        required_fields: {
          app_key: { type: 'string', source: 'config' },
          session_id: { type: 'string', source: 'localStorage' },
          user_id: { type: 'string', source: 'context', nullable: true },
          ts: { type: 'timestamp', source: 'generated' }
        },
        events: events.map(e => ({
          type: e.name,
          required: e.required,
          properties: e.properties || {}
        }))
      },
      'ui-graph.json': {
        app_key: input.appKey,
        pages: {},
        modals: {},
        widgets: {}
      },
      'analytics-components.tsx': this.generateFallbackReactComponents(),
      'analytics-provider.tsx': this.generateFallbackProvider(input.appKey),
      'analytics.types.ts': this.generateFallbackTypes(events),
      'integration-guide.md': this.generateIntegrationGuide(input.appKey)
    };
  }

  /**
   * Validate and complete the output
   */
  private validateAndCompleteOutput(
    generated: any,
    input: GeneratorInput,
    events: EventSchema[]
  ): GeneratorOutput {
    // Use generated components or fallbacks
    const output: GeneratorOutput = {
      'tracker.js': generated['tracker.js'] || this.generateFallbackTracker(input.appKey, input.backendUrl || 'http://localhost:8080/ingest/analytics'),
      'events-schema.json': generated['events-schema.json'] || {
        required_fields: {
          app_key: { type: 'string', source: 'config' },
          session_id: { type: 'string', source: 'localStorage' },
          user_id: { type: 'string', source: 'context', nullable: true },
          ts: { type: 'timestamp', source: 'generated' }
        },
        events: events
      },
      'ui-graph.json': generated['ui-graph.json'] || {
        app_key: input.appKey,
        pages: {},
        modals: {},
        widgets: {}
      },
      'analytics-components.tsx': generated['analytics-components.tsx'] || this.generateFallbackReactComponents(),
      'analytics-provider.tsx': generated['analytics-provider.tsx'] || this.generateFallbackProvider(input.appKey),
      'analytics.types.ts': generated['analytics.types.ts'] || this.generateFallbackTypes(events),
      'integration-guide.md': generated['integration-guide.md'] || this.generateIntegrationGuide(input.appKey),
      metadata: {
        generatedAt: new Date().toISOString(),
        appKey: input.appKey,
        eventCount: events.length,
        frameworksDetected: input.frameworks || []
      }
    };

    // Validate that all events include required fields
    const schema = output['events-schema.json'];
    if (schema && Array.isArray(schema.events)) {
      schema.events = schema.events.map((e: any) => ({
        ...e,
        required: Array.from(new Set([...REQUIRED_FIELDS, ...(e.required || [])]))
      }));
    }

    return output;
  }

  /**
   * Save output to disk
   */
  private async saveOutput(output: GeneratorOutput, repoId: string, appKey: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(OUTPUTS_DIR, 'unified', repoId, timestamp);
    
    await fs.mkdir(outputPath, { recursive: true });

    // Save each file
    for (const [filename, content] of Object.entries(output)) {
      if (filename === 'metadata') continue;
      
      const filePath = path.join(outputPath, filename);
      const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      await fs.writeFile(filePath, fileContent, 'utf8');
    }

    // Save metadata
    await fs.writeFile(
      path.join(outputPath, 'metadata.json'),
      JSON.stringify(output.metadata, null, 2),
      'utf8'
    );

    // Save to database
    await this.supabase.from('events').insert({
      source: 'ai',
      repo_id: repoId,
      commit_sha: null,
      actor: 'analytics_intelligence_generator',
      ts: new Date().toISOString(),
      verb: 'analytics_implementation',
      metadata: {
        app_key: appKey,
        output_path: outputPath,
        ...output.metadata,
        files: Object.keys(output).filter(k => k !== 'metadata')
      }
    });

    console.log(`✅ Analytics implementation saved to: ${outputPath}`);
    return outputPath;
  }

  // Fallback generation methods
  private generateFallbackTracker(appKey: string, endpoint: string): string {
    return `(function(root, factory) {
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
        appKey: '${appKey}',
        endpoint: '${endpoint}',
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
}));`;
  }

  private generateFallbackReactComponents(): string {
    return `import React, { useContext, useEffect, useState } from 'react';
import { AnalyticsContext } from './analytics-provider';

export function AnalyticsButton({ 
  text, 
  onClick, 
  location, 
  surface = 'main',
  ...props 
}) {
  const { appKey, sessionId, userId } = useContext(AnalyticsContext);
  
  const handleClick = (e) => {
    window.analytics?.trackEvent('button_click', {
      app_key: appKey,
      session_id: sessionId,
      user_id: userId,
      ts: new Date().toISOString(),
      text,
      location,
      surface,
      element_id: props.id
    });
    onClick?.(e);
  };
  
  return <button {...props} onClick={handleClick}>{text}</button>;
}

export function AnalyticsForm({ 
  formName, 
  onSubmit, 
  children 
}) {
  const { appKey, sessionId, userId } = useContext(AnalyticsContext);
  const [startTime, setStartTime] = useState(null);
  
  const handleFocus = () => {
    if (!startTime) {
      setStartTime(Date.now());
      window.analytics?.trackEvent('form_started', {
        app_key: appKey,
        session_id: sessionId,
        user_id: userId,
        ts: new Date().toISOString(),
        form_name: formName,
        location: window.location.pathname
      });
    }
  };
  
  const handleSubmit = (data) => {
    window.analytics?.trackEvent('form_submitted', {
      app_key: appKey,
      session_id: sessionId,
      user_id: userId,
      ts: new Date().toISOString(),
      form_name: formName,
      time_to_complete: startTime ? Date.now() - startTime : null
    });
    onSubmit(data);
  };
  
  return (
    <form onFocus={handleFocus} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}`;
  }

  private generateFallbackProvider(appKey: string): string {
    return `import React, { createContext, useState, useEffect } from 'react';

export const AnalyticsContext = createContext({
  appKey: '',
  sessionId: '',
  userId: null
});

export function AnalyticsProvider({ children, userId = null }) {
  const [sessionId, setSessionId] = useState('');
  
  useEffect(() => {
    // Get or create session ID
    let sid = sessionStorage.getItem('analytics_session_id');
    if (!sid) {
      sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('analytics_session_id', sid);
    }
    setSessionId(sid);
  }, []);
  
  return (
    <AnalyticsContext.Provider value={{
      appKey: '${appKey}',
      sessionId,
      userId
    }}>
      {children}
    </AnalyticsContext.Provider>
  );
}`;
  }

  private generateFallbackTypes(events: EventSchema[]): string {
    const eventTypes = events.map(e => `
  ${e.name}: {
    app_key: string;
    session_id: string;
    user_id: string | null;
    ts: string;
    ${Object.entries(e.properties || {}).map(([k, v]) => `${k}?: ${v};`).join('\n    ')}
  };`).join('');

    return `export interface AnalyticsEvents {${eventTypes}
}

export interface AnalyticsTracker {
  trackEvent<K extends keyof AnalyticsEvents>(
    eventName: K,
    properties: AnalyticsEvents[K]
  ): void;
  trackPageView(page?: { url?: string; title?: string }): void;
  identify(userId: string, traits?: Record<string, any>): void;
  flush(): void;
}

declare global {
  interface Window {
    analytics?: AnalyticsTracker;
  }
}`;
  }

  private generateIntegrationGuide(appKey: string): string {
    return `# Analytics Integration Guide

## Quick Start

### 1. Install the tracker
Copy \`tracker.js\` to your public directory:
\`\`\`bash
cp tracker.js public/tracker.js
\`\`\`

### 2. Add the Analytics Provider
Wrap your app with the provider in your root component:

\`\`\`tsx
import { AnalyticsProvider } from './analytics-provider';

function App() {
  return (
    <AnalyticsProvider userId={currentUser?.id}>
      {/* Your app */}
    </AnalyticsProvider>
  );
}
\`\`\`

### 3. Use Analytics Components
Replace standard components with analytics-enabled versions:

\`\`\`tsx
import { AnalyticsButton, AnalyticsForm } from './analytics-components';

function MyPage() {
  return (
    <>
      <AnalyticsButton 
        text="Sign Up" 
        location="homepage"
        onClick={handleSignUp}
      />
      
      <AnalyticsForm 
        formName="newsletter"
        onSubmit={handleSubmit}
      >
        {/* Form fields */}
      </AnalyticsForm>
    </>
  );
}
\`\`\`

### 4. Track Custom Events
For custom events, use the global analytics object:

\`\`\`javascript
window.analytics.trackEvent('custom_event', {
  // Required fields are added automatically
  custom_property: 'value'
});
\`\`\`

## Required Fields
Every event automatically includes:
- \`app_key\`: "${appKey}"
- \`session_id\`: Auto-generated per session
- \`user_id\`: From context (can be null)
- \`ts\`: ISO timestamp

## Testing
Open browser console and look for:
- "Analytics tracker initialized" on load
- Network requests to /ingest/analytics
- Events in the payload with all required fields

## Support
For issues or questions, check the events-schema.json for the complete event specification.`;
  }
}

// Export singleton instance
export const analyticsGenerator = new AnalyticsIntelligenceGenerator();

// API endpoint handler
export async function createAnalyticsIntelligenceEndpoint(app: any) {
  app.post('/analytics/generate-unified', async (req: any, reply: any) => {
    try {
      const { repo_id, app_key, domain, backend_url } = req.body;

      if (!repo_id || !app_key) {
        return reply.code(400).send({ 
          error: 'repo_id and app_key are required' 
        });
      }

      console.log('🚀 Starting unified analytics generation for:', app_key);

      // Get repo info
      const { data: repo } = await supabase
        .from('repos')
        .select('*')
        .eq('id', repo_id)
        .single();

      if (!repo) {
        return reply.code(404).send({ error: 'Repository not found' });
      }

      // Get latest analyzer run for framework detection
      const { data: latestRun } = await supabase
        .from('analyzer_runs')
        .select('summary')
        .eq('repo_id', repo_id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const frameworks = latestRun?.summary?.schema?.frameworks || ['react'];

      // Generate unified implementation
      const generator = new AnalyticsIntelligenceGenerator();
      const output = await generator.generate({
        repoId: repo_id,
        appKey: app_key,
        domain: domain || 'localhost:3000',
        backendUrl: backend_url || 'http://localhost:8080/ingest/analytics',
        frameworks
      });

      return reply.send({
        success: true,
        app_key,
        metadata: output.metadata,
        files: Object.keys(output).filter(k => k !== 'metadata'),
        message: `Generated ${output.metadata.eventCount} events with required fields enforced`
      });

    } catch (error: any) {
      console.error('❌ Generation failed:', error);
      return reply.code(500).send({
        error: 'Failed to generate unified analytics',
        message: error.message
      });
    }
  });

  app.get('/analytics/latest/:repo_id', async (req: any, reply: any) => {
    try {
      const { repo_id } = req.params;

      const { data: latest } = await supabase
        .from('events')
        .select('metadata, ts')
        .eq('repo_id', repo_id)
        .eq('verb', 'analytics_implementation')
        .order('ts', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latest) {
        return reply.code(404).send({ error: 'No analytics implementation found' });
      }

      return reply.send({
        success: true,
        generated_at: latest.ts,
        ...latest.metadata
      });

    } catch (error: any) {
      return reply.code(500).send({ error: 'Failed to retrieve implementation' });
    }
  });
}