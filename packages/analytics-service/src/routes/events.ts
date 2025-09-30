// src/routes/events.ts
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { subscribe } from '../utils/event-bus';
import { StreamQuerySchema } from '../utils/validation';

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

    const { app_key, session_id } = queryValidation.data;

    // Set SSE headers
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection confirmation
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', app_key, session_id })}\n\n`);

    // Subscribe to events
    const unsubscribe = subscribe(app_key, (event) => {
      try {
        // Write event to stream
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
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
      console.log(`SSE client disconnected: app_key=${app_key}, session_id=${session_id || 'all'}`);
    });

    // Log connection
    console.log(`SSE client connected: app_key=${app_key}, session_id=${session_id || 'all'}`);
  });
};

export default eventsRoutes;
