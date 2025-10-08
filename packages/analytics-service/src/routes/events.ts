// src/routes/events.ts
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { subscribe } from '../utils/event-bus';
import { StreamQuerySchema } from '../utils/validation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  
  fastify.get('/events/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validate query parameters
    const queryValidation = StreamQuerySchema.safeParse(request.query);
    
    if (!queryValidation.success) {
      return reply.code(400).send({
        ok: false,
        error: 'Invalid query parameters',
        errors: queryValidation.error.issues,
      });
    }

    const { app_key, session_id, event_type } = queryValidation.data;

    // Hijack the reply to prevent Fastify from auto-closing the connection
    reply.hijack();

    // Set CORS headers (required when using hijack, as we bypass Fastify's CORS handling)
    reply.raw.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Set SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection confirmation
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', app_key, session_id, event_type })}\n\n`);

    // Send recent historical events (last 50 events)
    try {
      let query = supabase
        .from('analytics_product_events')
        .select('id, event_type, app_key, user_id, session_id, ts, data')
        .eq('app_key', app_key)
        .order('ts', { ascending: false })
        .limit(50);

      if (session_id) {
        query = query.eq('session_id', session_id);
      }

      if (event_type) {
        query = query.eq('event_type', event_type);
      }

      const { data: historicalEvents, error: histError } = await query;

      if (histError) {
        console.error('Error fetching historical events:', histError);
      } else if (historicalEvents && historicalEvents.length > 0) {
        console.log(`Sending ${historicalEvents.length} historical events to client`);
        // Send events in chronological order (oldest first)
        historicalEvents.reverse().forEach((event, index) => {
          try {
            const message = { type: 'event', event };
            const written = reply.raw.write(`data: ${JSON.stringify(message)}\n\n`);
            if (!written) {
              console.warn(`Backpressure detected at event ${index + 1}/${historicalEvents.length}`);
            }
          } catch (writeError) {
            console.error(`Error writing event ${index + 1}:`, writeError);
          }
        });
        console.log(`Finished sending ${historicalEvents.length} historical events`);
      } else {
        console.log('No historical events found for app_key:', app_key);
      }
    } catch (err) {
      console.error('Exception fetching historical events:', err);
    }

    // Subscribe to events
    const unsubscribe = subscribe(app_key, (event) => {
      try {
        // Filter by event_type if specified
        if (event_type && event.event_type !== event_type) {
          return; // Skip events that don't match the filter
        }
        
        // Write event to stream - wrap in expected format
        const message = { type: 'event', event };
        reply.raw.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (err) {
        console.error('Error writing to SSE stream:', err);
      }
    }, session_id);

    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        reply.raw.write('data: heartbeat\n\n');
      } catch (err) {
        console.error('Error sending heartbeat:', err);
        clearInterval(heartbeatInterval);
      }
    }, 30000); // 30 seconds

    // Cleanup on client disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeatInterval);
      unsubscribe();
      console.log(`SSE client disconnected: app_key=${app_key}, session_id=${session_id || 'all'}, event_type=${event_type || 'all'}`);
    });

    // Log connection
    console.log(`SSE client connected: app_key=${app_key}, session_id=${session_id || 'all'}, event_type=${event_type || 'all'}`);
  });
};

export default eventsRoutes;

