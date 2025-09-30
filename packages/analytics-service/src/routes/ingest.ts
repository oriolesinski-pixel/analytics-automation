// src/routes/ingest.ts
import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { logAnalyticsEvent } from '../utils/event-logger';
import { insertEvents } from '../utils/supabase';
import { broadcast } from '../utils/event-bus';
import { validateIngestRequest, AnalyticsEvent } from '../utils/validation';

// Simple in-memory rate limiter
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimiter.get(ip);

  if (!record || record.resetAt < now) {
    // New window
    rateLimiter.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimiter.entries()) {
    if (record.resetAt < now) {
      rateLimiter.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// ---------- Route Module ----------
export default async function ingestRoutes(app: FastifyInstance) {

  // --- Product Analytics Ingest Endpoint with SSE Broadcasting ---
  app.post('/ingest/analytics', async (req, reply) => {
    try {
      // Rate limiting
      const clientIp = req.ip;
      const rateCheck = checkRateLimit(clientIp);
      
      if (!rateCheck.allowed) {
        return reply.code(429).send({
          ok: false,
          error: 'Rate limit exceeded. Maximum 100 requests per minute.',
        });
      }

      // Pre-process: Ensure all events have app_key before validation
      const body = req.body as any;
      if (body && body.app_key && Array.isArray(body.events)) {
        body.events = body.events.map((event: any) => ({
          ...event,
          app_key: event.app_key || body.app_key, // Use event's app_key or fall back to request-level
        }));
      }

      // Validate request body (now all events have app_key)
      const validation = validateIngestRequest(body);
      
      if (!validation.success) {
        return reply.code(400).send({
          ok: false,
          error: 'Validation failed',
          errors: validation.errors,
        });
      }

      const { app_key, events } = validation.data!;

      // Process and normalize events
      const processedEvents: AnalyticsEvent[] = events.map(event => ({
        id: event.id || crypto.randomUUID(),
        event_type: event.event_type.toUpperCase(),
        app_key: event.app_key, // Already merged in pre-processing
        user_id: event.user_id,
        session_id: event.session_id,
        ts: event.ts > 9999999999 ? event.ts : event.ts * 1000, // Convert to ms if needed
        data: event.data || {},
      }));

      // Insert into database
      const result = await insertEvents(processedEvents);

      // Broadcast to SSE clients (even if DB insert failed, for real-time monitoring)
      processedEvents.forEach(event => {
        broadcast(event);
      });

      // Log the events with beautiful formatting (if available)
      if (typeof logAnalyticsEvent === 'function') {
        logAnalyticsEvent(processedEvents, app_key);
      }

      // Return response
      if (!result.success) {
        return reply.code(500).send({
          ok: false,
          received: events.length,
          stored: result.inserted,
          errors: result.errors,
          message: `Stored ${result.inserted}/${events.length} events`,
        });
      }

      return reply.send({
        ok: true,
        received: events.length,
        stored: result.inserted,
        errors: [],
        message: `Successfully stored ${result.inserted} events`,
      });

    } catch (error: any) {
      console.error('Ingest error:', error);
      return reply.code(500).send({
        ok: false,
        error: error.message || 'Internal server error',
      });
    }
  });

  // --- Existing sandbox endpoint ---
  app.get('/sandbox', async (_req, reply) => {
    reply
      .header('content-type', 'text/html; charset=utf-8')
      .send(`<!doctype html>
<html><head><meta charset="utf-8"/><title>Analytics Sandbox</title>
<style>body{font:14px/1.4 system-ui, sans-serif; padding:16px; max-width:1100px; margin:auto}
pre,textarea{width:100%; min-height:160px; font:12px/1.4 ui-monospace,Menlo,monospace}
.grid{display:grid; gap:16px; grid-template-columns:1fr 1fr}
.card{border:1px solid #ddd; border-radius:10px; padding:12px}
button{padding:8px 16px; cursor:pointer; background:#007bff; color:white; border:none; border-radius:4px}
button:hover{background:#0056b3}</style>
</head><body>
<h1>📊 Analytics Product Events — Sandbox</h1>
<div class="card">
  <h3>Send Test Analytics Event</h3>
  <label>App Key: <input id="appKey" value="test-app-rich" style="width:300px"/></label><br/><br/>
  <label>Event Type: <input id="eventType" value="PAGE_VIEW" style="width:300px"/></label><br/><br/>
  <label>User ID: <input id="userId" value="user-${Date.now()}" style="width:300px"/></label><br/><br/>
  <label>Session ID: <input id="sessionId" value="session-${Date.now()}" style="width:300px"/></label><br/><br/>
  <label>Event Data JSON:</label>
  <textarea id="eventData">{ "url": "/test", "title": "Test Page" }</textarea>
  <button onclick="sendAnalyticsEvent()">Send Event</button>
  <pre id="result"></pre>
</div>

<div class="card" style="margin-top:20px">
  <h3>📡 Live Event Stream (SSE)</h3>
  <label>App Key: <input id="streamAppKey" value="test-app-rich" style="width:300px"/></label>
  <label>Session ID (optional): <input id="streamSessionId" value="" style="width:300px"/></label><br/><br/>
  <button onclick="startStream()">Start Stream</button>
  <button onclick="stopStream()">Stop Stream</button>
  <pre id="streamResult" style="background:#f5f5f5; max-height:400px; overflow:auto"></pre>
</div>

<script>
let eventSource = null;

async function sendAnalyticsEvent(){
  const appKey = document.getElementById('appKey').value;
  const body = {
    app_key: appKey,
    events: [{
      id: crypto.randomUUID(),
      ts: Date.now(),
      event_type: document.getElementById('eventType').value,
      app_key: appKey,
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
  const result = await r.json();
  document.getElementById('result').textContent = JSON.stringify(result, null, 2);
}

function startStream() {
  stopStream(); // Close any existing stream
  
  const appKey = document.getElementById('streamAppKey').value;
  const sessionId = document.getElementById('streamSessionId').value;
  
  let url = '/events/stream?app_key=' + encodeURIComponent(appKey);
  if (sessionId) {
    url += '&session_id=' + encodeURIComponent(sessionId);
  }
  
  eventSource = new EventSource(url);
  const resultEl = document.getElementById('streamResult');
  resultEl.textContent = '🟢 Connected. Listening for events...\\n\\n';
  
  eventSource.onmessage = (e) => {
    if (e.data === 'heartbeat') {
      resultEl.textContent += '💓 heartbeat\\n';
    } else {
      const event = JSON.parse(e.data);
      resultEl.textContent += JSON.stringify(event, null, 2) + '\\n\\n';
      resultEl.scrollTop = resultEl.scrollHeight;
    }
  };
  
  eventSource.onerror = (e) => {
    resultEl.textContent += '🔴 Connection error or closed\\n';
    stopStream();
  };
}

function stopStream() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
    document.getElementById('streamResult').textContent += '\\n⏹ Stream stopped\\n';
  }
}
</script>
</body></html>`);
  });
}