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
