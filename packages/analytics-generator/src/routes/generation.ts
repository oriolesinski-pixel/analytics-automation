import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { AnalyticsIntelligenceGenerator } from '../lib/analytics-intelligence-generator';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

async function analyticsIntelligenceRoutes(app: FastifyInstance) {
    app.post('/analytics/generate-unified', async (req, reply) => {
        try {
            const { repo_id, app_key, domain, backend_url, business_context, sample_routes } = req.body as any;

            if (!repo_id || !app_key) {
                return reply.code(400).send({
                    error: 'repo_id and app_key are required'
                });
            }

            console.log('🚀 Starting unified analytics generation for:', app_key);

            // Get repo info
            const { data: repo } = await supabase
                .from('repos')
                .select('*')
                .eq('id', repo_id)
                .single();

            if (!repo) {
                return reply.code(404).send({ error: 'Repository not found' });
            }

            // Get latest analyzer run for framework detection
            const { data: latestRun } = await supabase
                .from('analyzer_runs')
                .select('summary')
                .eq('repo_id', repo_id)
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const frameworks = latestRun?.summary?.schema?.frameworks || ['react'];

            // Generate unified implementation
            const generator = new AnalyticsIntelligenceGenerator();
            const output = await generator.generate({
                repoId: repo_id,
                appKey: app_key,
                domain: domain || 'localhost:3000',
                backendUrl: backend_url || 'http://localhost:8080/ingest/analytics',
                frameworks,
                businessContext: business_context,
                sample_routes
            });

            return reply.send({
                success: true,
                app_key,
                metadata: output.metadata,
                files: Object.keys(output).filter(k => k !== 'metadata'),
                message: `Generated ${output.metadata.eventCount} contextual events with required fields`
            });

        } catch (error: any) {
            console.error('❌ Generation failed:', error);
            return reply.code(500).send({
                error: 'Failed to generate unified analytics',
                message: error.message
            });
        }
    });

    app.get('/analytics/latest/:repo_id', async (req, reply) => {
        try {
            const { repo_id } = req.params as any;

            const { data: latest } = await supabase
                .from('events')
                .select('metadata, ts')
                .eq('repo_id', repo_id)
                .eq('verb', 'analytics_implementation')
                .order('ts', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!latest) {
                return reply.code(404).send({ error: 'No analytics implementation found' });
            }

            return reply.send({
                success: true,
                generated_at: latest.ts,
                ...latest.metadata
            });

        } catch (error: any) {
            return reply.code(500).send({ error: 'Failed to retrieve implementation' });
        }
    });

    // TEST ENDPOINT FOR FILE READING
    app.get('/analytics/test-file-read/:repo_id', async (req, reply) => {
        try {
            const { repo_id } = req.params as any;

            const generator = new AnalyticsIntelligenceGenerator();
            // @ts-ignore - we'll make this public temporarily
            const files = await generator.loadRepositoryFiles(repo_id);

            return reply.send({
                repo_id,
                files_found: files.length,
                file_paths: files.map((f: any) => f.path),
                sample_content: files[0]?.content?.slice(0, 500),
                repo_path_checked: `/Users/oriolesinski/analytics-automation/examples/demo-next`
            });
        } catch (error: any) {
            return reply.code(500).send({
                error: 'Failed to test file reading',
                message: error.message
            });
        }
    });
}

export default fp(analyticsIntelligenceRoutes, { name: 'analytics-intelligence-routes' });