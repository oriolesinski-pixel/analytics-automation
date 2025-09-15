#!/usr/bin/env node

/**
 * Dead Code Analyzer for JavaScript/TypeScript Projects
 * 
 * Features:
 * - Traces imports from entry points
 * - Interactive approval for each deletion
 * - Creates backups before deletion
 * - Shows file preview and size
 * - Safe operation with ability to quit anytime
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CONFIG = {
    // Entry points to start tracing from
    entryPoints: [
        'server.ts',
        'index.ts',
        'main.ts',
        'app.ts',
        'server.js',
        'index.js',
        'main.js',
        'app.js'
    ],

    // File extensions to analyze
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],

    // Directories to skip
    ignoreDirs: [
        'node_modules',
        '.git',
        'dist',
        'build',
        'coverage',
        '.next',
        '.cache',
        'out',
        '.turbo',
        '.vercel',
        'backup_dead_code'
    ],

    // Files to always keep (never mark as dead)
    alwaysKeep: [
        'package.json',
        'tsconfig.json',
        'next.config.js',
        'vite.config.ts',
        'webpack.config.js',
        '.eslintrc.js',
        'jest.config.js',
        'tailwind.config.js',
        'postcss.config.js'
    ],

    // Backup directory
    backupDir: 'backup_dead_code',

    // Preview lines to show
    previewLines: 10
};

class DeadCodeAnalyzer {
    constructor() {
        this.usedFiles = new Set();
        this.allFiles = new Set();
        this.entryPoints = [];
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async run(targetDir) {
        console.log('\n🔍 Dead Code Analyzer Starting...\n');
        console.log(`📁 Analyzing: ${targetDir}`);
        console.log(`📝 Extensions: ${CONFIG.extensions.join(', ')}`);
        console.log(`🚀 Entry points: ${CONFIG.entryPoints.join(', ')}\n`);

        // Step 1: Find all files
        console.log('Step 1: Scanning all files...');
        this.scanDirectory(targetDir);
        console.log(`   Found ${this.allFiles.size} total files\n`);

        // Step 2: Find entry points
        console.log('Step 2: Locating entry points...');
        this.findEntryPoints(targetDir);

        if (this.entryPoints.length === 0) {
            console.log('❌ No entry points found! Please check your project structure.');
            this.rl.close();
            return;
        }

        console.log(`   Found ${this.entryPoints.length} entry points:`);
        this.entryPoints.forEach(ep => console.log(`   - ${path.relative(targetDir, ep)}`));
        console.log();

        // Step 3: Trace dependencies
        console.log('Step 3: Tracing dependencies from entry points...');
        for (const entryPoint of this.entryPoints) {
            this.traceDependencies(entryPoint, targetDir);
        }
        console.log(`   ${this.usedFiles.size} files are referenced\n`);

        // Step 4: Find dead files
        const deadFiles = this.findDeadFiles();

        if (deadFiles.length === 0) {
            console.log('✅ No dead code found! Your project is clean.\n');
            this.rl.close();
            return;
        }

        console.log(`\n⚠️  Found ${deadFiles.length} potentially dead files:\n`);

        // Step 5: Interactive review and deletion
        await this.interactiveReview(deadFiles, targetDir);

        this.rl.close();
    }

    scanDirectory(dir, baseDir = dir) {
        try {
            const items = fs.readdirSync(dir);

            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    if (!CONFIG.ignoreDirs.includes(item)) {
                        this.scanDirectory(fullPath, baseDir);
                    }
                } else if (stat.isFile()) {
                    const ext = path.extname(item);
                    if (CONFIG.extensions.includes(ext)) {
                        this.allFiles.add(fullPath);
                    }
                }
            }
        } catch (err) {
            console.error(`Error scanning ${dir}: ${err.message}`);
        }
    }

    findEntryPoints(baseDir) {
        // Look for entry points in root and common directories
        const searchDirs = [
            baseDir,
            path.join(baseDir, 'src'),
            path.join(baseDir, 'app'),
            path.join(baseDir, 'pages'),
            path.join(baseDir, 'api'),
            path.join(baseDir, 'packages', 'connector-service', 'src'),
            path.join(baseDir, 'packages', 'analyzer', 'src')
        ];

        for (const searchDir of searchDirs) {
            if (!fs.existsSync(searchDir)) continue;

            for (const entryFile of CONFIG.entryPoints) {
                const fullPath = path.join(searchDir, entryFile);
                if (fs.existsSync(fullPath)) {
                    this.entryPoints.push(fullPath);
                }
            }

            // Also look for route files in Next.js style projects
            this.findRouteFiles(searchDir);
        }
    }

    findRouteFiles(dir) {
        const routeIndicators = ['route.ts', 'route.js', 'page.tsx', 'page.jsx', 'api.ts', 'api.js'];

        try {
            const items = fs.readdirSync(dir);

            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory() && !CONFIG.ignoreDirs.includes(item)) {
                    this.findRouteFiles(fullPath);
                } else if (stat.isFile() && routeIndicators.includes(item)) {
                    this.entryPoints.push(fullPath);
                }
            }
        } catch (err) {
            // Ignore errors
        }
    }

    traceDependencies(file, baseDir, visited = new Set()) {
        if (visited.has(file)) return;
        visited.add(file);
        this.usedFiles.add(file);

        try {
            const content = fs.readFileSync(file, 'utf8');
            const imports = this.extractImports(content);

            for (const importPath of imports) {
                const resolvedPath = this.resolveImport(importPath, file, baseDir);
                if (resolvedPath && fs.existsSync(resolvedPath)) {
                    this.traceDependencies(resolvedPath, baseDir, visited);
                }
            }
        } catch (err) {
            // Ignore errors in reading/parsing files
        }
    }

    extractImports(content) {
        const imports = [];

        // ES6 imports
        const es6ImportRegex = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
        let match;
        while ((match = es6ImportRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        // CommonJS requires
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = requireRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        // Dynamic imports
        const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = dynamicImportRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        return imports;
    }

    resolveImport(importPath, fromFile, baseDir) {
        // Skip node_modules and external packages
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            return null;
        }

        const dir = path.dirname(fromFile);
        let resolvedPath = path.resolve(dir, importPath);

        // Try different extensions
        const variations = [
            resolvedPath,
            `${resolvedPath}.ts`,
            `${resolvedPath}.tsx`,
            `${resolvedPath}.js`,
            `${resolvedPath}.jsx`,
            path.join(resolvedPath, 'index.ts'),
            path.join(resolvedPath, 'index.tsx'),
            path.join(resolvedPath, 'index.js'),
            path.join(resolvedPath, 'index.jsx')
        ];

        for (const variant of variations) {
            if (fs.existsSync(variant) && fs.statSync(variant).isFile()) {
                return variant;
            }
        }

        return null;
    }

    findDeadFiles() {
        const deadFiles = [];

        for (const file of this.allFiles) {
            if (!this.usedFiles.has(file)) {
                const basename = path.basename(file);

                // Skip config files and special files
                if (CONFIG.alwaysKeep.includes(basename)) continue;
                if (basename.startsWith('.')) continue;
                if (basename.includes('.test.') || basename.includes('.spec.')) continue;
                if (basename.includes('.config.')) continue;
                if (basename === 'README.md') continue;

                deadFiles.push(file);
            }
        }

        return deadFiles.sort();
    }

    async interactiveReview(deadFiles, baseDir) {
        console.log('═'.repeat(80));
        console.log('INTERACTIVE REVIEW MODE');
        console.log('═'.repeat(80));
        console.log('\nOptions for each file:');
        console.log('  [y] Yes, delete this file (with backup)');
        console.log('  [n] No, keep this file');
        console.log('  [v] View more of the file');
        console.log('  [s] Skip remaining files');
        console.log('  [q] Quit without any changes\n');
        console.log('═'.repeat(80));

        const deletions = [];

        for (let i = 0; i < deadFiles.length; i++) {
            const file = deadFiles[i];
            const relativePath = path.relative(baseDir, file);

            console.log(`\n[${i + 1}/${deadFiles.length}] File: ${relativePath}`);

            // Show file info
            const stat = fs.statSync(file);
            const sizeKB = (stat.size / 1024).toFixed(2);
            console.log(`Size: ${sizeKB} KB | Modified: ${stat.mtime.toLocaleDateString()}`);

            // Show preview
            this.showFilePreview(file);

            // Get user input
            const action = await this.askUser('\nAction [y/n/v/s/q]: ');

            switch (action.toLowerCase()) {
                case 'y':
                    deletions.push(file);
                    console.log('  ✓ Marked for deletion');
                    break;
                case 'n':
                    console.log('  ✓ Keeping file');
                    break;
                case 'v':
                    this.showFullFile(file);
                    i--; // Re-ask for this file
                    break;
                case 's':
                    console.log('\n⏩ Skipping remaining files...');
                    i = deadFiles.length; // Exit loop
                    break;
                case 'q':
                    console.log('\n❌ Quitting without changes...');
                    return;
                default:
                    console.log('  ⚠️  Invalid option, keeping file');
            }
        }

        // Process deletions
        if (deletions.length > 0) {
            console.log('\n═'.repeat(80));
            console.log(`CONFIRMATION: Delete ${deletions.length} files?`);
            console.log('═'.repeat(80));

            deletions.forEach(file => {
                console.log(`  - ${path.relative(baseDir, file)}`);
            });

            const confirm = await this.askUser('\nProceed with deletion? [yes/no]: ');

            if (confirm.toLowerCase() === 'yes') {
                await this.deleteFiles(deletions, baseDir);
            } else {
                console.log('\n❌ Deletion cancelled.');
            }
        } else {
            console.log('\n✅ No files selected for deletion.');
        }
    }

    showFilePreview(file, lines = CONFIG.previewLines) {
        console.log('\n--- File Preview ---');
        try {
            const content = fs.readFileSync(file, 'utf8');
            const fileLines = content.split('\n');
            const preview = fileLines.slice(0, lines).join('\n');
            console.log(preview);

            if (fileLines.length > lines) {
                console.log(`... (${fileLines.length - lines} more lines)`);
            }
        } catch (err) {
            console.log(`Error reading file: ${err.message}`);
        }
        console.log('--- End Preview ---');
    }

    showFullFile(file) {
        console.log('\n--- Full File Content ---');
        try {
            const content = fs.readFileSync(file, 'utf8');
            console.log(content);
        } catch (err) {
            console.log(`Error reading file: ${err.message}`);
        }
        console.log('--- End Content ---');
    }

    askUser(question) {
        return new Promise(resolve => {
            this.rl.question(question, answer => {
                resolve(answer);
            });
        });
    }

    async deleteFiles(files, baseDir) {
        // Create backup directory
        const backupDir = path.join(baseDir, CONFIG.backupDir);
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const sessionBackupDir = path.join(backupDir, `session_${timestamp}`);

        if (!fs.existsSync(sessionBackupDir)) {
            fs.mkdirSync(sessionBackupDir, { recursive: true });
        }

        console.log(`\n📦 Creating backups in: ${path.relative(baseDir, sessionBackupDir)}`);

        let deletedCount = 0;
        let errorCount = 0;

        for (const file of files) {
            const relativePath = path.relative(baseDir, file);

            try {
                // Create backup
                const backupPath = path.join(sessionBackupDir, relativePath);
                const backupDir = path.dirname(backupPath);

                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, { recursive: true });
                }

                fs.copyFileSync(file, backupPath);

                // Delete original
                fs.unlinkSync(file);
                deletedCount++;
                console.log(`  ✓ Deleted: ${relativePath}`);
            } catch (err) {
                errorCount++;
                console.log(`  ✗ Error deleting ${relativePath}: ${err.message}`);
            }
        }

        console.log('\n═'.repeat(80));
        console.log('SUMMARY');
        console.log('═'.repeat(80));
        console.log(`✅ Successfully deleted: ${deletedCount} files`);
        if (errorCount > 0) {
            console.log(`❌ Errors: ${errorCount} files`);
        }
        console.log(`📦 Backups saved to: ${path.relative(baseDir, sessionBackupDir)}`);
        console.log('\nTo restore deleted files, copy them back from the backup directory.');
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const targetDir = args[0] || process.cwd();

    if (!fs.existsSync(targetDir)) {
        console.error(`❌ Directory not found: ${targetDir}`);
        process.exit(1);
    }

    const analyzer = new DeadCodeAnalyzer();
    await analyzer.run(path.resolve(targetDir));
}

// Run if executed directly
if (require.main === module) {
    main().catch(err => {
        console.error('\n❌ Fatal error:', err);
        process.exit(1);
    });
}

module.exports = DeadCodeAnalyzer;