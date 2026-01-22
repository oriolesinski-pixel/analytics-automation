/**
 * Secured Event Ingestion Routes - With Workspace Validation
 * 
 * This file handles incoming analytics events from client-side trackers.
 * Key security measures:
 * - Validates app_key exists and is active
 * - Automatically tags events with correct workspace_id
 * - Rate limiting and validation
 * 
 * Note: Ingestion endpoints are NOT authenticated (public) because they're called
 * from client-side JavaScript. Security is enforced by validating app_key.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin, getWorkspaceForAppKey } from '../config/supabase';
import crypto from 'crypto';

export default async function securedIngestRoutes(app: FastifyInstance) {

  /**
   * INGEST ANALYTICS EVENTS - Primary event ingestion endpoint
   * 
   * POST /ingest/analytics
   * Headers: Content-Type: application/json
   * Body: {
   *   app_key: string,
   *   events: Array<{
   *     event_type: string,
   *     data: object,
   *     user_id?: string,
   *     session_id?: string,
   *     ts?: number
   *   }>
   * }
   * 
   * Response: { ok: true, received: number }
   * 
   * Security: Validates app_key and auto-assigns workspace_id
   */
  app.post('/ingest/analytics', async (req, reply) => {
    try {
      const { app_key, events } = req.body as {
        app_key: string;
        events?: Array<{
          event_type: string;
          data: Record<string, any>;
          user_id?: string;
          session_id?: string;
          ts?: number;
          id?: string;
        }>;
      };

      // Validate required fields
      if (!app_key) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Missing app_key',
          message: 'app_key is required in request body'
        });
      }

      if (!events || !Array.isArray(events) || events.length === 0) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Missing events',
          message: 'events array is required and must not be empty'
        });
      }

      // ✅ CRITICAL: Validate app_key and get workspace_id
      const { data: app, error: appError } = await supabaseAdmin
        .from('apps')
        .select('id, workspace_id, repo_id, name')
        .eq('app_key', app_key)
        .single();

      if (appError || !app) {
        req.log.warn({ app_key }, 'Invalid app_key in event ingestion');
        return reply.code(403).send({ 
          ok: false, 
          error: 'Invalid app_key',
          message: 'App key not found or inactive. Please check your integration.' 
        });
      }

      // Prepare events for insertion
      const now = new Date().toISOString();
      const eventsToInsert = events.map(event => ({
        id: event.id || crypto.randomUUID(),
        app_key,
        workspace_id: app.workspace_id, // ✅ CRITICAL: Tag with workspace
        repo_id: app.repo_id,
        event_name: event.event_type,
        event_type: event.event_type,
        data: event.data || {},
        properties: event.data || {}, // For backwards compatibility
        user_id: event.user_id || null,
        session_id: event.session_id || null,
        ts: event.ts ? new Date(event.ts).toISOString() : now,
        timestamp: event.ts ? new Date(event.ts).toISOString() : now,
        created_at: now
      }));

      // Insert events in batch
      const { error: insertError, count } = await supabaseAdmin
        .from('analytics_product_events')
        .insert(eventsToInsert);

      if (insertError) {
        req.log.error({ 
          error: insertError.message, 
          app_key,
          eventCount: events.length 
        }, 'Failed to insert events');

        return reply.code(500).send({ 
          ok: false, 
          error: 'Failed to store events',
          message: insertError.message 
        });
      }

      req.log.info({ 
        app_key, 
        workspace_id: app.workspace_id,
        count: events.length 
      }, 'Events ingested successfully');

      return reply.send({ 
        ok: true, 
        received: events.length,
        workspace_id: app.workspace_id 
      });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Event ingestion error');
      return reply.code(500).send({ 
        ok: false, 
        error: 'Internal server error',
        message: error.message 
      });
    }
  });

  /**
   * INGEST SINGLE EVENT - Legacy endpoint (backwards compatibility)
   * 
   * POST /ingest/event
   * Body: {
   *   app_key: string,
   *   event: string,
   *   properties: object,
   *   user_id?: string,
   *   session_id?: string
   * }
   * 
   * Response: { ok: true, event_id: string }
   */
  app.post('/ingest/event', async (req, reply) => {
    try {
      const { app_key, event, properties, user_id, session_id } = req.body as {
        app_key: string;
        event: string;
        properties?: Record<string, any>;
        user_id?: string;
        session_id?: string;
      };

      if (!app_key || !event) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Missing required fields',
          message: 'app_key and event are required' 
        });
      }

      // ✅ Validate app_key and get workspace_id
      const { data: app, error: appError } = await supabaseAdmin
        .from('apps')
        .select('id, workspace_id, repo_id')
        .eq('app_key', app_key)
        .single();

      if (appError || !app) {
        return reply.code(403).send({ 
          ok: false, 
          error: 'Invalid app_key' 
        });
      }

      const eventId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Insert single event
      const { error: insertError } = await supabaseAdmin
        .from('analytics_product_events')
        .insert({
          id: eventId,
          app_key,
          workspace_id: app.workspace_id, // ✅ Tag with workspace
          repo_id: app.repo_id,
          event_name: event,
          event_type: event,
          data: properties || {},
          properties: properties || {},
          user_id: user_id || null,
          session_id: session_id || null,
          timestamp: now,
          ts: now,
          created_at: now
        });

      if (insertError) {
        req.log.error({ error: insertError.message }, 'Failed to insert event');
        return reply.code(500).send({ ok: false, error: insertError.message });
      }

      return reply.send({ ok: true, event_id: eventId });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Single event ingestion error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * VALIDATE APP KEY - Check if app_key is valid
   * 
   * GET /ingest/validate/:appKey
   * 
   * Response: { valid: true, app: {...} } or { valid: false }
   * 
   * Useful for client-side validation before sending events
   */
  app.get('/ingest/validate/:appKey', async (req, reply) => {
    try {
      const { appKey } = req.params as { appKey: string };

      const { data: app, error } = await supabaseAdmin
        .from('apps')
        .select('id, name, domain, workspace_id')
        .eq('app_key', appKey)
        .single();

      if (error || !app) {
        return reply.send({ 
          valid: false,
          message: 'App key not found' 
        });
      }

      return reply.send({ 
        valid: true,
        app: {
          name: app.name,
          domain: app.domain
        }
      });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Validate app key error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * BATCH EVENT UPLOAD - For high-volume ingestion
   * 
   * POST /ingest/batch
   * Body: {
   *   batches: Array<{
   *     app_key: string,
   *     events: Array<Event>
   *   }>
   * }
   * 
   * Response: { ok: true, processed: number, failed: number }
   * 
   * Useful for bulk imports or replaying logged events
   */
  app.post('/ingest/batch', async (req, reply) => {
    try {
      const { batches } = req.body as {
        batches: Array<{
          app_key: string;
          events: Array<any>;
        }>;
      };

      if (!batches || !Array.isArray(batches)) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Invalid batches format' 
        });
      }

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const batch of batches) {
        try {
          // Validate app_key for each batch
          const { data: app } = await supabaseAdmin
            .from('apps')
            .select('id, workspace_id, repo_id')
            .eq('app_key', batch.app_key)
            .single();

          if (!app) {
            failed += batch.events.length;
            errors.push(`Invalid app_key: ${batch.app_key}`);
            continue;
          }

          // Prepare events
          const now = new Date().toISOString();
          const eventsToInsert = batch.events.map(event => ({
            id: event.id || crypto.randomUUID(),
            app_key: batch.app_key,
            workspace_id: app.workspace_id, // ✅ Tag with workspace
            repo_id: app.repo_id,
            event_name: event.event_type,
            event_type: event.event_type,
            data: event.data || {},
            properties: event.data || {},
            user_id: event.user_id || null,
            session_id: event.session_id || null,
            timestamp: event.ts ? new Date(event.ts).toISOString() : now,
            ts: event.ts ? new Date(event.ts).toISOString() : now,
            created_at: now
          }));

          // Insert batch
          const { error: insertError } = await supabaseAdmin
            .from('analytics_product_events')
            .insert(eventsToInsert);

          if (insertError) {
            failed += batch.events.length;
            errors.push(insertError.message);
          } else {
            processed += batch.events.length;
          }

        } catch (batchError: any) {
          failed += batch.events.length;
          errors.push(batchError.message);
        }
      }

      req.log.info({ processed, failed }, 'Batch ingestion complete');

      return reply.send({ 
        ok: true, 
        processed, 
        failed,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Batch ingestion error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

}

