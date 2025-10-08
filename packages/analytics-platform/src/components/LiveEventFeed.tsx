'use client';

import { useState, useEffect, useRef } from 'react';

interface AnalyticsEvent {
  id: string;
  event_type: string;
  app_key: string;
  user_id: string | null;
  session_id: string;
  ts: number;
  data: Record<string, any>;
}

interface LiveEventFeedProps {
  appKey: string;
}

export default function LiveEventFeed({ appKey }: LiveEventFeedProps) {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [filterEventType, setFilterEventType] = useState<string>('all');
  const [eventTypes, setEventTypes] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!appKey || isPaused) return;

    // Clear events when filter changes to avoid mixing different event types
    setEvents([]);
    
    // Connect to SSE endpoint
    const serviceUrl = process.env.NEXT_PUBLIC_ANALYTICS_SERVICE_URL || 'http://localhost:8082';
    const jitter = Math.floor(Math.random() * 1000);
    let url = `${serviceUrl}/events/stream?app_key=${appKey}&_=${Date.now()}-${jitter}`;
    
    // Add event_type filter if not 'all'
    if (filterEventType !== 'all') {
      url += `&event_type=${encodeURIComponent(filterEventType)}`;
    }
    
    const eventSource = new EventSource(url);
    
    eventSource.onopen = () => {
      console.log('✅ SSE connection opened');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        console.log('📨 Received SSE message:', event.data.substring(0, 100));
        const data = JSON.parse(event.data);
        
        // Filter out heartbeat messages
        if (data.type === 'event') {
          console.log('📊 Processing event:', data.event.event_type, data.event.id);
          setEvents((prev) => {
            const next = [data.event, ...prev];
            try {
              localStorage.setItem('live_events_cache', JSON.stringify(next.slice(0, 100)));
            } catch (cacheError) {
              console.warn('Unable to cache events locally:', cacheError);
            }
            return next.slice(0, 100);
          });
          // Track unique event types for filter
          setEventTypes((prev) => new Set([...Array.from(prev), data.event.event_type]));
        } else if (data.type === 'connected') {
          console.log('🔗 Connection confirmed:', data.app_key);
        }
      } catch (error) {
        console.error('❌ Error parsing event:', error, 'Raw data:', event.data);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE error:', error);
      console.log('EventSource readyState:', eventSource.readyState);
      setIsConnected(false);
    };

    eventSourceRef.current = eventSource;

    // Cleanup on unmount
    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [appKey, isPaused, filterEventType]);

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  const handleClear = () => {
    setEvents([]);
    setEventTypes(new Set());
    setFilterEventType('all');
  };

  // Filter events based on selected type
  const filteredEvents = filterEventType === 'all' 
    ? events 
    : events.filter(e => e.event_type === filterEventType);

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header with controls */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium text-gray-700">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              {events.length} events
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Events ({events.length})</option>
              {Array.from(eventTypes).sort().map((type) => (
                <option key={type} value={type}>
                  {type} ({events.filter(e => e.event_type === type).length})
                </option>
              ))}
            </select>
            
            <button
              onClick={handlePauseResume}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Events list */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {events.length === 0 ? (
              <>
                <p>No events yet. Waiting for incoming events...</p>
                <p className="text-sm mt-2">App Key: {appKey}</p>
                <button
                  onClick={() => {
                    setFilterEventType('all');
                    setEvents([]);
                  }}
                  className="mt-4 px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50"
                >
                  Refresh
                </button>
              </>
            ) : (
              <>
                <p>No events match the selected filter.</p>
                <button
                  onClick={() => setFilterEventType('all')}
                  className="mt-4 px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50"
                >
                  Clear filter
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((event) => (
              <div key={event.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Event Type Badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {event.event_type}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {new Date(event.ts).toLocaleString()}
                      </span>
                    </div>

                    {/* User and Session Info */}
                    <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                      {event.user_id && (
                        <span>
                          <span className="font-medium">User:</span> {event.user_id}
                        </span>
                      )}
                      <span>
                        <span className="font-medium">Session:</span> {event.session_id}
                      </span>
                    </div>

                    {/* Event Data */}
                    {Object.keys(event.data).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          View data ({Object.keys(event.data).length} fields)
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>

                  {/* Event ID */}
                  <div className="text-xs text-gray-400 font-mono ml-4">
                    #{event.id.slice(0, 8)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

