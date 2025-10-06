// packages/analytics-platform/src/app/api/analyze/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const GENERATOR_API_URL = process.env.GENERATOR_API_URL || 'http://localhost:8081';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoId, repoName, repoOwner, defaultBranch, subdir } = body;

    // Get GitHub token from cookies
    const cookieStore = cookies();
    const githubToken = cookieStore.get('github_token')?.value;

    if (!githubToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Generate a UUID for the database if repoId is not a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let dbRepoId = repoId;

    if (!uuidRegex.test(repoId)) {
      // repoId is likely a GitHub ID, generate a new UUID
      dbRepoId = uuidv4();
      console.log(`Generated UUID for repo: ${dbRepoId} (GitHub ID: ${repoId})`);
    }

    // Generate a unique app key
    const timestamp = new Date().toISOString().split('T')[0];
    const randomId = Math.random().toString(36).substring(2, 15);
    const appKey = `${repoName}-${timestamp}-${randomId}`;

    console.log('=================================');
    console.log('ANALYTICS GENERATION REQUEST');
    console.log('=================================');
    console.log(`Repository: ${repoOwner}/${repoName}`);
    console.log(`Branch: ${defaultBranch || 'main'}`);
    console.log(`Subdirectory: ${subdir || '(root)'}`);
    console.log(`Generated app key: ${appKey}`);
    console.log(`Using repo_id: ${dbRepoId}`);
    console.log('=================================');

    // Call the generator service - it handles all progress tracking
    const response = await fetch(`${GENERATOR_API_URL}/analytics/generate-unified`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repo_id: dbRepoId,
        github_repo_id: repoId, // Pass the original GitHub ID for progress tracking
        app_key: appKey,
        domain: `${repoName}.example.com`,
        backend_url: process.env.ANALYTICS_BACKEND_URL || 'https://analytics-service-production-0f0c.up.railway.app/ingest/analytics',
        sample_routes: ['/'],
        // Include repo information for cloning
        repo_name: repoName,
        repo_owner: repoOwner,
        default_branch: defaultBranch || 'main',
        // CRITICAL: Pass the GitHub token so the generator can clone the repo
        github_token: githubToken,
        // Explicitly tell generator to clone from GitHub
        use_github: true,
        clone_url: `https://github.com/${repoOwner}/${repoName}.git`,
        // CRITICAL: Pass the subdirectory to analyze only that path
        subdir: subdir || null,
        // Progress callback is built into generator - no need to pass it
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Generator API error:', errorText);
      return NextResponse.json(
        { error: 'Analysis failed', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();

    console.log('=================================');
    console.log('GENERATOR RESPONSE RECEIVED');
    console.log('=================================');
    console.log('Components:', {
      hasEventsSchema: !!result.eventsSchema,
      hasUIGraph: !!result.uiGraph,
      hasMetadata: !!result.metadata,
      hasTrackerCode: !!result.trackerCode,
      hasProviderCode: !!result.providerCode,
      hasEntryPoint: !!result['entry-point.js']
    });
    console.log('Deployment Plan:', {
      hasDeploymentPlan: !!result.deploymentPlan,
      framework: result.deploymentPlan?.framework || 'none',
      filesCount: result.deploymentPlan?.files?.length || 0
    });

    // Parse the actual component count from the AI analysis
    let totalComponents = 0;
    if (result.eventsSchema?.ai_components && Array.isArray(result.eventsSchema.ai_components)) {
      totalComponents = result.eventsSchema.ai_components.length;
      console.log(`Found ${totalComponents} AI-discovered components`);
    } else if (result.uiGraph?.widgets && Array.isArray(result.uiGraph.widgets)) {
      totalComponents = result.uiGraph.widgets.length;
      console.log(`Found ${totalComponents} widgets`);
    } else if (result.metadata?.componentCount) {
      totalComponents = result.metadata.componentCount;
      console.log(`Found ${totalComponents} components from metadata`);
    }

    // Extract pages count
    let totalPages = 0;
    if (result.uiGraph?.pages && typeof result.uiGraph.pages === 'object') {
      totalPages = Object.keys(result.uiGraph.pages).length;
      console.log(`Found ${totalPages} pages`);
    }

    // Extract events
    let events = [];
    if (result.eventsSchema?.events && Array.isArray(result.eventsSchema.events)) {
      events = result.eventsSchema.events;
    } else if (result.events && Array.isArray(result.events)) {
      events = result.events;
    }
    console.log(`Found ${events.length} event types`);

    // Extract routes
    let routes = [];
    if (result.routes && Array.isArray(result.routes)) {
      routes = result.routes;
    } else if (result.uiGraph?.pages) {
      routes = Object.values(result.uiGraph.pages).map((page: any) => page.route).filter(Boolean);
    }
    console.log(`Found ${routes.length} routes`);

    console.log('=================================');

    // Build the analysis result with entry point for preview
    const analysisResult = {
      events,
      routes,
      uiGraph: result.uiGraph || {},
      metadata: result.metadata || {},
      trackerCode: result.trackerCode || '',
      providerCode: result.providerCode || '',
      totalPages,
      totalComponents,
      estimatedEvents: result.estimatedEvents || '10K/day',
      appKey: result.appKey || appKey,
      deploymentPlan: result.deploymentPlan  // CRITICAL: Pass through the LLM deployment plan
    };

    // Register the app with analytics service
    try {
      const registerResponse = await fetch('http://localhost:8082/apps/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_key: analysisResult.appKey,
          name: repoName,
          domain: `${repoName}.example.com`,
          repo_owner: repoOwner,
          repo_name: repoName
        })
      });

      if (!registerResponse.ok) {
        console.error('App registration failed:', await registerResponse.text());
      } else {
        console.log(`✅ App registered successfully with key: ${analysisResult.appKey}`);
      }
    } catch (registerError) {
      console.error('App registration error:', registerError);
      // Don't fail the whole analysis if registration fails
    }

    return NextResponse.json(analysisResult);

  } catch (error) {
    console.error('Analysis error:', error);

    // Type-safe error handling
    let errorMessage = 'Internal server error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    return NextResponse.json(
      { error: 'Analysis failed', details: errorMessage },
      { status: 500 }
    );
  }
}