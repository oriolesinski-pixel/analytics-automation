import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export async function POST(
  request: NextRequest,
  { params }: { params: { appKey: string } }
) {
  const { appKey } = params;

  try {
    const body = await request.json();
    const { title, description, event, reviewers, options } = body;

    // TODO: Create actual PR via GitHub API or analytics-generator service
    // For now, return mock PR data

    const mockPR = {
      id: `pr_${Date.now()}`,
      number: Math.floor(Math.random() * 1000) + 1,
      title,
      description,
      status: 'open',
      createdAt: new Date().toISOString(),
      branch: `analytics/update-${event.name.toLowerCase()}-${Date.now()}`,
      githubUrl: `https://github.com/user/repo/pull/${Math.floor(Math.random() * 1000) + 1}`,
      filesChanged: [
        {
          path: 'public/tracker.js',
          additions: 5,
          deletions: 2,
          diff: '+ new field tracking\n- old implementation',
        },
        {
          path: 'analytics-schema.json',
          additions: 10,
          deletions: 0,
          diff: '+ event definition',
        },
      ],
      checks: [
        {
          name: 'Lint & Format',
          status: 'passed',
          duration: '12s',
        },
        {
          name: 'Event Validation',
          status: 'running',
          duration: '5s',
        },
      ],
      canMerge: false,
      blockingReason: 'Checks are still running',
    };

    return NextResponse.json({
      success: true,
      pr: mockPR,
    });
  } catch (error) {
    console.error('Error creating PR:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

