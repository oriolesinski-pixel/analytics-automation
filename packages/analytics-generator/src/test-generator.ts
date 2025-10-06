// packages/analytics-generator/src/test-generator.ts
import { config } from 'dotenv';
import { analyticsGenerator } from './lib/analytics-intelligence-generator';
import path from 'path';
import fs from 'fs';

// Load environment variables
config();

interface TestConfig {
    appName: string;
    repoId: string;
    appKey: string;
    backendUrl?: string;
    domain?: string;
    targetPath?: string;
}

async function testGenerator(config: TestConfig) {
    console.log('\n' + '='.repeat(50));
    console.log(`🧪 Testing Analytics Generator for: ${config.appName}`);
    console.log('='.repeat(50) + '\n');

    try {
        const startTime = Date.now();

        // The generator gets targetPath from environment variable
        if (config.targetPath) {
            process.env.TARGET_PATH = config.targetPath;
        }

        const result = await analyticsGenerator.generate({
            repoId: config.repoId,
            appKey: config.appKey,
            backendUrl: config.backendUrl,
            domain: config.domain
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n📊 Generation Results:');
        console.log('  ⏱️  Duration:', duration, 'seconds');
        console.log('  📝 Events Generated:', result.metadata.eventCount);
        console.log('  🔧 Frameworks Detected:', result.metadata.frameworksDetected.join(', ') || 'none');
        console.log('  🗓️  Generated At:', result.metadata.generatedAt);

        // Display event summary
        const schema = result['events-schema.json'];
        if (schema && schema.events) {
            console.log('\n📋 Event Types:');
            schema.events.forEach((event: any) => {
                console.log(`  - ${event.event_type}:`);

                if (event.data_fields && event.data_fields.length > 0) {
                    console.log(`    Data fields: ${event.data_fields.join(', ')}`);
                }

                if (event.properties && Object.keys(event.properties).length > 0) {
                    const propTypes = Object.entries(event.properties)
                        .slice(0, 3)
                        .map(([key, type]) => `${key}(${type})`)
                        .join(', ');
                    console.log(`    Types: ${propTypes}${Object.keys(event.properties).length > 3 ? '...' : ''}`);
                }
            });

            if (schema.base_fields) {
                console.log('\n📌 Base Fields (present in all events):');
                Object.entries(schema.base_fields).forEach(([field, info]: [string, any]) => {
                    console.log(`  - ${field}: ${info.type} (${info.source})`);
                });
            }
        }

        // Display UI graph summary
        const uiGraph = result['ui-graph.json'];
        if (uiGraph && uiGraph.pages) {
            console.log('\n🗺️  UI Graph:');
            console.log('  Pages:', Object.keys(uiGraph.pages).join(', '));
            console.log('  Relationships:', uiGraph.relationships?.length || 0);

            if (uiGraph.framework) {
                console.log('  Framework:', uiGraph.framework);
            }

            if (uiGraph.widgets) {
                console.log('  Global Widgets:', uiGraph.widgets.length);
            }
            if (uiGraph.modals) {
                console.log('  Modals:', uiGraph.modals.length);
            }
        }

        // Display AI insights if available
        if (schema.ai_components && schema.ai_components.length > 0) {
            console.log('\n🤖 AI-Discovered Components:');
            console.log(`  Total: ${schema.ai_components.length} components`);
            const types = [...new Set(schema.ai_components.map((c: any) => c.type))];
            console.log(`  Types: ${types.join(', ')}`);
        }

        console.log('\n✅ Test completed successfully!');

        return result;

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    }
}

async function runGenerator() {
    console.log('🚀 Starting Analytics Generator');
    console.log('Environment:', process.env.NODE_ENV || 'development');

    // Check required environment variables
    const requiredEnvVars = ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);

    if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables:', missingVars.join(', '));
        console.log('\n📝 Create a .env file with:');
        missingVars.forEach(v => console.log(`${v}=your_${v.toLowerCase()}_here`));
        process.exit(1);
    }

    // Get app name from command line argument or environment variable
    const appName = process.argv[2] || process.env.APP_KEY;

    if (!appName) {
        console.error('❌ No app name provided');
        console.log('\nUsage:');
        console.log('  npx ts-node src/test-generator.ts <app-name>');
        console.log('  OR set APP_KEY environment variable');
        console.log('\nExamples:');
        console.log('  npx ts-node src/test-generator.ts test-app-rich');
        console.log('  npx ts-node src/test-generator.ts my-custom-app');
        console.log('  APP_KEY=my-app npx ts-node src/test-generator.ts');
        process.exit(1);
    }

    // Get target path from environment or try to determine it
    let targetPath = process.env.TARGET_PATH;

    if (!targetPath) {
        // Check if it's in examples directory
        const examplesPath = path.resolve(process.cwd(), '../../examples', appName);
        if (fs.existsSync(examplesPath)) {
            targetPath = examplesPath;
            console.log(`📁 Found app in examples: ${targetPath}`);
        } else {
            // Check if a path was provided as second argument
            if (process.argv[3]) {
                targetPath = path.resolve(process.argv[3]);
                if (!fs.existsSync(targetPath)) {
                    console.error(`❌ Target path does not exist: ${targetPath}`);
                    process.exit(1);
                }
            } else {
                console.error('❌ No TARGET_PATH environment variable set and app not found in examples');
                console.log('\nPlease either:');
                console.log('  1. Set TARGET_PATH environment variable to the app directory');
                console.log('  2. Provide path as second argument: npx ts-node src/test-generator.ts <app-name> <path>');
                console.log('  3. Place your app in the examples directory');
                process.exit(1);
            }
        }
    }

    console.log(`📂 Using target path: ${targetPath}`);

    // Create configuration
    const config: TestConfig = {
        appName: appName,
        repoId: appName,  // Use same name for repoId
        appKey: `${appName}-${Date.now()}`,  // Add timestamp for uniqueness
        backendUrl: process.env.BACKEND_URL || 'https://analytics-service-production-0f0c.up.railway.app/ingest/analytics',
        domain: process.env.DOMAIN || `https://${appName}.vercel.app`,
        targetPath: targetPath
    };

    console.log('\n📝 Configuration:');
    console.log(`  App Name: ${config.appName}`);
    console.log(`  App Key: ${config.appKey}`);
    console.log(`  Backend URL: ${config.backendUrl}`);
    console.log(`  Domain: ${config.domain}`);
    console.log(`  Target Path: ${config.targetPath}`);

    try {
        const result = await testGenerator(config);
        console.log('\n🎉 Generation completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n💥 Generation failed:', error);
        process.exit(1);
    }
}

// Run generator
if (require.main === module) {
    runGenerator().catch(console.error);
}

export { testGenerator };