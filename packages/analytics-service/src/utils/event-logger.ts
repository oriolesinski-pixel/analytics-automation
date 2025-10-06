// src/utils/event-logger.ts - Simple event logging without external dependencies

// Event counters
const eventCounts: Record<string, number> = {};
let totalEventCount = 0;

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
    const icon = eventIcons[verb] || eventIcons.other;
    
    // Update counter
    eventCounts[verb] = (eventCounts[verb] || 0) + 1;
    totalEventCount++;
    
    // Format timestamp
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
    
    // Build display
    console.log('\n' + '═'.repeat(70));
    console.log(`${icon} ${verb.toUpperCase().replace(/_/g, ' ')} [${timestamp}] [#${totalEventCount}]`);
    console.log('─'.repeat(70));
    
    // App key
    console.log('  🔑 App Key:', app_key);
    
    // Show key fields in readable format
    if (event.page_url) console.log('  📍 Page:', event.page_url);
    if (event.page_title) console.log('  📑 Title:', event.page_title);
    if (event.element_text) console.log('  🎯 Element:', event.element_text);
    if (event.element_type) console.log('  🏷️  Type:', event.element_type);
    if (event.depth_percent !== undefined) console.log('  📊 Scroll:', `${event.depth_percent}%`);
    if (event.form_name) console.log('  📝 Form:', event.form_name);
    if (event.selection_value) console.log('  ✅ Selected:', event.selection_value);
    if (event.session_id) console.log('  🔗 Session:', event.session_id);
    
    // Show full JSON for detailed inspection
    console.log('\n  📋 Full Event Data:');
    const jsonDisplay = JSON.stringify(event, null, 2)
      .split('\n')
      .map(line => '    ' + line)
      .join('\n');
    console.log(jsonDisplay);
    
    console.log('═'.repeat(70));
  });
  
  // Show stats every 10 events
  if (totalEventCount % 10 === 0) {
    showStats();
  }
}

export function logEvent(event: any, result?: any) {
  const verb = event.verb || 'unknown';
  const icon = eventIcons[verb] || eventIcons.other;
  
  // Update counter
  eventCounts[verb] = (eventCounts[verb] || 0) + 1;
  totalEventCount++;
  
  // Format timestamp
  const now = new Date();
  const timestamp = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit'
  });
  
  // Build display
  console.log('\n' + '─'.repeat(60));
  console.log(`${icon} ${verb.toUpperCase().replace(/_/g, ' ')} [${timestamp}] [#${totalEventCount}]`);
  
  // Repository
  if (event.full) console.log('  🏷️  Repo:', event.full);
  
  // Important metadata fields
  const metadata = event.metadata || {};
  
  if (metadata.page_url) console.log('  📍 URL:', metadata.page_url);
  if (metadata.route) console.log('  🛤️  Route:', metadata.route);
  
  // Show full metadata as JSON
  if (Object.keys(metadata).length > 0) {
    console.log('\n  📋 Metadata:');
    const jsonDisplay = JSON.stringify(metadata, null, 2)
      .split('\n')
      .map(line => '    ' + line)
      .join('\n');
    console.log(jsonDisplay);
  }
  
  // Show result status
  if (result) {
    if (result.ok) {
      console.log('  ✓ Stored in Supabase');
      if (result.node_id) console.log(`  📍 Node: ${result.node_id}`);
      if (result.edge_id) console.log(`  🔗 Edge: ${result.edge_id}`);
    } else {
      console.log('  ✗ Error:', result.error);
    }
  }
  
  console.log('─'.repeat(60));
  
  // Show stats every 10 events
  if (totalEventCount % 10 === 0) {
    showStats();
  }
}

export function showStats() {
  const total = Object.values(eventCounts).reduce((a, b) => a + b, 0);
  
  if (total === 0) return; // Don't show empty stats
  
  console.log('\n📊 Event Statistics Summary:');
  console.log('═'.repeat(45));
  
  Object.entries(eventCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([verb, count]) => {
      const icon = eventIcons[verb] || eventIcons.other;
      const percentage = ((count / total) * 100).toFixed(1);
      console.log(`  ${icon} ${verb.padEnd(20)} ${count.toString().padStart(4)} (${percentage}%)`);
    });
  
  console.log('─'.repeat(45));
  console.log(`  Total Events: ${total}`);
  console.log('═'.repeat(45) + '\n');
}

// Manual trigger for stats
process.on('SIGUSR1', showStats);

// Show stats on exit
process.on('SIGINT', () => {
  console.log('\n\nFinal Statistics:');
  showStats();
  process.exit(0);
});
