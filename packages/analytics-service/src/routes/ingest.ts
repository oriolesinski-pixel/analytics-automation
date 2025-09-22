// src/routes/ingest.ts
import type { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import crypto from 'node:crypto';
import { logAnalyticsEvent } from '../utils/event-logger';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------- Schemas for Product Analytics ----------
const ProductEventSchema = z.object({
  id: z.string(),
  ts: z.number(), // timestamp in milliseconds
  event_type: z.string().optional(), // from tracker
  verb: z.string().optional(), // for database
  user_id: z.string(),
  session_id: z.string(),
  data: z.record(z.unknown()).default({}),
  // Optional fields that tracker might send
  app_key: z.string().optional(),
});

const AnalyticsIngestSchema = z.object({
  app_key: z.string(),
  session_id: z.string().optional(),
  events: z.array(ProductEventSchema)
});

// ---------- Route Module ----------
export default async function ingestRoutes(app: FastifyInstance) {

  // --- Product Analytics Ingest Endpoint ---
  app.post('/ingest/analytics', async (req, reply) => {
    try {
      const body = AnalyticsIngestSchema.parse(req.body);

      // Clean app_key (remove timestamp suffix if present)
      const appKey = body.app_key.replace(/-\d{13}$/, '');

      // Check if app exists
      const { data: appData } = await supabase
        .from('apps')
        .select('id, repo_id')
        .eq('app_key', appKey)
        .single();

      if (!appData) {
        return reply.code(404).send({
          ok: false,
          error: `App with key '${appKey}' not found`
        });
      }

      // Process events
      const processedEvents = [];
      const failedEvents = [];

      for (const event of body.events) {
        try {
          // Get event_type (NO MORE VERB!)
          const eventType = event.event_type || 'UNKNOWN';

          // Keep timestamp as milliseconds (convert if needed)
          const timestamp = event.ts > 9999999999
            ? event.ts  // Already in milliseconds
            : event.ts * 1000; // Convert from seconds to milliseconds

          // Build the SIMPLE event row - only 7 fields!
          const eventRow = {
            id: event.id || crypto.randomUUID(),
            event_type: eventType.toUpperCase(), // Normalize to uppercase
            app_key: appKey,
            user_id: event.user_id,
            session_id: event.session_id || body.session_id,
            ts: timestamp,
            data: event.data || {}
          };

          // Insert into analytics_product_events table
          const { error } = await supabase
            .from('analytics_product_events')
            .insert(eventRow);

          if (error) {
            console.error('Failed to insert event:', error);
            failedEvents.push({ event: event.id, error: error.message });
          } else {
            processedEvents.push(eventRow);
          }
        } catch (eventError: any) {
          console.error('Error processing event:', eventError);
          failedEvents.push({
            event: event.id,
            error: eventError.message || 'Processing failed'
          });
        }
      }

      // Log the events with beautiful formatting (optional)
      if (typeof logAnalyticsEvent === 'function') {
        logAnalyticsEvent(processedEvents, appKey);
      }

      // Return response
      return reply.send({
        ok: true,
        stored: processedEvents.length,
        failed: failedEvents.length,
        message: `Processed ${processedEvents.length} events successfully${failedEvents.length > 0 ? `, ${failedEvents.length} failed` : ''
          }`
      });

    } catch (error: any) {
      console.error('Ingest error:', error);
      return reply.code(400).send({
        ok: false,
        error: error.message || 'Invalid request format'
      });
    }
  });

  // --- GET endpoint for checking event data ---
  app.get('/analytics/events', async (req, reply) => {
    try {
      const { app_key, limit = 10 } = req.query as any;

      if (!app_key) {
        return reply.code(400).send({
          ok: false,
          error: 'app_key parameter required'
        });
      }

      const { data, error } = await supabase
        .from('analytics_product_events')
        .select('*')
        .eq('metadata->>app_key', app_key)
        .order('ts', { ascending: false })
        .limit(parseInt(limit));

      if (error) {
        return reply.code(500).send({
          ok: false,
          error: error.message
        });
      }

      return reply.send({
        ok: true,
        events: data,
        count: data.length
      });
    } catch (error: any) {
      return reply.code(500).send({
        ok: false,
        error: error.message
      });
    }
  });

  // --- Overview endpoint for dashboard ---
  app.get('/analytics/overview', async (req, reply) => {
    try {
      const { app_key, from, to } = req.query as any;

      if (!app_key) {
        return reply.code(400).send({
          ok: false,
          error: 'app_key parameter required'
        });
      }

      // Build date range
      const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();

      // Query analytics_product_events table
      let query = supabase
        .from('analytics_product_events')
        .select('verb, user_id, session_id, ts')
        .eq('metadata->>app_key', app_key)
        .gte('ts', fromDate.toISOString())
        .lte('ts', toDate.toISOString());

      const { data, error } = await query;

      if (error) {
        console.error('Overview query error:', error);
        return reply.code(500).send({
          ok: false,
          error: error.message
        });
      }

      // Calculate overview metrics
      const uniqueUsers = new Set(data?.map(e => e.user_id) || []);
      const uniqueSessions = new Set(data?.map(e => e.session_id) || []);

      // Group by event type
      const eventsByType: Record<string, number> = {};
      data?.forEach(event => {
        const verb = event.verb || 'unknown';
        eventsByType[verb] = (eventsByType[verb] || 0) + 1;
      });

      const overview = {
        app_key,
        period: {
          from: fromDate.toISOString(),
          to: toDate.toISOString()
        },
        total_events: data?.length || 0,
        unique_sessions: uniqueSessions.size,
        unique_users: uniqueUsers.size,
        events_by_type: Object.entries(eventsByType).map(([verb, count]) => ({
          verb,
          count
        }))
      };

      return reply.send({
        ok: true,
        overview
      });

    } catch (error: any) {
      console.error('Overview error:', error);
      return reply.code(500).send({
        ok: false,
        error: error.message
      });
    }
  });

  // Keep your existing sandbox and other endpoints...
  app.get('/sandbox', async (_req, reply) => {
    reply
      .header('content-type', 'text/html; charset=utf-8')
      .send(`<!doctype html>
<html><head><meta charset="utf-8"/><title>Analytics Sandbox</title>
<style>body{font:14px/1.4 system-ui, sans-serif; padding:16px; max-width:1100px; margin:auto}
pre,textarea{width:100%; min-height:160px; font:12px/1.4 ui-monospace,Menlo,monospace}
.grid{display:grid; gap:16px; grid-template-columns:1fr 1fr}
.card{border:1px solid #ddd; border-radius:10px; padding:12px}</style>
</head><body>
<h1>Analytics Product Events — Sandbox</h1>
<div class="card">
  <h3>Send Test Analytics Event</h3>
  <label>App Key: <input id="appKey" value="test-app-rich"/></label><br/>
  <label>Event Type: <input id="eventType" value="PAGE_VIEW"/></label><br/>
  <label>User ID: <input id="userId" value="12345678"/></label><br/>
  <label>Session ID: <input id="sessionId" value="test-session-123"/></label><br/>
  <label>Event Data JSON:</label>
  <textarea id="eventData">{ "url": "/test", "title": "Test Page" }</textarea>
  <button onclick="sendAnalyticsEvent()">Send Event</button>
  <pre id="result"></pre>
</div>
<script>
async function sendAnalyticsEvent(){
  const body = {
    app_key: document.getElementById('appKey').value,
    events: [{
      id: 'test-' + Date.now(),
      ts: Date.now(),
      event_type: document.getElementById('eventType').value,
      user_id: document.getElementById('userId').value,
      session_id: document.getElementById('sessionId').value,
      data: JSON.parse(document.getElementById('eventData').value || '{}')
    }]
  };
  const r = await fetch('/ingest/analytics', {
    method:'POST', 
    headers:{'content-type':'application/json'}, 
    body: JSON.stringify(body)
  });
  document.getElementById('result').textContent = await r.text();
}
</script>
</body></html>`);
  });
}