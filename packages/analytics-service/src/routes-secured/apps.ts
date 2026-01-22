/**
 * Secured Apps Routes - With Workspace Isolation
 * 
 * This file contains workspace-isolated implementations of all app management routes.
 * All routes enforce authentication and workspace-based access control.
 * 
 * Replace the existing routes in server.ts with these secured versions.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, getAuthUser, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import crypto from 'crypto';

export default async function securedAppsRoutes(app: FastifyInstance) {

  /**
   * LIST APPS - Get all apps in user's workspace
   * 
   * GET /apps/list
   * Headers: Authorization: Bearer <token>
   * 
   * Response: { ok: true, apps: [...], count: number }
   */
  app.get('/apps/list', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);

      const { data: apps, error } = await supabaseAdmin
        .from('apps')
        .select('*, repos:repo_id (owner, name, id)')
        .eq('workspace_id', user.workspace_id) // ✅ CRITICAL: Workspace filter
        .order('created_at', { ascending: false });

      if (error) {
        req.log.error({ error: error.message }, 'Failed to fetch apps');
        return reply.code(500).send({ 
          ok: false, 
          error: 'Failed to fetch apps',
          message: error.message 
        });
      }

      return reply.send({ 
        ok: true, 
        apps: apps || [],
        count: apps?.length || 0 
      });
    } catch (error: any) {
      req.log.error({ error: error.message }, 'Apps list error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET APP BY KEY - Get single app details
   * 
   * GET /apps/:appKey
   * Headers: Authorization: Bearer <token>
   * 
   * Response: { ok: true, app: {...} }
   */
  app.get('/apps/:appKey', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { appKey } = req.params as { appKey: string };

      const { data: app, error } = await supabaseAdmin
        .from('apps')
        .select('*, repos:repo_id (owner, name, id, default_branch)')
        .eq('app_key', appKey)
        .eq('workspace_id', user.workspace_id) // ✅ Workspace filter
        .single();

      if (error || !app) {
        return reply.code(404).send({ 
          ok: false, 
          error: 'App not found',
          message: 'App not found in your workspace' 
        });
      }

      return reply.send({ ok: true, app });
    } catch (error: any) {
      req.log.error({ error: error.message }, 'Get app error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * REGISTER APP - Create new app in workspace
   * 
   * POST /apps/register
   * Headers: Authorization: Bearer <token>
   * Body: { repo_id: string, name: string, domain?: string }
   * 
   * Response: { ok: true, app: {...}, action: 'created' | 'updated' }
   */
  app.post('/apps/register', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { repo_id, name, domain, app_key } = req.body as {
        repo_id: string;
        name: string;
        domain?: string;
        app_key?: string;
      };

      // Validate required fields
      if (!repo_id || !name) {
        return reply.code(400).send({
          ok: false,
          error: 'Missing required fields',
          message: 'repo_id and name are required'
        });
      }

      // ✅ CRITICAL: Verify repo belongs to user's workspace
      const { data: repo, error: repoError } = await supabaseAdmin
        .from('repos')
        .select('id, owner, name')
        .eq('id', repo_id)
        .eq('workspace_id', user.workspace_id) // ✅ Workspace validation
        .single();

      if (repoError || !repo) {
        req.log.warn({ repo_id, workspace_id: user.workspace_id }, 'Repo not found in workspace');
        return reply.code(403).send({ 
          ok: false,
          error: 'Forbidden',
          message: 'Repository not found in your workspace' 
        });
      }

      // Check if app_key already exists (update case)
      if (app_key) {
        const { data: existingApp } = await supabaseAdmin
          .from('apps')
          .select('id')
          .eq('app_key', app_key)
          .eq('workspace_id', user.workspace_id)
          .single();

        if (existingApp) {
          // Update existing app
          const { data: updatedApp, error: updateError } = await supabaseAdmin
            .from('apps')
            .update({
              name,
              domain: domain || `${app_key}.localhost`,
              repo_id,
              updated_at: new Date().toISOString()
            })
            .eq('app_key', app_key)
            .eq('workspace_id', user.workspace_id)
            .select('*, repos:repo_id (owner, name)')
            .single();

          if (updateError) {
            req.log.error({ error: updateError.message }, 'Failed to update app');
            return reply.code(500).send({ ok: false, error: updateError.message });
          }

          req.log.info({ app_key, workspace_id: user.workspace_id }, 'App updated');
          return reply.send({ ok: true, app: updatedApp, action: 'updated' });
        }
      }

      // Generate unique app_key
      const generatedAppKey = app_key || `app-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      // Create new app
      const { data: newApp, error: createError } = await supabaseAdmin
        .from('apps')
        .insert({
          app_key: generatedAppKey,
          name,
          domain: domain || `${generatedAppKey}.localhost`,
          repo_id,
          workspace_id: user.workspace_id, // ✅ CRITICAL: Set workspace
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*, repos:repo_id (owner, name)')
        .single();

      if (createError) {
        req.log.error({ error: createError.message }, 'Failed to create app');
        return reply.code(500).send({ 
          ok: false, 
          error: 'Failed to create app',
          message: createError.message 
        });
      }

      req.log.info({ app_key: generatedAppKey, workspace_id: user.workspace_id }, 'App created');
      return reply.code(201).send({ ok: true, app: newApp, action: 'created' });
      
    } catch (error: any) {
      req.log.error({ error: error.message }, 'Register app error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * UPDATE APP - Modify existing app
   * 
   * PUT /apps/:appKey
   * Headers: Authorization: Bearer <token>
   * Body: { name?, domain?, setup_status?, pr_url?, pr_number? }
   * 
   * Response: { ok: true, app: {...} }
   */
  app.put('/apps/:appKey', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { appKey } = req.params as { appKey: string };
      const updates = req.body as Record<string, any>;

      // ✅ Verify ownership before update
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('apps')
        .select('id')
        .eq('app_key', appKey)
        .eq('workspace_id', user.workspace_id) // ✅ Workspace filter
        .single();

      if (checkError || !existing) {
        return reply.code(404).send({ 
          ok: false, 
          error: 'App not found',
          message: 'App not found in your workspace' 
        });
      }

      // Perform update
      const { data: updatedApp, error: updateError } = await supabaseAdmin
        .from('apps')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('app_key', appKey)
        .eq('workspace_id', user.workspace_id)
        .select('*, repos:repo_id (owner, name)')
        .single();

      if (updateError) {
        req.log.error({ error: updateError.message }, 'Failed to update app');
        return reply.code(500).send({ ok: false, error: updateError.message });
      }

      req.log.info({ app_key: appKey }, 'App updated');
      return reply.send({ ok: true, app: updatedApp });
      
    } catch (error: any) {
      req.log.error({ error: error.message }, 'Update app error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * UPDATE APP STATUS - Quick status update
   * 
   * POST /apps/:appKey/status
   * Headers: Authorization: Bearer <token>
   * Body: { setup_status: string }
   * 
   * Response: { ok: true, app: {...} }
   */
  app.post('/apps/:appKey/status', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { appKey } = req.params as { appKey: string };
      const { setup_status } = req.body as { setup_status: string };

      if (!setup_status) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Missing setup_status' 
        });
      }

      const { data: app, error } = await supabaseAdmin
        .from('apps')
        .update({
          setup_status,
          updated_at: new Date().toISOString()
        })
        .eq('app_key', appKey)
        .eq('workspace_id', user.workspace_id) // ✅ Workspace filter
        .select()
        .single();

      if (error || !app) {
        return reply.code(404).send({ ok: false, error: 'App not found' });
      }

      return reply.send({ ok: true, app });
      
    } catch (error: any) {
      req.log.error({ error: error.message }, 'Update status error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * DELETE APP - Remove app from workspace
   * 
   * DELETE /apps/:appKey
   * Headers: Authorization: Bearer <token>
   * 
   * Response: { ok: true, message: string }
   * 
   * Note: Requires 'admin' or 'owner' role
   */
  app.delete('/apps/:appKey', { 
    preHandler: [requireAuth, requireRole(['owner', 'admin'])] 
  }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { appKey } = req.params as { appKey: string };

      // Delete with workspace filter for safety
      const { error } = await supabaseAdmin
        .from('apps')
        .delete()
        .eq('app_key', appKey)
        .eq('workspace_id', user.workspace_id); // ✅ Workspace filter

      if (error) {
        req.log.error({ error: error.message }, 'Failed to delete app');
        return reply.code(500).send({ ok: false, error: error.message });
      }

      req.log.info({ app_key: appKey, workspace_id: user.workspace_id }, 'App deleted');
      return reply.send({ 
        ok: true, 
        message: 'App deleted successfully' 
      });
      
    } catch (error: any) {
      req.log.error({ error: error.message }, 'Delete app error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET APP ANALYTICS SUMMARY
   * 
   * GET /apps/:appKey/analytics
   * Headers: Authorization: Bearer <token>
   * Query: ?start_date=...&end_date=...
   * 
   * Response: { ok: true, app: {...}, analytics: {...} }
   */
  app.get('/apps/:appKey/analytics', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { appKey } = req.params as { appKey: string };
      const { start_date, end_date } = req.query as { 
        start_date?: string; 
        end_date?: string; 
      };

      // ✅ Verify app ownership
      const { data: app, error: appError } = await supabaseAdmin
        .from('apps')
        .select('id, name, app_key')
        .eq('app_key', appKey)
        .eq('workspace_id', user.workspace_id) // ✅ Workspace filter
        .single();

      if (appError || !app) {
        return reply.code(404).send({ ok: false, error: 'App not found' });
      }

      // Get event counts
      let eventQuery = supabaseAdmin
        .from('analytics_product_events')
        .select('*', { count: 'exact', head: true })
        .eq('app_key', appKey)
        .eq('workspace_id', user.workspace_id); // ✅ Workspace filter

      if (start_date) eventQuery = eventQuery.gte('timestamp', start_date);
      if (end_date) eventQuery = eventQuery.lte('timestamp', end_date);

      const { count: totalEvents } = await eventQuery;

      // Get recent events
      const { data: recentEvents } = await supabaseAdmin
        .from('analytics_product_events')
        .select('*')
        .eq('app_key', appKey)
        .eq('workspace_id', user.workspace_id) // ✅ Workspace filter
        .order('timestamp', { ascending: false })
        .limit(10);

      // Get unique sessions
      const { data: sessions } = await supabaseAdmin
        .from('analytics_product_events')
        .select('session_id')
        .eq('app_key', appKey)
        .eq('workspace_id', user.workspace_id); // ✅ Workspace filter

      const uniqueSessions = sessions 
        ? [...new Set(sessions.map(s => s.session_id).filter(Boolean))].length 
        : 0;

      return reply.send({
        ok: true,
        app,
        analytics: {
          totalEvents: totalEvents || 0,
          uniqueSessions,
          recentEvents: recentEvents || []
        }
      });
      
    } catch (error: any) {
      req.log.error({ error: error.message }, 'Get analytics error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

}

