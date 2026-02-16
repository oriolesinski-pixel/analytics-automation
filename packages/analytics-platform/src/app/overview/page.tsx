'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Activity, Zap, Globe, Monitor, Smartphone, Flame, FileText, Layers, Sparkles } from 'lucide-react';
import { SitePreviewSandbox } from '@/components/onboarding/ReviewSchema';
import { UIGraphWithTraffic } from '@/components/UIGraphWithTraffic';
import { useAppKey } from '@/lib/AppKeyContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export default function OverviewPage() {
  const { appKey } = useAppKey();
  const [schema, setSchema] = useState<any>(null);
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [isLoading, setIsLoading] = useState(true);
  const [realtimeStats, setRealtimeStats] = useState<any>(null);

  useEffect(() => {
    if (!appKey) return;
    const loadData = async () => {
      console.log('🔍 === OVERVIEW PAGE LOADING DATA ===');
      console.log('   App Key found:', appKey);

      // Try to load schema from storage first - check all possible locations
      const storedSchema = sessionStorage.getItem('onboarding_schema') || 
                          localStorage.getItem('onboarding_schema');
      
      console.log('   Stored schema exists:', !!storedSchema);
      console.log('   Stored schema length:', storedSchema?.length || 0, 'characters');
      
      if (storedSchema) {
        try {
          const parsed = JSON.parse(storedSchema);
          // Calculate widget count from uiGraph pages
          const allWidgets = new Set<string>();
          if (parsed.uiGraph?.pages) {
            Object.values(parsed.uiGraph.pages).forEach((page: any) => {
              if (page.widgets && Array.isArray(page.widgets)) {
                page.widgets.forEach((widget: string) => allWidgets.add(widget));
              }
            });
          }
          const widgetCount = allWidgets.size;
          
          console.log('✅ Loaded full schema from onboarding:');
          console.log('   - uiGraph.pages:', Object.keys(parsed.uiGraph?.pages || {}).length, 'pages');
          console.log('   - Unique widgets from pages:', widgetCount);
          console.log('   - uiGraph.widgets:', parsed.uiGraph?.widgets?.length || 0);
          console.log('   - uiGraph.framework:', parsed.uiGraph?.framework);
          console.log('   - schema.ai_components:', parsed.schema?.ai_components?.length || 0);
          console.log('   - totalPages:', parsed.totalPages);
          console.log('   - totalComponents:', parsed.totalComponents);
          console.log('   - events:', parsed.events?.length || 0);
          
          // Enhance schema with any missing fields - use same fallback logic as onboarding
          // Priority: stored totalComponents -> ai_components -> widgets from pages -> global widgets
          const calculatedComponents = parsed.totalComponents || 
                                       parsed.schema?.ai_components?.length || 
                                       widgetCount ||
                                       parsed.metadata?.componentCount || 
                                       parsed.uiGraph?.widgets?.length || 
                                       0;
          
          const enhancedSchema = {
            ...parsed,
            totalPages: Object.keys(parsed.uiGraph?.pages || {}).length || parsed.routes?.length || parsed.totalPages || 0,
            totalComponents: calculatedComponents,
            events: parsed.events || ['PAGE_VIEW', 'BUTTON_CLICK', 'FORM_INTERACTION'],
            siteUrl: parsed.siteUrl || ''
          };
          
          console.log('   ✅ Enhanced totalComponents:', enhancedSchema.totalComponents, `(from ${
            parsed.totalComponents ? 'stored value' :
            parsed.schema?.ai_components?.length ? 'ai_components' :
            widgetCount ? 'page widgets' :
            parsed.metadata?.componentCount ? 'metadata' :
            parsed.uiGraph?.widgets?.length ? 'global widgets' : 'default'
          })`);
          
          setSchema(enhancedSchema);
          setIsLoading(false);
          return;
        } catch (e) {
          console.error('Failed to parse stored schema:', e);
        }
      }
      
      console.log('⚠️ No schema found in storage - building from event data');
      
      // If no schema, build one from actual event data
      if (appKey) {
        try {
          const now = new Date();
          const startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
          
          const response = await fetch(`${API_BASE_URL}/query/tile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              app_key: appKey,
              event_type: 'PAGE_VIEW',
              measure: { aggregation: 'count', label: 'Views' },
              dimensions: [{ id: 'path', field: 'data->path', label: 'Path', type: 'categorical' }],
              date_range: {
                start: startTime.toISOString(),
                end: now.toISOString()
              }
            })
          });
          
          const result = await response.json();
          
          if (result.ok && result.data && result.data.length > 0) {
            // Build UI graph from actual page data with better structure
            const pages: any = {};
            const seenPaths = new Set<string>();
            
            result.data.forEach((item: any) => {
              // Try multiple possible field names
              const path = item.Path || item['data->path'] || item.path || '/';
              
              if (seenPaths.has(path)) return;
              seenPaths.add(path);
              
              // Clean up the path
              const cleanPath = path.startsWith('/') ? path : '/' + path;
              const pageId = cleanPath === '/' ? 'home' : cleanPath.replace(/^\//, '').replace(/\//g, '_');
              
              // Build better page name
              const nameParts = cleanPath.split('/').filter(Boolean);
              const pageName = cleanPath === '/' ? 'Home' : 
                             nameParts.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') || pageId;
              
              pages[pageId] = {
                id: pageId,
                route: cleanPath,
                page_type: cleanPath === '/' ? 'home' : 
                          cleanPath.includes('product') && !cleanPath.includes('checkout') ? 'product_detail' :
                          cleanPath.includes('cart') ? 'cart' :
                          cleanPath.includes('checkout') || cleanPath.includes('payment') ? 'checkout' :
                          cleanPath.includes('auth') || cleanPath.includes('login') ? 'auth' :
                          cleanPath.includes('wishlist') ? 'wishlist' : 
                          'general',
                widgets: [],
                events: ['PAGE_VIEW', 'BUTTON_CLICK'],
                can_navigate_to: [],
                name: pageName
              };
            });
            
            // Build basic navigation graph
            const pageIds = Object.keys(pages);
            const homeId = pageIds.find(id => pages[id].page_type === 'home');
            
            if (homeId) {
              // Home can navigate to most pages
              pages[homeId].can_navigate_to = pageIds.filter(id => id !== homeId);
            }
            
            // Product pages can navigate to cart
            const cartId = pageIds.find(id => pages[id].page_type === 'cart');
            if (cartId) {
              pageIds.filter(id => pages[id].page_type === 'product_detail').forEach(productId => {
                pages[productId].can_navigate_to = [cartId];
              });
              
              // Cart can navigate to checkout
              const checkoutIds = pageIds.filter(id => pages[id].page_type === 'checkout');
              if (checkoutIds.length > 0) {
                pages[cartId].can_navigate_to = checkoutIds;
              }
            }
            
            const generatedSchema = {
              uiGraph: {
                pages,
                framework: 'detected_from_events'
              },
              siteUrl: '',
              events: ['PAGE_VIEW', 'BUTTON_CLICK', 'FORM_INTERACTION'],
              totalPages: Object.keys(pages).length,
              totalComponents: 0,
              estimatedEvents: result.data.reduce((sum: number, item: any) => sum + (item.value || 0), 0)
            };
            
            console.log('📊 Generated schema from event data:', generatedSchema);
            setSchema(generatedSchema);
          } else {
            // Fallback to minimal schema
            console.log('❌ No event data available, using minimal schema');
            setSchema({
              uiGraph: {
                pages: {
                  'home': { 
                    id: 'home',
                    route: '/', 
                    page_type: 'home', 
                    widgets: [], 
                    events: ['PAGE_VIEW'], 
                    can_navigate_to: [], 
                    name: 'Home' 
                  }
                },
                framework: 'unknown'
              },
              siteUrl: '',
              events: ['PAGE_VIEW'],
              totalPages: 1,
              totalComponents: 0,
              estimatedEvents: '0'
            });
          }
        } catch (error) {
          console.error('❌ Failed to fetch schema data:', error);
          setSchema(null);
        }
      }
      
      setIsLoading(false);
    };
    
    loadData();
  }, [appKey]);

  // Fetch realtime stats
  useEffect(() => {
    if (!appKey) return;
    
    const fetchStats = async () => {
      try {
        const now = new Date();
        const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        // Direct SQL query for total events in last 24h
        const sqlQuery = `
          SELECT COUNT(*) as total_events
          FROM analytics_product_events
          WHERE app_key = '${appKey}'
            AND ts >= ${startTime.getTime()}
            AND ts <= ${now.getTime()}
        `;
        
        const response = await fetch(`${API_BASE_URL}/query/sql`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: sqlQuery,
            app_key: appKey,
            timeout: 5000
          })
        });
        
        const result = await response.json();
        console.log('📊 Events (24h) result:', result);
        
        if (result.ok && result.data?.[0]) {
          const eventCount = parseInt(result.data[0].total_events) || 0;
          console.log('   ✅ Total events in 24h:', eventCount);
          setRealtimeStats({ totalEvents: eventCount });
        } else {
          console.warn('   ⚠️ No event data:', result.error);
          setRealtimeStats({ totalEvents: 0 });
        }
      } catch (error) {
        console.error('❌ Failed to fetch stats:', error);
        setRealtimeStats({ totalEvents: 0 });
      }
    };
    
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [appKey]);

  // Calculate metrics from schema
  const totalPages = schema?.uiGraph ? Object.keys(schema.uiGraph.pages || {}).length : 0;
  const totalComponents = schema?.totalComponents || schema?.uiGraph?.widgets?.length || 0;
  const totalEvents = schema?.events?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Overview</h1>
          <p className="text-gray-600 dark:text-gray-400">High-level metrics and insights across your application</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Metrics Grid */}
          {schema && (
            <div className="grid grid-cols-4 gap-4">
              {/* Pages Tracked */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-500/20 dark:to-blue-600/10 rounded-xl p-6 border border-blue-200 dark:border-blue-500/30 relative overflow-hidden">
                <div className="absolute top-2 right-2 opacity-10">
                  <FileText className="w-16 h-16 text-blue-900 dark:text-blue-400" />
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-blue-200 dark:bg-blue-500/30 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-900 dark:text-blue-300" />
                    </div>
                  </div>
                  <p className="text-4xl font-bold text-blue-900 dark:text-blue-100">{totalPages}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-2 font-medium">Pages Tracked</p>
                </div>
              </div>

              {/* Components */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-500/20 dark:to-purple-600/10 rounded-xl p-6 border border-purple-200 dark:border-purple-500/30 relative overflow-hidden">
                <div className="absolute top-2 right-2 opacity-10">
                  <Layers className="w-16 h-16 text-purple-900 dark:text-purple-400" />
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-purple-200 dark:bg-purple-500/30 rounded-lg">
                      <Layers className="w-5 h-5 text-purple-900 dark:text-purple-300" />
                    </div>
                  </div>
                  <p className="text-4xl font-bold text-purple-900 dark:text-purple-100">{totalComponents}</p>
                  <p className="text-sm text-purple-700 dark:text-purple-400 mt-2 font-medium">Components</p>
                </div>
              </div>

              {/* Event Types */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-500/20 dark:to-green-600/10 rounded-xl p-6 border border-green-200 dark:border-green-500/30 relative overflow-hidden">
                <div className="absolute top-2 right-2 opacity-10">
                  <Zap className="w-16 h-16 text-green-900 dark:text-green-400" />
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-green-200 dark:bg-green-500/30 rounded-lg">
                      <Zap className="w-5 h-5 text-green-900 dark:text-green-300" />
                    </div>
                  </div>
                  <p className="text-4xl font-bold text-green-900 dark:text-green-100">{totalEvents}</p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-2 font-medium">Event Types</p>
                </div>
              </div>

              {/* Events (24h) */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-500/20 dark:to-orange-600/10 rounded-xl p-6 border border-orange-200 dark:border-orange-500/30 relative overflow-hidden">
                <div className="absolute top-2 right-2 opacity-10">
                  <Activity className="w-16 h-16 text-orange-900 dark:text-orange-400" />
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-orange-200 dark:bg-orange-500/30 rounded-lg">
                      <Activity className="w-5 h-5 text-orange-900 dark:text-orange-300" />
                    </div>
                    {realtimeStats?.totalEvents > 0 && (
                      <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400 animate-pulse" />
                    )}
                  </div>
                  <p className="text-4xl font-bold text-orange-900 dark:text-orange-100">
                    {realtimeStats?.totalEvents?.toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-400 mt-2 font-medium">Events (24h)</p>
                </div>
              </div>
            </div>
          )}

          {/* Site Preview - Only if URL exists */}
          {schema?.siteUrl && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Live Site Preview</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{schema.siteUrl}</p>
                </div>
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded transition-colors ${previewDevice === 'mobile' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                    title="Mobile"
                  >
                    <Smartphone className={`w-4 h-4 ${previewDevice === 'mobile' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                  </button>
                  <button
                    onClick={() => setPreviewDevice('desktop')}
                    className={`p-1.5 rounded transition-colors ${previewDevice === 'desktop' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                    title="Desktop"
                  >
                    <Monitor className={`w-4 h-4 ${previewDevice === 'desktop' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                  </button>
                </div>
              </div>
              <div className="h-[500px]">
                <SitePreviewSandbox
                  selectedRepo={null}
                  previewDevice={previewDevice}
                  schema={schema}
                />
              </div>
            </div>
          )}

          {/* UI Graph Visualization - Full Width */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">User Journey Flow</h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Interactive map with real-time traffic heat maps</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {schema?.uiGraph && appKey ? (
                <UIGraphWithTraffic uiGraph={schema.uiGraph} appKey={appKey} />
              ) : schema?.uiGraph ? (
                <UIGraphWithTraffic uiGraph={schema.uiGraph} appKey={appKey || 'demo'} />
              ) : (
                <div className="flex flex-col items-center justify-center h-96 text-center p-6">
                  <div className="bg-blue-50 dark:bg-blue-500/20 rounded-full p-4 mb-4">
                    <Activity className="w-16 h-16 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">UI Graph Not Available</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mb-6">
                    The UI graph is generated during onboarding when we analyze your app's codebase. 
                    Complete the onboarding flow to see your user journey visualization with real-time traffic heat maps.
                  </p>
                  <button
                    onClick={() => window.location.href = '/onboarding'}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Activity className="w-5 h-5" />
                    Start Onboarding
                  </button>
                  <p className="text-xs text-gray-500 mt-4 max-w-sm">
                    Onboarding analyzes your repository structure, detects pages and components, 
                    and generates an interactive map of your application flow
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Feature Preview - Show when no schema */}
          {!schema && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-12 text-center shadow-sm">
              <BarChart3 className="w-20 h-20 text-blue-600 mx-auto mb-6" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">Complete Onboarding</h2>
              <p className="text-gray-600 max-w-2xl mx-auto mb-8">
                Get a bird's eye view of your analytics with top-level metrics, AI-generated insights, user journey flows, and real-time app previews.
              </p>
              
              {/* Feature Preview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto mt-8">
                <FeatureCard
                  icon={TrendingUp}
                  title="Key Metrics"
                  description="Top-level performance indicators"
                />
                <FeatureCard
                  icon={Users}
                  title="User Insights"
                  description="Behavior patterns and trends"
                />
                <FeatureCard
                  icon={Activity}
                  title="Journey Flows"
                  description="Visual user path analysis"
                />
                <FeatureCard
                  icon={Zap}
                  title="AI Insights"
                  description="Automated recommendations"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <Icon className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-3" />
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}

