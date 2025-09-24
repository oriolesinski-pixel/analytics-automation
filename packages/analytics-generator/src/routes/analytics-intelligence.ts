import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { AnalyticsIntelligenceGenerator } from '../lib/analytics-intelligence-generator';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

// Helper to execute shell commands
function executeCommand(command: string, args: string[], options: any = {}): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            ...options,
            shell: true
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            } else {
                resolve({ stdout, stderr });
            }
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

async function analyticsIntelligenceRoutes(app: FastifyInstance) {
    app.post('/analytics/generate-unified', async (req, reply) => {
        try {
            const {
                repo_id,
                app_key,
                domain,
                backend_url,
                business_context,
                sample_routes,
                repo_name,
                repo_owner,
                default_branch,
                github_token,
                use_github,
                clone_url,
                use_local_repo // New flag for explicit local repo usage
            } = req.body as any;

            if (!repo_id || !app_key) {
                return reply.code(400).send({
                    error: 'repo_id and app_key are required'
                });
            }

            console.log('🚀 Starting unified analytics generation for:', app_key);
            console.log('📋 Request parameters:');
            console.log('  - repo_id:', repo_id);
            console.log('  - repo_owner:', repo_owner);
            console.log('  - repo_name:', repo_name);
            console.log('  - use_github:', use_github);
            console.log('  - has_github_token:', !!github_token);
            console.log('  - clone_url:', clone_url);
            console.log('  - use_local_repo:', use_local_repo);

            // Handle repo record in database
            let { data: repo } = await supabase
                .from('repos')
                .select('*')
                .eq('id', repo_id)
                .single();

            // If repo doesn't exist and we have the necessary info, create it
            if (!repo && repo_name && repo_owner) {
                console.log(`📝 Creating repo record for ${repo_owner}/${repo_name}`);

                // Check if repo_id is a valid UUID, if not generate one
                let validRepoId = repo_id;
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

                if (!uuidRegex.test(repo_id)) {
                    validRepoId = uuidv4();
                    console.log(`Generated new UUID for repo: ${validRepoId}`);
                }

                const { data: createdRepo, error: createError } = await supabase
                    .from('repos')
                    .insert({
                        id: validRepoId,
                        provider: 'github',
                        owner: repo_owner,
                        name: repo_name,
                        default_branch: default_branch || 'main'
                    })
                    .select()
                    .single();

                if (createError) {
                    console.error('Failed to create repo:', createError);
                    // Try to find by owner/name as fallback
                    const { data: existingRepo } = await supabase
                        .from('repos')
                        .select('*')
                        .eq('owner', repo_owner)
                        .eq('name', repo_name)
                        .single();

                    if (existingRepo) {
                        repo = existingRepo;
                        console.log(`Found existing repo by owner/name: ${existingRepo.id}`);
                    }
                } else {
                    repo = createdRepo;
                    console.log(`✅ Created repo record with ID: ${validRepoId}`);
                }
            }

            // Use the valid repo ID for further operations
            const actualRepoId = repo?.id || repo_id;

            // CRITICAL: Handle GitHub cloning vs local repo
            let targetPath: string | null = null;

            // Option 1: Explicit local repo usage (for development/testing)
            if (use_local_repo) {
                console.log('📁 USE_LOCAL_REPO flag set - using local repository');
                // The generator will look for local paths as it currently does
                // No need to set targetPath, let the generator handle it

                // Option 2: GitHub cloning
            } else if (use_github && github_token && clone_url) {
                console.log('🔄 CLONING FROM GITHUB');
                console.log('  Clone URL:', clone_url);
                console.log('  Branch:', default_branch || 'main');

                // Create temp directory for clone
                const tempDir = `/tmp/repo-${Date.now()}-${Math.random().toString(36).substring(7)}`;

                try {
                    // Create the directory
                    fs.mkdirSync(tempDir, { recursive: true });

                    // Build the authenticated clone URL
                    const authCloneUrl = clone_url.replace(
                        'https://github.com',
                        `https://${github_token}@github.com`
                    );

                    console.log(`📦 Cloning to: ${tempDir}`);

                    // Execute git clone
                    const { stdout, stderr } = await executeCommand('git', [
                        'clone',
                        '--depth', '1',
                        '--branch', default_branch || 'main',
                        authCloneUrl,
                        tempDir
                    ]);

                    console.log('✅ SUCCESSFULLY CLONED FROM GITHUB');
                    console.log('  Git output:', stdout.trim() || 'Clone completed');
                    if (stderr) {
                        console.log('  Git stderr:', stderr.trim());
                    }

                    // Verify the clone succeeded
                    const repoExists = fs.existsSync(path.join(tempDir, '.git'));
                    if (!repoExists) {
                        throw new Error('Clone succeeded but .git directory not found');
                    }

                    // Set the target path for the generator
                    targetPath = tempDir;

                    // Log some basic info about what was cloned
                    const files = fs.readdirSync(tempDir);
                    console.log(`  Files in cloned repo: ${files.length} items`);
                    console.log(`  Sample files: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);

                } catch (cloneError: any) {
                    console.error('❌ GIT CLONE FAILED');
                    console.error('  Error message:', cloneError.message);
                    console.error('  Full error:', cloneError);

                    // Clean up temp dir if it was created
                    try {
                        if (fs.existsSync(tempDir)) {
                            fs.rmSync(tempDir, { recursive: true, force: true });
                        }
                    } catch (cleanupError) {
                        console.error('  Failed to clean up temp dir:', cleanupError);
                    }

                    return reply.code(500).send({
                        error: 'Failed to clone repository from GitHub',
                        details: cloneError.message,
                        clone_url: clone_url,
                        branch: default_branch || 'main'
                    });
                }

                // Option 3: No explicit instructions - error out
            } else {
                console.error('❌ NO VALID REPOSITORY SOURCE');
                console.error('  - use_local_repo:', use_local_repo);
                console.error('  - use_github:', use_github);
                console.error('  - has github_token:', !!github_token);
                console.error('  - has clone_url:', !!clone_url);

                return reply.code(400).send({
                    error: 'No valid repository source specified',
                    details: 'Either set use_local_repo=true for local repos, or provide github_token, use_github=true, and clone_url for GitHub repos',
                    received: {
                        use_local_repo,
                        use_github,
                        has_github_token: !!github_token,
                        has_clone_url: !!clone_url
                    }
                });
            }

            // Get latest analyzer run for framework detection (if exists)
            const { data: latestRun } = await supabase
                .from('analyzer_runs')
                .select('summary')
                .eq('repo_id', actualRepoId)
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const frameworks = latestRun?.summary?.schema?.frameworks || ['react'];

            // Generate unified implementation
            const generator = new AnalyticsIntelligenceGenerator();

            // Modify the input based on whether we cloned from GitHub
            const generatorInput: any = {
                repoId: targetPath || actualRepoId, // Use cloned path if available, otherwise repo ID
                appKey: app_key,
                domain: domain || 'localhost:3000',
                backendUrl: backend_url || 'http://localhost:8082/ingest/analytics',
                frameworks,
                businessContext: business_context,
                sample_routes
            };

            // If we cloned from GitHub, pass the path explicitly
            if (targetPath) {
                console.log(`🎯 Using cloned repository at: ${targetPath}`);
                // The generator's loadRepositoryFiles method needs to handle this path
            }

            const output = await generator.generate(generatorInput);

            // Clean up temp directory if we cloned
            if (targetPath && targetPath.startsWith('/tmp/')) {
                console.log(`🧹 Cleaning up temp directory: ${targetPath}`);
                try {
                    fs.rmSync(targetPath, { recursive: true, force: true });
                    console.log('✅ Temp directory cleaned up');
                } catch (cleanupError) {
                    console.error('⚠️ Failed to clean up temp directory:', cleanupError);
                }
            }

            return reply.send({
                success: true,
                app_key,
                metadata: output.metadata,
                files: Object.keys(output).filter(k => k !== 'metadata'),
                message: `Generated ${output.metadata.eventCount} contextual events with required fields`,
                // Include the generated outputs for the analyze route
                eventsSchema: output['events-schema.json'],
                uiGraph: output['ui-graph.json'],
                trackerCode: output['tracker.js'],
                providerCode: output['analytics-provider.tsx'],
                'entry-point.js': output['entry-point.js'],
                source: targetPath ? 'github_clone' : 'local_repo'
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