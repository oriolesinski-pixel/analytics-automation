const fs = require('fs');
const path = require('path');

// Check if debug logs directory exists
const debugDir = path.join(process.cwd(), 'debug-logs');
if (fs.existsSync(debugDir)) {
  console.log('📁 Debug logs directory found');
  
  // List all debug files
  const files = fs.readdirSync(debugDir).filter(f => f.includes('openai-debug'));
  console.log(`📄 Found ${files.length} debug files`);
  
  if (files.length > 0) {
    // Analyze the most recent debug file
    const latestFile = files.sort().pop();
    const debugPath = path.join(debugDir, latestFile);
    const debugData = JSON.parse(fs.readFileSync(debugPath, 'utf8'));
    
    console.log('\n🔍 Latest OpenAI Debug Analysis:');
    console.log('Model used:', debugData.response.model);
    console.log('Finish reason:', debugData.response.finish_reason);
    console.log('Content type:', debugData.response.content_type);
    console.log('Content length:', debugData.response.content_length);
    console.log('Starts with JSON:', debugData.response.starts_with_json);
    console.log('Contains markdown:', debugData.response.contains_markdown);
    
    if (debugData.response.contains_markdown) {
      console.log('⚠️  Response contains markdown - this indicates the prompt issue persists');
    } else {
      console.log('✅ No markdown detected in response');
    }
    
    // Check if function calling was used
    if (debugData.request.functions) {
      console.log('✅ Function calling approach used');
    } else if (debugData.request.response_format) {
      console.log('⚠️  JSON mode approach used (less reliable)');
    }
  }
} else {
  console.log('❌ No debug logs directory found. Make sure to add the debug logger to your code.');
}

// Check generated outputs directory
const outputsDir = path.join(process.cwd(), 'generated-outputs');
if (fs.existsSync(outputsDir)) {
  console.log('\n📁 Generated outputs directory found');
  
  // Check for recent generations
  const rawDir = path.join(outputsDir, 'raw-responses');
  if (fs.existsSync(rawDir)) {
    const rawFiles = fs.readdirSync(rawDir);
    console.log(`📄 Found ${rawFiles.length} raw response files`);
  }
} else {
  console.log('❌ No generated outputs directory found');
}
