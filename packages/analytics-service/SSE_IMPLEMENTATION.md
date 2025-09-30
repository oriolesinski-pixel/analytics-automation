# SSE-based Event Ingestion API

## Overview
Server-Sent Events (SSE) implementation for real-time analytics event streaming in the analytics-service.

## Architecture

### Files Created

#### 1. `src/utils/supabase.ts`
- Singleton Supabase client
- `getSupabaseClient()` - Returns configured Supabase instance
- `insertEvents(events)` - Batch insert function for analytics events
- Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

#### 2. `src/utils/event-bus.ts`
- Global EventEmitter for SSE broadcasting
- `broadcast(event)` - Broadcasts events to all subscribed clients
- `subscribe(app_key, callback, session_id?)` - Subscribe to events with cleanup function
- `getListenerCount(app_key, session_id?)` - Debug helper
- Channel format: `event:{app_key}` or `event:{app_key}:{session_id}`
- Max listeners: 1000 concurrent connections

#### 3. `src/utils/validation.ts`
- Zod schemas for type-safe validation
- `AnalyticsEventSchema` - Single event validation
- `IngestRequestSchema` - Batch ingest validation
- `StreamQuerySchema` - SSE query parameter validation
- `validateIngestRequest(data)` - Helper function with detailed error reporting

#### 4. `src/routes/health.ts`
- Simple health check endpoint
- `GET /health` → `{ status: 'ok' }`

#### 5. `src/routes/ingest.ts` (Updated)
- **POST /ingest/analytics** - Event ingestion with SSE broadcasting
  - Rate limiting: 100 requests/minute per IP
  - Zod validation
  - Batch insert to `analytics_product_events`
  - Real-time broadcasting to SSE clients
  - Returns: `{ ok, received, stored, errors }`
  
- **GET /sandbox** - Interactive test UI
  - Send test events
  - Connect to live SSE stream
  - View real-time events

#### 6. `src/routes/events.ts` (New)
- **GET /events/stream** - SSE endpoint
  - Query params: `app_key` (required), `session_id` (optional)
  - SSE headers with no-cache
  - 30-second heartbeat interval
  - Automatic cleanup on disconnect
  - Filters events by app_key and optional session_id

#### 7. `src/server.ts` (Updated)
- CORS configured with `origin: '*'` for SSE compatibility
- Registered new routes: `healthRoutes`, `eventsRoutes`
- Graceful shutdown handlers (SIGTERM, SIGINT)
- Updated startup banner with new endpoints

## API Endpoints

### 1. POST /ingest/analytics
**Request:**
```json
{
  "app_key": "test-app-rich",
  "events": [
    {
      "id": "evt-123",
      "event_type": "PAGE_VIEW",
      "user_id": "user-456",
      "session_id": "session-789",
      "ts": 1727712000000,
      "data": {
        "url": "/products",
        "title": "Products Page"
      }
    }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "received": 1,
  "stored": 1,
  "errors": [],
  "message": "Successfully stored 1 events"
}
```

**Features:**
- ✅ Zod validation
- ✅ Rate limiting (100/min per IP)
- ✅ Batch insert to Supabase
- ✅ Real-time SSE broadcasting
- ✅ Automatic timestamp normalization
- ✅ UUID generation for missing IDs

### 2. GET /events/stream
**Query Parameters:**
- `app_key` (required) - Filter by application
- `session_id` (optional) - Filter by session

**SSE Stream Format:**
```
data: {"type":"connected","app_key":"test-app-rich","session_id":null}

data: {"id":"evt-123","event_type":"PAGE_VIEW","app_key":"test-app-rich",...}

data: heartbeat
```

**Features:**
- ✅ Real-time event streaming
- ✅ 30-second heartbeat
- ✅ Automatic reconnection support
- ✅ Session-specific filtering
- ✅ Clean disconnect handling

### 3. GET /health
**Response:**
```json
{
  "status": "ok"
}
```

## Database Schema

Table: `analytics_product_events`

```typescript
interface AnalyticsEvent {
  id: string;              // UUID
  event_type: string;      // e.g., "PAGE_VIEW", "BUTTON_CLICK"
  app_key: string;         // Application identifier
  user_id: string;         // User identifier
  session_id: string;      // Session identifier
  ts: number;              // Timestamp in milliseconds
  data: Record<string, any>; // Additional event data
}
```

## Rate Limiting

- **Limit:** 100 requests per minute per IP
- **Window:** 60 seconds (rolling)
- **Implementation:** In-memory Map with automatic cleanup
- **Response:** 429 Too Many Requests when exceeded

## SSE Flow

1. Client connects to `/events/stream?app_key=xxx`
2. Server validates query params
3. Server sends SSE headers and connection confirmation
4. Server subscribes to EventEmitter for app_key
5. Events are broadcast in real-time when ingested
6. Heartbeat sent every 30 seconds
7. On disconnect, cleanup handler unsubscribes and clears intervals

## Testing

### Using the Sandbox UI
1. Start the service: `npm run dev`
2. Visit: `http://localhost:8082/sandbox`
3. Send test events via the form
4. Connect to live stream to see real-time updates

### Using curl

**Send Event:**
```bash
curl -X POST http://localhost:8082/ingest/analytics \
  -H "Content-Type: application/json" \
  -d '{
    "app_key": "test-app-rich",
    "events": [{
      "id": "test-1",
      "event_type": "PAGE_VIEW",
      "user_id": "user-123",
      "session_id": "session-456",
      "ts": 1727712000000,
      "data": {"url": "/test"}
    }]
  }'
```

**Stream Events:**
```bash
curl -N http://localhost:8082/events/stream?app_key=test-app-rich
```

### Using JavaScript

**EventSource Client:**
```javascript
const eventSource = new EventSource(
  'http://localhost:8082/events/stream?app_key=test-app-rich'
);

eventSource.onmessage = (e) => {
  if (e.data === 'heartbeat') {
    console.log('💓 heartbeat');
  } else {
    const event = JSON.parse(e.data);
    console.log('Event received:', event);
  }
};

eventSource.onerror = () => {
  console.error('Connection error');
  eventSource.close();
};
```

## Environment Variables

Required in `.env`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANALYTICS_PORT=8082
```

## Dependencies

Already present in `package.json`:
- `@supabase/supabase-js`: ^2.57.4
- `@fastify/cors`: ^9.0.1
- `zod`: ^3.23.8
- `fastify`: ^4.28.1

## Production Considerations

1. **Rate Limiting**: Currently in-memory; consider Redis for distributed systems
2. **SSE Connections**: Monitor max listeners (currently 1000)
3. **Heartbeat**: 30s default; adjust based on network conditions
4. **CORS**: Set to `*`; restrict in production if needed
5. **Error Handling**: All errors logged; consider error tracking service
6. **Cleanup**: Graceful shutdown handlers ensure SSE cleanup

## Next Steps

- [ ] Add authentication/API key validation
- [ ] Implement Redis-based rate limiting for horizontal scaling
- [ ] Add metrics collection (connection count, event throughput)
- [ ] Set up monitoring and alerting
- [ ] Add event replay capability
- [ ] Implement event filtering by event_type
