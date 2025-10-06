// packages/analytics-platform/src/app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import crypto from 'crypto';

// In-memory storage for logs (in production, use Redis or a database)
const analysisLogs = new Map<string, string[]>();

// Helper function to add logs
function addLog(repoId: string, message: string) {
    if (!analysisLogs.has(repoId)) {
        analysisLogs.set(repoId, []);
    }
    analysisLogs.get(repoId)!.push(message);
    console.log(`[${repoId}] ${message}`);

    // Clean up old logs after 5 minutes
    setTimeout(() => {
        analysisLogs.delete(repoId);
    }, 5 * 60 * 1000);
}

// GET endpoint for fetching logs
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get('repoId');

    if (!repoId) {
        return NextResponse.json({ error: 'Missing repoId' }, { status: 400 });
    }

    const logs = analysisLogs.get(repoId) || [];
    return NextResponse.json({ logs });
}

export async function POST(request: NextRequest) {
    let repoId: string = '';

    try {
        const body = await request.json();
        repoId = body.repoId?.toString() || crypto.randomBytes(8).toString('hex');
        const { repoName, repoOwner, defaultBranch, siteUrl, subdir, subdirName } = body;

        // Get token from cookie
        const token = request.cookies.get('github_token')?.value;

        if (!token) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // Generate unique app key with timestamp
        const randomSuffix = crypto.randomBytes(5).toString('base64').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const appKey = `${repoName}-${new Date().toISOString().split('T')[0]}-${randomSuffix}`;

        console.log('=================================');
        console.log('ANALYTICS GENERATION REQUEST');
        console.log('=================================');
        console.log(`Repository: ${repoOwner}/${repoName}`);
        console.log(`Branch: ${defaultBranch || 'main'}`);
        console.log(`Generated app key: ${appKey}`);
        console.log(`Using repo_id: ${repoId}`);
        if (subdir) {
            console.log(`Subdirectory: ${subdir}`);
        }
        console.log('=================================');

        // Add initial logs for progress tracking
        addLog(repoId, '🚀 Starting AI-powered generation');
        addLog(repoId, `Initializing analysis for ${repoName}`);

        // Build GitHub clone URL
        const cloneUrl = `https://github.com/${repoOwner}/${repoName}.git`;

        // Call the generator service at port 8081
        console.log('Calling generator service...');
        const generatorResponse = await fetch('http://localhost:8081/analytics/generate-unified', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                repo_id: repoId,
                app_key: appKey,
                domain: siteUrl || `${repoName}.vercel.app`,
                backend_url: process.env.ANALYTICS_BACKEND_URL || 'https://analytics-service-production-0f0c.up.railway.app/ingest/analytics',
                repo_name: repoName,
                repo_owner: repoOwner,
                default_branch: defaultBranch || 'main',
                github_token: token,
                use_github: true,
                clone_url: cloneUrl,
                // CRITICAL: Add the progress callback URL
                progress_callback: `http://localhost:8081/analytics/progress?repo_id=${repoId}`,
                // Add subdirectory if provided
                subdir: subdir || null,
                subdir_name: subdirName || null
            })
        });

        if (!generatorResponse.ok) {
            const errorData = await generatorResponse.json();
            throw new Error(errorData.error || 'Generator service failed');
        }

        const generatorData = await generatorResponse.json();
        console.log('=================================');
        console.log('GENERATOR RESPONSE RECEIVED');
        console.log('=================================');
        console.log('Components:', {
            hasEventsSchema: !!generatorData.eventsSchema,
            hasUIGraph: !!generatorData.uiGraph,
            hasMetadata: !!generatorData.metadata,
            hasTrackerCode: !!generatorData.trackerCode,
            hasProviderCode: !!generatorData.providerCode,
            hasEntryPoint: !!generatorData.entryPoint
        });

        // Process the response from the generator
        const schema = generatorData.eventsSchema || { events: [], routes: [], base_fields: [] };
        const uiGraph = generatorData.uiGraph || { nodes: [], edges: [] };
        const metadata = generatorData.metadata || { total_pages: 0, total_components: 0 };
        const trackerCode = generatorData.trackerCode || '';
        const providerCode = generatorData.providerCode || '';

        // Extract counts from the data
        const componentCount = schema.ai_components?.length || 0;
        const behaviorCount = schema.ai_patterns?.length || 0;
        const pageCount = Object.keys(uiGraph.pages || {}).length || 0;
        const routeCount = Object.keys(uiGraph.pages || {}).length || 0;

        if (componentCount > 0) {
            console.log(`Found ${componentCount} AI-discovered components`);
            addLog(repoId, `📊 Discovered ${componentCount} interactive components`);
        }

        if (pageCount > 0) {
            console.log(`Found ${pageCount} pages`);
            addLog(repoId, `🔍 Analyzed ${pageCount} pages`);
        }

        if (schema.events?.length > 0) {
            console.log(`Found ${schema.events.length} event types`);
            addLog(repoId, `🔍 Analyzed ${behaviorCount} behavior patterns`);
        }

        if (routeCount > 0) {
            console.log(`Found ${routeCount} routes`);
        }

        console.log('=================================');

        addLog(repoId, '📝 Creating integration files');

        // Register the app with the analytics backend
        try {
            const registerResponse = await fetch('http://localhost:8082/apps/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_key: appKey,
                    name: repoName,
                    domain: siteUrl || `${repoName}.vercel.app`,
                    repo_owner: repoOwner,
                    repo_name: repoName
                })
            });

            if (!registerResponse.ok) {
                const errorData = await registerResponse.json();
                console.error('App registration failed:', errorData);
                // Don't throw - continue anyway since the generation succeeded
            } else {
                console.log(`Registered app with key: ${appKey}`);
                addLog(repoId, '✅ Registered app with analytics service');
            }
        } catch (e) {
            console.error('App registration failed:', e);
            // Don't throw - continue anyway
        }

        // Final success log
        addLog(repoId, '✅ Analysis complete!');

        // Return results matching what the frontend expects
        return NextResponse.json({
            success: true,
            appKey,
            schema,
            uiGraph,
            metadata,
            trackerCode,
            providerCode,
            events: schema.events || [],
            routes: schema.routes || [],
            totalPages: pageCount || metadata.total_pages || metadata.pages || 0,
            totalComponents: componentCount || metadata.total_components || metadata.components || 0,
            estimatedEvents: metadata.estimated_events_per_day || '10K/day',
            siteUrl: siteUrl
        });

    } catch (error: any) {
        console.error('Analysis error:', error);

        if (repoId) {
            addLog(repoId, `❌ Error: ${error.message}`);
        }

        return NextResponse.json(
            {
                error: 'Failed to analyze repository',
                details: error.message
            },
            { status: 500 }
        );
    }
}