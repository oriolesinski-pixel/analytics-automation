// packages/analytics-platform/src/app/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Clock, TrendingUp, TrendingDown, Users, ShoppingCart, DollarSign, Activity, Filter, ChevronDown, Search, ArrowUp, ArrowDown, Minus, MoreVertical, Settings, Download, RefreshCw, Eye, MousePointer, Package, CreditCard, Loader2 } from 'lucide-react';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface App {
    app_key: string;
    name: string;
    domain?: string;
    created_at?: string;
}

interface EventData {
    verb: string;
    count: number;
}

interface TimeSeriesPoint {
    time: string;
    value: number;
    previous?: number;
}

interface FunnelStep {
    stage: string;
    count: number;
    percentage: number;
    color: string;
}

interface TopProduct {
    name: string;
    revenue: number;
    units: number;
    trend: 'up' | 'down' | 'neutral';
    change: number;
}

interface AnalyticsOverview {
    total_events: number;
    unique_sessions: number;
    unique_users: number;
    events_by_type: EventData[];
}

export default function AnalyticsDashboard() {
    // State management
    const [selectedApp, setSelectedApp] = useState<string>('all');
    const [apps, setApps] = useState<App[]>([]);
    const [timeRange, setTimeRange] = useState('7d');
    const [selectedMetric, setSelectedMetric] = useState('page_views');
    const [refreshing, setRefreshing] = useState(false);
    const [showAppDropdown, setShowAppDropdown] = useState(false);
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
    const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[]>([]);
    const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
    const [kpiData, setKpiData] = useState<any[]>([]);
    const [analyticsExists, setAnalyticsExists] = useState(false);
    const [checkingAnalytics, setCheckingAnalytics] = useState(true);
    const [removing, setRemoving] = useState(false);

    // Time range options
    const timeRanges = [
        { value: '1h', label: 'Last Hour' },
        { value: '24h', label: 'Last 24 Hours' },
        { value: '7d', label: 'Last 7 Days' },
        { value: '30d', label: 'Last 30 Days' },
        { value: '90d', label: 'Last 90 Days' },
    ];

    // Metric options for time series
    const metricOptions = [
        { value: 'page_views', label: 'Page Views', icon: Eye },
        { value: 'unique_users', label: 'Unique Users', icon: Users },
        { value: 'clicks', label: 'Total Clicks', icon: MousePointer },
        { value: 'conversions', label: 'Conversions', icon: ShoppingCart },
        { value: 'revenue', label: 'Revenue', icon: DollarSign },
    ];

    // Fetch apps from backend
    const fetchApps = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/apps/list`);
            const data = await response.json();

            if (data.ok && data.apps) {
                // Create the apps list with "All" option plus all apps from database
                const formattedApps: App[] = [
                    { app_key: 'all', name: 'All Applications' },
                    ...data.apps.map((app: any) => ({
                        app_key: app.app_key,
                        name: app.name || app.app_key,
                        domain: app.domain,
                        created_at: app.created_at
                    }))
                ];

                setApps(formattedApps);

                // If no app selected yet, select the first real app (not 'all')
                if (!selectedApp && formattedApps.length > 1) {
                    setSelectedApp(formattedApps[1].app_key);
                }

                console.log('Apps loaded from Supabase:', formattedApps.map(a => a.app_key));
            }
        } catch (error) {
            console.error('Failed to fetch apps:', error);
            // Only show error, don't fall back to hardcoded list
            setApps([{ app_key: 'all', name: 'All Applications' }]);
        }
    };
    // Fetch analytics data
    const fetchAnalytics = async () => {
        if (!selectedApp || selectedApp === 'all') {
            // For 'all' apps, aggregate or show mock data
            generateMockData();
            return;
        }

        try {
            setLoading(true);

            // Calculate date range
            const now = new Date();
            const from = new Date();
            switch (timeRange) {
                case '1h':
                    from.setHours(from.getHours() - 1);
                    break;
                case '24h':
                    from.setHours(from.getHours() - 24);
                    break;
                case '7d':
                    from.setDate(from.getDate() - 7);
                    break;
                case '30d':
                    from.setDate(from.getDate() - 30);
                    break;
                case '90d':
                    from.setDate(from.getDate() - 90);
                    break;
            }

            console.log(`Fetching analytics for app: ${selectedApp}`);
            console.log(`Time range: ${from.toISOString()} to ${now.toISOString()}`);

            // Fetch overview data
            const overviewUrl = `${API_BASE_URL}/analytics/overview?app_key=${selectedApp}&from=${from.toISOString()}&to=${now.toISOString()}`;
            console.log('Fetching from:', overviewUrl);

            const overviewResponse = await fetch(overviewUrl);
            const overviewData = await overviewResponse.json();

            console.log('Overview response:', overviewData);

            if (overviewData.ok && overviewData.overview) {
                setOverview(overviewData.overview);
                updateKPIs(overviewData.overview);
                generateTimeSeriesFromEvents(overviewData.overview);
                generateFunnelFromEvents(overviewData.overview);
            } else {
                console.error('Failed to fetch overview:', overviewData.error);
                // Show empty state instead of mock data
                setOverview({
                    total_events: 0,
                    unique_sessions: 0,
                    unique_users: 0,
                    events_by_type: []
                });
                updateKPIs({
                    total_events: 0,
                    unique_sessions: 0,
                    unique_users: 0,
                    events_by_type: []
                });
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
            // Show error state, not mock data
            setOverview(null);
        } finally {
            setLoading(false);
        }
    };
    // Update KPIs based on overview data
    const updateKPIs = (data: AnalyticsOverview) => {
        const pageViews = data.events_by_type.find(e => e.verb === 'PAGE_VIEW')?.count || 0;
        const clicks = data.events_by_type.find(e => e.verb === 'BUTTON_CLICK')?.count || 0;
        const conversions = data.events_by_type.find(e => e.verb === 'FORM_INTERACTION')?.count || 0;

        setKpiData([
            {
                title: 'Active Users',
                value: data.unique_users.toLocaleString(),
                change: 12.5, // You'd calculate this from historical data
                icon: Users,
                color: 'text-blue-600',
                bgColor: 'bg-blue-50',
                trend: 'up'
            },
            {
                title: 'Page Views',
                value: pageViews.toLocaleString(),
                change: 8.3,
                icon: Eye,
                color: 'text-purple-600',
                bgColor: 'bg-purple-50',
                trend: 'up'
            },
            {
                title: 'Total Events',
                value: data.total_events.toLocaleString(),
                change: -2.1,
                icon: Activity,
                color: 'text-green-600',
                bgColor: 'bg-green-50',
                trend: 'down'
            },
            {
                title: 'Sessions',
                value: data.unique_sessions.toLocaleString(),
                change: 18.7,
                icon: Clock,
                color: 'text-amber-600',
                bgColor: 'bg-amber-50',
                trend: 'up'
            },
            {
                title: 'Conversions',
                value: conversions.toLocaleString(),
                change: 5.2,
                icon: TrendingUp,
                color: 'text-indigo-600',
                bgColor: 'bg-indigo-50',
                trend: 'up'
            }
        ]);
    };

    // Generate time series from event data
    const generateTimeSeriesFromEvents = (data: AnalyticsOverview) => {
        // This is a simplified version - you'd want to group by time periods
        const points = timeRange === '1h' ? 12 : timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const eventCount = data.events_by_type.find(e =>
            e.verb.toLowerCase().includes(selectedMetric.replace('_', ''))
        )?.count || data.total_events;

        const baseValue = eventCount / points;
        const series: TimeSeriesPoint[] = [];

        for (let i = 0; i < points; i++) {
            series.push({
                time: timeRange === '1h' ? `${i * 5}m` :
                    timeRange === '24h' ? `${i}:00` :
                        timeRange === '7d' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] :
                            `Day ${i + 1}`,
                value: Math.floor(baseValue + Math.random() * baseValue * 0.5 - baseValue * 0.25),
                previous: Math.floor(baseValue * 0.9 + Math.random() * baseValue * 0.4 - baseValue * 0.2)
            });
        }

        setTimeSeriesData(series);
    };

    // Generate funnel from event data
    const generateFunnelFromEvents = (data: AnalyticsOverview) => {
        // Map event types to funnel stages
        const stages = [
            { name: 'PAGE_VIEW', label: 'Page Visited', color: '#6366f1' },
            { name: 'USER_LOGIN', label: 'Logged In', color: '#8b5cf6' },
            { name: 'USER_REGISTER', label: 'Created Account', color: '#a855f7' },
            { name: 'BUTTON_CLICK', label: 'Interaction', color: '#c084fc' },
            { name: 'FORM_INTERACTION', label: 'Form Submit', color: '#d8b4fe' },
            { name: 'PURCHASE', label: 'Purchase', color: '#e9d5ff' },
        ];

        const totalEvents = data.total_events || 1;
        const funnel: FunnelStep[] = stages.map(stage => {
            const eventData = data.events_by_type.find(e => e.verb === stage.name);
            const count = eventData?.count || 0;
            return {
                stage: stage.label,
                count: count,
                percentage: Math.round((count / totalEvents) * 100),
                color: stage.color
            };
        });

        setFunnelData(funnel.filter(f => f.count > 0));
    };

    // Generate mock data (fallback)
    const generateMockData = () => {
        // Generate time series
        const points = timeRange === '1h' ? 12 : timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const baseValue = selectedMetric === 'revenue' ? 5000 : selectedMetric === 'conversions' ? 50 : 1000;
        const series: TimeSeriesPoint[] = [];

        for (let i = 0; i < points; i++) {
            series.push({
                time: timeRange === '1h' ? `${i * 5}m` :
                    timeRange === '24h' ? `${i}:00` :
                        timeRange === '7d' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] :
                            `Day ${i + 1}`,
                value: Math.floor(baseValue + Math.random() * baseValue * 0.5 - baseValue * 0.25),
                previous: Math.floor(baseValue * 0.9 + Math.random() * baseValue * 0.4 - baseValue * 0.2)
            });
        }
        setTimeSeriesData(series);

        // Generate funnel
        setFunnelData([
            { stage: 'Page Visited', count: 10000, percentage: 100, color: '#6366f1' },
            { stage: 'Logged In', count: 6500, percentage: 65, color: '#8b5cf6' },
            { stage: 'Created Account', count: 3200, percentage: 32, color: '#a855f7' },
            { stage: 'Add to Cart', count: 2400, percentage: 24, color: '#c084fc' },
            { stage: 'Checkout', count: 1800, percentage: 18, color: '#d8b4fe' },
            { stage: 'Purchase', count: 1200, percentage: 12, color: '#e9d5ff' },
        ]);

        // Set default KPIs
        setKpiData([
            {
                title: 'Active Users',
                value: selectedApp === 'all' ? '48.2K' : '12.3K',
                change: 12.5,
                icon: Users,
                color: 'text-blue-600',
                bgColor: 'bg-blue-50',
                trend: 'up'
            },
            {
                title: 'Page Views',
                value: selectedApp === 'all' ? '327K' : '89.2K',
                change: 8.3,
                icon: Eye,
                color: 'text-purple-600',
                bgColor: 'bg-purple-50',
                trend: 'up'
            },
            {
                title: 'Conversion Rate',
                value: '3.24%',
                change: -2.1,
                icon: TrendingUp,
                color: 'text-green-600',
                bgColor: 'bg-green-50',
                trend: 'down'
            },
            {
                title: 'Revenue',
                value: selectedApp === 'all' ? '$124.5K' : '$32.1K',
                change: 18.7,
                icon: DollarSign,
                color: 'text-amber-600',
                bgColor: 'bg-amber-50',
                trend: 'up'
            },
            {
                title: 'Avg. Session',
                value: '4m 32s',
                change: 0,
                icon: Clock,
                color: 'text-indigo-600',
                bgColor: 'bg-indigo-50',
                trend: 'neutral'
            }
        ]);
    };

    // Top products data
    const topProducts: TopProduct[] = [
        { name: 'MacBook Pro M3', revenue: 45200, units: 38, trend: 'up', change: 12.3 },
        { name: 'iPhone 15 Pro', revenue: 38900, units: 89, trend: 'up', change: 8.7 },
        { name: 'AirPods Pro', revenue: 28400, units: 142, trend: 'down', change: -3.2 },
        { name: 'iPad Air', revenue: 22100, units: 44, trend: 'up', change: 5.6 },
        { name: 'Apple Watch Ultra', revenue: 18700, units: 31, trend: 'neutral', change: 0.2 },
    ];

    // Handle refresh
    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchAnalytics();
        setTimeout(() => setRefreshing(false), 1000);
    };

    // Check if analytics files exist in repository
    const checkAnalyticsFiles = async () => {
        const owner = sessionStorage.getItem('github_owner');
        const repo = sessionStorage.getItem('github_repo');
        const token = sessionStorage.getItem('github_token');
        
        if (!owner || !repo || !token) {
            setCheckingAnalytics(false);
            return;
        }
        
        try {
            const response = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/public/tracker.js`,
                {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                }
            );
            
            setAnalyticsExists(response.ok);
        } catch (error) {
            console.error('Error checking analytics files:', error);
            setAnalyticsExists(false);
        } finally {
            setCheckingAnalytics(false);
        }
    };

    // Handle analytics removal
    const handleRemoveAnalytics = async () => {
        if (!confirm('Are you sure you want to remove analytics from your repository? This action cannot be undone.')) {
            return;
        }
        
        setRemoving(true);
        
        const owner = sessionStorage.getItem('github_owner');
        const repo = sessionStorage.getItem('github_repo');
        const token = sessionStorage.getItem('github_token');
        
        try {
            const response = await fetch('/api/remove-analytics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner, repo, token })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('Analytics removed successfully!');
                setAnalyticsExists(false);
                // Clear onboarding state to allow re-running
                sessionStorage.removeItem('onboarding_complete');
            } else {
                alert(`Failed to remove analytics: ${data.error}`);
            }
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setRemoving(false);
        }
    };

    // Effects
    useEffect(() => {
        fetchApps();
        checkAnalyticsFiles();
    }, []);

    useEffect(() => {
        fetchAnalytics();
    }, [selectedApp, timeRange, selectedMetric]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchAnalytics();
        }, 30000);
        return () => clearInterval(interval);
    }, [selectedApp, timeRange]);

    if (loading && !kpiData.length) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className="text-gray-600">Loading analytics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <h1 className="text-2xl font-semibold text-gray-900">Analytics Dashboard</h1>

                            {/* App Selector */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowAppDropdown(!showAppDropdown)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    <span className="font-medium text-gray-700">
                                        {apps.find(a => a.app_key === selectedApp)?.name || 'Select App'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                </button>

                                {showAppDropdown && (
                                    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                                        {apps.map(app => (
                                            <button
                                                key={app.app_key}
                                                onClick={() => {
                                                    setSelectedApp(app.app_key);
                                                    setShowAppDropdown(false);
                                                }}
                                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                                            >
                                                <span className="text-gray-700">{app.name}</span>
                                                {app.app_key === selectedApp && (
                                                    <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Header Actions */}
                        <div className="flex items-center space-x-3">
                            {/* Time Range Selector */}
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                {timeRanges.map(range => (
                                    <button
                                        key={range.value}
                                        onClick={() => setTimeRange(range.value)}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${timeRange === range.value
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                    >
                                        {range.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleRefresh}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
                            </button>

                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <Download className="w-5 h-5 text-gray-600" />
                            </button>

                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <Settings className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6">
                {/* Remove Analytics Button */}
                {!checkingAnalytics && analyticsExists && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-red-800">
                                    Analytics Integration Active
                                </h3>
                                <p className="mt-1 text-sm text-red-600">
                                    Remove analytics files from your repository
                                </p>
                            </div>
                            <button
                                onClick={handleRemoveAnalytics}
                                disabled={removing}
                                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {removing ? 'Removing...' : 'Remove Analytics'}
                            </button>
                        </div>
                    </div>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-5 gap-4 mb-6">
                    {kpiData.map((kpi, index) => (
                        <div key={index} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                            <div className="flex items-start justify-between mb-3">
                                <div className={`p-2 ${kpi.bgColor} rounded-lg`}>
                                    <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                                </div>
                                <div className="flex items-center space-x-1">
                                    {kpi.trend === 'up' ? (
                                        <ArrowUp className="w-4 h-4 text-green-500" />
                                    ) : kpi.trend === 'down' ? (
                                        <ArrowDown className="w-4 h-4 text-red-500" />
                                    ) : (
                                        <Minus className="w-4 h-4 text-gray-400" />
                                    )}
                                    <span className={`text-sm font-medium ${kpi.trend === 'up' ? 'text-green-600' :
                                        kpi.trend === 'down' ? 'text-red-600' :
                                            'text-gray-500'
                                        }`}>
                                        {Math.abs(kpi.change)}%
                                    </span>
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
                            <div className="text-sm text-gray-500 mt-1">{kpi.title}</div>
                        </div>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-3 gap-6">
                    {/* Time Trend Analysis - 2 columns */}
                    <div className="col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">Trend Analysis</h2>
                            <div className="flex items-center space-x-3">
                                {/* Metric Selector */}
                                <select
                                    value={selectedMetric}
                                    onChange={(e) => setSelectedMetric(e.target.value)}
                                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {metricOptions.map(metric => (
                                        <option key={metric.value} value={metric.value}>
                                            {metric.label}
                                        </option>
                                    ))}
                                </select>
                                <button className="p-1.5 hover:bg-gray-100 rounded-lg">
                                    <MoreVertical className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                        </div>

                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={timeSeriesData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="time"
                                    stroke="#9ca3af"
                                    fontSize={12}
                                />
                                <YAxis
                                    stroke="#9ca3af"
                                    fontSize={12}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="previous"
                                    stroke="#9ca3af"
                                    strokeWidth={1}
                                    strokeDasharray="5 5"
                                    dot={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Conversion Funnel */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">Conversion Funnel</h2>
                            <button className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <Filter className="w-4 h-4 text-gray-600" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {funnelData.map((stage, index) => (
                                <div key={index}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">{stage.stage}</span>
                                        <span className="text-sm text-gray-500">{stage.count.toLocaleString()}</span>
                                    </div>
                                    <div className="relative">
                                        <div className="w-full bg-gray-100 rounded-full h-8">
                                            <div
                                                className="h-8 rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                                                style={{
                                                    width: `${stage.percentage}%`,
                                                    backgroundColor: stage.color
                                                }}
                                            >
                                                <span className="text-xs font-medium text-white">
                                                    {stage.percentage}%
                                                </span>
                                            </div>
                                        </div>
                                        {index < funnelData.length - 1 && (
                                            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                                                <ChevronDown className="w-4 h-4 text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Funnel Summary */}
                        {funnelData.length > 0 && (
                            <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-indigo-900">Overall Conversion</span>
                                    <span className="text-lg font-bold text-indigo-600">
                                        {funnelData[funnelData.length - 1]?.percentage || 0}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Products Section */}
                <div className="mt-6 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Top Performing Products</h2>
                        <div className="flex items-center space-x-3">
                            <button className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
                                Revenue
                            </button>
                            <button className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
                                Units Sold
                            </button>
                            <button className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
                                Growth Rate
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Product</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Revenue</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Units</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Trend</th>
                                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Performance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topProducts.map((product, index) => (
                                    <tr key={index} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="py-4 px-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                                                    <Package className="w-4 h-4 text-indigo-600" />
                                                </div>
                                                <span className="font-medium text-gray-900">{product.name}</span>
                                            </div>
                                        </td>
                                        <td className="text-right py-4 px-4 font-medium text-gray-900">
                                            ${product.revenue.toLocaleString()}
                                        </td>
                                        <td className="text-right py-4 px-4 text-gray-600">
                                            {product.units}
                                        </td>
                                        <td className="text-right py-4 px-4">
                                            <div className="flex items-center justify-end space-x-1">
                                                {product.trend === 'up' ? (
                                                    <ArrowUp className="w-4 h-4 text-green-500" />
                                                ) : product.trend === 'down' ? (
                                                    <ArrowDown className="w-4 h-4 text-red-500" />
                                                ) : (
                                                    <Minus className="w-4 h-4 text-gray-400" />
                                                )}
                                                <span className={`text-sm font-medium ${product.trend === 'up' ? 'text-green-600' :
                                                    product.trend === 'down' ? 'text-red-600' :
                                                        'text-gray-500'
                                                    }`}>
                                                    {Math.abs(product.change)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-center py-4 px-4">
                                            <div className="w-full bg-gray-100 rounded-full h-2 max-w-[100px] mx-auto">
                                                <div
                                                    className="h-2 bg-indigo-500 rounded-full transition-all"
                                                    style={{ width: `${(product.revenue / topProducts[0].revenue) * 100}%` }}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Real-time Event Stream (Optional) */}
                {overview && (
                    <div className="mt-6 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Summary</h2>
                        <div className="grid grid-cols-4 gap-4">
                            {overview.events_by_type.slice(0, 8).map((event, index) => (
                                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                                    <div className="text-sm text-gray-600">{event.verb}</div>
                                    <div className="text-lg font-semibold text-gray-900">{event.count.toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
