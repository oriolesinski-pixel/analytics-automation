import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export async function GET(
  request: NextRequest,
  { params }: { params: { appKey: string; deploymentId: string } }
) {
  const { appKey, deploymentId } = params;

  try {
    // TODO: Fetch actual deployment status
    // For now, return mock data that simulates progress

    // Simulate deployment completion
    const mockDeployment = {
      id: deploymentId,
      status: 'success',
      steps: [
        {
          name: 'Merge Pull Request',
          status: 'completed',
          duration: 2,
        },
        {
          name: 'Build Tracker',
          status: 'completed',
          duration: 45,
        },
        {
          name: 'Deploy to CDN',
          status: 'completed',
          duration: 32,
        },
        {
          name: 'Verify First Event',
          status: 'completed',
          duration: 8,
        },
      ],
      oldVersion: '1.0.0',
      newVersion: '1.1.0',
      oldEventCount: 1247,
      newEventCount: 3,
      firstEventTime: new Date().toLocaleTimeString(),
    };

    return NextResponse.json({
      deployment: mockDeployment,
    });
  } catch (error) {
    console.error('Error fetching deployment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

