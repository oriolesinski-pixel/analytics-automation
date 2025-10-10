'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useDataContractsStore } from '@/lib/useDataContractsStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface Event {
  id: string;
  name: string;
  trigger: {
    description: string;
    selector: string;
    type: string;
  };
  frequency: string;
  fields: {
    id: string;
    name: string;
    extraction: {
      source: string;
    };
    sampleValues: string[];
  }[];
  sampleEvents: any[];
  components: string[];
}

interface Page {
  path: string;
  route: string;
  components: string[];
  widgets: string[];
  eventCount?: number;
}

interface PageEventsViewProps {
  page: Page;
  pageId: string;
  appKey: string;
}

export function PageEventsView({ page, pageId, appKey }: PageEventsViewProps) {
  const { setSelectedPageId, setEditingEvent } = useDataContractsStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPageEvents();
  }, [pageId, appKey]);

  const fetchPageEvents = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/apps/${appKey}/pages/${pageId}/events`
      );
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error fetching page events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testEvent = async (event: Event) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/apps/${appKey}/events/${event.id}/test`,
        {
          method: 'POST',
        }
      );
      if (response.ok) {
        const result = await response.json();
        console.log('Test result:', result);
        // TODO: Show toast notification
      }
    } catch (error) {
      console.error('Error testing event:', error);
    }
  };

  const editEvent = (event: Event) => {
    setEditingEvent(event);
  };

  const addNewEvent = () => {
    // Create a new empty event
    const newEvent: Event = {
      id: 'new',
      name: 'NEW_EVENT',
      trigger: {
        description: 'Describe when this event fires',
        selector: 'button',
        type: 'click',
      },
      frequency: '0',
      fields: [],
      sampleEvents: [],
      components: page.components || [],
    };
    setEditingEvent(newEvent);
  };

  const totalEvents = events.reduce((sum, event) => {
    const freq = parseInt(event.frequency) || 0;
    return sum + freq;
  }, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={() => setSelectedPageId(null)}
        className="gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Graph
      </Button>

      {/* Page Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Events on {page.route || page.path}
        </h2>
        <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span>
            Components: {(page.components || page.widgets || []).join(', ') || 'None'}
          </span>
          <span>•</span>
          <span>{totalEvents} events/day</span>
          <span>•</span>
          <span>{events.length} event types</span>
        </div>
      </div>

      {/* Event Cards */}
      <div className="space-y-4">
        {events.map((event) => (
          <Card key={event.id} className="overflow-hidden">
            <CardHeader className="bg-gray-50 dark:bg-gray-800/50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {event.name}
                    </h3>
                    <Badge variant="secondary">{event.frequency} events/day</Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Fires when: {event.trigger.description}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => testEvent(event)}
                  >
                    Test
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => editEvent(event)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Fields List */}
              <div className="space-y-3 mb-4">
                <p className="font-medium text-sm text-gray-700 dark:text-gray-300">
                  Fields ({event.fields.length}):
                </p>
                {event.fields.length > 0 ? (
                  event.fields.map((field) => (
                    <div 
                      key={field.id}
                      className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <code className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {field.name}
                        </code>
                        <span className="text-gray-400">:</span>
                        <code className="font-mono text-gray-600 dark:text-gray-400">
                          {field.extraction.source}
                        </code>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        Sample: {field.sampleValues.slice(0, 3).join(', ') || 'No samples yet'}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">No fields defined yet</p>
                )}
              </div>

              {/* Sample Events Accordion */}
              {event.sampleEvents.length > 0 && (
                <Accordion type="single" collapsible>
                  <AccordionItem value="samples">
                    <AccordionTrigger className="text-sm font-medium">
                      Recent Events (Last 24h)
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {event.sampleEvents.map((e, i) => (
                          <div
                            key={i}
                            className="bg-gray-900 dark:bg-gray-950 rounded-lg p-3 font-mono text-xs"
                          >
                            <div className="text-gray-400 mb-2">
                              {new Date(e.timestamp).toLocaleString()}
                            </div>
                            <pre className="text-green-400 overflow-x-auto">
                              {JSON.stringify(e.properties, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add New Event Button */}
      <Button 
        variant="outline" 
        onClick={addNewEvent}
        className="w-full gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Event
      </Button>
    </div>
  );
}

