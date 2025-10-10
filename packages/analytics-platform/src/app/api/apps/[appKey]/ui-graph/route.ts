import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export async function GET(
  request: NextRequest,
  { params }: { params: { appKey: string } }
) {
  const { appKey } = params;

  try {
    // Try to fetch UI graph from analytics-generator service
    let uiGraphData = null;
    
    try {
      const response = await fetch(`${API_BASE_URL}/apps/${appKey}/schema`, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        uiGraphData = data.uiGraph;
      }
    } catch (fetchError) {
      console.log('Could not fetch from analytics service, using mock data');
    }

    // If no data from service, use mock data for demo
    if (!uiGraphData || !uiGraphData.pages) {
      uiGraphData = {
        pages: {
          'home': {
            route: '/',
            path: 'app/page.tsx',
            components: ['Header', 'Hero', 'Footer'],
            widgets: ['Button', 'Link', 'Image'],
          },
          'products': {
            route: '/products',
            path: 'app/products/page.tsx',
            components: ['ProductGrid', 'Filter', 'SearchBar'],
            widgets: ['ProductCard', 'Button', 'Input'],
          },
          'cart': {
            route: '/cart',
            path: 'app/cart/page.tsx',
            components: ['CartItem', 'Checkout', 'Summary'],
            widgets: ['Button', 'Input', 'PriceDisplay'],
          },
          'checkout': {
            route: '/checkout',
            path: 'app/checkout/page.tsx',
            components: ['PaymentForm', 'ShippingForm', 'OrderSummary'],
            widgets: ['Form', 'Button', 'Input'],
          },
        },
        metadata: {
          totalPages: 4,
          totalComponents: 12,
        }
      };
    }

    // Annotate pages with event counts
    const annotatedUIGraph = {
      ...uiGraphData,
      pages: Object.entries(uiGraphData.pages || {}).reduce(
        (acc, [key, page]: [string, any]) => {
          acc[key] = {
            ...page,
            eventCount: Math.floor(Math.random() * 10) + 1, // Mock event count
          };
          return acc;
        },
        {} as Record<string, any>
      ),
    };

    return NextResponse.json({
      uiGraph: annotatedUIGraph,
    });
  } catch (error) {
    console.error('Error in UI graph route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

