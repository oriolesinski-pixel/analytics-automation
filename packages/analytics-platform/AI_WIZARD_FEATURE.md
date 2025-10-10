# AI Analytics Wizard Feature

## Overview

The AI Analytics Wizard is a natural language interface for querying analytics data. Users can ask questions in plain English and receive instant insights with dynamic visualizations powered by Claude AI.

## Architecture

```
┌─────────────────┐
│  User Question  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  AIWizard Component     │
└────────┬────────────────┘
         │
         ├──► 1. Fetch Schema (/api/analytics/[appId]/schema)
         │
         ├──► 2. Send to LLM (/api/ai/query)
         │    - Question + Schema Context
         │    - Returns: {answer, querySpec, vizSpec, suggestions}
         │
         ├──► 3. Validate Query Spec
         │
         ├──► 4. Execute Query (/api/analytics/[appId]/query)
         │
         └──► 5. Render Visualization (DynamicChart)
```

## File Structure

```
/analytics-automation/packages/analytics-platform/src/
├── components/ai-wiz/
│   ├── AIWizard.tsx              # Main container component
│   ├── DynamicChart.tsx          # Dynamic chart renderer
│   └── QuerySpecValidator.ts    # Query validation logic
│
├── app/
│   ├── ai-wiz/
│   │   └── page.tsx              # AI Wizard page
│   │
│   └── api/
│       ├── ai/
│       │   └── query/
│       │       └── route.ts       # LLM integration endpoint
│       │
│       └── analytics/
│           └── [appId]/
│               ├── schema/
│               │   └── route.ts   # Schema endpoint
│               └── query/
│                   └── route.ts   # Query execution endpoint
```

## Components

### 1. AIWizard.tsx

**Purpose:** Main component that orchestrates the entire AI query flow.

**Features:**
- Natural language prompt input with keyboard shortcuts (Cmd+Enter to submit)
- Loading states with skeleton UI
- Error handling with user-friendly messages
- Response display with AI insights and visualizations
- Follow-up question suggestions
- Save to dashboard functionality
- Collapsible query details panel

**Key Props:**
- `appId: string` - The app key to query analytics for

**State Management:**
```typescript
- prompt: string                    // User's question
- isLoading: boolean                // Query in progress
- response: AIWizResponse | null    // AI response with specs
- queryData: any[]                  // Query results
- error: string | null              // Error message if any
```

### 2. DynamicChart.tsx

**Purpose:** Renders visualizations dynamically based on the spec from the LLM.

**Supported Chart Types:**
- **Bar Chart**: Categorical data comparisons (horizontal/vertical)
- **Line Chart**: Temporal trends over time
- **Pie Chart**: Parts of a whole
- **Table**: Raw data display
- **Metric**: Single number display (KPI card)

**Features:**
- Auto-formatting of numbers and labels
- Responsive design with ResponsiveContainer
- Dark mode support
- Empty state handling
- Custom color schemes

### 3. QuerySpecValidator.ts

**Purpose:** Validates LLM-generated query specifications against the analytics schema.

**Validations:**
- Measure exists in schema
- Dimensions are valid
- Filter fields are valid
- Filter operators are supported
- Sort fields are in the query
- Limit is within bounds (1-1000)

**Error Handling:** Throws descriptive errors that help the user understand what went wrong.

## API Routes

### 1. `/api/ai/query` (POST)

**Purpose:** Sends user question + schema to Claude AI and returns structured response.

**Request:**
```json
{
  "question": "What were my top 5 pages last week?",
  "schema": {
    "measures": ["total_events", "unique_users", ...],
    "dimensions": ["hour", "day", "page_path", ...],
    "currentDate": "2025-10-09"
  }
}
```

**Response:**
```json
{
  "naturalLanguageAnswer": "Here are your top 5 pages by traffic last week...",
  "querySpec": {
    "measure": "total_events",
    "dimensions": ["page_path"],
    "filters": [{
      "field": "ts",
      "operator": "between",
      "value": ["2025-10-02", "2025-10-09"]
    }],
    "sort": {
      "field": "total_events",
      "order": "desc"
    },
    "limit": 5
  },
  "visualizationSpec": {
    "type": "bar",
    "xField": "page_path",
    "yField": "total_events",
    "orientation": "horizontal",
    "color": "#6366f1"
  },
  "followUpSuggestions": [
    "What's the bounce rate for these pages?",
    "Compare this to the previous week"
  ]
}
```

**LLM Model:** Claude Sonnet 4 (`claude-sonnet-4-20250514`)

**Temperature:** 0.3 (for consistent, structured output)

### 2. `/api/analytics/[appId]/schema` (GET)

**Purpose:** Returns the available measures and dimensions for an app.

**Response:**
```json
{
  "appId": "my-app-key",
  "measures": [
    {
      "name": "total_events",
      "label": "Total Events",
      "aggregation": "count",
      "field": null,
      "eventTypes": null
    },
    {
      "name": "unique_users",
      "label": "Unique Users",
      "aggregation": "count_distinct",
      "field": "user_id",
      "eventTypes": null
    }
  ],
  "dimensions": [
    {
      "name": "hour",
      "label": "Hour",
      "field": "ts",
      "type": "temporal"
    },
    {
      "name": "page_path",
      "label": "Page Path",
      "field": "data->path",
      "type": "categorical",
      "eventTypes": ["PAGE_VIEW"]
    }
  ]
}
```

### 3. `/api/analytics/[appId]/query` (POST)

**Purpose:** Executes a query against the analytics service and returns data.

