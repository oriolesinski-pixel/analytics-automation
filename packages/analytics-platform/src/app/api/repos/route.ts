import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GitHubClient } from '@/lib/github/client';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('github_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const client = new GitHubClient(token);
    const repos = await client.listRepositories();
    
    return NextResponse.json({ repos });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}
