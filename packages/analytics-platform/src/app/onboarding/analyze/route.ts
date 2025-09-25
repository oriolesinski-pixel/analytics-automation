// packages/analytics-platform/src/app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Helper to execute commands with promise
function executeCommand(command: string, args: string[], options: any = {}): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            ...options,
            shell: true
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
            console.log('Generator output:', data.toString());
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
            console.error('Generator error:', data.toString());
        });

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            } else {
                resolve({ stdout, stderr });
            }
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

export async function POST(request: NextRequest) {
    let tempDir: string | null = null;

    try {
        const body = await request.json();
        const { repoId, repoName, repoOwner, defaultBranch } = body;

        // Get token from cookie
        const token = request.cookies.get('github_token')?.value;

        if (!token) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // Generate unique app key
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const appKey = `${repoName}-${timestamp}`;

        console.log(`Starting analysis for ${repoOwner}/${repoName}`);
        console.log(`  App Key: ${appKey}`);

        // For now, let's use the local test-app-rich instead of cloning
        // This is a temporary fix to get the flow working
        const isTestRepo = repoName === 'test-app-rich-demo' || repoName === 'test-app-rich';

        if (isTestRepo) {
            // Use local test app
            tempDir = path.resolve(process.cwd(), '../../examples/test-app-rich');
            console.log(`Using local test app at ${tempDir}`);
        } else {
            // Clone the repository
            tempDir = path.join('/tmp', `repo-${crypto.randomBytes(8).toString('hex')}`);
            fs.mkdirSync(tempDir, { recursive: true });

            const cloneUrl = `https://${token}@github.com/${repoOwner}/${repoName}.git`;
            console.log(`Cloning repository to ${tempDir}...`);

            await executeCommand('git', [
                'clone',
                '--depth', '1',
                '--branch', defaultBranch || 'main',
                cloneUrl,
                tempDir
            ]);
        }

        // Run the generator using the deploy-simple.sh approach
        // Current directory is packages/analytics-platform, need to go up to project root
        const currentDir = process.cwd();
        console.log(`Current directory: ${currentDir}`);

        const projectRoot = path.resolve(currentDir, '../..');
        const generatorPath = path.join(projectRoot, 'packages/analytics-generator');

        console.log(`Project root: ${projectRoot}`);
        console.log(`Generator path: ${generatorPath}`);

        // Clean old outputs if they exist for the app key
        const cleanupPath = path.join(
            generatorPath,
            'src/utils/generated-outputs/unified',
            appKey
        );

        if (fs.existsSync(cleanupPath)) {
            console.log(`Cleaning old outputs at ${cleanupPath}`);
            await executeCommand('rm', ['-rf', cleanupPath]);
        }

        // Set environment variables and run generator
        process.env.TARGET_PATH = tempDir;
        process.env.APP_KEY = appKey;

        console.log('Running generator with:');
        console.log('  TARGET_PATH:', tempDir);
        console.log('  APP_KEY:', appKey);

        // Change to generator directory and run
        const originalDir = process.cwd();
        process.chdir(generatorPath);

        try {
            // Run the generator with the app key
            await executeCommand('npx', [
                'ts-node',
                'src/test-generator.ts',
                appKey  // Pass the full app key
            ], {
                cwd: generatorPath,
                env: {
                    ...process.env,
                    TARGET_PATH: tempDir,
                    APP_KEY: appKey
                }
            });

            console.log('Generator completed successfully');
        } finally {
            process.chdir(originalDir);
        }

        // Wait a moment for files to be written
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Find the generated files - look in the app key directory
        const outputBasePath = path.join(
            generatorPath,
            'src/utils/generated-outputs/unified',
            appKey  // Use the full app key
        );

        if (!fs.existsSync(outputBasePath)) {
            throw new Error(`Output directory not created at ${outputBasePath}`);
        }

        const dirs = fs.readdirSync(outputBasePath).filter(d => {
            const fullPath = path.join(outputBasePath, d);
            return fs.statSync(fullPath).isDirectory();
        });

        if (dirs.length === 0) {
            throw new Error('No output directory created by generator');
        }

        const latestDir = dirs.sort().pop();
        const outputPath = path.join(outputBasePath, latestDir!);

        console.log(`Reading generated files from ${outputPath}`);

        // Read generated files
        const readFileIfExists = (filePath: string, defaultValue: any = null) => {
            try {
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    return filePath.endsWith('.json') ? JSON.parse(content) : content;
                }
                return defaultValue;
            } catch (error) {
                console.error(`Error reading ${filePath}:`, error);
                return defaultValue;
            }
        };

        const schema = readFileIfExists(
            path.join(outputPath, 'events-schema.json'),
            { events: [], routes: [], base_fields: [] }
        );

        const uiGraph = readFileIfExists(
            path.join(outputPath, 'ui-graph.json'),
            { nodes: [], edges: [] }
        );

        const metadata = readFileIfExists(
            path.join(outputPath, 'metadata.json'),
            { total_pages: 0, total_components: 0 }
        );

        const trackerCode = readFileIfExists(
            path.join(outputPath, 'tracker.js'),
            ''
        );

        const providerCode = readFileIfExists(
            path.join(outputPath, 'analytics-provider.tsx'),
            ''
        );

        // Register the app with the unique tracking key
        try {
            const registerResponse = await fetch('http://localhost:8082/apps/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_key: appKey,  // Use the unique timestamped key
                    name: repoName,
                    domain: `${repoName}.vercel.app`,
                    repo_owner: repoOwner || 'unknown',
                    repo_name: repoName
                })
            });

            if (!registerResponse.ok) {
                const errorText = await registerResponse.text();
                console.error('App registration failed with status:', registerResponse.status);
                console.error('Error response:', errorText);
                // Don't throw - continue anyway since the generation succeeded
            } else {
                console.log(`Registered app with key: ${appKey}`);
            }
        } catch (e) {
            console.error('App registration failed:', e);
            // Don't throw - continue anyway since the generation succeeded
        }

        // Clean up temp directory if not using local
        if (!isTestRepo && tempDir && tempDir.startsWith('/tmp/')) {
            try {
                await executeCommand('rm', ['-rf', tempDir]);
            } catch { }
        }

        // Return results
        return NextResponse.json({
            success: true,
            appKey,
            schema,
            uiGraph,
            metadata,
            trackerCode,
            providerCode,
            events: schema.events || [],
            routes: schema.routes || [],
            totalPages: metadata.total_pages || metadata.pages || 0,
            totalComponents: metadata.total_components || metadata.components || 0,
            estimatedEvents: metadata.estimated_events_per_day || '10K'
        });

    } catch (error: any) {
        console.error('Analysis error:', error);

        // Clean up temp directory
        if (tempDir && tempDir.startsWith('/tmp/')) {
            try {
                await executeCommand('rm', ['-rf', tempDir]);
            } catch { }
        }

        return NextResponse.json(
            {
                error: 'Failed to analyze repository',
                details: error.message
            },
            { status: 500 }
        );
    }
}