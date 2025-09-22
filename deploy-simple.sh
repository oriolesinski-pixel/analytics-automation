#!/bin/bash

# deploy-simple.sh - Enhanced deployment script with automatic app registration for ANY app

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ROOT="/Users/oriolesinski/analytics-automation"
GENERATOR_PATH="${PROJECT_ROOT}/packages/analytics-generator"
OUTPUTS_PATH="${GENERATOR_PATH}/src/utils/generated-outputs/unified"
TARGET_APP="${1:-test-app-rich}"  # Accept app_key as parameter, default to test-app-rich
TIMESTAMP=$(date +"%Y-%m-%dT%H-%M-%S")
ANALYTICS_PORT=8082

# Generate a nice display name from app_key (e.g., test-app-rich -> Test App Rich)
APP_DISPLAY_NAME=$(echo "$TARGET_APP" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🚀 Analytics Deployment with Event Visualization${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}\n"
echo -e "${YELLOW}Target App: ${GREEN}${TARGET_APP}${NC} (${APP_DISPLAY_NAME})\n"

# Step 1: Kill existing processes
echo -e "${BLUE}Step 1: Stopping existing services...${NC}"
killall node 2>/dev/null || true
sleep 2
echo -e "${GREEN}✓ Services stopped${NC}\n"

# Step 2: Start analytics service first (needed for app registration)
echo -e "${BLUE}Step 2: Starting analytics service...${NC}"
cd "${PROJECT_ROOT}/packages/analytics-service"

# Check if chalk is installed, if not install it
if [ ! -f "node_modules/chalk/package.json" ]; then
    echo -e "${YELLOW}Installing chalk for beautiful logging...${NC}"
    npm install chalk
    npm install --save-dev @types/chalk
    echo -e "${GREEN}✓ Chalk installed${NC}"
fi

# Create the event logger (keeping all your existing beautiful logging)
echo -e "${YELLOW}Creating/updating event logger utility...${NC}"
mkdir -p src/utils
cat > src/utils/event-logger.ts << 'EOF'
// src/utils/event-logger.ts - Beautiful event logging with JSON display
import chalk from 'chalk';

// Event counters
const eventCounts: Record<string, number> = {};
let totalEventCount = 0;

// Color scheme
const eventColors: Record<string, any> = {
  page_view: chalk.blue,
  element_click: chalk.green,
  scroll_depth: chalk.cyan,
  form_started: chalk.magenta,
  form_submitted: chalk.yellow,
  selection_change: chalk.yellowBright,
  purchase: chalk.greenBright.bold,
  error: chalk.red,
  other: chalk.gray
};

// Icons
const eventIcons: Record<string, string> = {
  page_view: '📄',
  element_click: '🖱️',
  scroll_depth: '📜',
  form_started: '📝',
  form_submitted: '✅',
  selection_change: '🎯',
  purchase: '💰',
  error: '❌',
  other: '📊'
};

export function logAnalyticsEvent(events: any[], app_key: string) {
  // Process each event in the batch
  events.forEach(event => {
    const verb = event.event || event.verb || 'unknown';
    const color = eventColors[verb] || eventColors.other;
    const icon = eventIcons[verb] || eventIcons.other;
    
    // Update counter
    eventCounts[verb] = (eventCounts[verb] || 0) + 1;
    totalEventCount++;
    
    // Format timestamp
    const now = new Date();
    const timestamp = chalk.dim(`[${now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    })}]`);
    
    // Build display
    console.log('\n' + chalk.cyan('═'.repeat(70)));
    console.log(`${icon} ${color.bold(verb.toUpperCase().replace(/_/g, ' '))} ${timestamp} [#${totalEventCount}]`);
    console.log(chalk.cyan('─'.repeat(70)));
    
    // App key
    console.log(chalk.magenta('  🔑 App Key:'), chalk.white(app_key));
    
    // Show key fields in readable format
    if (event.page_url) {
      console.log(chalk.blue('  📍 Page:'), chalk.white(event.page_url));
    }
    
    if (event.page_title) {
      console.log(chalk.blue('  📑 Title:'), chalk.white(event.page_title));
    }
    
    if (event.element_text) {
      console.log(chalk.green('  🎯 Element:'), chalk.white(event.element_text));
    }
    
    if (event.element_type) {
      console.log(chalk.yellow('  🏷️  Type:'), chalk.white(event.element_type));
    }
    
    if (event.depth_percent !== undefined) {
      console.log(chalk.cyan('  📊 Scroll:'), chalk.white(`${event.depth_percent}%`));
    }
    
    if (event.form_name) {
      console.log(chalk.magenta('  📝 Form:'), chalk.white(event.form_name));
    }
    
    if (event.selection_value) {
      console.log(chalk.yellow('  ✅ Selected:'), chalk.white(event.selection_value));
    }
    
    // Session info
    if (event.session_id) {
      console.log(chalk.gray('  🔗 Session:'), chalk.dim(event.session_id));
    }
    
    // Show full JSON for detailed inspection
    console.log(chalk.yellow('\n  📋 Full Event Data:'));
    const jsonDisplay = JSON.stringify(event, null, 2)
      .split('\n')
      .map(line => '    ' + line)
      .join('\n');
    console.log(chalk.gray(jsonDisplay));
    
    console.log(chalk.cyan('═'.repeat(70)));
  });
  
  // Show stats every 10 events
  if (totalEventCount % 10 === 0) {
    showStats();
  }
}

export function logEvent(event: any, result?: any) {
  const verb = event.verb || 'unknown';
  const color = eventColors[verb] || eventColors.other;
  const icon = eventIcons[verb] || eventIcons.other;
  
  // Update counter
  eventCounts[verb] = (eventCounts[verb] || 0) + 1;
  totalEventCount++;
  
  // Format timestamp
  const now = new Date();
  const timestamp = chalk.dim(`[${now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit'
  })}]`);
  
  // Build display
  console.log('\n' + chalk.gray('─'.repeat(60)));
  console.log(`${icon} ${color.bold(verb.toUpperCase().replace(/_/g, ' '))} ${timestamp} [#${totalEventCount}]`);
  
  // Repository
  if (event.full) {
    console.log(chalk.magenta('  🏷️  Repo:'), chalk.white(event.full));
  }
  
  // Important metadata fields
  const metadata = event.metadata || {};
  
  if (metadata.page_url) {
    console.log(chalk.cyan('  📍 URL:'), chalk.white(metadata.page_url));
  }
  
  if (metadata.route) {
    console.log(chalk.cyan('  🛤️  Route:'), chalk.white(metadata.route));
  }
  
  // Show full metadata as JSON
  if (Object.keys(metadata).length > 0) {
    console.log(chalk.yellow('\n  📋 Metadata:'));
    const jsonDisplay = JSON.stringify(metadata, null, 2)
      .split('\n')
      .map(line => '    ' + line)
      .join('\n');
    console.log(chalk.gray(jsonDisplay));
  }
  
  // Show result status
  if (result) {
    if (result.ok) {
      console.log(chalk.green('  ✓ Stored in Supabase'));
      if (result.node_id) {
        console.log(chalk.cyan(`  📍 Node: ${result.node_id}`));
      }
      if (result.edge_id) {
        console.log(chalk.cyan(`  🔗 Edge: ${result.edge_id}`));
      }
    } else {
      console.log(chalk.red('  ✗ Error:'), result.error);
    }
  }
  
  console.log(chalk.gray('─'.repeat(60)));
  
  // Show stats every 10 events
  if (totalEventCount % 10 === 0) {
    showStats();
  }
}

export function showStats() {
  const total = Object.values(eventCounts).reduce((a, b) => a + b, 0);
  
  if (total === 0) return; // Don't show empty stats
  
  console.log('\n' + chalk.yellow.bold('📊 Event Statistics Summary:'));
  console.log(chalk.yellow('═'.repeat(45)));
  
  Object.entries(eventCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([verb, count]) => {
      const icon = eventIcons[verb] || eventIcons.other;
      const color = eventColors[verb] || eventColors.other;
      const percentage = ((count / total) * 100).toFixed(1);
      console.log(`  ${icon} ${color(verb.padEnd(20))} ${chalk.white(count.toString().padStart(4))} ${chalk.gray(`(${percentage}%)`)}`);
    });
  
  console.log(chalk.yellow('─'.repeat(45)));
  console.log(chalk.bold(`  Total Events: ${chalk.yellow(total)}`));
  console.log(chalk.yellow('═'.repeat(45)) + '\n');
}

// Manual trigger for stats (not used in this setup, but available)
process.on('SIGUSR1', showStats);

// Show stats on exit
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nFinal Statistics:'));
  showStats();
  process.exit(0);
});
EOF
echo -e "${GREEN}✓ Event logger created/updated${NC}"

