'use client';

import { useState } from 'react';
import { 
  Home, 
  ShoppingCart, 
  Package, 
  CreditCard,
  ChevronRight,
  Activity
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Page {
  route: string;
  path: string;
  components: string[];
  widgets?: string[];
  eventCount?: number;
}

interface UIGraphProps {
  pages: Record<string, Page>;
  onNodeClick: (pageId: string) => void;
}

const getIconForRoute = (route: string) => {
  if (route === '/' || route.includes('home')) return Home;
  if (route.includes('cart')) return ShoppingCart;
  if (route.includes('product')) return Package;
  if (route.includes('checkout') || route.includes('payment')) return CreditCard;
  return Activity;
};

export function UIGraph({ pages, onNodeClick }: UIGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Application Pages ({Object.keys(pages).length})
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Click any page to view and edit tracked events
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(pages).map(([pageId, page]) => {
          const Icon = getIconForRoute(page.route);
          const isHovered = hoveredNode === pageId;

          return (
            <button
              key={pageId}
              onClick={() => onNodeClick(pageId)}
              onMouseEnter={() => setHoveredNode(pageId)}
              onMouseLeave={() => setHoveredNode(null)}
              className={`
                relative p-6 rounded-lg border-2 transition-all text-left
                ${isHovered 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg transform scale-105' 
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'
                }
              `}
            >
              {/* Event Count Badge */}
              {page.eventCount && page.eventCount > 0 && (
                <div className="absolute -top-2 -right-2">
                  <Badge className="bg-blue-600 text-white px-2 py-1">
                    {page.eventCount} {page.eventCount === 1 ? 'event' : 'events'}
                  </Badge>
                </div>
              )}

              {/* Icon and Route */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    isHovered 
                      ? 'bg-blue-600' 
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      isHovered 
                        ? 'text-white' 
                        : 'text-gray-600 dark:text-gray-300'
                    }`} />
                  </div>
                  <div>
                    <div className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                      {page.route}
                    </div>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 transition-transform ${
                  isHovered ? 'transform translate-x-1 text-blue-600' : 'text-gray-400'
                }`} />
              </div>

              {/* File Path */}
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-mono">
                {page.path}
              </div>

              {/* Components */}
              <div className="flex flex-wrap gap-1">
                {(page.components || page.widgets || []).slice(0, 3).map((comp, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    {comp}
                  </span>
                ))}
                {(page.components?.length || 0) + (page.widgets?.length || 0) > 3 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    +{(page.components?.length || 0) + (page.widgets?.length || 0) - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {Object.keys(pages).length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No pages found in the UI graph</p>
          <p className="text-sm mt-2">Run schema analysis to populate pages</p>
        </div>
      )}
    </div>
  );
}

