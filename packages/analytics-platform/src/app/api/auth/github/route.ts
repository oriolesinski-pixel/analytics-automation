// packages/analytics-platform/src/app/api/auth/github/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'GitHub token is required' },
        { status: 400 }
      );
    }

    // Verify token with GitHub
    const octokit = new Octokit({ auth: token });

    try {
      // Test the token by getting authenticated user
      const { data: user } = await octokit.rest.users.getAuthenticated();

      // Get user's repositories to verify repo access
      const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
        per_page: 1, // Just test access
        sort: 'updated'
      });

      // Store token in HTTP-only cookie for security
      const response = NextResponse.json({
        success: true,
        user: {
          login: user.login,
          id: user.id,
          avatar_url: user.avatar_url,
          name: user.name,
          email: user.email
        }
      });

      // Set secure cookie with token
      response.cookies.set('github_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      });

      return response;
    } catch (githubError: any) {
      console.error('GitHub API error:', githubError);

      // Check for specific error types
      if (githubError.status === 401) {
        return NextResponse.json(
          { error: 'Invalid GitHub token. Please check your token and try again.' },
          { status: 401 }
        );
      }

      if (githubError.status === 403) {
        return NextResponse.json(
          { error: 'Token lacks required permissions. Ensure it has "repo" scope.' },
          { status: 403 }
        );
      }

      throw githubError;
    }
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate with GitHub' },
      { status: 500 }
    );
  }
}