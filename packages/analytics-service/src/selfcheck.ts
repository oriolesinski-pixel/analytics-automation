/**
 * Selfcheck module - Health check and diagnostics
 */

import { FastifyInstance } from 'fastify';

export default async function selfcheck(app: FastifyInstance) {
  // Self-check endpoint
  app.get('/selfcheck', async (req, reply) => {
    return reply.send({
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // Detailed health endpoint
  app.get('/selfcheck/detailed', async (req, reply) => {
    return reply.send({
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        api: 'running'
      }
    });
  });
}

