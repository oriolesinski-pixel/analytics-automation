const fs = require('fs');
const path = require('path');

class UniversalTrackerParser {
  constructor(responseText, outputDir = 'generated-outputs') {
    this.responseText = responseText;
    this.parsedResult = null;
    this.outputDir = outputDir;
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  }

  parse() {
    try {
      this.parsedResult = JSON.parse(this.responseText);
      if (this.parsedResult.tracking_plan) {
        console.log('Successfully parsed tracking plan JSON');
        return this.processTrackingPlan();
      }
    } catch (e) {
      console.log('Not valid JSON, attempting extraction...');
    }

    return this.extractFromText();
  }

  processTrackingPlan() {
    const plan = this.parsedResult.tracking_plan;
    const allFiles = [];

    if (plan.files_to_create) {
      plan.files_to_create.forEach(file => {
        allFiles.push({
          path: file.path,
          content: this.enhanceContent(file.content, file.type),
          description: file.description,
          action: 'create',
          type: file.type
        });
      });
    }

    if (plan.files_to_modify) {
      plan.files_to_modify.forEach(file => {
        allFiles.push({
          path: file.path,
          content: this.enhanceContent(file.content, file.type),
          description: file.description,
          action: 'modify',
          type: file.type,
          changes_summary: file.changes_summary
        });
      });
    }

    return {
      framework: plan.framework_detected,
      confidence: plan.confidence || 'unknown',
      reasoning: plan.detection_reasoning || 'No reasoning provided',
      strategy: plan.integration_strategy,
      files: allFiles,
      summary: this.parsedResult.implementation,
      deployment: this.parsedResult.deployment_plan
    };
  }

  detectFrameworkFromAI() {
    const text = this.responseText.toLowerCase();

    // Look for explicit framework detection from AI
    const frameworkMatch = text.match(/"framework_detected":\s*"([^"]+)"/);
    if (frameworkMatch) {
      return frameworkMatch[1];
    }

    // Look for confidence and reasoning
    const confidenceMatch = text.match(/"confidence":\s*"([^"]+)"/);
    const reasoningMatch = text.match(/"detection_reasoning":\s*"([^"]+)"/);

    return {
      framework: 'unknown',
      confidence: confidenceMatch ? confidenceMatch[1] : 'low',
      reasoning: reasoningMatch ? reasoningMatch[1] : 'Could not determine from response'
    };
  }

  enhanceContent(content, fileType) {
    if (fileType === 'tracker_core' && !content.includes("console.log('Analytics tracker initialized")) {
      content += `\n\n// Required debug logging\nconsole.log('Analytics tracker initialized for:', config);`;
    }
    return content;
  }

  extractFromText() {
    console.log('Attempting text extraction...');

    const files = [];
    const codeBlocks = this.responseText.match(/```(\w+)?\n([\s\S]*?)\n```/g) || [];

    console.log(`Found ${codeBlocks.length} code blocks`);

    const frameworkInfo = this.detectFrameworkFromAI();
    const framework = typeof frameworkInfo === 'string' ? frameworkInfo : frameworkInfo.framework;

    codeBlocks.forEach((block, index) => {
      const content = block.replace(/```\w*\n/, '').replace(/\n```$/, '');
      const extension = this.guessFileExtension(content);
      const filePath = this.generateFilePath(content, extension, framework, index);

      files.push({
        path: filePath,
        content: this.enhanceContent(content, this.guessFileType(content)),
        description: `Generated file ${index + 1}`,
        action: filePath.includes('layout') || filePath.includes('main') ? 'modify' : 'create',
        type: this.guessFileType(content)
      });
    });

    return {
      framework: framework,
      confidence: typeof frameworkInfo === 'object' ? frameworkInfo.confidence : 'low',
      reasoning: typeof frameworkInfo === 'object' ? frameworkInfo.reasoning : 'Extracted from text patterns',
      strategy: 'Extracted from response text',
      files: files,
      summary: 'Extracted tracking implementation',
      deployment: 'Follow framework-specific integration steps'
    };
  }

  guessFileExtension(content) {
    if (content.includes('interface ') || content.includes(': string')) return '.ts';
    if (content.includes('import React') || content.includes('useEffect')) return '.tsx';
    if (content.includes('<template>')) return '.vue';
    if (content.includes('@Component')) return '.ts';
    return '.js';
  }

  guessFileType(content) {
    if (content.includes('class ') && content.includes('track')) return 'tracker_core';
    if (content.includes('useEffect') || content.includes('export default')) return 'component';
    if (content.includes('RootLayout') || content.includes('<html>')) return 'layout';
    return 'utility';
  }

  generateFilePath(content, extension, framework, index) {
    const type = this.guessFileType(content);

    const pathMappings = {
      nextjs: {
        tracker_core: 'src/aa/tracker.core.ts',
        component: 'src/components/Analytics.tsx',
        layout: 'src/app/layout.tsx'
      },
      react: {
        tracker_core: 'src/utils/analytics.ts',
        component: 'src/components/Analytics.tsx',
        layout: 'src/main.tsx'
      }
    };

    return pathMappings[framework]?.[type] || `src/generated-${index}${extension}`;
  }

saveResultsToOutputDir(repoId) {
  const result = this.parse();
  
  // Create timestamped directory for this generation
  const outputPath = path.join(this.outputDir, 'repos', repoId, this.timestamp);
  fs.mkdirSync(outputPath, { recursive: true });
  
  // Save raw OpenAI response
  const rawPath = path.join(outputPath, 'raw-openai-response.txt');
  fs.writeFileSync(rawPath, this.responseText);
  
  // Save metadata with raw response info
  const metadataPath = path.join(outputPath, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify({
    generated_at: this.timestamp,
    framework: result.framework,
    confidence: result.confidence,
    reasoning: result.reasoning,
    file_count: result.files.length,
    repo_id: repoId,
    raw_response_length: this.responseText.length,
    parsing_method: this.parsedResult ? 'json' : 'text_extraction'
  }, null, 2));
  
  // Save individual files
  result.files.forEach((file, index) => {
    const fileName = `${index + 1}-${path.basename(file.path)}`;
    const filePath = path.join(outputPath, fileName);
    fs.writeFileSync(filePath, file.content);
  });
  
  // Save complete parsed result
  const resultPath = path.join(outputPath, 'parsed-result.json');
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  
  console.log(`All outputs saved to: ${outputPath}`);
  console.log(`Raw response: ${rawPath}`);
  console.log(`Parsed result: ${resultPath}`);
  
  return { result, outputPath };
}
}

if (require.main === module) {
  if (!fs.existsSync('openai_response.txt')) {
    console.error('openai_response.txt not found');
    process.exit(1);
  }

  const repoId = process.argv[2] || 'unknown-repo';
  const responseText = fs.readFileSync('openai_response.txt', 'utf8');
  const parser = new UniversalTrackerParser(responseText);
  const { result, outputPath } = parser.saveResultsToOutputDir(repoId);

  // Also save to old location for compatibility
  fs.writeFileSync('parsed_tracking_plan.json', JSON.stringify(result, null, 2));

  console.log(`\nFiles ready for integration from: ${outputPath}`);
}

module.exports = UniversalTrackerParser;