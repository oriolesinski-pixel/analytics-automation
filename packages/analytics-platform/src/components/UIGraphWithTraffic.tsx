'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Flame, TrendingUp, Activity, GitBranch, Layers, Home, ShoppingCart, User, Package, CreditCard, Heart, Globe, ChevronDown, ChevronRight, Info, Store, LogIn, UserPlus, FileText, ArrowRight, MousePointer, FileSearch, Eye, ScrollText, Filter, CheckCircle2 } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface UIGraphWithTrafficProps {
  uiGraph: any;
  appKey: string;
}

export function UIGraphWithTraffic({ uiGraph, appKey }: UIGraphWithTrafficProps) {
  const [eventData, setEventData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [showTrafficOverlay, setShowTrafficOverlay] = useState(true); // Heat map ON by default
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState('graph');
  const [showFooterPages, setShowFooterPages] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  // Fix hydration by only rendering after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Debug: Log the uiGraph structure
  useEffect(() => {
    console.log('🔍 UIGraphWithTraffic received:');
    console.log('   - uiGraph:', uiGraph);
    console.log('   - Page count:', Object.keys(uiGraph?.pages || {}).length);
    console.log('   - appKey:', appKey);
    
    // Log all page routes for traffic matching
    if (uiGraph?.pages) {
      console.log('\n📍 Page Routes in uiGraph:');
      Object.entries(uiGraph.pages).forEach(([key, page]: [string, any]) => {
        console.log(`   - ${key}: route="${page.route}"`);
      });
    }
  }, [uiGraph, appKey]);

  useEffect(() => {
    if (!appKey) return;
    fetchEventData();
  }, [appKey, timeRange]);

  const fetchEventData = async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const rangeMap: Record<string, number> = {
        '1h': 1,
        '24h': 24,
        '7d': 24 * 7,
        '30d': 24 * 30
      };
      const hours = rangeMap[timeRange] || 24;
      const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

      // Use SQL query to get page views aggregated by path
      const sqlQuery = `
        SELECT 
          data->>'path' as path,
          COUNT(*) as count
        FROM analytics_product_events
        WHERE app_key = '${appKey}'
          AND event_type = 'PAGE_VIEW'
          AND ts >= ${startTime.getTime()}
          AND ts <= ${now.getTime()}
        GROUP BY data->>'path'
        ORDER BY count DESC
      `;

      const response = await fetch(`${API_BASE_URL}/query/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: sqlQuery,
          app_key: appKey,
          timeout: 10000
        })
      });

      const result = await response.json();
      console.log('🔥 Traffic data result:', result);
      
      if (result.ok && result.data) {
        console.log('   - Found', result.data.length, 'paths with traffic');
        
        // Transform SQL result to expected format
        const transformedData = result.data.map((row: any) => ({
          path: row.path,
          value: parseInt(row.count) || 0
        }));
        
        transformedData.forEach((item: any) => {
          console.log(`     - Path: "${item.path}" → ${item.value} views`);
        });
        
        setEventData(transformedData);
      } else if (result.error) {
        console.warn('⚠️ Query failed:', result.error);
        if (result.errors) {
          console.warn('   Errors:', result.errors);
        }
        setEventData([]);
      } else {
        console.warn('⚠️ No traffic data available');
        setEventData([]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch event data:', error);
      setEventData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate traffic intensity for each page
  const pageTraffic = useMemo(() => {
    const traffic: Record<string, number> = {};
    
    console.log('\n🗺️ Building traffic map from', eventData.length, 'data points');
    
    eventData.forEach((item: any) => {
      // Try multiple possible field names based on dimension label
      const path = item.Path || item['data->path'] || item.path || '';
      const count = item.value || 0;
      
      if (path) {
        // Normalize the path to match routes in uiGraph
        const normalizedPath = path.startsWith('/') ? path : '/' + path;
        traffic[normalizedPath] = (traffic[normalizedPath] || 0) + count;
        
        console.log(`   📍 "${path}" → normalized: "${normalizedPath}" → ${count} views`);
      }
    });

    console.log('\n🔥 Final pageTraffic map:');
    Object.entries(traffic).forEach(([route, count]) => {
      console.log(`   - ${route}: ${count} views`);
    });
    
    // Now match against uiGraph routes
    if (uiGraph?.pages) {
      console.log('\n🎯 Matching traffic to uiGraph pages:');
      Object.entries(uiGraph.pages).forEach(([key, page]: [string, any]) => {
        const matchedTraffic = traffic[page.route] || 0;
        console.log(`   - ${key} (${page.route}): ${matchedTraffic > 0 ? '✅ ' + matchedTraffic : '⭕ 0'} views`);
      });
    }
    
    return traffic;
  }, [eventData, uiGraph]);

  const maxTraffic = Math.max(...Object.values(pageTraffic), 1);
  const totalTraffic = Object.values(pageTraffic).reduce((a, b) => a + b, 0);

  // Get pages with traffic sorted
  const topPages = useMemo(() => {
    return Object.entries(pageTraffic)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [pageTraffic]);

  const pages = useMemo(() => {
    if (!uiGraph?.pages) return [];
    return Object.entries(uiGraph.pages).map(([key, page]: [string, any]) => ({
      id: key,
      ...page
    }));
  }, [uiGraph]);

  // Identify footer/global pages
  const footerPages = useMemo(() => {
    const footerKeywords = ['about', 'shipping', 'returns', 'privacy', 'terms', 'contact', 'help', 'faq'];
    const footer = pages.filter(p =>
      footerKeywords.some(keyword => p.id.toLowerCase().includes(keyword))
    );
    
    console.log('📋 Footer pages identified:', footer.map(p => p.id));
    return footer;
  }, [pages]);

  // Main flow pages (excluding footer pages unless explicitly shown)
  const filteredPages = useMemo(() => {
    const result = showFooterPages ? pages : pages.filter(p => !footerPages.includes(p));
    
    console.log(`🔍 Filtered pages (showFooter: ${showFooterPages}):`, result.length, 'of', pages.length);
    console.log('   Showing:', result.map(p => p.id).join(', '));
    
    return result;
  }, [pages, footerPages, showFooterPages]);

  const getPageIcon = useCallback((pageType: string, pageId: string) => {
    if (pageId === 'home' || pageType === 'home' || pageId === '/' || pageId.includes('index')) return Home;
    if (pageId.includes('product')) return Package;
    if (pageId.includes('cart')) return ShoppingCart;
    if (pageId.includes('checkout') || pageId.includes('check')) return CreditCard;
    if (pageId.includes('auth_login') || pageId.includes('login')) return LogIn;
    if (pageId.includes('auth_register') || pageId.includes('register')) return UserPlus;
    if (pageId.includes('wishlist')) return Heart;
    if (pageId.includes('about')) return Info;
    if (pageId.includes('shipping') || pageId.includes('returns')) return FileText;
    if (pageId.includes('success') || pageId.includes('thank')) return CheckCircle2;

    const icons: Record<string, any> = {
      'home': Home,
      'product_detail': Package,
      'cart': ShoppingCart,
      'checkout': CreditCard,
      'auth': User,
      'wishlist': Heart,
      'info': Info,
      'general': Globe
    };
    return icons[pageType] || Globe;
  }, []);

  const getEventIcon = useCallback((eventType: string) => {
    switch (eventType) {
      case 'PAGE_VIEW': return Eye;
      case 'BUTTON_CLICK': return MousePointer;
      case 'FORM_INTERACTION': return FileSearch;
      case 'SCROLL_INTERACTION': return ScrollText;
      case 'ELEMENT_VISIBILITY': return Activity;
      default: return Activity;
    }
  }, []);

  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // Calculate traffic intensity for node styling
  const getTrafficIntensity = useCallback((route: string) => {
    const traffic = pageTraffic[route] || 0;
    if (traffic === 0) return 0;
    return traffic / maxTraffic;
  }, [pageTraffic, maxTraffic]);

  // Smart hierarchical layout algorithm
  const calculateNodePositions = useCallback((pages: any[]) => {
    const nodeWidth = 200;
    const levelHeight = 140;
    const startY = 80;

    const homeNode = pages.find(p =>
      p.id === 'home' ||
      p.route === '/' ||
      p.page_type === 'home'
    );

    const authNodes = pages.filter(p =>
      p.id.includes('auth') ||
      p.id.includes('login') ||
      p.id.includes('register')
    );

    const productNodes = pages.filter(p =>
      p.id.includes('product') &&
      !p.id.includes('checkout')
    );

    const cartNode = pages.find(p => p.id === 'cart' || p.id.includes('cart'));

    const checkoutNodes = pages.filter(p =>
      (p.id.includes('checkout') || p.id.includes('check')) &&
      !p.id.includes('success')
    );

    const successNodes = pages.filter(p =>
      p.id.includes('success') ||
      p.id.includes('thank') ||
      p.id.includes('confirm')
    );

    const wishlistNode = pages.find(p => p.id.includes('wishlist'));

    const otherNodes = pages.filter(p =>
      p !== homeNode &&
      !authNodes.includes(p) &&
      !productNodes.includes(p) &&
      p !== cartNode &&
      !checkoutNodes.includes(p) &&
      !successNodes.includes(p) &&
      p !== wishlistNode
    );

    const positions: Record<string, { x: number, y: number }> = {};
    let currentLevel = 0;

    if (homeNode) {
      positions[homeNode.id] = { x: 600, y: startY + (currentLevel * levelHeight) };
      currentLevel++;
    }

    const level1Y = startY + (currentLevel * levelHeight);

    authNodes.forEach((node, idx) => {
      positions[node.id] = {
        x: 200 + (idx * 150),
        y: level1Y
      };
    });

    const productStartX = 500;
    productNodes.forEach((node, idx) => {
      positions[node.id] = {
        x: productStartX + (idx * nodeWidth),
        y: level1Y
      };
    });

    if (wishlistNode) {
      positions[wishlistNode.id] = {
        x: 1000,
        y: level1Y
      };
    }
    currentLevel++;

    if (cartNode) {
      positions[cartNode.id] = { x: 600, y: startY + (currentLevel * levelHeight) };
      currentLevel++;
    }

    if (checkoutNodes.length > 0) {
      const checkoutY = startY + (currentLevel * levelHeight);
      const checkoutStartX = 600 - ((checkoutNodes.length - 1) * nodeWidth / 2);

      checkoutNodes.forEach((node, idx) => {
        positions[node.id] = {
          x: checkoutStartX + (idx * nodeWidth),
          y: checkoutY
        };
      });
      currentLevel++;
    }

    if (successNodes.length > 0) {
      const successY = startY + (currentLevel * levelHeight);
      const successStartX = 600 - ((successNodes.length - 1) * nodeWidth / 2);

      successNodes.forEach((node, idx) => {
        positions[node.id] = {
          x: successStartX + (idx * nodeWidth),
          y: successY
        };
      });
      currentLevel++;
    }

    if (otherNodes.length > 0) {
      const otherY = startY + (currentLevel * levelHeight);
      const otherStartX = 600 - ((otherNodes.length - 1) * nodeWidth / 2);

      otherNodes.forEach((node, idx) => {
        positions[node.id] = {
          x: otherStartX + (idx * nodeWidth),
          y: otherY
        };
      });
    }

    const allX = Object.values(positions).map(p => p.x);
    const allY = Object.values(positions).map(p => p.y);
    const minX = Math.min(...allX) - 100;
    const maxX = Math.max(...allX) + 100;
    const minY = Math.min(...allY) - 50;
    const maxY = Math.max(...allY) + 100;

    return {
      positions,
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
      width: maxX - minX,
      height: maxY - minY
    };
  }, []);

  const renderGraphView = () => {
    if (!isMounted) {
      return <div className="h-[700px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg" />;
    }

    const { positions: nodePositions, viewBox, width, height } = calculateNodePositions(filteredPages);

    return (
      <div className="relative">
        {/* Legend Trigger Icon - Hover to show legend */}
        {isMounted && showTrafficOverlay && !selectedNode && (
          <div 
            className="absolute top-4 right-4 z-10"
            onMouseEnter={() => setShowLegend(true)}
            onMouseLeave={() => setShowLegend(false)}
          >
            <div className="p-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-orange-200 cursor-help hover:bg-orange-50 transition-colors">
              <Flame className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        )}

        {/* SVG Container */}
        <div className="h-[700px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden">
          <svg
            width="100%"
            height="100%"
            viewBox={viewBox}
            preserveAspectRatio="xMidYMin meet"
            className="w-full h-full"
          >
            {/* Define arrow markers */}
            <defs>
              <marker
                id="arrow-default-traffic"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
              </marker>
              <marker
                id="arrow-highlighted-traffic"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
              </marker>
              <marker
                id="arrow-selected-traffic"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#4f46e5" />
              </marker>
            </defs>

            {/* Draw connections/edges */}
            {filteredPages.map(page => {
              const pos1 = nodePositions[page.id];
              if (!pos1) return null;

              return page.can_navigate_to?.filter((targetId: string) =>
                filteredPages.some(p => p.id === targetId)
              ).map((targetId: string) => {
                const pos2 = nodePositions[targetId];
                if (!pos2) return null;

                const isOutgoingHighlighted = hoveredNode === page.id || selectedNode?.id === page.id;
                const isSelected = selectedNode?.id === page.id;

                const dx = pos2.x - pos1.x;
                const dy = pos2.y - pos1.y;
                const dr = Math.sqrt(dx * dx + dy * dy);
                const curvature = dr * 0.15;

                const midX = (pos1.x + pos2.x) / 2;
                const midY = (pos1.y + pos2.y) / 2;

                const offsetX = -dy / dr * curvature;
                const offsetY = dx / dr * curvature;

                return (
                  <g key={`${page.id}-${targetId}`}>
                    <path
                      d={`M ${pos1.x} ${pos1.y} Q ${midX + offsetX} ${midY + offsetY} ${pos2.x} ${pos2.y}`}
                      stroke={isOutgoingHighlighted ? (isSelected ? "#4f46e5" : "#6366f1") : "#cbd5e1"}
                      strokeWidth={isOutgoingHighlighted ? "2.5" : "1.5"}
                      fill="none"
                      markerEnd={`url(#arrow-${isOutgoingHighlighted ? (isSelected ? 'selected-traffic' : 'highlighted-traffic') : 'default-traffic'})`}
                      style={{ transition: 'all 0.3s ease' }}
                      opacity={isOutgoingHighlighted ? 1 : 0.3}
                    />

                    {isOutgoingHighlighted && (
                      <circle
                        cx={midX + offsetX}
                        cy={midY + offsetY}
                        r="2"
                        fill={isSelected ? "#4f46e5" : "#6366f1"}
                        opacity="0.6"
                      />
                    )}
                  </g>
                );
              });
            })}

            {/* Draw nodes */}
            {filteredPages.map((page: any) => {
              const pos = nodePositions[page.id];
              if (!pos) return null;

              const PageIcon = getPageIcon(page.page_type, page.id);
              const isSelected = selectedNode?.id === page.id;
              const isHovered = hoveredNode === page.id;
              const isHome = page.id === 'home' || page.route === '/' || page.page_type === 'home';
              const isSuccess = page.id.includes('success') || page.id.includes('thank');
              const trafficIntensity = getTrafficIntensity(page.route);

              const hasOutgoingConnections = page.can_navigate_to?.some((targetId: string) =>
                filteredPages.some(p => p.id === targetId)
              );

              // Single-color progression heat map (orange/red)
              const getHeatColor = () => {
                if (isSelected) return "#6366f1";
                if (isHovered) return "#e0e7ff";
                
                if (!showTrafficOverlay || trafficIntensity === 0) {
                  if (isHome) return "#fef3c7";
                  if (isSuccess) return "#dcfce7";
                  return "#ffffff";
                }
                
                // Orange → Red progression based on intensity
                const intensity = Math.min(trafficIntensity, 1);
                
                // RGB interpolation from light orange to dark red
                // Light: #fed7aa (254, 215, 170) → Dark: #dc2626 (220, 38, 38)
                const r = Math.round(254 - (34 * intensity));
                const g = Math.round(215 - (177 * intensity));
                const b = Math.round(170 - (132 * intensity));
                
                return `rgb(${r}, ${g}, ${b})`;
              };

              const getHeatStroke = () => {
                if (isSelected) return "#4f46e5";
                if (isHovered) return "#6366f1";
                
                if (!showTrafficOverlay || trafficIntensity === 0) {
                  if (isHome) return "#f59e0b";
                  if (isSuccess) return "#16a34a";
                  return "#e5e7eb";
                }
                
                // Darker stroke based on intensity
                const intensity = Math.min(trafficIntensity, 1);
                
                // RGB interpolation from medium orange to very dark red
                // Medium: #fb923c → Dark: #991b1b
                const r = Math.round(251 - (98 * intensity));
                const g = Math.round(146 - (119 * intensity));
                const b = Math.round(60 - (33 * intensity));
                
                return `rgb(${r}, ${g}, ${b})`;
              };

              return (
                <g key={page.id}>
                  {(isSelected || isHome || isSuccess || (showTrafficOverlay && trafficIntensity > 0.3)) && (
                    <ellipse
                      cx={pos.x}
                      cy={pos.y + 3}
                      rx={isHome || isSuccess ? "52" : "42"}
                      ry="10"
                      fill="black"
                      opacity="0.08"
                    />
                  )}

                  {(isHovered || isSelected) && hasOutgoingConnections && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isHome || isSuccess ? "55" : "47"}
                      fill="none"
                      stroke={isSelected ? "#4f46e5" : "#6366f1"}
                      strokeWidth="1"
                      opacity="0.3"
                      style={{ animation: 'pulse 2s infinite' }}
                    />
                  )}

                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isHome || isSuccess ? "48" : "40"}
                    fill={getHeatColor()}
                    stroke={getHeatStroke()}
                    strokeWidth={
                      isSelected ? "3" :
                      isHovered ? "2.5" :
                      isHome || isSuccess ? "2.5" :
                      (showTrafficOverlay && trafficIntensity > 0.5) ? "3" :
                      (showTrafficOverlay && trafficIntensity > 0.3) ? "2.5" :
                      (showTrafficOverlay && trafficIntensity > 0) ? "2" :
                      "1.5"
                    }
                    className="cursor-pointer transition-all duration-300"
                    onMouseEnter={() => setHoveredNode(page.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => setSelectedNode(page)}
                    style={{
                      filter: (showTrafficOverlay && trafficIntensity > 0.5) ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))' : 'none'
                    }}
                  />

                  <foreignObject
                    x={pos.x - 16}
                    y={pos.y - 16}
                    width="32"
                    height="32"
                    style={{ pointerEvents: 'none' }}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <PageIcon className={`w-7 h-7 ${
                        isSelected ? 'text-white' :
                        isHovered ? 'text-indigo-600' :
                        isHome && !showTrafficOverlay ? 'text-amber-600' :
                        isSuccess && !showTrafficOverlay ? 'text-green-600' :
                        (showTrafficOverlay && trafficIntensity > 0.7) ? 'text-white drop-shadow' :
                        (showTrafficOverlay && trafficIntensity > 0.3) ? 'text-red-900' :
                        (showTrafficOverlay && trafficIntensity > 0) ? 'text-orange-900' :
                        'text-gray-600'
                      }`} />
                    </div>
                  </foreignObject>

                  {/* Traffic badge */}
                  {showTrafficOverlay && pageTraffic[page.route] > 0 && (
                    <g>
                      <circle
                        cx={pos.x + 38}
                        cy={pos.y - 38}
                        r="14"
                        fill={(() => {
                          // Badge color matches node heat intensity
                          const intensity = Math.min(trafficIntensity, 1);
                          const r = Math.round(254 - (34 * intensity));
                          const g = Math.round(215 - (177 * intensity));
                          const b = Math.round(170 - (132 * intensity));
                          return `rgb(${r}, ${g}, ${b})`;
                        })()}
                        stroke="white"
                        strokeWidth="2.5"
                      />
                      <text
                        x={pos.x + 38}
                        y={pos.y - 34}
                        textAnchor="middle"
                        className="text-xs font-bold"
                        fill={trafficIntensity > 0.4 ? 'white' : '#78350f'}
                        style={{ pointerEvents: 'none', fontSize: '11px' }}
                      >
                        {pageTraffic[page.route] > 999 ? '999+' : pageTraffic[page.route]}
                      </text>
                    </g>
                  )}
                  
                  {/* Show zero badge for pages with no traffic when heat map is on */}
                  {showTrafficOverlay && !isLoading && totalTraffic > 0 && pageTraffic[page.route] === 0 && (
                    <g>
                      <circle
                        cx={pos.x + 38}
                        cy={pos.y - 38}
                        r="12"
                        fill="#9ca3af"
                        stroke="white"
                        strokeWidth="2"
                        opacity="0.5"
                      />
                      <text
                        x={pos.x + 38}
                        y={pos.y - 34}
                        textAnchor="middle"
                        className="text-xs font-bold fill-white"
                        style={{ pointerEvents: 'none', fontSize: '10px' }}
                      >
                        0
                      </text>
                    </g>
                  )}

                  <text
                    x={pos.x}
                    y={pos.y + 65}
                    textAnchor="middle"
                    className={`text-sm font-medium fill-gray-700 select-none ${isHome || isSuccess ? 'font-bold' : ''}`}
                    style={{ pointerEvents: 'none' }}
                  >
                    {page.name || page.id.replace(/_/g, ' ')}
                  </text>

                  <text
                    x={pos.x}
                    y={pos.y + 80}
                    textAnchor="middle"
                    className="text-xs fill-gray-500 font-mono select-none"
                    style={{ pointerEvents: 'none' }}
                  >
                    {page.route}
                  </text>
                </g>
              );
            })}

            <style>
              {`
                @keyframes pulse {
                  0% { opacity: 0.3; }
                  50% { opacity: 0.5; }
                  100% { opacity: 0.3; }
                }
              `}
            </style>
          </svg>
        </div>

        {/* Heat Map Legend - Show on Hover */}
        {isMounted && showTrafficOverlay && !selectedNode && showLegend && (
          <div 
            className="absolute top-4 right-4 w-64 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-orange-200 p-4 z-20"
            onMouseEnter={() => setShowLegend(true)}
            onMouseLeave={() => setShowLegend(false)}
          >
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-orange-600" />
              <h4 className="text-sm font-bold text-gray-900">Traffic Heat Map</h4>
            </div>
            
            {isLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Activity className="w-4 h-4 animate-pulse text-blue-600" />
                <span className="text-xs text-gray-600">Loading traffic data...</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="text-xs text-gray-600 mb-3 font-medium">Traffic Intensity Scale</div>
                  
                  {/* Gradient bar showing progression */}
                  <div className="relative h-8 rounded-lg overflow-hidden mb-3" style={{
                    background: 'linear-gradient(to right, #fed7aa, #fb923c, #f97316, #ea580c, #dc2626, #991b1b)'
                  }}>
                    <div className="absolute inset-0 flex items-center justify-between px-2">
                      <span className="text-xs font-bold text-gray-700">Low</span>
                      <span className="text-xs font-bold text-white drop-shadow">High</span>
                    </div>
                  </div>
                  
                  {/* Percentage markers */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#dc2626] border-2 border-[#991b1b]"></div>
                        <span className="text-xs text-gray-700">100%</span>
                      </div>
                      <span className="text-xs text-gray-500">Most traffic</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#f97316] border-2 border-[#ea580c]"></div>
                        <span className="text-xs text-gray-700">50%</span>
                      </div>
                      <span className="text-xs text-gray-500">Medium traffic</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#fed7aa] border-2 border-[#fb923c]"></div>
                        <span className="text-xs text-gray-700">0%</span>
                      </div>
                      <span className="text-xs text-gray-500">Least traffic</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200">
                  {totalTraffic > 0 ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Total views:</span>
                      <span className="font-bold text-gray-900">{totalTraffic.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      <p className="mb-1">⭕ No traffic data yet</p>
                      <p className="text-gray-400">Colors will activate when events are tracked</p>
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="text-xs text-gray-400">
                Click any node for details
              </div>
            </div>
          </div>
        )}

        {/* Selected node details panel */}
        {isMounted && selectedNode && (
          <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-20">
            <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {(() => {
                    const Icon = getPageIcon(selectedNode.page_type, selectedNode.id);
                    return <Icon className="w-5 h-5" />;
                  })()}
                  <h3 className="font-semibold text-lg">{selectedNode.name || selectedNode.id}</h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-white/80 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm opacity-90 mt-1 font-mono">{selectedNode.route}</p>
              {showTrafficOverlay && pageTraffic[selectedNode.route] > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <Flame className="w-4 h-4" />
                  <span className="font-bold">{pageTraffic[selectedNode.route].toLocaleString()}</span>
                  <span className="text-sm opacity-90">page views</span>
                </div>
              )}
            </div>

            <div className="p-4 space-y-4">
              {selectedNode.events && selectedNode.events.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    Tracked Events ({selectedNode.events.length})
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedNode.events.map((event: string, idx: number) => {
                      const EventIcon = getEventIcon(event);
                      return (
                        <div key={idx} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                          <EventIcon className="w-4 h-4 text-indigo-600" />
                          <span className="text-sm font-mono text-gray-700">{event}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedNode.widgets && selectedNode.widgets.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    Components ({selectedNode.widgets.length})
                  </h4>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {selectedNode.widgets.map((widget: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                        {widget}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.can_navigate_to && selectedNode.can_navigate_to.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    Navigates To
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedNode.can_navigate_to.map((target: string, idx: number) => (
                      <div key={idx} className="flex items-center space-x-2 text-sm text-gray-600">
                        <ArrowRight className="w-3 h-3" />
                        <span>{target}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTreeView = () => {
    if (!isMounted) {
      return <div className="h-[700px] bg-gray-50 rounded-lg" />;
    }

    const displayPages = showFooterPages ? pages : filteredPages;

    return (
      <div className="bg-gray-50 rounded-lg p-4 h-[700px] overflow-y-auto">
        <div className="space-y-2">
          {displayPages.map(page => {
            const PageIcon = getPageIcon(page.page_type, page.id);
            const isSelected = selectedNode?.id === page.id;
            const isExpanded = expandedNodes.has(page.id);
            const isHome = page.id === 'home' || page.route === '/' || page.page_type === 'home';
            const isFooter = footerPages.includes(page);
            const trafficCount = pageTraffic[page.route] || 0;

            return (
              <div
                key={page.id}
                className={`border rounded-lg transition-all ${
                  isSelected ? 'border-indigo-500 bg-indigo-50' :
                  isHome ? 'border-amber-400 bg-amber-50' :
                  isFooter ? 'border-gray-300 bg-gray-50' :
                  'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div
                  className="p-3 cursor-pointer"
                  onClick={() => {
                    setSelectedNode(page);
                    toggleNodeExpansion(page.id);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <button className="p-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      <div className={`p-2 rounded-lg ${
                        isSelected ? 'bg-indigo-200' :
                        isHome ? 'bg-amber-200' :
                        isFooter ? 'bg-gray-200' :
                        'bg-gray-100'
                      }`}>
                        <PageIcon className={`w-5 h-5 ${
                          isSelected ? 'text-indigo-700' :
                          isHome ? 'text-amber-700' :
                          isFooter ? 'text-gray-500' :
                          'text-gray-600'
                        }`} />
                      </div>
                      <div>
                        <h4 className={`font-semibold text-gray-900 ${isHome ? 'text-lg' : ''}`}>
                          {page.name || page.id}
                          {isHome && <span className="ml-2 text-xs text-amber-600 font-normal">(Entry Point)</span>}
                          {isFooter && <span className="ml-2 text-xs text-gray-500 font-normal">(Footer)</span>}
                        </h4>
                        <p className="text-sm text-gray-500 font-mono">{page.route}</p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      {showTrafficOverlay && trafficCount > 0 && (
                        <div className="flex items-center gap-1 text-orange-600 font-bold mb-1">
                          <Flame className="w-4 h-4" />
                          {trafficCount.toLocaleString()}
                        </div>
                      )}
                      <div className="text-gray-600">{page.events?.length || 0} events</div>
                      <div className="text-gray-500">{page.widgets?.length || 0} widgets</div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-gray-200">
                    <div className="mt-3 space-y-3">
                      {page.events?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                            Events Tracked
                          </p>
                          <div className="space-y-1">
                            {page.events.map((event: string, idx: number) => {
                              const EventIcon = getEventIcon(event);
                              return (
                                <div key={idx} className="flex items-center space-x-2 p-2 bg-indigo-50 rounded">
                                  <EventIcon className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                  <span className="text-xs font-mono text-indigo-700">{event}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {page.widgets?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                            Page Components
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {page.widgets.map((widget: string, idx: number) => (
                              <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                {widget}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {page.can_navigate_to?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                            Navigation Links
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {page.can_navigate_to.map((target: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                <ArrowRight className="w-3 h-3 mr-1" />
                                {target}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isMounted) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Site Structure</h3>
        </div>
        <div className="p-4">
          <div className="h-[600px] bg-gray-50 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {['1h', '24h', '7d', '30d'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowTrafficOverlay(!showTrafficOverlay)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              showTrafficOverlay
                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Flame className="w-4 h-4" />
            {showTrafficOverlay ? 'Hide' : 'Show'} Heat Map
          </button>

          <button
            onClick={() => {
              const newState = !showFooterPages;
              console.log('🔄 Toggling footer pages:', newState ? 'SHOW' : 'HIDE');
              setShowFooterPages(newState);
            }}
            className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showFooterPages
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Filter className="w-4 h-4 mr-1" />
            {showFooterPages ? 'Hide' : 'Show'} Footer Pages
            {footerPages.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-200 text-indigo-800 rounded-full text-xs font-bold">
                {footerPages.length}
              </span>
            )}
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'graph' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 border border-gray-200 bg-white'
              }`}
            >
              <GitBranch className="w-4 h-4 inline mr-1" />
              Graph
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'tree' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 border border-gray-200 bg-white'
              }`}
            >
              <Layers className="w-4 h-4 inline mr-1" />
              Tree
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        {!isLoading && totalTraffic > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-gray-900">{totalTraffic.toLocaleString()}</span>
              <span className="text-gray-600">total views</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="font-bold text-gray-900">{Object.keys(pageTraffic).length}</span>
              <span className="text-gray-600">active pages</span>
            </div>
          </div>
        )}
      </div>

      {/* UI Graph with optional traffic overlay */}
      <div className="relative">{viewMode === 'graph' ? renderGraphView() : renderTreeView()}</div>
    </div>
  );
}

