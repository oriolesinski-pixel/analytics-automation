// packages/analytics-service/src/routes/apps.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface RegisterAppBody {
    app_key: string;
    name: string;
    domain?: string;
    repo_id?: string;
    github_repo?: string;
    setup_status?: string;
}

interface UpdateAppBody {
    app_key: string;
    setup_status?: string;
    pr_url?: string;
    pr_number?: number;
    domain?: string;
}

export default async function appsRoutes(fastify: FastifyInstance) {

    // List all apps
    fastify.get('/apps/list', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { data: apps, error } = await supabase
                .from('apps')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                return reply.status(500).send({ error: error.message });
            }

            return reply.send({ apps: apps || [] });
        } catch (error) {
            console.error('Error listing apps:', error);
            return reply.status(500).send({ error: 'Failed to list apps' });
        }
    });

    // Get single app by key
    fastify.get('/apps/:appKey', async (request: FastifyRequest<{ Params: { appKey: string } }>, reply: FastifyReply) => {
        try {
            const { appKey } = request.params;

            const { data: app, error } = await supabase
                .from('apps')
                .select('*')
                .eq('app_key', appKey)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return reply.status(404).send({ error: 'App not found' });
                }
                return reply.status(500).send({ error: error.message });
            }

            return reply.send({ app });
        } catch (error) {
            console.error('Error getting app:', error);
            return reply.status(500).send({ error: 'Failed to get app' });
        }
    });

    // Register new app
    fastify.post('/apps/register', async (request: FastifyRequest<{ Body: RegisterAppBody }>, reply: FastifyReply) => {
        try {
            const { app_key, name, domain, repo_id, github_repo, setup_status } = request.body;

            if (!app_key || !name) {
                return reply.status(400).send({ error: 'app_key and name are required' });
            }

            // Check if app already exists
            const { data: existingApp } = await supabase
                .from('apps')
                .select('id')
                .eq('app_key', app_key)
                .single();

            if (existingApp) {
                // Update existing app
                const { data: updatedApp, error: updateError } = await supabase
                    .from('apps')
                    .update({
                        name,
                        domain: domain || `${app_key}.localhost`,
                        repo_id,
                        github_repo,
                        setup_status: setup_status || 'registered',
                        updated_at: new Date().toISOString()
                    })
                    .eq('app_key', app_key)
                    .select()
                    .single();

                if (updateError) {
                    console.error('Error updating app:', updateError);
                    return reply.status(500).send({ error: updateError.message });
                }

                console.log(`✅ Updated existing app: ${app_key}`);
                return reply.send({
                    app: updatedApp,
                    message: 'App updated successfully',
                    action: 'updated'
                });
            }

            // Create repo if repo_id not provided
            let finalRepoId = repo_id;
            if (!finalRepoId) {
                const repoData = {
                    id: crypto.randomUUID(),
                    name: github_repo?.split('/')[1] || app_key,
                    owner: github_repo?.split('/')[0] || 'local',
                    provider: github_repo ? 'github' : 'local',
                    default_branch: 'main',
                    default_app_key: app_key,
                    created_at: new Date().toISOString()
                };

                const { data: newRepo, error: repoError } = await supabase
                    .from('repos')
                    .insert(repoData)
                    .select()
                    .single();

                if (repoError) {
                    console.error('Error creating repo:', repoError);
                    // Continue without repo_id
                } else {
                    finalRepoId = newRepo.id;
                    console.log(`Created repo for ${app_key}:`, finalRepoId);
                }
            }

            // Create new app
            const appData = {
                app_key,
                name,
                domain: domain || `${app_key}.localhost`,
                repo_id: finalRepoId,
                github_repo,
                setup_status: setup_status || 'registered',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data: newApp, error: createError } = await supabase
                .from('apps')
                .insert(appData)
                .select()
                .single();

            if (createError) {
                console.error('Error creating app:', createError);
                return reply.status(500).send({ error: createError.message });
            }

            console.log(`✅ Registered new app: ${app_key}`);
            return reply.status(201).send({
                app: newApp,
                message: 'App registered successfully',
                action: 'created'
            });
        } catch (error) {
            console.error('Error in register app:', error);
            return reply.status(500).send({ error: 'Failed to register app' });
        }
    });

    // Update app status
    fastify.post('/apps/update', async (request: FastifyRequest<{ Body: UpdateAppBody }>, reply: FastifyReply) => {
        try {
            const { app_key, setup_status, pr_url, pr_number, domain } = request.body;

            if (!app_key) {
                return reply.status(400).send({ error: 'app_key is required' });
            }

            const updateData: any = {
                updated_at: new Date().toISOString()
            };

            if (setup_status !== undefined) updateData.setup_status = setup_status;
            if (pr_url !== undefined) updateData.pr_url = pr_url;
            if (pr_number !== undefined) updateData.pr_number = pr_number;
            if (domain !== undefined) updateData.domain = domain;

            const { data: updatedApp, error } = await supabase
                .from('apps')
                .update(updateData)
                .eq('app_key', app_key)
                .select()
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return reply.status(404).send({ error: 'App not found' });
                }
                return reply.status(500).send({ error: error.message });
            }

            console.log(`✅ Updated app ${app_key} status to: ${setup_status || 'updated'}`);
            return reply.send({
                app: updatedApp,
                message: 'App updated successfully'
            });
        } catch (error) {
            console.error('Error updating app:', error);
            return reply.status(500).send({ error: 'Failed to update app' });
        }
    });

    // Update app status (simpler endpoint)
    fastify.post('/apps/update-status', async (request: FastifyRequest<{ Body: { app_key: string; setup_status: string } }>, reply: FastifyReply) => {
        try {
            const { app_key, setup_status } = request.body;

            if (!app_key || !setup_status) {
                return reply.status(400).send({ error: 'app_key and setup_status are required' });
            }

            const { data, error } = await supabase
                .from('apps')
                .update({
                    setup_status,
                    updated_at: new Date().toISOString()
                })
                .eq('app_key', app_key)
                .select()
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return reply.status(404).send({ error: 'App not found' });
                }
                return reply.status(500).send({ error: error.message });
            }

            console.log(`✅ Updated ${app_key} status to: ${setup_status}`);
            return reply.send({ success: true, app: data });
        } catch (error) {
            console.error('Error updating status:', error);
            return reply.status(500).send({ error: 'Failed to update status' });
        }
    });

    // Delete app
    fastify.delete('/apps/:appKey', async (request: FastifyRequest<{ Params: { appKey: string } }>, reply: FastifyReply) => {
        try {
            const { appKey } = request.params;

            const { error } = await supabase
                .from('apps')
                .delete()
                .eq('app_key', appKey);

            if (error) {
                return reply.status(500).send({ error: error.message });
            }

            console.log(`✅ Deleted app: ${appKey}`);
            return reply.send({ message: 'App deleted successfully' });
        } catch (error) {
            console.error('Error deleting app:', error);
            return reply.status(500).send({ error: 'Failed to delete app' });
        }
    });

    // Get app analytics summary
    fastify.get('/apps/:appKey/analytics', async (request: FastifyRequest<{ Params: { appKey: string } }>, reply: FastifyReply) => {
        try {
            const { appKey } = request.params;

            // Get app first
            const { data: app, error: appError } = await supabase
                .from('apps')
                .select('id, name')
                .eq('app_key', appKey)
                .single();

            if (appError || !app) {
                return reply.status(404).send({ error: 'App not found' });
            }

            // Get event counts
            const { count: totalEvents, error: countError } = await supabase
                .from('events')
                .select('*', { count: 'exact', head: true })
                .eq('app_id', app.id);

            // Get recent events
            const { data: recentEvents, error: eventsError } = await supabase
                .from('events')
                .select('*')
                .eq('app_id', app.id)
                .order('timestamp', { ascending: false })
                .limit(10);

            // Get unique users (distinct session_ids)
            const { data: sessions, error: sessionsError } = await supabase
                .from('events')
                .select('session_id')
                .eq('app_id', app.id);

            const uniqueSessions = sessions ? [...new Set(sessions.map(s => s.session_id))].length : 0;

            return reply.send({
                app: {
                    ...app,
                    app_key: appKey
                },
                analytics: {
                    totalEvents: totalEvents || 0,
                    uniqueSessions,
                    recentEvents: recentEvents || []
                }
            });
        } catch (error) {
            console.error('Error getting analytics:', error);
            return reply.status(500).send({ error: 'Failed to get analytics' });
        }
    });
}