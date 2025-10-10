import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export async function GET(
  request: NextRequest,
  { params }: { params: { appKey: string; prNumber: string } }
) {
  const { appKey, prNumber } = params;

  try {
    // TODO: Fetch actual PR from GitHub or storage service
    // For now, return mock data

    const mockPR = {
      id: `pr_${prNumber}`,
      number: parseInt(prNumber),
      title: `Analytics: Update BUTTON_CLICK event`,
      description: `## Summary
Updated event tracking for \`BUTTON_CLICK\` event.

## Changes
- **Added fields**: product_id, category
- **Impact**: ~1250 events/day

## Files Modified
- \`public/tracker.js\`
- \`analytics-schema.json\`
- \`CHANGELOG.md\``,
      status: 'open',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      branch: `analytics/update-button-click-${Date.now()}`,
      githubUrl: `https://github.com/user/repo/pull/${prNumber}`,
      filesChanged: [
        {
          path: 'public/tracker.js',
          additions: 5,
          deletions: 2,
          diff: `- button_text: element.textContent,
+ button_text: element.textContent.trim(),
+ product_id: element.closest('[data-product-id]')?.dataset.productId,
+ category: element.dataset.category,`,
        },
        {
          path: 'analytics-schema.json',
          additions: 12,
          deletions: 0,
          diff: `+ {
+   "name": "BUTTON_CLICK",
+   "fields": {
+     "button_text": "string",
+     "product_id": "string",
+     "category": "string"
+   }
+ }`,
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
          status: 'passed',
          duration: '18s',
        },
        {
          name: 'Build',
          status: 'passed',
          duration: '45s',
        },
      ],
      canMerge: true,
      blockingReason: null,
    };

    return NextResponse.json({
      pr: mockPR,
    });
  } catch (error) {
    console.error('Error fetching PR:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

