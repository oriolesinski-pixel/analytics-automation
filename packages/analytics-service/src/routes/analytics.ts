/**
 * Analytics Query Routes - Public (no auth required)
 * 
 * Basic analytics endpoints for querying event data.
 * For secured multi-tenant endpoints, see routes-secured/analytics.ts
 */

import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';

// Lazy-initialized Supabase client (env vars loaded by the time routes are registered)
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
    if (!_supabase) {
        _supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );
    }
    return _supabase;
}

export default async function analyticsRoutes(app: FastifyInstance) {

  /**
   * GET /analytics/events - Query events with filters
   */
  app.get('/analytics/events', async (req, reply) => {
    try {
      const { 
        app_key, 
        event_type, 
        start_date, 
        end_date, 
        limit = 100,
        offset = 0
      } = req.query as {
        app_key?: string;
        event_type?: string;
        start_date?: string;
        end_date?: string;
        limit?: number;
        offset?: number;
      };

      const safeLimit = Math.min(Number(limit), 1000);

      let query = getSupabase()
        .from('analytics_product_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(Number(offset), Number(offset) + safeLimit - 1);

      if (app_key) query = query.eq('app_key', app_key);
      if (event_type) query = query.eq('event_type', event_type);
      if (start_date) query = query.gte('timestamp', start_date);
      if (end_date) query = query.lte('timestamp', end_date);

      const { data: events, error } = await query;

      if (error) {
        req.log.error({ error: error.message }, 'Failed to fetch events');
        return reply.code(500).send({ ok: false, error: error.message });
      }

      return reply.send({ 
        ok: true, 
        events: events || [],
        count: events?.length || 0
      });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Query events error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET /analytics/summary - Get summary stats
   */
  app.get('/analytics/summary', async (req, reply) => {
    try {
      const { app_key } = req.query as { app_key?: string };

      let query = getSupabase()
        .from('analytics_product_events')
        .select('event_type', { count: 'exact' });

      if (app_key) query = query.eq('app_key', app_key);

      const { count, error } = await query;

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      return reply.send({ 
        ok: true,
        total_events: count || 0
      });

    } catch (error: any) {
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET /analytics/apps - List apps
   */
  app.get('/analytics/apps', async (req, reply) => {
    try {
      const { data: apps, error } = await getSupabase()
        .from('apps')
        .select('id, app_key, name, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      return reply.send({ ok: true, apps: apps || [] });

    } catch (error: any) {
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });
}
