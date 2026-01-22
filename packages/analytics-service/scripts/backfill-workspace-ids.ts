#!/usr/bin/env tsx
/**
 * Backfill Script: Add workspace_id to existing data
 * 
 * This script assigns a workspace to all existing records that don't have one.
 * It should be run AFTER the migration but BEFORE enforcing NOT NULL constraints.
 * 
 * Usage:
 *   tsx packages/analytics-service/scripts/backfill-workspace-ids.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

interface BackfillStats {
  apps: number;
  repos: number;
  events: number;
  analyzer_runs: number;
}

async function backfillWorkspaceIds(): Promise<void> {
  console.log('🚀 Starting workspace_id backfill...\n');

  const stats: BackfillStats = {
    apps: 0,
    repos: 0,
    events: 0,
    analyzer_runs: 0
  };

  try {
    // Step 1: Get or create default workspace
    console.log('📋 Step 1: Ensuring default workspace exists...');
    
    let { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('name', 'Default Workspace')
      .single();

    if (workspaceError && workspaceError.code === 'PGRST116') {
      // Workspace doesn't exist, create it
      console.log('   Creating "Default Workspace"...');
      const { data: newWorkspace, error: createError } = await supabase
        .from('workspaces')
        .insert({ 
          name: 'Default Workspace',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create default workspace: ${createError.message}`);
      }

      workspace = newWorkspace;
      console.log(`   ✅ Created workspace: ${workspace!.id}`);
    } else if (workspaceError) {
      throw new Error(`Failed to query workspaces: ${workspaceError.message}`);
    } else {
      console.log(`   ✅ Found existing workspace: ${workspace!.id}`);
    }

    const defaultWorkspaceId = workspace!.id;

    // Step 2: Backfill apps table
    console.log('\n📋 Step 2: Backfilling apps table...');
    const { data: appsToUpdate, error: appsQueryError } = await supabase
      .from('apps')
      .select('id')
      .is('workspace_id', null);

    if (appsQueryError) {
      throw new Error(`Failed to query apps: ${appsQueryError.message}`);
    }

    if (appsToUpdate && appsToUpdate.length > 0) {
      const { error: appsUpdateError } = await supabase
        .from('apps')
        .update({ workspace_id: defaultWorkspaceId })
        .is('workspace_id', null);

      if (appsUpdateError) {
        throw new Error(`Failed to update apps: ${appsUpdateError.message}`);
      }

      stats.apps = appsToUpdate.length;
      console.log(`   ✅ Updated ${stats.apps} apps`);
    } else {
      console.log(`   ✅ No apps to update`);
    }

    // Step 3: Backfill repos table
    console.log('\n📋 Step 3: Backfilling repos table...');
    const { data: reposToUpdate, error: reposQueryError } = await supabase
      .from('repos')
      .select('id')
      .is('workspace_id', null);

    if (reposQueryError) {
      throw new Error(`Failed to query repos: ${reposQueryError.message}`);
    }

    if (reposToUpdate && reposToUpdate.length > 0) {
      const { error: reposUpdateError } = await supabase
        .from('repos')
        .update({ workspace_id: defaultWorkspaceId })
        .is('workspace_id', null);

      if (reposUpdateError) {
        throw new Error(`Failed to update repos: ${reposUpdateError.message}`);
      }

      stats.repos = reposToUpdate.length;
      console.log(`   ✅ Updated ${stats.repos} repos`);
    } else {
      console.log(`   ✅ No repos to update`);
    }

    // Step 4: Backfill analytics_product_events table
    console.log('\n📋 Step 4: Backfilling analytics_product_events table...');
    console.log('   (This may take a while for large datasets...)');
    
    const { data: eventsToUpdate, error: eventsQueryError } = await supabase
      .from('analytics_product_events')
      .select('id')
      .eq('workspace_id', '00000000-0000-0000-0000-000000000000')
      .limit(1);

    if (eventsQueryError) {
      throw new Error(`Failed to query events: ${eventsQueryError.message}`);
    }

    if (eventsToUpdate && eventsToUpdate.length > 0) {
      const { count, error: countError } = await supabase
        .from('analytics_product_events')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', '00000000-0000-0000-0000-000000000000');

      if (countError) {
        console.log(`   ⚠️  Could not count events: ${countError.message}`);
      } else {
        console.log(`   Found ${count} events to update`);
      }

      const { error: eventsUpdateError } = await supabase
        .from('analytics_product_events')
        .update({ workspace_id: defaultWorkspaceId })
        .eq('workspace_id', '00000000-0000-0000-0000-000000000000');

      if (eventsUpdateError) {
        throw new Error(`Failed to update events: ${eventsUpdateError.message}`);
      }

      stats.events = count || 0;
      console.log(`   ✅ Updated ${stats.events} events`);
    } else {
      console.log(`   ✅ No events to update`);
    }

    // Step 5: Backfill analyzer_runs table
    console.log('\n📋 Step 5: Backfilling analyzer_runs table...');
    const { data: runsToUpdate, error: runsQueryError } = await supabase
      .from('analyzer_runs')
      .select('id')
      .is('workspace_id', null);

    if (runsQueryError) {
      throw new Error(`Failed to query analyzer_runs: ${runsQueryError.message}`);
    }

    if (runsToUpdate && runsToUpdate.length > 0) {
      const { error: runsUpdateError } = await supabase
        .from('analyzer_runs')
        .update({ workspace_id: defaultWorkspaceId })
        .is('workspace_id', null);

      if (runsUpdateError) {
        throw new Error(`Failed to update analyzer_runs: ${runsUpdateError.message}`);
      }

      stats.analyzer_runs = runsToUpdate.length;
      console.log(`   ✅ Updated ${stats.analyzer_runs} analyzer_runs`);
    } else {
      console.log(`   ✅ No analyzer_runs to update`);
    }

    // Final verification
    console.log('\n📋 Step 6: Verifying backfill...');
    const { data: appsCheck } = await supabase
      .from('apps')
      .select('id')
      .is('workspace_id', null)
      .limit(1);

    const { data: reposCheck } = await supabase
      .from('repos')
      .select('id')
      .is('workspace_id', null)
      .limit(1);

    const { data: runsCheck } = await supabase
      .from('analyzer_runs')
      .select('id')
      .is('workspace_id', null)
      .limit(1);

    if (appsCheck && appsCheck.length > 0) {
      console.log('   ⚠️  WARNING: Some apps still have NULL workspace_id');
    }
    if (reposCheck && reposCheck.length > 0) {
      console.log('   ⚠️  WARNING: Some repos still have NULL workspace_id');
    }
    if (runsCheck && runsCheck.length > 0) {
      console.log('   ⚠️  WARNING: Some analyzer_runs still have NULL workspace_id');
    }

    console.log('\n✅ Backfill complete!\n');
    console.log('📊 Summary:');
    console.log(`   - Apps updated: ${stats.apps}`);
    console.log(`   - Repos updated: ${stats.repos}`);
    console.log(`   - Events updated: ${stats.events}`);
    console.log(`   - Analyzer runs updated: ${stats.analyzer_runs}`);
    console.log(`   - Default workspace ID: ${defaultWorkspaceId}`);
    
    console.log('\n📝 Next steps:');
    console.log('   1. Verify the backfill by checking your database');
    console.log('   2. Uncomment the NOT NULL constraints in migration 001');
    console.log('   3. Run migration 002 to enable RLS policies');

  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillWorkspaceIds()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

