// analytics-automation/packages/analytics-platform/src/app/api/analyze/progress/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple proxy to the generator's progress endpoint
 * Frontend polls this, we forward to generator service
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get('repo_id');

    if (!repoId) {
        return new NextResponse(JSON.stringify({ error: 'Missing repo_id' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    }

    try {
        // Forward to generator service
        const response = await fetch(
            `http://localhost:8081/analytics/progress?repo_id=${repoId}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                cache: 'no-store'
            }
        );

        if (!response.ok) {
            return new NextResponse(JSON.stringify({ 
                message: 'No progress available', 
                timestamp: Date.now(),
                step: 0,
                total_steps: 10
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
        }

        const data = await response.json();
        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (error) {
        console.error('Progress fetch error:', error);
        return new NextResponse(JSON.stringify({ 
            message: 'No progress available', 
            timestamp: Date.now(),
            step: 0,
            total_steps: 10
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    }
}