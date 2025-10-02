// packages/analytics-platform/src/app/api/onboarding/merge/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { repoOwner, repoName, prNumber } = body;

        // Get the GitHub token from the request header
        const githubToken = request.headers.get('X-GitHub-Token');

        if (!githubToken) {
            return NextResponse.json(
                { error: 'GitHub token required' },
                { status: 401 }
            );
        }

        if (!repoOwner || !repoName || !prNumber) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // First, check the PR status
        const prCheckResponse = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/pulls/${prNumber}`,
            {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!prCheckResponse.ok) {
            const error = await prCheckResponse.json();
            console.error('Failed to get PR:', error);
            return NextResponse.json(
                { error: 'Could not fetch pull request details' },
                { status: prCheckResponse.status }
            );
        }

        const prData = await prCheckResponse.json();

        // Check if PR is already merged
        if (prData.merged) {
            return NextResponse.json({
                success: true,
                message: 'Pull request is already merged',
                mergedAt: prData.merged_at
            });
        }

        // Check if PR is closed (but not merged)
        if (prData.state === 'closed') {
            return NextResponse.json(
                { error: 'Pull request is closed and cannot be merged' },
                { status: 400 }
            );
        }

        // Check if PR is mergeable
        if (prData.mergeable === false) {
            return NextResponse.json(
                { error: 'Pull request has conflicts and cannot be automatically merged' },
                { status: 409 }
            );
        }

        // Wait a moment if mergeable state is unknown
        if (prData.mergeable === null) {
            // GitHub needs time to calculate mergeability
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Re-check PR status
            const recheckResponse = await fetch(
                `https://api.github.com/repos/${repoOwner}/${repoName}/pulls/${prNumber}`,
                {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (recheckResponse.ok) {
                const recheckData = await recheckResponse.json();
                if (recheckData.mergeable === false) {
                    return NextResponse.json(
                        { error: 'Pull request has conflicts and cannot be automatically merged' },
                        { status: 409 }
                    );
                }
            }
        }

        // Attempt to merge the PR
        const mergeResponse = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/pulls/${prNumber}/merge`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    commit_title: `Merge pull request #${prNumber}: Add Analytics Integration`,
                    commit_message: 'Automatically merged via Analytics Platform',
                    merge_method: 'merge' // Can be 'merge', 'squash', or 'rebase'
                })
            }
        );

        if (!mergeResponse.ok) {
            const error = await mergeResponse.json();
            console.error('Merge failed:', error);

            // Provide specific error messages based on the response
            if (mergeResponse.status === 405) {
                return NextResponse.json(
                    { error: 'Pull request cannot be merged. It may require reviews or status checks to pass.' },
                    { status: 405 }
                );
            }

            if (mergeResponse.status === 409) {
                return NextResponse.json(
                    { error: 'Pull request has conflicts that must be resolved before merging' },
                    { status: 409 }
                );
            }

            if (mergeResponse.status === 403) {
                return NextResponse.json(
                    { error: 'You do not have permission to merge this pull request. Admin or write access required.' },
                    { status: 403 }
                );
            }

            return NextResponse.json(
                { error: error.message || 'Failed to merge pull request' },
                { status: mergeResponse.status }
            );
        }

        const mergeData = await mergeResponse.json();

        // Return success with merge details
        return NextResponse.json({
            success: true,
            message: 'Pull request merged successfully',
            sha: mergeData.sha,
            mergedBy: mergeData.merged_by?.login,
            mergedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in merge endpoint:', error);
        return NextResponse.json(
            { error: 'Internal server error while merging PR' },
            { status: 500 }
        );
    }
}

