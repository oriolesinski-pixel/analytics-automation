import { EventEmitter } from 'events';

interface AnalyticsEvent {
  id: string;
  event_type: string;
  app_key: string;
  user_id: string;
  session_id: string;
  ts: number;
  data: Record<string, any>;
}

// Create a global event bus for SSE broadcasting
const eventBus = new EventEmitter();

// Increase max listeners to handle many SSE connections
eventBus.setMaxListeners(1000);

/**
 * Broadcast an event to all SSE listeners
 */
export function broadcast(event: AnalyticsEvent): void {
  // Emit to app_key channel
  eventBus.emit(`event:${event.app_key}`, event);
  
  // Emit to session-specific channel if session_id exists
  if (event.session_id) {
    eventBus.emit(`event:${event.app_key}:${event.session_id}`, event);
  }
}

/**
 * Subscribe to events for a specific app_key and optional session_id
 */
export function subscribe(
  app_key: string,
  callback: (event: AnalyticsEvent) => void,
  session_id?: string
): () => void {
  const channel = session_id 
    ? `event:${app_key}:${session_id}`
    : `event:${app_key}`;

  eventBus.on(channel, callback);

  // Return cleanup function
  return () => {
    eventBus.off(channel, callback);
  };
}

/**
 * Get current listener count (for debugging)
 */
export function getListenerCount(app_key: string, session_id?: string): number {
  const channel = session_id 
    ? `event:${app_key}:${session_id}`
    : `event:${app_key}`;
  return eventBus.listenerCount(channel);
}

export default eventBus;

