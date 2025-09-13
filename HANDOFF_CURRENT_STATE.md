# LLM Handoff: Analytics Tracker Generator - Tested Component

## Proven Working System
The **backend tracker generation service** successfully creates browser-compatible analytics trackers on demand.

### Core Tested Component
**Tracker Generator Service** (Backend Port 8080)
- **Location**: `packages/connector-service/src/lib/tracker-generator.ts`
- **Input**: POST request with app configuration
- **Output**: `tracker.js` - UMD-format JavaScript file
- **Status**: ✅ Fully tested and operational
- **Generated Tracker sends to**: `http://localhost:8080/ingest/analytics`

### Generated Tracker Capabilities (Verified)
- Session management with localStorage
- Event batching (10 events or 30-second intervals)
- Retry logic with exponential backoff
- Automatic page view tracking
- Custom event tracking with props
- User identification

### Current Working State
Successfully implemented an analytics tracker generator that creates JavaScript tracking code for any frontend framework. The system analyzes repositories, generates tracking schemas, and produces ready-to-deploy tracking files.

### Infrastructure Overview
**Core Components:**
1. **Analyzer Service** (`packages/analyzer/`)
   * Clones and analyzes GitHub repositories
   * Detects frameworks, routes, and file structures
   * Stores analysis in Supabase

2. **Connector Service** (`packages/connector-service/`)
   * REST API on port 8080
   * Endpoints: `/analyze`, `/tracker/generate-from-analysis`
   * Integrates with Claude API for code generation

3. **Tracker Generator** (`src/lib/tracker-generator.ts`)
   * Generates pure JavaScript (no TypeScript conversion issues)
   * Creates UMD bundles for browser compatibility
   * Includes session management, metadata tracking, retry logic
   * Outputs ready-to-deploy files

**Data Flow:**
GitHub Repo → Analyzer → Supabase → Schema Generation → Tracker Generator → Ready Files

### File Output Structure
parsed-results/
└── {repo-id}/
    └── {timestamp}/
        └── ready-to-deploy/
            ├── tracker.js      (UMD bundle for browsers)
            ├── Analytics.tsx   (React component)
            ├── window.d.ts     (TypeScript definitions)
            └── README.md       (Integration guide)

### Recent Fixes
* Switched from TypeScript to JavaScript generation (avoiding conversion issues)
* Added `app_key` to request payloads
* Implemented retry limits to prevent infinite loops
* Added session management with UUID generation
* Included comprehensive metadata (user agent, viewport, referrer)

### Technical Debt to Address
* Multiple analyzer implementations need consolidation
* Hardcoded paths should use environment variables
* Missing comprehensive error handling in some modules
* No test coverage for generated tracker code
* Dependency on local file paths
* `demo-next` is at root level instead of in packages/

### Key Files for New Session
/packages/connector-service/src/lib/tracker-generator.ts  (main generator)
/packages/connector-service/src/lib/detectFrameworks.ts   (framework detection)
/packages/analyzer/src/analyzer.ts                        (repo analysis)
/packages/connector-service/src/server.ts                 (API endpoints)

### Environment Requirements
* Node.js with TypeScript
* Supabase credentials
* Claude API key (Anthropic)
* GitHub access token

## IMPORTANT: DO NOT MODIFY
The tracker generator (`packages/connector-service/src/lib/tracker-generator.ts`) is production-ready and tested. Do not modify this file.

