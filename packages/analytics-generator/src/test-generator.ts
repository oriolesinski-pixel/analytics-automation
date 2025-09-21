// packages/analytics-generator/src/test-generator.ts
import { config } from 'dotenv';
import { analyticsGenerator } from './lib/analytics-intelligence-generator';

// Load environment variables
config();

interface TestConfig {
    appName: string;  // Display name
    repoId: string;   // What the generator expects (can be same as appName for examples)
    appKey: string;
    backendUrl?: string;
    domain?: string;
}

// Test configurations for different apps
const TEST_CONFIGS: TestConfig[] = [
    {
        appName: 'test-app-rich',
        repoId: 'test-app-rich',  // For examples directory, use the folder name
        appKey: 'test-app-rich-' + Date.now(),
        backendUrl: 'http://localhost:8082/ingest/analytics',
        domain: 'https://test-app-rich.example.com'
    },
    {
        appName: 'demo-next',
        repoId: 'demo-next',  // For examples directory, use the folder name
        appKey: 'demo-next-' + Date.now(),
        backendUrl: 'http://localhost:8082/ingest/analytics',
        domain: 'https://demo-next.example.com'
    }
];

async function testGenerator(config: TestConfig) {
    console.log('\n' + '='.repeat(50));
    console.log(`🧪 Testing Analytics Generator for: ${config.appName}`);
    console.log('='.repeat(50) + '\n');

    try {
        const startTime = Date.now();

        const result = await analyticsGenerator.generate({
            repoId: config.repoId,  // FIXED: Use repoId instead of appName
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

        // Display event summary - UPDATED FOR NEW SCHEMA
        const schema = result['events-schema.json'];
        if (schema && schema.events) {
            console.log('\n📋 Event Types:');
            schema.events.forEach((event: any) => {
                console.log(`  - ${event.event_type}:`);

                // Display data fields for the new schema structure
                if (event.data_fields && event.data_fields.length > 0) {
                    console.log(`    Data fields: ${event.data_fields.join(', ')}`);
                }

                // Show properties if available
                if (event.properties && Object.keys(event.properties).length > 0) {
                    const propTypes = Object.entries(event.properties)
                        .slice(0, 3)
                        .map(([key, type]) => `${key}(${type})`)
                        .join(', ');
                    console.log(`    Types: ${propTypes}${Object.keys(event.properties).length > 3 ? '...' : ''}`);
                }
            });

            // Display base fields information
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

            // Show framework detection
            if (uiGraph.framework) {
                console.log('  Framework:', uiGraph.framework);
            }

            // Show widget and modal counts
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

async function runAllTests() {
    console.log('🚀 Starting Analytics Generator Tests');
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

    const results = [];

    // Test specific app or all
    const appToTest = process.argv[2];
    const configsToTest = appToTest
        ? TEST_CONFIGS.filter(c => c.appName === appToTest)
        : TEST_CONFIGS;

    if (configsToTest.length === 0) {
        console.error(`❌ App '${appToTest}' not found. Available: ${TEST_CONFIGS.map(c => c.appName).join(', ')}`);
        process.exit(1);
    }

    for (const config of configsToTest) {
        try {
            const result = await testGenerator(config);
            results.push({ config, success: true, result });
        } catch (error) {
            results.push({ config, success: false, error });
        }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📈 Test Summary');
    console.log('='.repeat(50));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (failed.length > 0) {
        console.log('\nFailed tests:');
        failed.forEach(f => {
            console.log(`  - ${f.config.appName}: ${f.error}`);
        });
        process.exit(1);
    }

    console.log('\n🎉 All tests passed!');
}

// Run tests
if (require.main === module) {
    runAllTests().catch(console.error);
}

export { testGenerator, TEST_CONFIGS };