// packages/analytics-platform/src/app/api/repos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

interface DirectoryItem {
  name: string;
  path: string;
  type: 'dir' | 'file';
  hasPackageJson?: boolean;
  hasFrontendFiles?: boolean;
  framework?: string;
  description?: string;
  scripts?: Record<string, string>;
}

// Check if a directory contains frontend files (page.tsx, layout.tsx, etc.)
async function checkForFrontendFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string
): Promise<boolean> {
  try {
    const { data: contents } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path
    });

    if (!Array.isArray(contents)) return false;

    // Check for common frontend file patterns
    const frontendFiles = ['page.tsx', 'page.jsx', 'layout.tsx', 'layout.jsx', 'app.tsx', 'app.jsx', 'index.tsx', 'index.jsx'];
    return contents.some(item => 
      item.type === 'file' && frontendFiles.includes(item.name.toLowerCase())
    );
  } catch {
    return false;
  }
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

    // Check if we're fetching contents for a specific directory
    const searchParams = request.nextUrl.searchParams;
    const repoOwner = searchParams.get('owner');
    const repoName = searchParams.get('repo');
    const dirPath = searchParams.get('path'); // New: support any path depth

    if (repoOwner && repoName) {
      // Fetch directory contents at any depth
      try {
        const { data: contents } = await octokit.rest.repos.getContent({
          owner: repoOwner,
          repo: repoName,
          path: dirPath || '' // Empty string = root
        });

        if (!Array.isArray(contents)) {
          return NextResponse.json({ items: [] });
        }

        // Get all directories (not files)
        const directories = contents.filter(item => item.type === 'dir');

        // Process each directory
        const itemPromises = directories.map(async (dir) => {
          let hasPackageJson = false;
          let hasFrontendFiles = false;
          let framework = undefined;
          let description = undefined;
          let scripts = undefined;

          try {
            // Check for package.json
            const { data: packageContent } = await octokit.rest.repos.getContent({
              owner: repoOwner,
              repo: repoName,
              path: `${dir.path}/package.json`
            });

            if ('content' in packageContent) {
              hasPackageJson = true;
              
              // Decode package.json content
              const packageJson = JSON.parse(
                Buffer.from(packageContent.content, 'base64').toString()
              );

              // Detect framework
              if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
                framework = 'Next.js';
              } else if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
                framework = 'React';
              } else if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
                framework = 'Vue';
              } else if (packageJson.dependencies?.express) {
                framework = 'Express';
              }

              description = packageJson.description || undefined;
              scripts = packageJson.scripts || undefined;
            }
          } catch {
            // No package.json - that's okay
          }

          // Check for frontend files (even without package.json)
          hasFrontendFiles = await checkForFrontendFiles(octokit, repoOwner, repoName, dir.path);

          return {
            name: dir.name,
            path: dir.path,
            type: 'dir' as const,
            hasPackageJson,
            hasFrontendFiles,
            framework,
            description,
            scripts
          };
        });

        const items = await Promise.all(itemPromises);

        // Return ALL directories (user can explore the tree)
        // But mark which ones have package.json or frontend files
        return NextResponse.json({
          success: true,
          items,
          repoName,
          repoOwner,
          currentPath: dirPath || ''
        });

      } catch (error) {
        console.error('Error fetching directory contents:', error);
        return NextResponse.json(
          { error: 'Failed to fetch directory contents' },
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