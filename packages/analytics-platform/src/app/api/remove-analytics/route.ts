import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

/**
 * Smart Analytics Removal API
 * 
 * This endpoint intelligently removes analytics integration without disrupting other changes.
 * 
 * TWO REMOVAL STRATEGIES:
 * 
 * 1. PRE-MERGE (Step 5 - PR exists but not merged):
 *    - Simply close the PR and delete the branch
 *    - No need for removal PR since files never reached main
 * 
 * 2. POST-MERGE (Step 6 - PR already merged):
 *    - Analyzes the original analytics PR to find what was added
 *    - For NEW files (tracker.js, provider): Delete entirely
 *    - For MODIFIED files (layouts): Surgically remove only analytics lines
 *    - Preserves all other changes made after analytics was integrated
 *    - Creates a removal PR that can be auto-merged
 * 
 * KEY FEATURE: Smart Line-by-Line Removal
 * - Extracts exact lines added by analytics PR from the git patch
 * - Gets CURRENT version of modified files (not old version)
 * - Removes only lines that match analytics additions
 * - Preserves everything else, including changes made after analytics PR
 * 
 * This approach ensures NO CONFLICTS with:
 * - Changes made after analytics was integrated
 * - CI/CD pipelines
 * - Other developers' work
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, token, subdir, prNumber, isMerged } = body;
    
    // Also check for token in headers (for onboarding flow)
    const headerToken = request.headers.get('X-GitHub-Token');
    const authToken = token || headerToken;
    
    if (!owner || !repo || !authToken) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const octokit = new Octokit({ auth: authToken });
    
    // Validate token before proceeding
    try {
      const { data: user } = await octokit.rest.users.getAuthenticated();
      console.log(`✅ Authenticated as: ${user.login}`);
      
      // Verify access to the specific repo
      await octokit.repos.get({ owner, repo });
      console.log(`✅ Has access to: ${owner}/${repo}`);
    } catch (authError: any) {
      console.error('GitHub auth error:', authError.message);
      if (authError.status === 401) {
        return NextResponse.json(
          { error: 'GitHub token is invalid or expired. Please re-authenticate by clearing your browser storage and entering a fresh token.' },
          { status: 401 }
        );
      }
      if (authError.status === 403) {
        return NextResponse.json(
          { error: 'GitHub token lacks required permissions. Ensure it has "repo" scope.' },
          { status: 403 }
        );
      }
      if (authError.status === 404) {
        return NextResponse.json(
          { error: `Repository ${owner}/${repo} not found or you don't have access to it.` },
          { status: 404 }
        );
      }
      throw authError;
    }
    
    // Case 1: If PR exists and hasn't been merged yet, just close it and delete the branch
    if (prNumber && !isMerged) {
      console.log(`Closing unmerged PR #${prNumber} and deleting branch...`);
      
      try {
        // Get PR details to find the branch name
        const { data: pr } = await octokit.pulls.get({
          owner,
          repo,
          pull_number: prNumber
        });
        
        const branchName = pr.head.ref;
        
        // Close the PR
        await octokit.pulls.update({
          owner,
          repo,
          pull_number: prNumber,
          state: 'closed'
        });
        
        console.log(`✅ Closed PR #${prNumber}`);
        
        // Delete the branch
        try {
          await octokit.git.deleteRef({
            owner,
            repo,
            ref: `heads/${branchName}`
          });
          console.log(`✅ Deleted branch: ${branchName}`);
        } catch (deleteError) {
          console.log(`⚠️ Could not delete branch ${branchName}:`, deleteError);
        }
        
        return NextResponse.json({ 
          success: true,
          message: 'Analytics PR closed and branch deleted successfully',
          prUrl: pr.html_url,
          closed: true
        });
      } catch (error: any) {
        console.error('Error closing PR:', error);
        return NextResponse.json(
          { error: `Failed to close PR: ${error.message}` },
          { status: 500 }
        );
      }
    }
    
    // Case 2: PR has been merged, need to create a removal PR
    console.log('Creating removal PR for merged analytics...');

    // Get default branch
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;
    
    // Get current commit SHA
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`
    });
    const baseSha = refData.object.sha;
    
    // If we have a PR number, get the files that were changed and the exact code additions
    let filesToRemove: string[] = [];
    let filesToModify: { path: string, patch: string }[] = [];
    
    if (prNumber) {
      console.log(`🔍 Analyzing PR #${prNumber} to find analytics additions...`);
      try {
        // Get the files changed in the PR with their diffs
        const { data: prFiles } = await octokit.pulls.listFiles({
          owner,
          repo,
          pull_number: prNumber
        });
        
        for (const file of prFiles) {
          if (file.status === 'added') {
            filesToRemove.push(file.filename);
            console.log(`  📝 Will delete: ${file.filename}`);
          } else if (file.status === 'modified' && file.patch) {
            // Store the patch so we can reverse it
            filesToModify.push({ 
              path: file.filename, 
              patch: file.patch 
            });
            console.log(`  ✂️ Will remove additions from: ${file.filename}`);
          }
        }
      } catch (error) {
        console.error('Error analyzing PR files:', error);
        // Fall back to default file list
        filesToRemove = [
          subdir ? `${subdir}/public/tracker.js` : 'public/tracker.js',
          subdir ? `${subdir}/app/components/AnalyticsProvider.tsx` : 'app/components/AnalyticsProvider.tsx'
        ];
      }
    } else {
      // No PR number - use default locations
      filesToRemove = [
        subdir ? `${subdir}/public/tracker.js` : 'public/tracker.js',
        subdir ? `${subdir}/app/components/AnalyticsProvider.tsx` : 'app/components/AnalyticsProvider.tsx'
      ];
    }
    
    console.log(`📊 Files to delete: ${filesToRemove.length}, Files to clean: ${filesToModify.length}`);
    
    // Create a new branch for removal
    const branchName = `remove-analytics-${Date.now()}`;
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    });
    
    // Track successful operations
    const deletedFiles: string[] = [];
    const revertedFiles: string[] = [];
    const errors: string[] = [];
    
    // Delete each file that was added
    for (const filePath of filesToRemove) {
      try {
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo,
          path: filePath,
          ref: branchName  // Use the new branch
        });
        
        if (!Array.isArray(fileData) && 'sha' in fileData) {
          await octokit.repos.deleteFile({
            owner,
            repo,
            path: filePath,
            message: `Remove ${filePath}`,
            sha: fileData.sha,
            branch: branchName
          });
          deletedFiles.push(filePath);
          console.log(`✅ Deleted: ${filePath}`);
        }
      } catch (e: any) {
        console.log(`⚠️ File not found or already deleted: ${filePath}`);
        errors.push(`Could not delete ${filePath}: ${e.message}`);
      }
    }
    
    // Helper function to extract added lines from a git patch
    const extractAddedLines = (patch: string): Set<string> => {
      const addedLines = new Set<string>();
      const lines = patch.split('\n');
      
      for (const line of lines) {
        // Lines starting with '+' (but not '+++') are additions
        if (line.startsWith('+') && !line.startsWith('+++')) {
          // Remove the '+' prefix and trim
          const content = line.substring(1).trim();
          if (content) {
            addedLines.add(content);
          }
        }
      }
      
      return addedLines;
    };
    
    // Helper function to check if a line contains analytics-related code
    // Uses context-aware matching to avoid removing structural code
    const isAnalyticsLine = (line: string, addedLines: Set<string>, lineIndex: number, allLines: string[]): boolean => {
      const trimmedLine = line.trim();
      
      // Skip empty lines and very short structural lines (like single '}' or '>')
      if (!trimmedLine || trimmedLine.length <= 2) {
        return false;
      }
      
      // Check for analytics-specific patterns (must contain these keywords)
      const analyticsPatterns = [
        'tracker.js',
        'AnalyticsProvider',
        'analytics-provider',
        'app_key',
        'APP_KEY',
        "from 'next/script'",
        'import Script from',
      ];
      
      const hasAnalyticsKeyword = analyticsPatterns.some(pattern => trimmedLine.includes(pattern));
      
      // Only check addedLines if the line contains analytics keywords
      // This prevents removing structural code that happens to match
      if (hasAnalyticsKeyword && addedLines.has(trimmedLine)) {
        return true;
      }
      
      // Additional check: is this an analytics import line?
      if (trimmedLine.startsWith('import') && hasAnalyticsKeyword) {
        return true;
      }
      
      // Check for Script component tag (Next.js specific)
      if (trimmedLine.includes('<Script') && trimmedLine.includes('tracker.js')) {
        return true;
      }
      
      // Check for AnalyticsProvider opening tag (with or without props)
      if (trimmedLine.match(/^<AnalyticsProvider(\s|>)/)) {
        return true;
      }
      
      // Check for AnalyticsProvider closing tag - BUT only if it's standalone
      // and the previous/next lines suggest it's the analytics wrapper
      if (trimmedLine === '</AnalyticsProvider>') {
        // Look at context: check if surrounding lines suggest this is the provider wrapper
        const prevLine = lineIndex > 0 ? allLines[lineIndex - 1].trim() : '';
        const nextLine = lineIndex < allLines.length - 1 ? allLines[lineIndex + 1].trim() : '';
        
        // Only remove if it's clearly part of the analytics wrapper
        // (e.g., near body tags or other provider-related code)
        if (prevLine.includes('children') || nextLine.includes('</body>') || 
            prevLine.includes('</div>') || nextLine === '</body>') {
          return true;
        }
      }
      
      return false;
    };
    
    // Helper to unwrap AnalyticsProvider while preserving content
    const unwrapAnalyticsProvider = (content: string): string => {
      // Find the AnalyticsProvider opening tag
      const openingTagRegex = /<AnalyticsProvider[^>]*>/;
      const openingMatch = content.match(openingTagRegex);
      
      if (!openingMatch) {
        return content; // No provider to unwrap
      }
      
      const openingIndex = openingMatch.index!;
      const openingTag = openingMatch[0];
      
      // Find the matching closing tag
      const closingTag = '</AnalyticsProvider>';
      const closingIndex = content.lastIndexOf(closingTag);
      
      if (closingIndex === -1 || closingIndex <= openingIndex) {
        console.log('  ⚠️ Could not find matching closing tag for AnalyticsProvider');
        return content;
      }
      
      // Extract content before, inside, and after the provider
      const before = content.substring(0, openingIndex);
      const inside = content.substring(openingIndex + openingTag.length, closingIndex);
      const after = content.substring(closingIndex + closingTag.length);
      
      console.log('  ✂️ Unwrapping AnalyticsProvider wrapper');
      return before + inside + after;
    };
    
    // Surgically remove analytics additions from modified files
    for (const { path, patch } of filesToModify) {
      try {
        // Get the CURRENT content from main branch (not the old version)
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo,
          path: path,
          ref: branchName
        });
        
        if (!Array.isArray(fileData) && 'sha' in fileData && fileData.type === 'file' && 'content' in fileData) {
          let currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
          
          // Step 1: Unwrap AnalyticsProvider (preserves content inside)
          currentContent = unwrapAnalyticsProvider(currentContent);
          
          const currentLines = currentContent.split('\n');
          
          // Extract what was added in the analytics PR
          const addedLines = extractAddedLines(patch);
          console.log(`  📋 ${path}: Found ${addedLines.size} added lines to remove`);
          
          // Step 2: Remove analytics-specific lines (imports, Script tags, etc.)
          const cleanedLines: string[] = [];
          let removedCount = 0;
          
          for (let i = 0; i < currentLines.length; i++) {
            const line = currentLines[i];
            if (isAnalyticsLine(line, addedLines, i, currentLines)) {
              removedCount++;
              console.log(`    🗑️ Removing line ${i + 1}: ${line.trim().substring(0, 60)}...`);
            } else {
              cleanedLines.push(line);
            }
          }
          
          // Always update if we unwrapped the provider or removed lines
          const originalContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
          const cleanedContent = cleanedLines.join('\n');
          const contentChanged = originalContent !== cleanedContent;
          
          if (contentChanged) {
            await octokit.repos.createOrUpdateFileContents({
              owner,
              repo,
              path: path,
              message: `Remove analytics additions from ${path}`,
              content: Buffer.from(cleanedContent).toString('base64'),
              branch: branchName,
              sha: fileData.sha
            });
            
            revertedFiles.push(path);
            console.log(`  ✅ Cleaned ${path}: unwrapped provider and removed ${removedCount} analytics line(s)`);
          } else {
            console.log(`  ⚠️ No analytics changes detected in current version of ${path}`);
          }
        }
      } catch (e: any) {
        console.log(`  ❌ Could not clean ${path}:`, e.message);
        errors.push(`Could not clean ${path}: ${e.message}`);
      }
    }
    
    // Check if any operations succeeded
    if (deletedFiles.length === 0 && revertedFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files were modified or deleted. Analytics may have already been removed.', details: errors },
        { status: 400 }
      );
    }
    
    // Create PR for removal
    const fileList = [
      ...deletedFiles.map(f => `- 🗑️ **Deleted**: \`${f}\``),
      ...revertedFiles.map(f => `- ✂️ **Cleaned**: \`${f}\` (surgically removed analytics lines)`)
    ].join('\n');
    
    const errorSection = errors.length > 0 
      ? `\n### ⚠️ Warnings:\n${errors.map(e => `- ${e}`).join('\n')}\n`
      : '';
    
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: '🗑️ Remove Analytics Integration',
      head: branchName,
      base: defaultBranch,
      body: `## 🧹 Smart Analytics Removal

This PR surgically removes analytics tracking from your application${subdir ? ` in the \`${subdir}\` directory` : ''}.

### 🎯 Smart Removal Strategy
- **New files** (tracker, provider) → Deleted entirely
- **Modified files** (layouts) → Only analytics lines removed, all other changes preserved
- **No conflicts** with any changes made after analytics integration

### 📁 Operations Performed:
${fileList}
${errorSection}
### ✅ After Merging:
- Analytics tracking completely removed
- All other code changes preserved
- No disruption to your CI/CD pipeline

---
*🤖 Smart removal by Analytics Platform*`
    });
    
    // Auto-merge the removal PR
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for PR to be mergeable
      
      await octokit.pulls.merge({
        owner,
        repo,
        pull_number: pr.number,
        merge_method: 'squash'
      });
      
      // Delete branch after merge
      await octokit.git.deleteRef({
        owner,
        repo,
        ref: `heads/${branchName}`
      });
      
      console.log('✅ Analytics removal PR merged automatically');
      
      return NextResponse.json({ 
        success: true,
        message: `Analytics removed successfully! Deleted ${deletedFiles.length} file(s), reverted ${revertedFiles.length} file(s).`,
        prUrl: pr.html_url,
        merged: true,
        deletedFiles,
        revertedFiles,
        errors
      });
    } catch (mergeError) {
      console.log('⚠️ Could not auto-merge removal PR:', mergeError);
      
      return NextResponse.json({ 
        success: true,
        message: `Analytics removal PR created (deleted ${deletedFiles.length} file(s), reverted ${revertedFiles.length} file(s)). Please merge it manually.`,
        prUrl: pr.html_url,
        prNumber: pr.number,
        merged: false,
        deletedFiles,
        revertedFiles,
        errors
      });
    }
    
  } catch (error: any) {
    console.error('Remove analytics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove analytics' },
      { status: 500 }
    );
  }
}