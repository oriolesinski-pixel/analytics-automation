/**
 * Secured Analytics Query Routes - With Workspace Isolation
 * 
 * This file contains all analytics query endpoints with workspace filtering.
 * All routes require authentication and automatically filter by workspace.
 */

import { FastifyInstance } from 'fastify';
import { requireAuth, getAuthUser } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';

export default async function securedAnalyticsRoutes(app: FastifyInstance) {

  /**
   * GET EVENTS - Query events with filters
   * 
   * GET /analytics/events
   * Headers: Authorization: Bearer <token>
   * Query: 
   *   - app_key?: string
   *   - event_type?: string
   *   - start_date?: ISO date
   *   - end_date?: ISO date
   *   - limit?: number (max 1000)
   *   - offset?: number
   * 
   * Response: { ok: true, events: [...], count: number }
   */
  app.get('/analytics/events', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
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

      // Enforce max limit
      const safeLimit = Math.min(Number(limit), 1000);

      // Build query with workspace filter
      let query = supabaseAdmin
        .from('analytics_product_events')
        .select('*')
        .eq('workspace_id', user.workspace_id) // ✅ CRITICAL: Workspace filter
        .order('timestamp', { ascending: false })
        .range(Number(offset), Number(offset) + safeLimit - 1);

      // Apply optional filters
      if (app_key) {
        // ✅ Verify app_key belongs to workspace
        const { data: app } = await supabaseAdmin
          .from('apps')
          .select('id')
          .eq('app_key', app_key)
          .eq('workspace_id', user.workspace_id)
          .single();

        if (!app) {
          return reply.code(403).send({ 
            ok: false, 
            error: 'Invalid app_key for your workspace' 
          });
        }

        query = query.eq('app_key', app_key);
      }

      if (event_type) query = query.eq('event_type', event_type);
      if (start_date) query = query.gte('timestamp', start_date);
      if (end_date) query = query.lte('timestamp', end_date);

      const { data: events, error, count } = await query;

      if (error) {
        req.log.error({ error: error.message }, 'Failed to fetch events');
        return reply.code(500).send({ ok: false, error: error.message });
      }

      return reply.send({ 
        ok: true, 
        events: events || [],
        count: events?.length || 0,
        total: count
      });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Query events error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET EVENT SUMMARY - Aggregated event statistics
   * 
   * GET /analytics/summary
   * Headers: Authorization: Bearer <token>
   * Query:
   *   - app_key?: string
   *   - start_date?: ISO date
   *   - end_date?: ISO date
   *   - group_by?: 'event_type' | 'day' | 'hour'
   * 
   * Response: { ok: true, summary: {...} }
   */
  app.get('/analytics/summary', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { app_key, start_date, end_date, group_by } = req.query as {
        app_key?: string;
        start_date?: string;
        end_date?: string;
        group_by?: 'event_type' | 'day' | 'hour';
      };

      // Validate app_key if provided
      if (app_key) {
        const { data: app } = await supabaseAdmin
          .from('apps')
          .select('id')
          .eq('app_key', app_key)
          .eq('workspace_id', user.workspace_id)
          .single();

        if (!app) {
          return reply.code(403).send({ ok: false, error: 'Invalid app_key' });
        }
      }

      // Build base query
      let query = supabaseAdmin
        .from('analytics_product_events')
        .select('event_type, timestamp, user_id, session_id')
        .eq('workspace_id', user.workspace_id); // ✅ Workspace filter

      if (app_key) query = query.eq('app_key', app_key);
      if (start_date) query = query.gte('timestamp', start_date);
      if (end_date) query = query.lte('timestamp', end_date);

      const { data: events, error } = await query;

      if (error) {
        req.log.error({ error: error.message }, 'Failed to fetch event summary');
        return reply.code(500).send({ ok: false, error: error.message });
      }

      // Aggregate data
      const summary: any = {
        total_events: events?.length || 0,
        unique_users: [...new Set(events?.map(e => e.user_id).filter(Boolean))].length,
        unique_sessions: [...new Set(events?.map(e => e.session_id).filter(Boolean))].length,
        event_types: {}
      };

      // Group by event type
      events?.forEach(event => {
        summary.event_types[event.event_type] = 
          (summary.event_types[event.event_type] || 0) + 1;
      });

      // Time-based grouping
      if (group_by === 'day' || group_by === 'hour') {
        summary.timeline = {};
        events?.forEach(event => {
          const date = new Date(event.timestamp);
          const key = group_by === 'day' 
            ? date.toISOString().split('T')[0]
            : date.toISOString().slice(0, 13) + ':00:00Z';
          
          summary.timeline[key] = (summary.timeline[key] || 0) + 1;
        });
      }

      return reply.send({ ok: true, summary });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Summary error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET FUNNEL ANALYSIS
   * 
   * POST /analytics/funnel
   * Headers: Authorization: Bearer <token>
   * Body: {
   *   app_key: string,
   *   steps: Array<{ event_type: string, filters?: object }>,
   *   start_date?: string,
   *   end_date?: string
   * }
   * 
   * Response: { ok: true, funnel: [...] }
   */
  app.post('/analytics/funnel', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { app_key, steps, start_date, end_date } = req.body as {
        app_key: string;
        steps: Array<{ event_type: string; filters?: Record<string, any> }>;
        start_date?: string;
        end_date?: string;
      };

      if (!app_key || !steps || steps.length === 0) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'app_key and steps are required' 
        });
      }

      // ✅ Verify app_key
      const { data: app } = await supabaseAdmin
        .from('apps')
        .select('id')
        .eq('app_key', app_key)
        .eq('workspace_id', user.workspace_id)
        .single();

      if (!app) {
        return reply.code(403).send({ ok: false, error: 'Invalid app_key' });
      }

      // Fetch all relevant events
      let query = supabaseAdmin
        .from('analytics_product_events')
        .select('event_type, user_id, session_id, timestamp, data')
        .eq('workspace_id', user.workspace_id) // ✅ Workspace filter
        .eq('app_key', app_key)
        .in('event_type', steps.map(s => s.event_type))
        .order('timestamp', { ascending: true });

      if (start_date) query = query.gte('timestamp', start_date);
      if (end_date) query = query.lte('timestamp', end_date);

      const { data: events, error } = await query;

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      // Calculate funnel
      const funnel = steps.map((step, index) => {
        const stepEvents = events?.filter(e => e.event_type === step.event_type) || [];
        const uniqueUsers = [...new Set(stepEvents.map(e => e.user_id).filter(Boolean))];

        return {
          step: index + 1,
          event_type: step.event_type,
          users: uniqueUsers.length,
          events: stepEvents.length,
          conversion_rate: index === 0 ? 100 : 0 // Calculate properly in production
        };
      });

      // Calculate conversion rates
      for (let i = 1; i < funnel.length; i++) {
        if (funnel[0].users > 0) {
          funnel[i].conversion_rate = (funnel[i].users / funnel[0].users) * 100;
        }
      }

      return reply.send({ ok: true, funnel });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Funnel analysis error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET REAL-TIME METRICS
   * 
   * GET /analytics/realtime
   * Headers: Authorization: Bearer <token>
   * Query: app_key?: string, minutes?: number (default 5)
   * 
   * Response: { ok: true, metrics: {...} }
   */
  app.get('/analytics/realtime', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { app_key, minutes = 5 } = req.query as {
        app_key?: string;
        minutes?: number;
      };

      const cutoffTime = new Date(Date.now() - Number(minutes) * 60 * 1000).toISOString();

      let query = supabaseAdmin
        .from('analytics_product_events')
        .select('event_type, user_id, session_id, timestamp')
        .eq('workspace_id', user.workspace_id) // ✅ Workspace filter
        .gte('timestamp', cutoffTime)
        .order('timestamp', { ascending: false });

      if (app_key) {
        const { data: app } = await supabaseAdmin
          .from('apps')
          .select('id')
          .eq('app_key', app_key)
          .eq('workspace_id', user.workspace_id)
          .single();

        if (!app) {
          return reply.code(403).send({ ok: false, error: 'Invalid app_key' });
        }

        query = query.eq('app_key', app_key);
      }

      const { data: events, error } = await query;

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      const metrics = {
        time_window_minutes: minutes,
        total_events: events?.length || 0,
        active_users: [...new Set(events?.map(e => e.user_id).filter(Boolean))].length,
        active_sessions: [...new Set(events?.map(e => e.session_id).filter(Boolean))].length,
        events_per_minute: events ? events.length / Number(minutes) : 0,
        recent_events: events?.slice(0, 10) || []
      };

      return reply.send({ ok: true, metrics });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Realtime metrics error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET USER JOURNEY
   * 
   * GET /analytics/journey/:userId
   * Headers: Authorization: Bearer <token>
   * Query: app_key: string, limit?: number
   * 
   * Response: { ok: true, journey: [...] }
   */
  app.get('/analytics/journey/:userId', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { userId } = req.params as { userId: string };
      const { app_key, limit = 100 } = req.query as {
        app_key: string;
        limit?: number;
      };

      if (!app_key) {
        return reply.code(400).send({ ok: false, error: 'app_key is required' });
      }

      // ✅ Verify app_key
      const { data: app } = await supabaseAdmin
        .from('apps')
        .select('id')
        .eq('app_key', app_key)
        .eq('workspace_id', user.workspace_id)
        .single();

      if (!app) {
        return reply.code(403).send({ ok: false, error: 'Invalid app_key' });
      }

      const { data: journey, error } = await supabaseAdmin
        .from('analytics_product_events')
        .select('*')
        .eq('workspace_id', user.workspace_id) // ✅ Workspace filter
        .eq('app_key', app_key)
        .eq('user_id', userId)
        .order('timestamp', { ascending: true })
        .limit(Math.min(Number(limit), 1000));

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      return reply.send({ ok: true, journey: journey || [] });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'User journey error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

}

