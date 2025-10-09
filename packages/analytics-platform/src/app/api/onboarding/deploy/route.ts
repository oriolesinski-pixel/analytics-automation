///Users/oriolesinski/analytics-automation/packages/analytics-platform/src/app/api/onboarding/deploy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function POST(request: NextRequest) {
  try {
    const { 
      repoOwner, 
      repoName, 
      trackerCode,      // Keep as fallback
      providerCode,     // Keep as fallback
      appKey,
      autoMerge = false,
      subdir,
      deploymentPlan
    } = await request.json();

    const githubToken = request.cookies.get('github_token')?.value;
    
    if (!githubToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const octokit = new Octokit({ auth: githubToken });

    // Helper to add subdirectory prefix
    const getFilePath = (path: string) => {
      if (subdir && subdir.trim()) {
        const cleanSubdir = subdir.replace(/^\/+|\/+$/g, '');
        const cleanPath = path.replace(/^\/+/, '');
        return `${cleanSubdir}/${cleanPath}`;
      }
      return path;
    };

    // Validate and prepare execution plan with fallback
    let executionPlan = deploymentPlan;
    
    console.log('\n📦 === DEPLOY ROUTE RECEIVED ===');
    console.log('   Has deploymentPlan:', !!deploymentPlan);
    console.log('   Has files array:', !!deploymentPlan?.files);
    console.log('   Files array length:', deploymentPlan?.files?.length || 0);
    console.log('   Framework:', deploymentPlan?.framework || 'none');
    if (deploymentPlan?.files) {
      console.log('   Files:', deploymentPlan.files.map((f: any) => `${f.action} ${f.path}`).join(', '));
    }
    console.log('============================\n');
    
    if (!executionPlan || !executionPlan.files || !Array.isArray(executionPlan.files) || executionPlan.files.length === 0) {
      console.warn('⚠️ No valid deployment plan, using fallback');
      
      if (!trackerCode || !providerCode) {
        return NextResponse.json({ 
          error: 'No deployment plan and no fallback code provided' 
        }, { status: 400 });
      }

      const componentPath = subdir?.includes('app/') || !subdir
        ? 'app/components/AnalyticsProvider.tsx'
        : 'src/components/AnalyticsProvider.tsx';

      executionPlan = {
        framework: 'unknown-fallback',
        files: [
          { path: 'public/tracker.js', action: 'create', content: trackerCode, description: 'Create tracker (fallback)' },
          { path: componentPath, action: 'create', content: providerCode, description: 'Create provider (fallback)' }
        ],
        instructions: ['Manual setup required', 'Add script tag and wrap with provider']
      };
    }

    // Filter out invalid files
    const validFiles = executionPlan.files.filter((f: any) => f.content && f.content.trim().length > 0);
    if (validFiles.length < executionPlan.files.length) {
      console.warn(`Filtered ${executionPlan.files.length - validFiles.length} empty files`);
      executionPlan.files = validFiles;
    }

    if (executionPlan.files.length === 0) {
      return NextResponse.json({ error: 'No valid file operations' }, { status: 400 });
    }

    console.log('🚀 Executing deployment plan:', {
      repo: `${repoOwner}/${repoName}`,
      subdir: subdir || 'root',
      framework: executionPlan.framework,
      operations: executionPlan.files.length,
      autoMerge
    });

    const { data: repo } = await octokit.repos.get({ owner: repoOwner, repo: repoName });
    const baseBranch = repo.default_branch;

    const { data: ref } = await octokit.git.getRef({
      owner: repoOwner,
      repo: repoName,
      ref: `heads/${baseBranch}`
    });
    const baseSha = ref.object.sha;

    const branchName = `analytics-integration-${Date.now()}`;
    await octokit.git.createRef({
      owner: repoOwner,
      repo: repoName,
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    });

    console.log(`✅ Created branch: ${branchName}`);

    // Execute file operations
    let filesCreated = 0;
    let filesModified = 0;
    const fileResults: any[] = [];
    const errors: string[] = [];

    for (const fileOp of executionPlan.files) {
      const filePath = getFilePath(fileOp.path);
      console.log(`📝 ${fileOp.action} ${filePath} (${(fileOp.content.length / 1024).toFixed(1)} KB)`);

      let fileSha;
      try {
        const { data: existing } = await octokit.repos.getContent({
          owner: repoOwner,
          repo: repoName,
          path: filePath,
          ref: baseBranch
        });
        fileSha = Array.isArray(existing) ? undefined : existing.sha;
      } catch (e) {
        if (fileOp.action === 'modify') {
          errors.push(`Cannot modify ${filePath} - doesn't exist`);
          fileResults.push({ path: filePath, status: 'failed', action: fileOp.action, error: 'not found' });
          continue;
        }
      }

      if (!fileOp.content || fileOp.content.trim().length === 0) {
        errors.push(`Empty content for ${filePath}`);
        fileResults.push({ path: filePath, status: 'failed', action: fileOp.action, error: 'empty' });
        continue;
      }

      try {
        await octokit.repos.createOrUpdateFileContents({
          owner: repoOwner,
          repo: repoName,
          path: filePath,
          message: fileOp.description || `${fileOp.action} ${filePath}`,
          content: Buffer.from(fileOp.content).toString('base64'),
          branch: branchName,
          sha: fileSha
        });

        if (fileOp.action === 'create') filesCreated++;
        else filesModified++;

        fileResults.push({ path: filePath, status: 'success', action: fileOp.action, size: fileOp.content.length });
        console.log(`   ✅ Success`);
      } catch (error: any) {
        console.error(`   ❌ Failed:`, error.message);
        errors.push(`${filePath}: ${error.message}`);
        fileResults.push({ path: filePath, status: 'failed', action: fileOp.action, error: error.message });
      }
    }

    const successCount = filesCreated + filesModified;
    console.log(`✅ Executed: ${successCount}/${executionPlan.files.length} succeeded`);

    if (successCount === 0) {
      return NextResponse.json({ error: 'All operations failed', details: errors }, { status: 500 });
    }

    // Create PR
    const fileList = executionPlan.files.map((f: any, idx: number) => {
      const fullPath = getFilePath(f.path);
      const result = fileResults.find((r: any) => r.path === fullPath);
      const icon = f.action === 'create' ? '➕' : '✏️';
      const status = result?.status === 'success' ? '✅' : '❌';
      const size = result?.size ? ` (${(result.size / 1024).toFixed(1)} KB)` : '';
      return `${icon} ${status} \`${fullPath}\`${size} - ${f.description}`;
    }).join('\n');

    const { data: pr } = await octokit.pulls.create({
      owner: repoOwner,
      repo: repoName,
      title: '🎯 Add Analytics Tracking',
      head: branchName,
      base: baseBranch,
      body: `## Analytics Integration

This PR adds analytics tracking${subdir ? ` to \`${subdir}\`` : ''}.

### 🤖 Framework: \`${executionPlan.framework}\`
### 📊 Success: ${successCount}/${executionPlan.files.length} files

### 📁 Operations:
${fileList}

${errors.length > 0 ? `### ⚠️ Errors:\n\`\`\`\n${errors.join('\n')}\n\`\`\`\n\n` : ''}### 🔑 App Key: \`${appKey}\`

${executionPlan.instructions?.length ? `### 📝 ${executionPlan.framework === 'unknown-fallback' ? 'Manual Setup Required' : 'Notes'}:\n${executionPlan.instructions.map((i: string) => i).join('\n')}\n\n` : '### ✅ Fully Automated\nAnalytics integrated automatically!\n\n'}### 🎯 Features:
- 🤖 AI-powered event detection
- 🔑 8-10 digit persistent user IDs
- 📊 5 event types
- 🚀 Framework-aware integration

---
*AI-generated deployment via Claude*`
    });

    console.log(`✅ Created PR #${pr.number}`);

    // Auto-merge if requested and no errors
    let merged = false;
    if (autoMerge && errors.length === 0) {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await octokit.pulls.merge({
          owner: repoOwner,
          repo: repoName,
          pull_number: pr.number,
          merge_method: 'squash'
        });
        await octokit.git.deleteRef({
          owner: repoOwner,
          repo: repoName,
          ref: `heads/${branchName}`
        });
        merged = true;
        console.log('✅ Auto-merged');
      } catch (e: any) {
        console.log('⚠️ Auto-merge failed:', e.message);
      }
    }

    return NextResponse.json({
      success: true,
      prUrl: pr.html_url,
      prNumber: pr.number,
      branch: branchName,
      filesCreated,
      filesModified,
      fileResults,
      errors,
      merged,
      framework: executionPlan.framework,
      hasManualSteps: executionPlan.instructions?.length > 0
    });

  } catch (error: any) {
    console.error('❌ Deploy error:', error);
    return NextResponse.json(
      { error: error.message || 'Deployment failed', details: error.stack },
      { status: 500 }
    );
  }
}
