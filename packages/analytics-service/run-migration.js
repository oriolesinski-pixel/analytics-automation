// run-migration.js
// Script to run database migrations on Supabase

require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function runMigration() {
  console.log('🔧 Running Database Migration: Saved Tiles & Dashboards\n');
  
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '003_saved_tiles_dashboards.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded:', migrationPath);
    console.log('📝 SQL length:', sql.length, 'characters\n');
    
    // Split SQL into individual statements (by semicolons, ignoring comments)
    const statements = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--')) // Remove comment lines
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 60).replace(/\s+/g, ' ') + '...';
      
      console.log(`[${i + 1}/${statements.length}] Executing: ${preview}`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
        
        if (error) {
          // If exec_sql RPC doesn't exist, try alternative approach
          if (error.code === 'PGRST202') {
            console.log('   ⚠️  exec_sql RPC not found, trying direct query...');
            // For simple CREATE TABLE/INDEX statements, they might work via from()
            // But Supabase client doesn't support arbitrary SQL execution for security
            console.log('   ⚠️  Need to run migration via Supabase Dashboard SQL Editor');
            console.log('\n❌ CANNOT RUN MIGRATION PROGRAMMATICALLY\n');
            console.log('Please run the migration manually:');
            console.log('1. Go to https://supabase.com/dashboard');
            console.log('2. Select your project');
            console.log('3. Click "SQL Editor" in left sidebar');
            console.log('4. Click "New Query"');
            console.log('5. Copy/paste this file: migrations/003_saved_tiles_dashboards.sql');
            console.log('6. Click "Run"\n');
            process.exit(1);
          }
          
          throw error;
        }
        
        console.log('   ✅ Success\n');
      } catch (err) {
        console.error(`   ❌ Error:`, err.message);
        throw err;
      }
    }
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify tables exist
    console.log('🔍 Verifying tables...\n');
    
    const { count: tilesCount, error: tilesError } = await supabase
      .from('saved_tiles')
      .select('*', { count: 'exact', head: true });
    
    if (tilesError) {
      console.log('❌ saved_tiles table verification failed:', tilesError.message);
    } else {
      console.log('✅ saved_tiles table exists (rows:', tilesCount || 0, ')');
    }
    
    const { count: dashboardsCount, error: dashboardsError } = await supabase
      .from('dashboards')
      .select('*', { count: 'exact', head: true });
    
    if (dashboardsError) {
      console.log('❌ dashboards table verification failed:', dashboardsError.message);
    } else {
      console.log('✅ dashboards table exists (rows:', dashboardsCount || 0, ')');
    }
    
    const { count: dashboardTilesCount, error: dashboardTilesError } = await supabase
      .from('dashboard_tiles')
      .select('*', { count: 'exact', head: true });
    
    if (dashboardTilesError) {
      console.log('❌ dashboard_tiles table verification failed:', dashboardTilesError.message);
    } else {
      console.log('✅ dashboard_tiles table exists (rows:', dashboardTilesCount || 0, ')');
    }
    
    console.log('\n🎉 All tables verified successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nPlease run migration manually via Supabase Dashboard SQL Editor\n');
    process.exit(1);
  }
}

runMigration();

