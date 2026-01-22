// packages/analytics-platform/src/app/dashboard/page-new.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Activity, ChevronDown, Settings, Loader2, BarChart3 } from 'lucide-react';
import TileBuilder from '@/components/TileBuilder';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface App {
    app_key: string;
    name: string;
    domain?: string;
    created_at?: string;
}

export default function AnalyticsDashboard() {
    const [selectedApp, setSelectedApp] = useState<string>('');
    const [apps, setApps] = useState<App[]>([]);
    const [showAppDropdown, setShowAppDropdown] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch apps from backend
    const fetchApps = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/apps/list`);
            const data = await response.json();

            if (data.ok && data.apps) {
                const formattedApps: App[] = data.apps.map((app: any) => ({
                    app_key: app.app_key,
                    name: app.name || app.app_key,
                    domain: app.domain,
                    created_at: app.created_at
                }));

                setApps(formattedApps);

                // Auto-select first app
                if (formattedApps.length > 0 && !selectedApp) {
                    setSelectedApp(formattedApps[0].app_key);
                }

                console.log('Apps loaded from Supabase:', formattedApps.map(a => a.app_key));
            }
        } catch (error) {
            console.error('Failed to fetch apps:', error);
            setApps([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApps();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className="text-gray-600">Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (apps.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b border-gray-200">
                    <div className="px-6 py-4">
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-semibold text-gray-900">Analytics Dashboard</h1>
                        </div>
                    </div>
                </div>

                {/* Empty State */}
                <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                    <div className="text-center">
                        <BarChart3 className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                        <h3 className="text-xl font-medium text-gray-900 mb-2">No Applications Found</h3>
                        <p className="text-gray-600 mb-6">
                            Complete the onboarding process to set up analytics for your application.
                        </p>
                        <a
                            href="/onboarding"
                            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Start Onboarding
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 flex-shrink-0">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <h1 className="text-2xl font-semibold text-gray-900">Analytics Tile Builder</h1>

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
                            <a
                                href="/events"
                                className="inline-flex items-center px-4 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                            >
                                <Activity className="h-4 w-4 mr-2" />
                                <span className="flex items-center gap-2">
                                    Live Events
                                    <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                                </span>
                            </a>

                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <Settings className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tile Builder */}
            <div className="flex-1 overflow-hidden">
                {selectedApp ? (
                    <TileBuilder appKey={selectedApp} />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">Select an application to start building tiles</p>
                    </div>
                )}
            </div>
        </div>
    );
}

