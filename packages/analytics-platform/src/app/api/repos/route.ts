// packages/analytics-platform/src/app/api/repos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function GET(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get('github_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect GitHub first.' },
        { status: 401 }
      );
    }

    const octokit = new Octokit({ auth: token });

    try {
      // Fetch all repositories accessible to the user
      const allRepos = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 5) { // Limit to 5 pages for safety
        const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
          per_page: 100,
          page: page,
          sort: 'updated',
          direction: 'desc'
        });

        allRepos.push(...repos);

        if (repos.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }

      // Format repos for frontend
      const formattedRepos = allRepos.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url
        },
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        updated_at: repo.updated_at,
        default_branch: repo.default_branch || 'main',
        permissions: repo.permissions
      }));

      return NextResponse.json({
        success: true,
        repos: formattedRepos,
        count: formattedRepos.length
      });
    } catch (githubError: any) {
      console.error('GitHub API error:', githubError);

      if (githubError.status === 401) {
        // Clear invalid token
        const response = NextResponse.json(
          { error: 'GitHub token expired or invalid. Please reconnect.' },
          { status: 401 }
        );
        response.cookies.delete('github_token');
        return response;
      }

      throw githubError;
    }
  } catch (error) {
    console.error('Repository fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}