**Request:**
```json
{
  "measure": "total_events",
  "dimensions": ["page_path"],
  "filters": [...],
  "sort": { "field": "total_events", "order": "desc" },
  "limit": 5
}
```

**Response:**
```json
{
  "rows": [
    { "page_path": "/home", "total_events": 1523 },
    { "page_path": "/products", "total_events": 987 },
    { "page_path": "/pricing", "total_events": 654 }
  ]
}
```

**Backend:** Proxies to analytics service at `NEXT_PUBLIC_API_URL` (default: `http://localhost:8082`)

## User Flow

1. **Select App**: User selects which app to query from dropdown
2. **Ask Question**: User types natural language question
3. **AI Processing**: 
   - Fetch schema for context
   - Send to Claude with schema
   - Validate response
4. **Execute Query**: Run validated query against analytics service
5. **Display Results**:
   - Natural language insight
   - Dynamic visualization
   - Follow-up suggestions
6. **Save (Optional)**: User can save as dashboard tile

## Example Queries

### Simple Metric
- **Q:** "How many users visited today?"
- **Chart:** Metric card with single number

### Time Series
- **Q:** "Show me page views over the last month"
- **Chart:** Line chart with date on X-axis

### Top N
- **Q:** "What are my top 10 pages by traffic?"
- **Chart:** Horizontal bar chart, sorted descending

### Comparison
- **Q:** "Compare button clicks by CTA type"
- **Chart:** Bar chart with CTA types

### Breakdown
- **Q:** "Show me user distribution by entry type"
- **Chart:** Pie chart

## Styling & UX

### Design Tokens
- **Primary Gradient**: Purple-to-blue (`from-purple-600 to-blue-600`)
- **Insight Card**: Gradient background with border
- **Transitions**: 200ms for all interactive elements
- **Loading State**: Skeleton UI matching final layout

### Keyboard Shortcuts
- `⌘ + Enter` or `Ctrl + Enter`: Submit query
- `⌘ + K` or `Ctrl + K`: Focus input (planned)

### Responsive Design
- Mobile: Stacked layout, full-width components
- Desktop: Side-by-side layouts where appropriate
- Tablet: Optimized middle ground

### Dark Mode
- Full dark mode support throughout
- Theme-aware chart colors
- Accessible contrast ratios

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...           # Claude API key
NEXT_PUBLIC_SUPABASE_URL=https://...   # Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...      # Supabase anon key

# Optional
NEXT_PUBLIC_API_URL=http://localhost:8082  # Analytics service URL
```

### LLM Configuration

Located in `/api/ai/query/route.ts`:

```typescript
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4000,
  temperature: 0.3,  // Lower = more consistent
  system: systemPrompt,
  messages: [{ role: 'user', content: question }]
})
```

## Installation

1. **Install Dependencies**:
   ```bash
   cd analytics-automation/packages/analytics-platform
   npm install
   ```

   The `@anthropic-ai/sdk` package has been added to `package.json`.

2. **Set Environment Variables**:
   Create `.env.local`:
   ```bash
   ANTHROPIC_API_KEY=your_claude_api_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_API_URL=http://localhost:8082
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Access AI Wizard**:
   Navigate to `http://localhost:3002/ai-wiz`

## Future Enhancements

### Conversation History
- Store previous Q&As in session/database
- Allow users to refine previous queries
- Context-aware follow-ups

### Advanced Features
- Export visualization as PNG
- Edit query spec manually (advanced mode)
- Show confidence score from LLM
- Rate responses (thumbs up/down)
- Multi-turn conversations
- Query templates library

### Performance
- Cache schema responses
- Debounce user input
- Streaming LLM responses
- Progressive data loading

### Integrations
- Slack/Teams notifications
- Scheduled reports
- Email insights
- API webhooks

## Troubleshooting

### "Failed to fetch schema"
- Ensure app exists in database
- Check Supabase connection
- Verify app_key is valid

### "Invalid JSON response from AI"
- Check Anthropic API key
- Verify API rate limits
- Review system prompt for clarity

### "Failed to execute query"
- Ensure analytics service is running
- Check NEXT_PUBLIC_API_URL
- Verify query spec format

### Charts not rendering
- Ensure recharts is installed
- Check data format matches spec
- Verify field names in data

## Testing

### Manual Testing Checklist
- [ ] App selection dropdown works
- [ ] Prompt input accepts text
- [ ] Cmd+Enter submits query
- [ ] Loading skeleton appears
- [ ] Error states display correctly
- [ ] Charts render for each type
- [ ] Follow-ups are clickable
- [ ] Save to dashboard works
- [ ] Dark mode styling works
- [ ] Mobile responsive layout

### Edge Cases
- [ ] Empty data handling
- [ ] Invalid queries
- [ ] LLM errors
- [ ] Network failures
- [ ] Missing environment variables

## Performance Metrics

**Target Latencies:**
- Schema fetch: < 100ms
- LLM response: < 3s
- Query execution: < 1s
- Total end-to-end: < 5s

**Optimization Strategies:**
- Client-side schema caching
- Query result caching
- Optimistic UI updates
- Request deduplication

## Security

- All API routes validate input
- Query specs are validated against schema
- No SQL injection risk (using query builder)
- Rate limiting recommended for production
- API keys stored in environment variables

## Dependencies

- `@anthropic-ai/sdk@^0.32.1` - Claude AI integration
- `recharts@^2.15.4` - Chart rendering
- `lucide-react@^0.543.0` - Icons
- `next@^14.2.32` - Framework
- `@supabase/supabase-js@^2.38.0` - Database

## License

Part of the Analytics E2E Automation project.

