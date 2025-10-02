///Users/oriolesinski/analytics-automation/packages/analytics-platform/src/app/api/onboarding/deploy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function POST(request: NextRequest) {
  try {
    const { 
      repoOwner, 
      repoName, 
      trackerCode, 
      providerCode, 
      appKey,
      autoMerge = false,
      subdir 
    } = await request.json();

    const githubToken = request.cookies.get('github_token')?.value;
    
    if (!githubToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const octokit = new Octokit({ auth: githubToken });

    const getFilePath = (relativePath: string) => {
      if (subdir && subdir.trim()) {
        const cleanSubdir = subdir.replace(/^\/+|\/+$/g, '');
        const cleanRelativePath = relativePath.replace(/^\/+/, '');
        return `${cleanSubdir}/${cleanRelativePath}`;
      }
      return relativePath;
    };

    const trackerPath = getFilePath('public/tracker.js');
    const providerPath = getFilePath('app/components/AnalyticsProvider.tsx');
    const layoutPath = getFilePath('app/layout.tsx');

    console.log('Deploy configuration:', {
      repoOwner,
      repoName,
      subdir: subdir || 'root',
      trackerPath,
      providerPath,
      layoutPath
    });

    const { data: repo } = await octokit.repos.get({
      owner: repoOwner,
      repo: repoName
    });
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

    // Create tracker.js
    let trackerSha;
    try {
      const { data: existingFile } = await octokit.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: trackerPath,
        ref: baseBranch
      });
      trackerSha = Array.isArray(existingFile) ? undefined : existingFile.sha;
    } catch (e) {
      // File doesn't exist
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: repoOwner,
      repo: repoName,
      path: trackerPath,
      message: 'Add analytics tracker',
      content: Buffer.from(trackerCode).toString('base64'),
      branch: branchName,
      sha: trackerSha
    });

    // Create analytics provider
    let providerSha;
    try {
      const { data: existingFile } = await octokit.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: providerPath,
        ref: baseBranch
      });
      providerSha = Array.isArray(existingFile) ? undefined : existingFile.sha;
    } catch (e) {
      // File doesn't exist
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: repoOwner,
      repo: repoName,
      path: providerPath,
      message: 'Add analytics provider component',
      content: Buffer.from(providerCode).toString('base64'),
      branch: branchName,
      sha: providerSha
    });

    // Modify layout.tsx to integrate analytics
    let layoutModified = false;
    let layoutSha;
    
    try {
      const { data: layoutFile } = await octokit.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: layoutPath,
        ref: baseBranch
      });
      
      if (!Array.isArray(layoutFile) && 'content' in layoutFile) {
        layoutSha = layoutFile.sha;
        const layoutContent = Buffer.from(layoutFile.content, 'base64').toString('utf-8');
        
        // Check if analytics is already integrated
        if (!layoutContent.includes('tracker.js') || !layoutContent.includes('AnalyticsProvider')) {
          let modifiedLayout = layoutContent;
          
          // Step 1: Add import for AnalyticsProvider (if not present)
          if (!modifiedLayout.includes('AnalyticsProvider')) {
            // Find the last import statement
            const importLines = modifiedLayout.split('\n');
            let lastImportIndex = -1;
            
            for (let i = 0; i < importLines.length; i++) {
              if (importLines[i].trim().startsWith('import ')) {
                lastImportIndex = i;
              }
            }
            
            if (lastImportIndex >= 0) {
              // Add the import after the last import
              importLines.splice(
                lastImportIndex + 1,
                0,
                "import AnalyticsProvider from '@/app/components/AnalyticsProvider';"
              );
              modifiedLayout = importLines.join('\n');
            }
          }
          
          // Step 2: Add script tag in <head> (if not present)
          if (!modifiedLayout.includes('tracker.js')) {
            if (modifiedLayout.includes('<head>')) {
              modifiedLayout = modifiedLayout.replace(
                '<head>',
                '<head>\n        <script src="/tracker.js" defer></script>'
              );
            } else {
              // Add <head> section if it doesn't exist
              modifiedLayout = modifiedLayout.replace(
                '<html',
                '<html'
              ).replace(
                /(<html[^>]*>)/,
                '$1\n      <head>\n        <script src="/tracker.js" defer></script>\n      </head>'
              );
            }
          }
          
          // Step 3: Wrap children with AnalyticsProvider (if not present)
          if (!modifiedLayout.includes('<AnalyticsProvider')) {
            // Find the first child element after <body and wrap everything
            // Look for the pattern: <body ...> [content] </body>
            const bodyContentMatch = modifiedLayout.match(/(<body[^>]*>)([\s\S]*?)(<\/body>)/);
            
            if (bodyContentMatch) {
              const [fullMatch, openingBody, bodyContent, closingBody] = bodyContentMatch;
              
              // Wrap the body content with AnalyticsProvider
              const wrappedContent = `${openingBody}\n        <AnalyticsProvider>${bodyContent.trim()}\n        </AnalyticsProvider>\n      ${closingBody}`;
              
              modifiedLayout = modifiedLayout.replace(fullMatch, wrappedContent);
            }
          }
          
          layoutModified = true;
          
          await octokit.repos.createOrUpdateFileContents({
            owner: repoOwner,
            repo: repoName,
            path: layoutPath,
            message: 'Integrate analytics into layout',
            content: Buffer.from(modifiedLayout).toString('base64'),
            branch: branchName,
            sha: layoutSha
          });
          console.log('✅ Modified layout.tsx to integrate analytics');
        } else {
          console.log('ℹ️ Analytics already integrated in layout.tsx');
        }
      }
    } catch (e) {
      console.log('⚠️ Could not modify layout.tsx:', e);
      layoutModified = false;
    }

    // Create Pull Request
    const { data: pr } = await octokit.pulls.create({
      owner: repoOwner,
      repo: repoName,
      title: '🎯 Add Analytics Tracking',
      head: branchName,
      base: baseBranch,
      body: `## Analytics Integration

This PR adds analytics tracking to your application${subdir ? ` in the \`${subdir}\` directory` : ''}.

### What's included:
- ✅ Analytics tracker script (\`${trackerPath}\`)
- ✅ React Analytics Provider component (\`${providerPath}\`)
${layoutModified ? `- ✅ Modified \`${layoutPath}\` to integrate analytics\n` : ''}
- ✅ Auto-configured with app key: \`${appKey}\`

### Changes to layout.tsx:
${layoutModified ? `- Added \`<script src="/tracker.js" defer></script>\` to \`<head>\`
- Added import for \`AnalyticsProvider\`
- Wrapped app with \`<AnalyticsProvider>\` component

**No manual installation required** - everything is configured!` : `**Manual installation required:**
1. Add \`<script src="/tracker.js" defer></script>\` to \`<head>\`
2. Import: \`import AnalyticsProvider from '@/app/components/AnalyticsProvider';\`
3. Wrap your app with \`<AnalyticsProvider>\``}

### Features:
- 🤖 AI-powered event detection
- 🔑 Persistent user tracking (8-10 digit IDs)
- 📊 5 event types (PAGE_VIEW, BUTTON_CLICK, etc.)
- 🚀 ${layoutModified ? 'Fully automated setup' : 'Simple manual setup'}

${subdir ? `### Directory Structure:
This integration is configured for the \`${subdir}\` subdirectory of your repository.

` : ''}---
*Generated by Analytics Platform*`
    });

    // Auto-merge if requested
    if (autoMerge) {
      try {
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
      } catch (mergeError) {
        console.log('Auto-merge failed:', mergeError);
      }
    }

    return NextResponse.json({
      success: true,
      prUrl: pr.html_url,
      prNumber: pr.number,
      branch: branchName,
      layoutModified
    });

  } catch (error) {
    console.error('Deploy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Deployment failed' },
      { status: 500 }
    );
  }
}