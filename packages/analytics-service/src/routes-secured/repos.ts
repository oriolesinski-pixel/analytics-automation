/**
 * Secured Repository Routes - With Workspace Isolation
 * 
 * This file handles repository management with workspace filtering.
 * Integrates with GitHub App installation and ensures repos are tied to workspaces.
 */

import { FastifyInstance } from 'fastify';
import { requireAuth, getAuthUser } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import crypto from 'crypto';

export default async function securedReposRoutes(app: FastifyInstance) {

  /**
   * LIST REPOS - Get all repos in user's workspace
   * 
   * GET /repos/list
   * Headers: Authorization: Bearer <token>
   * Query: installation_id?: string
   * 
   * Response: { ok: true, repos: [...], count: number }
   */
  app.get('/repos/list', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { installation_id } = req.query as { installation_id?: string };

      let query = supabaseAdmin
        .from('repos')
        .select('*')
        .eq('workspace_id', user.workspace_id) // ✅ CRITICAL: Workspace filter
        .order('created_at', { ascending: false });

      if (installation_id) {
        query = query.eq('installation_id', installation_id);
      }

      const { data: repos, error } = await query;

      if (error) {
        req.log.error({ error: error.message }, 'Failed to fetch repos');
        return reply.code(500).send({ ok: false, error: error.message });
      }

      return reply.send({ 
        ok: true, 
        repos: repos || [],
        count: repos?.length || 0 
      });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'List repos error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET REPO BY ID
   * 
   * GET /repos/:repoId
   * Headers: Authorization: Bearer <token>
   * 
   * Response: { ok: true, repo: {...} }
   */
  app.get('/repos/:repoId', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { repoId } = req.params as { repoId: string };

      const { data: repo, error } = await supabaseAdmin
        .from('repos')
        .select('*')
        .eq('id', repoId)
        .eq('workspace_id', user.workspace_id) // ✅ Workspace filter
        .single();

      if (error || !repo) {
        return reply.code(404).send({ 
          ok: false, 
          error: 'Repository not found in your workspace' 
        });
      }

      // Get associated apps
      const { data: apps } = await supabaseAdmin
        .from('apps')
        .select('id, app_key, name')
        .eq('repo_id', repoId)
        .eq('workspace_id', user.workspace_id);

      return reply.send({ 
        ok: true, 
        repo: {
          ...repo,
          apps: apps || []
        }
      });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Get repo error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * ADD REPO MANUALLY
   * 
   * POST /repos/add
   * Headers: Authorization: Bearer <token>
   * Body: {
   *   provider: 'github' | 'gitlab',
   *   owner: string,
   *   name: string,
   *   default_branch?: string,
   *   installation_id?: string
   * }
   * 
   * Response: { ok: true, repo: {...} }
   */
  app.post('/repos/add', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { provider, owner, name, default_branch, installation_id } = req.body as {
        provider: 'github' | 'gitlab';
        owner: string;
        name: string;
        default_branch?: string;
        installation_id?: string;
      };

      if (!provider || !owner || !name) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'provider, owner, and name are required' 
        });
      }

      // Check if repo already exists in workspace
      const { data: existing } = await supabaseAdmin
        .from('repos')
        .select('id')
        .eq('provider', provider)
        .eq('owner', owner)
        .eq('name', name)
        .eq('workspace_id', user.workspace_id)
        .single();

      if (existing) {
        return reply.code(409).send({ 
          ok: false, 
          error: 'Repository already exists in your workspace',
          repo_id: existing.id 
        });
      }

      const { data: repo, error } = await supabaseAdmin
        .from('repos')
        .insert({
          id: crypto.randomUUID(),
          provider,
          owner,
          name,
          default_branch: default_branch || 'main',
          installation_id: installation_id || null,
          workspace_id: user.workspace_id, // ✅ CRITICAL: Set workspace
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        req.log.error({ error: error.message }, 'Failed to add repo');
        return reply.code(500).send({ ok: false, error: error.message });
      }

      req.log.info({ repo_id: repo.id, workspace_id: user.workspace_id }, 'Repo added');
      return reply.code(201).send({ ok: true, repo });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Add repo error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * UPDATE REPO
   * 
   * PUT /repos/:repoId
   * Headers: Authorization: Bearer <token>
   * Body: { default_branch?, installation_id? }
   * 
   * Response: { ok: true, repo: {...} }
   */
  app.put('/repos/:repoId', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { repoId } = req.params as { repoId: string };
      const updates = req.body as Record<string, any>;

      // ✅ Verify ownership
      const { data: existing } = await supabaseAdmin
        .from('repos')
        .select('id')
        .eq('id', repoId)
        .eq('workspace_id', user.workspace_id)
        .single();

      if (!existing) {
        return reply.code(404).send({ ok: false, error: 'Repo not found' });
      }

      const { data: repo, error } = await supabaseAdmin
        .from('repos')
        .update(updates)
        .eq('id', repoId)
        .eq('workspace_id', user.workspace_id)
        .select()
        .single();

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      return reply.send({ ok: true, repo });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Update repo error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * DELETE REPO
   * 
   * DELETE /repos/:repoId
   * Headers: Authorization: Bearer <token>
   * 
   * Response: { ok: true, message: string }
   * 
   * Note: This will also delete all associated apps (CASCADE)
   */
  app.delete('/repos/:repoId', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { repoId } = req.params as { repoId: string };

      // Check for associated apps
      const { data: apps } = await supabaseAdmin
        .from('apps')
        .select('id, name')
        .eq('repo_id', repoId)
        .eq('workspace_id', user.workspace_id);

      if (apps && apps.length > 0) {
        return reply.code(409).send({ 
          ok: false, 
          error: 'Cannot delete repository with associated apps',
          message: `This repo has ${apps.length} app(s). Delete apps first.`,
          apps: apps.map(a => ({ id: a.id, name: a.name }))
        });
      }

      const { error } = await supabaseAdmin
        .from('repos')
        .delete()
        .eq('id', repoId)
        .eq('workspace_id', user.workspace_id); // ✅ Workspace filter

      if (error) {
        req.log.error({ error: error.message }, 'Failed to delete repo');
        return reply.code(500).send({ ok: false, error: error.message });
      }

      req.log.info({ repo_id: repoId, workspace_id: user.workspace_id }, 'Repo deleted');
      return reply.send({ ok: true, message: 'Repository deleted successfully' });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Delete repo error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  /**
   * GET ANALYZER RUNS FOR REPO
   * 
   * GET /repos/:repoId/runs
   * Headers: Authorization: Bearer <token>
   * Query: status?: string, limit?: number
   * 
   * Response: { ok: true, runs: [...], count: number }
   */
  app.get('/repos/:repoId/runs', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const user = getAuthUser(req);
      const { repoId } = req.params as { repoId: string };
      const { status, limit = 50 } = req.query as {
        status?: string;
        limit?: number;
      };

      // ✅ Verify repo belongs to workspace
      const { data: repo } = await supabaseAdmin
        .from('repos')
        .select('id')
        .eq('id', repoId)
        .eq('workspace_id', user.workspace_id)
        .single();

      if (!repo) {
        return reply.code(404).send({ ok: false, error: 'Repo not found' });
      }

      let query = supabaseAdmin
        .from('analyzer_runs')
        .select('*')
        .eq('repo_id', repoId)
        .eq('workspace_id', user.workspace_id) // ✅ Workspace filter
        .order('created_at', { ascending: false })
        .limit(Math.min(Number(limit), 100));

      if (status) {
        query = query.eq('status', status);
      }

      const { data: runs, error } = await query;

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      return reply.send({ 
        ok: true, 
        runs: runs || [],
        count: runs?.length || 0 
      });

    } catch (error: any) {
      req.log.error({ error: error.message }, 'Get runs error');
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

}

