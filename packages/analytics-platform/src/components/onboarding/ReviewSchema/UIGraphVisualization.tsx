// Save as: packages/analytics-platform/src/components/onboarding/ReviewSchema/UIGraphVisualization.tsx

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { GitBranch, Layers, Home, ShoppingCart, User, Package, CreditCard, Heart, Globe, ChevronDown, ChevronRight, Info, Store, LogIn, UserPlus, FileText, ArrowRight, Activity, MousePointer, FileSearch, Eye, ScrollText, Filter, CheckCircle2 } from 'lucide-react';

interface UIGraphProps {
    uiGraph: any;
}

export function UIGraphVisualization({ uiGraph }: UIGraphProps) {
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState('graph');
    const [showFooterPages, setShowFooterPages] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Fix hydration by only rendering after mount
    useEffect(() => {
        setIsMounted(true);
    }, []);

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
        return pages.filter(p =>
            footerKeywords.some(keyword => p.id.toLowerCase().includes(keyword))
        );
    }, [pages]);

    // Main flow pages (excluding footer pages unless explicitly shown)
    const filteredPages = useMemo(() => {
        if (showFooterPages) return pages;
        return pages.filter(p => !footerPages.includes(p));
    }, [pages, footerPages, showFooterPages]);

    const getPageIcon = (pageType: string, pageId: string) => {
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
    };

    const getEventIcon = (eventType: string) => {
        switch (eventType) {
            case 'PAGE_VIEW': return Eye;
            case 'BUTTON_CLICK': return MousePointer;
            case 'FORM_INTERACTION': return FileSearch;
            case 'SCROLL_INTERACTION': return ScrollText;
            case 'ELEMENT_VISIBILITY': return Activity;
            default: return Activity;
        }
    };

    const toggleNodeExpansion = (nodeId: string) => {
        setExpandedNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(nodeId)) {
                newSet.delete(nodeId);
            } else {
                newSet.add(nodeId);
            }
            return newSet;
        });
    };

    // Smart hierarchical layout algorithm
    const calculateNodePositions = (pages: any[]) => {
        const nodeWidth = 180;
        const levelHeight = 150;
        const startY = 100;

        // Categorize pages by their role in the flow
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

        // Level 0: Home at top center
        if (homeNode) {
            positions[homeNode.id] = { x: 600, y: startY + (currentLevel * levelHeight) };
            currentLevel++;
        }

        // Level 1: Auth (left) and Products (center-right)
        const level1Y = startY + (currentLevel * levelHeight);

        // Auth nodes on the left
        authNodes.forEach((node, idx) => {
            positions[node.id] = {
                x: 200 + (idx * 150),
                y: level1Y
            };
        });

        // Product nodes in the center
        const productStartX = 500;
        productNodes.forEach((node, idx) => {
            positions[node.id] = {
                x: productStartX + (idx * nodeWidth),
                y: level1Y
            };
        });

        // Wishlist on the right
        if (wishlistNode) {
            positions[wishlistNode.id] = {
                x: 1000,
                y: level1Y
            };
        }
        currentLevel++;

        // Level 2: Cart
        if (cartNode) {
            positions[cartNode.id] = { x: 600, y: startY + (currentLevel * levelHeight) };
            currentLevel++;
        }

        // Level 3: Checkout flow
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

        // Level 4: Success/completion at bottom
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

        // Other nodes at bottom
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

        // Calculate viewBox to ensure everything is centered and visible
        const allX = Object.values(positions).map(p => p.x);
        const allY = Object.values(positions).map(p => p.y);
        
        // Add more padding for better visibility
        const padding = 150;
        const minX = Math.min(...allX) - padding;
        const maxX = Math.max(...allX) + padding;
        const minY = Math.min(...allY) - padding;
        const maxY = Math.max(...allY) + padding;

        return {
            positions,
            viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
            width: maxX - minX,
            height: maxY - minY
        };
    };

    const renderGraphView = () => {
        // Don't render until mounted to avoid hydration issues
        if (!isMounted) {
            return <div className="h-[600px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg" />;
        }

        const { positions: nodePositions, viewBox, width, height } = calculateNodePositions(filteredPages);

        return (
            <div className="relative">
                {/* Filter toggle */}
                <div className="absolute top-2 left-2 z-10">
                    <button
                        onClick={() => setShowFooterPages(!showFooterPages)}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showFooterPages
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                    >
                        <Filter className="w-4 h-4 mr-1" />
                        {showFooterPages ? 'Hide' : 'Show'} Footer Pages
                    </button>
                </div>

                {/* SVG Container - Auto-fits all nodes */}
                <div className="h-[600px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden">
                    <svg
                        width="100%"
                        height="100%"
                        viewBox={viewBox}
                        preserveAspectRatio="xMidYMid meet"
                        className="w-full h-full"
                    >
                        {/* Define arrow markers */}
                        <defs>
                            <marker
                                id="arrow-default"
                                viewBox="0 0 10 10"
                                refX="9"
                                refY="5"
                                markerWidth="5"
                                markerHeight="5"
                                orient="auto"
                            >
                                <path
                                    d="M 0 0 L 10 5 L 0 10 z"
                                    fill="#cbd5e1"
                                />
                            </marker>
                            <marker
                                id="arrow-highlighted"
                                viewBox="0 0 10 10"
                                refX="9"
                                refY="5"
                                markerWidth="7"
                                markerHeight="7"
                                orient="auto"
                            >
                                <path
                                    d="M 0 0 L 10 5 L 0 10 z"
                                    fill="#6366f1"
                                />
                            </marker>
                            <marker
                                id="arrow-selected"
                                viewBox="0 0 10 10"
                                refX="9"
                                refY="5"
                                markerWidth="7"
                                markerHeight="7"
                                orient="auto"
                            >
                                <path
                                    d="M 0 0 L 10 5 L 0 10 z"
                                    fill="#4f46e5"
                                />
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

                                // Only highlight outgoing connections from hovered/selected node
                                const isOutgoingHighlighted = hoveredNode === page.id || selectedNode?.id === page.id;
                                const isSelected = selectedNode?.id === page.id;

                                // Calculate path with slight curve
                                const dx = pos2.x - pos1.x;
                                const dy = pos2.y - pos1.y;
                                const dr = Math.sqrt(dx * dx + dy * dy);
                                const curvature = dr * 0.15; // 15% curve

                                // Calculate control point for quadratic curve
                                const midX = (pos1.x + pos2.x) / 2;
                                const midY = (pos1.y + pos2.y) / 2;

                                // Perpendicular offset for curve
                                const offsetX = -dy / dr * curvature;
                                const offsetY = dx / dr * curvature;

                                return (
                                    <g key={`${page.id}-${targetId}`}>
                                        <path
                                            d={`M ${pos1.x} ${pos1.y} Q ${midX + offsetX} ${midY + offsetY} ${pos2.x} ${pos2.y}`}
                                            stroke={isOutgoingHighlighted ? (isSelected ? "#4f46e5" : "#6366f1") : "#cbd5e1"}
                                            strokeWidth={isOutgoingHighlighted ? "2.5" : "1.5"}
                                            fill="none"
                                            markerEnd={`url(#arrow-${isOutgoingHighlighted ? (isSelected ? 'selected' : 'highlighted') : 'default'})`}
                                            style={{
                                                transition: 'all 0.3s ease',
                                                strokeDasharray: isOutgoingHighlighted ? '0' : '0'
                                            }}
                                            opacity={isOutgoingHighlighted ? 1 : 0.3}
                                        />

                                        {/* Add small directional indicators along the path when highlighted */}
                                        {isOutgoingHighlighted && (
                                            <>
                                                <circle
                                                    cx={midX + offsetX}
                                                    cy={midY + offsetY}
                                                    r="2"
                                                    fill={isSelected ? "#4f46e5" : "#6366f1"}
                                                    opacity="0.6"
                                                />
                                            </>
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

                            // Check if this node has outgoing connections
                            const hasOutgoingConnections = page.can_navigate_to?.some((targetId: string) =>
                                filteredPages.some(p => p.id === targetId)
                            );

                            return (
                                <g key={page.id}>
                                    {/* Node shadow */}
                                    {(isSelected || isHome || isSuccess) && (
                                        <ellipse
                                            cx={pos.x}
                                            cy={pos.y + 3}
                                            rx={isHome || isSuccess ? "52" : "42"}
                                            ry="10"
                                            fill="black"
                                            opacity="0.08"
                                        />
                                    )}

                                    {/* Glow effect when node has highlighted outgoing connections */}
                                    {(isHovered || isSelected) && hasOutgoingConnections && (
                                        <circle
                                            cx={pos.x}
                                            cy={pos.y}
                                            r={isHome || isSuccess ? "55" : "47"}
                                            fill="none"
                                            stroke={isSelected ? "#4f46e5" : "#6366f1"}
                                            strokeWidth="1"
                                            opacity="0.3"
                                            style={{
                                                animation: 'pulse 2s infinite',
                                            }}
                                        />
                                    )}

                                    {/* Main node circle */}
                                    <circle
                                        cx={pos.x}
                                        cy={pos.y}
                                        r={isHome || isSuccess ? "48" : "40"}
                                        fill={
                                            isSelected ? "#6366f1" :
                                                isHovered ? "#e0e7ff" :
                                                    isHome ? "#fef3c7" :
                                                        isSuccess ? "#dcfce7" :
                                                            "#ffffff"
                                        }
                                        stroke={
                                            isSelected ? "#4f46e5" :
                                                isHovered ? "#6366f1" :
                                                    isHome ? "#f59e0b" :
                                                        isSuccess ? "#16a34a" :
                                                            "#e5e7eb"
                                        }
                                        strokeWidth={isHovered || isSelected || isHome || isSuccess ? "2.5" : "1.5"}
                                        className="cursor-pointer transition-all duration-300"
                                        onMouseEnter={() => setHoveredNode(page.id)}
                                        onMouseLeave={() => setHoveredNode(null)}
                                        onClick={() => setSelectedNode(page)}
                                    />

                                    {/* Icon */}
                                    <foreignObject
                                        x={pos.x - 16}
                                        y={pos.y - 16}
                                        width="32"
                                        height="32"
                                        style={{ pointerEvents: 'none' }}
                                    >
                                        <div className="w-full h-full flex items-center justify-center">
                                            <PageIcon className={`w-7 h-7 ${isSelected ? 'text-white' :
                                                isHovered ? 'text-indigo-600' :
                                                    isHome ? 'text-amber-600' :
                                                        isSuccess ? 'text-green-600' :
                                                            'text-gray-600'
                                                }`} />
                                        </div>
                                    </foreignObject>

                                    {/* Small directional indicator for nodes with outgoing connections */}
                                    {hasOutgoingConnections && !isHovered && !isSelected && (
                                        <circle
                                            cx={pos.x + 35}
                                            cy={pos.y - 35}
                                            r="3"
                                            fill="#cbd5e1"
                                        />
                                    )}

                                    {/* Page name */}
                                    <text
                                        x={pos.x}
                                        y={pos.y + 65}
                                        textAnchor="middle"
                                        className={`text-sm font-medium fill-gray-700 select-none ${isHome || isSuccess ? 'font-bold' : ''
                                            }`}
                                        style={{ pointerEvents: 'none' }}
                                    >
                                        {page.id.replace(/_/g, ' ')}
                                    </text>

                                    {/* Route path */}
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

                        {/* Add pulse animation */}
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

                {/* Selected node details panel - only show when mounted */}
                {isMounted && selectedNode && (
                    <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-20">
                        <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    {(() => {
                                        const Icon = getPageIcon(selectedNode.page_type, selectedNode.id);
                                        return <Icon className="w-5 h-5" />;
                                    })()}
                                    <h3 className="font-semibold text-lg">{selectedNode.id}</h3>
                                </div>
                                <button
                                    onClick={() => setSelectedNode(null)}
                                    className="text-white/80 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>
                            <p className="text-sm opacity-90 mt-1 font-mono">{selectedNode.route}</p>
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
        // Don't render until mounted
        if (!isMounted) {
            return <div className="h-[600px] bg-gray-50 rounded-lg" />;
        }

        const displayPages = showFooterPages ? pages : filteredPages;

        return (
            <div className="bg-gray-50 rounded-lg p-4 h-[600px] overflow-y-auto">
                {/* Filter toggle */}
                <div className="mb-4">
                    <button
                        onClick={() => setShowFooterPages(!showFooterPages)}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showFooterPages
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                    >
                        <Filter className="w-4 h-4 mr-1" />
                        {showFooterPages ? 'Hide' : 'Show'} Footer Pages ({footerPages.length})
                    </button>
                </div>

                <div className="space-y-2">
                    {displayPages.map(page => {
                        const PageIcon = getPageIcon(page.page_type, page.id);
                        const isSelected = selectedNode?.id === page.id;
                        const isExpanded = expandedNodes.has(page.id);
                        const isHome = page.id === 'home' || page.route === '/' || page.page_type === 'home';
                        const isFooter = footerPages.includes(page);

                        return (
                            <div
                                key={page.id}
                                className={`border rounded-lg transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50' :
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
                                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-200' :
                                                isHome ? 'bg-amber-200' :
                                                    isFooter ? 'bg-gray-200' :
                                                        'bg-gray-100'
                                                }`}>
                                                <PageIcon className={`w-5 h-5 ${isSelected ? 'text-indigo-700' :
                                                    isHome ? 'text-amber-700' :
                                                        isFooter ? 'text-gray-500' :
                                                            'text-gray-600'
                                                    }`} />
                                            </div>
                                            <div>
                                                <h4 className={`font-semibold text-gray-900 ${isHome ? 'text-lg' : ''}`}>
                                                    {page.id}
                                                    {isHome && <span className="ml-2 text-xs text-amber-600 font-normal">(Entry Point)</span>}
                                                    {isFooter && <span className="ml-2 text-xs text-gray-500 font-normal">(Footer)</span>}
                                                </h4>
                                                <p className="text-sm text-gray-500 font-mono">{page.route}</p>
                                            </div>
                                        </div>
                                        <div className="text-right text-sm">
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

    // Only render after mount to avoid hydration issues
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
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Site Structure</h3>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setViewMode('graph')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'graph' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <GitBranch className="w-4 h-4 inline mr-1" />
                        Graph
                    </button>
                    <button
                        onClick={() => setViewMode('tree')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'tree' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <Layers className="w-4 h-4 inline mr-1" />
                        Tree
                    </button>
                </div>
            </div>
            <div className="p-4">
                {viewMode === 'graph' ? renderGraphView() : renderTreeView()}
            </div>
        </div>
    );
}