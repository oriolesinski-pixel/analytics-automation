import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, token } = body;
    
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
    
    // Get default branch
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;
    
    // Get current commit SHA
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`
    });
    const currentCommitSha = refData.object.sha;
    
    // Get current tree
    const { data: currentCommit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: currentCommitSha
    });
    
    // Files to remove
    const filesToRemove = [
      'public/tracker.js',
      'src/components/AnalyticsProvider.tsx',
      'src/lib/analytics-schema.ts'
    ];
    
    // Create new tree without analytics files
    const { data: baseTree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: currentCommit.tree.sha,
      recursive: 'true'
    });
    
    const newTree = baseTree.tree
      .filter(item => !filesToRemove.includes(item.path || ''))
      .map(item => ({
        path: item.path,
        mode: item.mode,
        type: item.type,
        sha: item.sha
      }));
    
    const { data: createdTree } = await octokit.git.createTree({
      owner,
      repo,
      tree: newTree as any,
      base_tree: currentCommit.tree.sha
    });
    
    // Create commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: 'chore: remove analytics integration',
      tree: createdTree.sha,
      parents: [currentCommitSha]
    });
    
    // Update reference
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
      sha: newCommit.sha
    });
    
    return NextResponse.json({ 
      success: true,
      message: 'Analytics removed successfully',
      commit: newCommit.sha
    });
    
  } catch (error: any) {
    console.error('Remove analytics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove analytics' },
      { status: 500 }
    );
  }
}