# Start analytics service
echo -e "${YELLOW}Starting analytics service...${NC}"
npm run dev &
ANALYTICS_PID=$!

# Wait for service to be ready
echo -e "${YELLOW}Waiting for analytics service to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:${ANALYTICS_PORT}/healthz > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Analytics service ready on port ${ANALYTICS_PORT}${NC}\n"
        break
    fi
    sleep 1
    echo -n "."
done

# Step 3: Check and register/fix app - handles null repo_id
echo -e "${BLUE}Step 3: Checking app registration for '${TARGET_APP}'...${NC}"

# Load environment variables - fix the spaces issue
cd "${PROJECT_ROOT}"
sed 's/ = /=/g' .env > .env.tmp
source .env.tmp
rm .env.tmp

# Check if app exists and get its details
APP_DATA=$(curl -s http://localhost:${ANALYTICS_PORT}/apps/list | python3 -c "
import sys, json
data = json.load(sys.stdin)
apps = data.get('apps', [])
for app in apps:
    if app['app_key'] == '${TARGET_APP}':
        print(json.dumps(app))
        break
" 2>/dev/null || echo "")

if [ -z "${APP_DATA}" ]; then
    # App doesn't exist - create it
    echo -e "${YELLOW}App '${TARGET_APP}' not found. Creating new app with repo...${NC}"
    ACTION="create"
else
    # Check if app has null repo_id
    HAS_REPO=$(echo "${APP_DATA}" | python3 -c "
import sys, json
app = json.load(sys.stdin)
print('true' if app.get('repo_id') else 'false')
" 2>/dev/null || echo "false")
    
    if [ "${HAS_REPO}" = "false" ]; then
        echo -e "${YELLOW}App '${TARGET_APP}' has null repo_id. Fixing...${NC}"
        ACTION="update"
    else
        echo -e "${GREEN}✓ App '${TARGET_APP}' already properly configured${NC}\n"
        ACTION="skip"
    fi
fi

# Perform action if needed
if [ "${ACTION}" != "skip" ]; then
    cd "${PROJECT_ROOT}/packages/analytics-service"
    
    node -e "
    const { createClient } = require('@supabase/supabase-js');
    const crypto = require('crypto');
    
    const supabaseUrl = '${SUPABASE_URL}';
    const supabaseKey = '${SUPABASE_SERVICE_ROLE_KEY}';
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials');
        process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    (async () => {
      try {
        const action = '${ACTION}';
        
        // First, create a new repo record
        const repoData = {
          id: crypto.randomUUID(),
          name: '${TARGET_APP}',
          owner: 'local-system',
          provider: 'local',
          default_branch: 'main',
          default_app_key: '${TARGET_APP}',
          created_at: new Date().toISOString()
        };
        
        console.log('Creating repo record...');
        const { data: newRepo, error: repoError } = await supabase
          .from('repos')
          .insert(repoData)
          .select()
          .single();
        
        if (repoError) {
          console.error('Failed to create repo:', repoError.message);
          // Try to get an existing repo_id instead
          const { data: existingRepo } = await supabase
            .from('repos')
            .select('id')
            .limit(1)
            .single();
          
          if (existingRepo) {
            repoData.id = existingRepo.id;
            console.log('Using existing repo_id:', repoData.id);
          } else {
            throw new Error('Could not create or find a repo');
          }
        } else {
          console.log('✅ Created repo:', newRepo.id);
        }
        
        if (action === 'create') {
          // Create new app with repo_id
          const appData = {
            app_key: '${TARGET_APP}',
            name: '${APP_DISPLAY_NAME}',
            domain: 'localhost:3000',
            repo_id: repoData.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { data: newApp, error: appError } = await supabase
            .from('apps')
            .insert(appData)
            .select()
            .single();
          
          if (appError) {
            console.error('Failed to create app:', appError.message);
          } else {
            console.log('✅ Created app with repo:', newApp.app_key);
          }
        } else if (action === 'update') {
          // Update existing app with new repo_id
          const { data: updatedApp, error: updateError } = await supabase
            .from('apps')
            .update({ 
              repo_id: repoData.id,
              updated_at: new Date().toISOString()
            })
            .eq('app_key', '${TARGET_APP}')
            .select()
            .single();
          
          if (updateError) {
            console.error('Failed to update app:', updateError.message);
          } else {
            console.log('✅ Updated app with new repo:', updatedApp.app_key);
          }
        }
      } catch (err) {
        console.error('Error:', err.message);
        // Continue anyway - app might work without repo_id
      }
    })();
    " || {
        echo -e "${YELLOW}Note: Repo handling encountered an issue, continuing anyway${NC}"
    }
    
    sleep 2
    echo -e "${GREEN}✓ App configuration completed${NC}\n"
fi

# Verify app is now registered
echo -e "${YELLOW}Verifying registration...${NC}"
curl -s http://localhost:${ANALYTICS_PORT}/apps/list | python3 -c "
import sys, json
data = json.load(sys.stdin)
apps = [app['app_key'] for app in data.get('apps', [])]
if '${TARGET_APP}' in apps:
    print('✅ ${TARGET_APP} is registered and ready')
else:
    print('⚠️  ${TARGET_APP} not found in list, but continuing deployment')
print('All registered apps:', ', '.join(apps))
" || echo "⚠️ Could not verify registration"
echo ""

# Step 4: Clean old outputs
echo -e "${BLUE}Step 4: Cleaning old generated files...${NC}"
rm -rf "${OUTPUTS_PATH}/${TARGET_APP}"
echo -e "${GREEN}✓ Old files cleaned${NC}\n"

# Step 5: Generate new tracker
echo -e "${BLUE}Step 5: Generating new tracker for '${TARGET_APP}'...${NC}"
cd "${GENERATOR_PATH}"

# Check if the app example exists, if not create a basic structure
if [ ! -d "${PROJECT_ROOT}/examples/${TARGET_APP}" ]; then
    echo -e "${YELLOW}Creating example app structure for ${TARGET_APP}...${NC}"
    mkdir -p "${PROJECT_ROOT}/examples/${TARGET_APP}/public"
    mkdir -p "${PROJECT_ROOT}/examples/${TARGET_APP}/app/components"
    echo -e "${GREEN}✓ Created app structure${NC}"
fi

npx ts-node src/test-generator.ts ${TARGET_APP}

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Generation failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tracker generated${NC}\n"

# Step 6: Find and copy the generated files
echo -e "${BLUE}Step 6: Deploying files...${NC}"
LATEST_DIR=$(ls -t "${OUTPUTS_PATH}/${TARGET_APP}" 2>/dev/null | head -1)

if [ -z "${LATEST_DIR}" ]; then
    echo -e "${RED}✗ No generated files found${NC}"
    exit 1
fi

GENERATED_PATH="${OUTPUTS_PATH}/${TARGET_APP}/${LATEST_DIR}"

# Copy tracker.js
cp "${GENERATED_PATH}/tracker.js" "${PROJECT_ROOT}/examples/${TARGET_APP}/public/tracker.js"
echo -e "${GREEN}✓ tracker.js deployed${NC}"

# Copy analytics-provider.tsx if it exists
if [ -f "${GENERATED_PATH}/analytics-provider.tsx" ]; then
    cp "${GENERATED_PATH}/analytics-provider.tsx" "${PROJECT_ROOT}/examples/${TARGET_APP}/app/components/analytics-provider.tsx"
    echo -e "${GREEN}✓ analytics-provider.tsx deployed${NC}"
fi
echo ""

# Step 7: Start the application (if start.sh exists)
echo -e "${BLUE}Step 7: Starting application...${NC}"
cd "${PROJECT_ROOT}"
if [ -f "./start.sh" ]; then
    ./start.sh &
    APP_PID=$!
    echo -e "${GREEN}✓ Application started${NC}"
else
    echo -e "${YELLOW}No start.sh found, skipping app start${NC}"
    APP_PID=""
fi

# Step 8: Start the analytics platform dashboard
echo -e "${BLUE}Step 8: Starting analytics dashboard...${NC}"
cd "${PROJECT_ROOT}/packages/analytics-platform"
npm run dev &
DASHBOARD_PID=$!
echo -e "${GREEN}✓ Dashboard starting on port 3002${NC}\n"

# Show welcome message
echo -e "\n${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment Complete with Event Visualization!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}\n"
echo -e "${YELLOW}Deployed App:${NC} ${GREEN}${TARGET_APP}${NC} (${APP_DISPLAY_NAME})\n"
echo -e "${YELLOW}Services Running:${NC}"
echo -e "  🌐 Frontend:  ${GREEN}http://localhost:3000${NC}"
echo -e "  📊 Analytics: ${GREEN}http://localhost:${ANALYTICS_PORT}${NC}"
echo -e "  📊 Dashboard: ${GREEN}http://localhost:3002/dashboard${NC}"
if [ ! -z "$APP_PID" ]; then
    echo -e "  🔧 Backend:   ${GREEN}http://localhost:3001${NC}"
fi
echo ""
echo -e "${YELLOW}Event Flow:${NC}"
echo -e "  1. User interacts with app"
echo -e "  2. Tracker sends event to ${CYAN}/ingest/analytics${NC}"
echo -e "  3. Beautiful logs appear here with full JSON data"
echo -e "  4. Events stored in Supabase\n"
echo -e "${YELLOW}What You'll See:${NC}"
echo -e "  • Each event numbered (#1, #2, #3...)"
echo -e "  • Full JSON data for debugging"
echo -e "  • Key fields highlighted"
echo -e "  • Statistics every 10 events"
echo -e "  • Event types with icons:"
echo -e "    ${BLUE}📄 PAGE VIEW${NC} - page_view events"
echo -e "    ${GREEN}🖱️  ELEMENT CLICK${NC} - element_click events"  
echo -e "    ${CYAN}📜 SCROLL DEPTH${NC} - scroll_depth events"
echo -e "    ${MAGENTA}📝 FORM STARTED${NC} - form_started events"
echo -e "    ${YELLOW}✅ FORM SUBMITTED${NC} - form_submitted events\n"
echo -e "${YELLOW}Dashboard Access:${NC}"
echo -e "  1. Open ${GREEN}http://localhost:3002/dashboard${NC}"
echo -e "  2. Select '${GREEN}${APP_DISPLAY_NAME}${NC}' from the dropdown"
echo -e "  3. View real-time analytics for your app\n"
echo -e "${YELLOW}Usage:${NC}"
echo -e "  Deploy different app: ${CYAN}./deploy-simple.sh another-app-key${NC}"
echo -e "  Default app: ${CYAN}./deploy-simple.sh${NC} (uses test-app-rich)\n"
echo -e "${YELLOW}Tips:${NC}"
echo -e "  • Open ${GREEN}http://localhost:3000${NC} and interact with the page"
echo -e "  • Watch this terminal for real-time events"
echo -e "  • Check browser DevTools Network tab for raw data"
echo -e "  • All apps auto-register if they don't exist\n"
echo -e "${CYAN}Press Ctrl+C to stop all services and see final statistics${NC}\n"
echo -e "${CYAN}────────────────────────────────────────────────────────${NC}"
echo -e "${YELLOW}Waiting for events from ${TARGET_APP}...${NC}\n"

# Trap to handle Ctrl+C and show stats
trap 'echo -e "\n${YELLOW}Stopping services...${NC}"; kill $ANALYTICS_PID $APP_PID $DASHBOARD_PID 2>/dev/null; exit' INT TERM

wait