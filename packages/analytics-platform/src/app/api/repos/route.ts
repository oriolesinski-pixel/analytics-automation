// packages/analytics-platform/src/app/api/repos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

interface SubDirectory {
  name: string;
  path: string;
  type: 'dir' | 'file';
  hasPackageJson?: boolean;
  framework?: string;
}

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

    // Check if we're fetching subdirectories for a specific repo
    const searchParams = request.nextUrl.searchParams;
    const repoOwner = searchParams.get('owner');
    const repoName = searchParams.get('repo');

    if (repoOwner && repoName) {
      // Fetch subdirectories for specific repo
      try {
        const { data: contents } = await octokit.rest.repos.getContent({
          owner: repoOwner,
          repo: repoName,
          path: ''
        });

        if (!Array.isArray(contents)) {
          return NextResponse.json({ subdirs: [] });
        }

        // Get all directories
        const directories = contents.filter(item => item.type === 'dir');

        // Check each directory for package.json to identify sub-apps
        const subdirPromises = directories.map(async (dir) => {
          try {
            // Try to get package.json from this directory
            const { data: packageContent } = await octokit.rest.repos.getContent({
              owner: repoOwner,
              repo: repoName,
              path: `${dir.path}/package.json`
            });

            if ('content' in packageContent) {
              // Decode package.json content
              const packageJson = JSON.parse(
                Buffer.from(packageContent.content, 'base64').toString()
              );

              // Detect framework
              let framework = 'unknown';
              if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
                framework = 'Next.js';
              } else if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
                framework = 'React';
              } else if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
                framework = 'Vue';
              } else if (packageJson.dependencies?.express) {
                framework = 'Express';
              }

              return {
                name: dir.name,
                path: dir.path,
                type: 'dir' as const,
                hasPackageJson: true,
                framework,
                description: packageJson.description || null,
                scripts: packageJson.scripts || {}
              };
            }
          } catch {
            // No package.json or error reading it
          }

          return {
            name: dir.name,
            path: dir.path,
            type: 'dir' as const,
            hasPackageJson: false
          };
        });

        const subdirs = await Promise.all(subdirPromises);

        // Filter to only show directories with package.json (actual apps)
        const appDirs = subdirs.filter(dir => dir.hasPackageJson);

        return NextResponse.json({
          success: true,
          subdirs: appDirs,
          repoName,
          repoOwner
        });

      } catch (error) {
        console.error('Error fetching subdirectories:', error);
        return NextResponse.json(
          { error: 'Failed to fetch subdirectories' },
          { status: 500 }
        );
      }
    }

    // Otherwise, fetch all repositories
    try {
      const allRepos = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 5) {
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
        permissions: repo.permissions,
        // Add flag for monorepo detection
        isMonorepo: repo.name.includes('demo-test-apps') ||
          repo.name.includes('monorepo') ||
          repo.description?.toLowerCase().includes('monorepo')
      }));

      return NextResponse.json({
        success: true,
        repos: formattedRepos,
        count: formattedRepos.length
      });
    } catch (githubError: any) {
      console.error('GitHub API error:', githubError);

      if (githubError.status === 401) {
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