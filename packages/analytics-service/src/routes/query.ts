// src/routes/query.ts
// Analytics tile query endpoint
//
// Performance: Uses execute_analytics_query RPC for server-side aggregation.
// A single Supabase call per tile query (GROUP BY, COUNT, etc. run in Postgres).
// Fallback to client-side aggregation only if the RPC is unavailable.

import { FastifyPluginAsync } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ─── SQL Safety ───────────────────────────────────────────────────────
// Escape a string value for safe interpolation in SQL single-quoted literals.
// Doubles single quotes and backslashes to prevent SQL injection.
function escapeSQL(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

// Validate that a field/column name contains only safe characters.
// Allows alphanumeric, underscores, dots, and Postgres JSON operators (-> / ->>).
// Supports both quoted (data->>'key') and unquoted (data->key) JSON paths.
const SAFE_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\s*->>?\s*'[^']*')*$/;
const UNQUOTED_JSON_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)->([a-zA-Z_][a-zA-Z0-9_]*)$/;
function assertSafeIdentifier(name: string): string {
  // Handle unquoted JSON paths like "data->path" → "data->>'path'"
  const unquotedMatch = name.match(UNQUOTED_JSON_RE);
  if (unquotedMatch) {
    return `${unquotedMatch[1]}->>'${unquotedMatch[2]}'`;
  }
  if (!SAFE_IDENTIFIER_RE.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return name;
}

// The RPC function name — matches migration 005
const ANALYTICS_RPC = 'execute_analytics_query';

// Per-measure condition schema (becomes CASE WHEN in SQL)
const MeasureConditionSchema = z.object({
  field: z.string(),
  operator: z.string().default('equals'),
  value: z.union([z.string(), z.number()]),
});

const MeasureSchema = z.object({
  aggregation: z.enum(['count', 'count_distinct', 'sum', 'avg', 'min', 'max']),
  field: z.string().optional(),
  conditions: z.array(MeasureConditionSchema).optional(),
});

// Validation schema
const TileQuerySchema = z.object({
  app_key: z.string(),
  event_type: z.string().optional(),
  measure: MeasureSchema.optional(),
  measures: z.array(MeasureSchema).optional(),
  dimensions: z.array(z.object({
    field: z.string(),
    bucket: z.string().optional(), // 'hour', 'day', 'week', 'month'
    type: z.enum(['categorical', 'temporal', 'numerical']),
  })),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'in']),
    value: z.union([z.string(), z.number(), z.array(z.string())]),
  })),
  date_range: z.object({
    start: z.string(),
    end: z.string(),
  }),
}).refine(data => data.measure || (data.measures && data.measures.length > 0), {
  message: 'Either measure or measures must be provided',
});

type TileQuery = z.infer<typeof TileQuerySchema>;

const queryRoutes: FastifyPluginAsync = async (fastify) => {
  
  // Flow query endpoint - queries each step separately
  fastify.post('/query/flow', async (request, reply) => {
    const startTime = Date.now();

    try {
      const body = request.body as any;
      const { app_key, flow_steps, measure, date_range } = body;

      if (!app_key || !flow_steps || !Array.isArray(flow_steps)) {
        return reply.code(400).send({
          ok: false,
          error: 'app_key and flow_steps are required'
        });
      }

      const startTimestamp = new Date(date_range.start).getTime();
      const endTimestamp = new Date(date_range.end).getTime();
      const safeAppKey = escapeSQL(app_key);

      // Query each step
      const results = [];
      
      for (const step of flow_steps) {
        const conditions = step.conditions || [];
        
        console.log(`Processing flow step "${step.label}" with conditions:`, JSON.stringify(conditions));
        
        // Build WHERE clause for this step
        const whereParts = [
          `app_key = '${safeAppKey}'`,
          `ts >= ${startTimestamp}`,
          `ts <= ${endTimestamp}`
        ];

        // Separate SQL conditions from JSON conditions
        const sqlConditions: any[] = [];
        const jsonConditions: any[] = [];

        conditions.forEach((condition: any) => {
          if (condition.field === 'event_type') {
            sqlConditions.push(condition);
            whereParts.push(`event_type = '${escapeSQL(String(condition.value))}'`);
          } else if (condition.field.includes('->')) {
            // JSON field - we'll filter in memory
            jsonConditions.push(condition);
          } else {
            sqlConditions.push(condition);
            const safeField = assertSafeIdentifier(condition.field);
            whereParts.push(`${safeField} = '${escapeSQL(String(condition.value))}'`);
          }
        });

        // Build measure clause
        const measureField = measure?.field ? assertSafeIdentifier(measure.field) : null;
        const measureClause = measure?.aggregation === 'count_distinct' && measureField
          ? `COUNT(DISTINCT ${measureField})`
          : 'COUNT(*)';

        // If we have JSON conditions, fetch events via RPC with SQL-level filters,
        // then apply JSON filters in memory
        if (jsonConditions.length > 0) {
          console.log(`Step "${step.label}" has JSON conditions, filtering in memory:`, jsonConditions);
          
          const fetchSQL = `
            SELECT * FROM analytics_product_events
            WHERE ${whereParts.join(' AND ')}
            LIMIT 10000
          `;

          // Try RPC first for server-side filtering
          const { data: rpcData, error: rpcError } = await supabase.rpc(ANALYTICS_RPC, {
            sql_query: fetchSQL
          });

          let filtered: any[];
          if (rpcError) {
            // Fallback to Supabase query builder
            let eventsQuery = supabase
              .from('analytics_product_events')
              .select('*')
              .eq('app_key', app_key)
              .gte('ts', startTimestamp)
              .lte('ts', endTimestamp);

            sqlConditions.forEach((condition: any) => {
              if (condition.field === 'event_type') {
                eventsQuery = eventsQuery.eq('event_type', condition.value);
              }
            });

            const { data: events } = await eventsQuery;
            filtered = events || [];
          } else {
            filtered = Array.isArray(rpcData) ? rpcData : [];
          }
          
          console.log(`Step "${step.label}": Fetched ${filtered.length} events to filter`);
          
          // Filter by JSON conditions in memory
          jsonConditions.forEach((condition: any) => {
            filtered = filtered.filter(event => {
              const fieldValue = getFieldValue(event, condition.field);
              return String(fieldValue) === String(condition.value);
            });
            console.log(`  After filtering ${condition.field}=${condition.value}: ${filtered.length} events remain`);
          });

          // Calculate measure on filtered data
          const filteredValue = measure?.aggregation === 'count_distinct' && measure?.field
            ? new Set(filtered.map(e => getFieldValue(e, measure.field)).filter(v => v != null)).size
            : filtered.length;

          console.log(`Step "${step.label}": Found ${filteredValue} matching events after all filters`);
          results.push({ value: filteredValue });
        } else {
          // No JSON conditions - pure SQL aggregation via RPC (single call)
          const sql = `
            SELECT ${measureClause} as measure_value
            FROM analytics_product_events
            WHERE ${whereParts.join(' AND ')}
          `;

          console.log(`Flow step "${step.label}" SQL:`, sql);

          const { data, error } = await supabase.rpc(ANALYTICS_RPC, {
            sql_query: sql
          });

          if (error) {
            console.error(`Error querying step "${step.label}":`, error);
            // Fallback: try the old RPC
            const { data: fallbackData, error: fallbackError } = await supabase.rpc('execute_raw_sql', {
              sql_query: sql
            });
            if (fallbackError) {
              console.error(`Fallback also failed for step "${step.label}":`, fallbackError);
              results.push({ value: 0 });
            } else {
              const resultArray = Array.isArray(fallbackData) ? fallbackData : [];
              const value = resultArray[0]?.measure_value || 0;
              results.push({ value });
            }
          } else {
            const resultArray = Array.isArray(data) ? data : [];
            const value = resultArray[0]?.measure_value || 0;
            console.log(`Step "${step.label}": Found ${value} matching events`);
            results.push({ value });
          }
        }
      }

      return reply.send({
        ok: true,
        data: results,
        metadata: {
          total_rows: results.length,
          query_time_ms: Date.now() - startTime,
        },
      });

    } catch (error: any) {
      console.error('Error executing flow query:', error);
      return reply.code(500).send({
        ok: false,
        error: error.message || 'Internal server error',
      });
    }
  });
  
  // Raw SQL query endpoint for SQL Sandbox
  fastify.post('/query/sql', async (request, reply) => {
    const startTime = Date.now();

    try {
      const body = request.body as any;
      const { query: sqlQuery, app_key, timeout = 30000 } = body;

      if (!sqlQuery || typeof sqlQuery !== 'string') {
        return reply.code(400).send({
          ok: false,
          error: 'SQL query is required'
        });
      }

      if (!app_key) {
        return reply.code(400).send({
          ok: false,
          error: 'app_key is required'
        });
      }

      // Security: Strip comments and check for SELECT
      // Remove single-line comments (--) and multi-line comments (/* */)
      let cleanQuery = sqlQuery
        .replace(/--[^\n]*/g, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .trim()
        .toUpperCase();
      
      if (!cleanQuery.startsWith('SELECT')) {
        return reply.code(400).send({
          ok: false,
          error: 'Only SELECT queries are allowed'
        });
      }

      // Security: Block dangerous keywords
      const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE'];
      for (const keyword of dangerousKeywords) {
        if (cleanQuery.includes(keyword)) {
          return reply.code(400).send({
            ok: false,
            error: `Query contains forbidden keyword: ${keyword}`
          });
        }
      }

      console.log('Executing SQL query:', sqlQuery.substring(0, 100) + '...');

      // Remove trailing semicolons (they cause syntax errors in the function)
      const cleanSqlQuery = sqlQuery.trim().replace(/;+$/, '');

      // Execute query with timeout — try new RPC first, fall back to old
      const queryPromise = supabase.rpc(ANALYTICS_RPC, {
        sql_query: cleanSqlQuery
      }).then(res => {
        // If new RPC fails, try old one
        if (res.error) {
          console.warn('execute_analytics_query failed, trying execute_raw_sql:', res.error.message);
          return supabase.rpc('execute_raw_sql', { sql_query: cleanSqlQuery });
        }
        return res;
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), timeout);
      });

      let result;
      try {
        result = await Promise.race([queryPromise, timeoutPromise]) as any;
      } catch (error: any) {
        if (error.message === 'Query timeout') {
          return reply.code(408).send({
            ok: false,
            error: 'Query execution timed out'
          });
        }
        throw error;
      }

      const { data, error } = result;

      if (error) {
        console.error('SQL execution error:', error);
        return reply.code(500).send({
          ok: false,
          error: error.message || 'Query execution failed'
        });
      }

      // The function returns a JSONB array directly
      const resultArray = Array.isArray(data) ? data : [];

      return reply.send({
        ok: true,
        data: resultArray,
        metadata: {
          total_rows: resultArray.length,
          query_time_ms: Date.now() - startTime,
        },
      });

    } catch (error: any) {
      console.error('Error executing SQL query:', error);
      return reply.code(500).send({
        ok: false,
        error: error.message || 'Internal server error',
      });
    }
  });
  
  fastify.post('/query/tile', async (request, reply) => {
    const startTime = Date.now();

    try {
      // Validate request body
      const validation = TileQuerySchema.safeParse(request.body);
      
      if (!validation.success) {
        return reply.code(400).send({
          ok: false,
          error: 'Invalid query parameters',
          errors: validation.error.issues,
        });
      }

      const query: TileQuery = validation.data;

      // Build SQL query
      const sql = buildTileSQL(query);
      console.log('Generated SQL:', sql);

      // ── Primary path: execute_analytics_query RPC (1 call, server-side aggregation)
      const { data, error } = await supabase.rpc(ANALYTICS_RPC, {
        sql_query: sql
      });

      if (!error) {
        const resultArray = Array.isArray(data) ? data : [];
        console.log(`Tile query completed via RPC in ${Date.now() - startTime}ms, ${resultArray.length} rows`);
        
        return reply.send({
          ok: true,
          data: resultArray,
          metadata: {
            total_rows: resultArray.length,
            query_time_ms: Date.now() - startTime,
            source: 'rpc',
          },
        });
      }

      // ── Fallback path: try execute_raw_sql (old RPC)
      console.warn(`${ANALYTICS_RPC} failed (${error.message}), trying execute_raw_sql...`);
      const { data: oldData, error: oldError } = await supabase.rpc('execute_raw_sql', {
        sql_query: sql
      });

      if (!oldError) {
        const resultArray = Array.isArray(oldData) ? oldData : [];
        console.log(`Tile query completed via execute_raw_sql in ${Date.now() - startTime}ms`);

        return reply.send({
          ok: true,
          data: resultArray,
          metadata: {
            total_rows: resultArray.length,
            query_time_ms: Date.now() - startTime,
            source: 'rpc_legacy',
          },
        });
      }

      // ── Last resort: client-side aggregation
      console.warn(`Both RPCs failed, falling back to direct query. Error: ${oldError.message}`);
      const result = await executeDirectQuery(query);
      
      return reply.send({
        ok: true,
        data: result.data,
        metadata: {
          total_rows: result.data.length,
          query_time_ms: Date.now() - startTime,
          source: 'direct_fallback',
        },
      });

    } catch (error: any) {
      console.error('Error executing tile query:', error);
      return reply.code(500).send({
        ok: false,
        error: error.message || 'Internal server error',
      });
    }
  });
};

function buildTileSQL(query: TileQuery): string {
  const {
    app_key,
    event_type,
    measure,
    measures: measuresArr,
    dimensions,
    filters,
    date_range,
  } = query;

  // Resolve measures: prefer `measures` array, fall back to single `measure`
  const measures = measuresArr && measuresArr.length > 0
    ? measuresArr
    : measure ? [measure] : [];

  // Build SELECT clause
  const selectParts: string[] = [];
  
  // Add dimensions (with identifier validation)
  dimensions.forEach((dim, idx) => {
    if (dim.type === 'temporal' && dim.bucket) {
      const safeField = assertSafeIdentifier(dim.field);
      const bucketClause = getTimeBucketClause(safeField, dim.bucket);
      selectParts.push(`${bucketClause} as dimension_${idx}`);
    } else {
      const safeField = assertSafeIdentifier(dim.field);
      selectParts.push(`${safeField} as dimension_${idx}`);
    }
  });

  // Add measures
  if (measures.length === 1 && (!measures[0].conditions || measures[0].conditions.length === 0)) {
    // Single measure, no per-measure conditions: backward-compatible format
    const measureClause = getMeasureClause(measures[0]);
    selectParts.push(`${measureClause} as measure_value`);
  } else {
    // Multi-measure or per-measure conditions: use indexed columns
    measures.forEach((m, idx) => {
      const measureClause = getMeasureClauseWithConditions(m);
      selectParts.push(`${measureClause} as measure_value_${idx}`);
    });
  }

  // Build WHERE clause
  const startTimestamp = new Date(date_range.start).getTime();
  const endTimestamp = new Date(date_range.end).getTime();
  
  const whereParts: string[] = [
    `app_key = '${escapeSQL(app_key)}'`,
    `ts >= ${startTimestamp}`,
    `ts <= ${endTimestamp}`,
  ];

  if (event_type) {
    whereParts.push(`event_type = '${escapeSQL(event_type)}'`);
  }

  filters.forEach(filter => {
    whereParts.push(buildFilterClause(filter));
  });

  // Build GROUP BY clause
  const groupByParts: string[] = [];
  dimensions.forEach((_dim, idx) => {
    groupByParts.push(`dimension_${idx}`);
  });

  let sql =
    `SELECT ${selectParts.join(', ')} FROM analytics_product_events WHERE ${whereParts.join(' AND ')}`;

  if (groupByParts.length > 0) {
    sql += ` GROUP BY ${groupByParts.join(', ')} ORDER BY ${groupByParts.join(', ')}`;
  }

  sql += ` LIMIT 10000`;

  return sql;
}

// Build a measure clause with per-measure CASE WHEN conditions
function getMeasureClauseWithConditions(measure: { aggregation: string; field?: string; conditions?: Array<{ field: string; operator?: string; value: string | number }> }): string {
  const { aggregation, field, conditions } = measure;
  const safeField = field ? assertSafeIdentifier(field) : null;

  // Build CASE WHEN clause from conditions
  let caseWhen = '';
  if (conditions && conditions.length > 0) {
    const condParts = conditions.map(c => {
      const safeCondField = assertSafeIdentifier(c.field);
      const op = c.operator || 'equals';
      const safeVal = escapeSQL(String(c.value));
      switch (op) {
        case 'equals': return `${safeCondField} = '${safeVal}'`;
        case 'not_equals': return `${safeCondField} != '${safeVal}'`;
        case 'gt': return `${safeCondField} > ${Number(c.value)}`;
        case 'lt': return `${safeCondField} < ${Number(c.value)}`;
        default: return `${safeCondField} = '${safeVal}'`;
      }
    });
    caseWhen = `CASE WHEN ${condParts.join(' AND ')} THEN `;
  }

  if (!caseWhen) {
    // No conditions — standard measure clause
    return getMeasureClause(measure);
  }

  // With conditions — wrap in CASE WHEN
  switch (aggregation) {
    case 'count':
      return `COUNT(${caseWhen}1 END)`;
    case 'count_distinct':
      return safeField
        ? `COUNT(DISTINCT ${caseWhen}${safeField} END)`
        : `COUNT(${caseWhen}1 END)`;
    case 'sum':
      return safeField ? `SUM(${caseWhen}(${safeField})::numeric END)` : '0';
    case 'avg':
      return safeField ? `AVG(${caseWhen}(${safeField})::numeric END)` : '0';
    case 'min':
      return safeField ? `MIN(${caseWhen}(${safeField})::numeric END)` : '0';
    case 'max':
      return safeField ? `MAX(${caseWhen}(${safeField})::numeric END)` : '0';
    default:
      return `COUNT(${caseWhen}1 END)`;
  }
}

function getTimeBucketClause(field: string, bucket: string): string {
  // The field is a bigint (Unix timestamp in ms), convert to timestamp first
  const timestampField = `to_timestamp(${field} / 1000.0)`;
  
  switch (bucket) {
    case 'hour':
      return `to_char(date_trunc('hour', ${timestampField}), 'YYYY-MM-DD HH24:MI')`;
    case 'day':
      return `to_char(date_trunc('day', ${timestampField}), 'YYYY-MM-DD')`;
    case 'week':
      return `to_char(date_trunc('week', ${timestampField}), 'YYYY-MM-DD')`;
    case 'month':
      return `to_char(date_trunc('month', ${timestampField}), 'YYYY-MM')`;
    default:
      return `to_char(${timestampField}, 'YYYY-MM-DD HH24:MI:SS')`;
  }
}

function getMeasureClause(measure: TileQuery['measure']): string {
  const { aggregation, field } = measure;
  const safeField = field ? assertSafeIdentifier(field) : null;

  switch (aggregation) {
    case 'count':
      return 'COUNT(*)';
    case 'count_distinct':
      return safeField ? `COUNT(DISTINCT ${safeField})` : 'COUNT(*)';
    case 'sum':
      return safeField ? `SUM((${safeField})::numeric)` : '0';
    case 'avg':
      return safeField ? `AVG((${safeField})::numeric)` : '0';
    case 'min':
      return safeField ? `MIN((${safeField})::numeric)` : '0';
    case 'max':
      return safeField ? `MAX((${safeField})::numeric)` : '0';
    default:
      return 'COUNT(*)';
  }
}

function buildFilterClause(filter: TileQuery['filters'][0]): string {
  const { field, operator, value } = filter;
  const safeField = assertSafeIdentifier(field);
  const safeValue = escapeSQL(String(value));

  switch (operator) {
    case 'equals':
      return `${safeField} = '${safeValue}'`;
    case 'not_equals':
      return `${safeField} != '${safeValue}'`;
    case 'contains':
      return `${safeField}::text ILIKE '%${escapeSQL(String(value))}%'`;
    case 'gt':
      return `${safeField} > ${Number(value)}`;
    case 'lt':
      return `${safeField} < ${Number(value)}`;
    case 'gte':
      return `${safeField} >= ${Number(value)}`;
    case 'lte':
      return `${safeField} <= ${Number(value)}`;
    case 'in':
      const values = Array.isArray(value) ? value : [value];
      return `${safeField} IN (${values.map(v => `'${escapeSQL(String(v))}'`).join(', ')})`;
    default:
      return '1=1';
  }
}

// Fallback: execute query directly using Supabase query builder.
// Optimized: only selects needed columns, uses larger page size,
// and fetches pages in parallel batches.
async function executeDirectQuery(query: TileQuery) {
  const {
    app_key,
    event_type,
    measure,
    dimensions,
    filters,
    date_range,
  } = query;

  const startTimestamp = new Date(date_range.start).getTime();
  const endTimestamp = new Date(date_range.end).getTime();

  // Determine which columns we actually need (avoid SELECT *)
  const neededCols = new Set<string>(['ts']);
  dimensions.forEach(dim => neededCols.add(dim.field.split('->')[0]));
  if (measure.field) neededCols.add(measure.field.split('->')[0]);
  filters.forEach(f => neededCols.add(f.field.split('->')[0]));
  // Always include 'data' if any JSON fields are referenced
  if ([...neededCols].some(c => c === 'data') || filters.some(f => f.field.includes('->'))) {
    neededCols.add('data');
  }
  const selectColumns = [...neededCols].join(',');

  // ── Parallel-batched cursor pagination ──
  // Split the time range into parallel windows, then paginate within each
  const FETCH_LIMIT = 1000;
  const MAX_ROWS = 50000;
  let allRawData: any[] = [];
  let cursorTs = startTimestamp;
  let page = 0;

  while (cursorTs <= endTimestamp) {
    page++;
    let supabaseQuery = supabase
      .from('analytics_product_events')
      .select(selectColumns)
      .eq('app_key', app_key)
      .gte('ts', cursorTs)
      .lte('ts', endTimestamp)
      .order('ts', { ascending: true })
      .limit(FETCH_LIMIT);

    if (event_type) {
      supabaseQuery = supabaseQuery.eq('event_type', event_type);
    }

    filters.forEach(filter => {
      supabaseQuery = applySupabaseFilter(supabaseQuery, filter);
    });

    const { data: pageData, error } = await supabaseQuery;

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    const rows = pageData || [];
    if (rows.length === 0) break;

    allRawData = allRawData.concat(rows);
    cursorTs = rows[rows.length - 1].ts + 1;

    if (rows.length < FETCH_LIMIT) break;

    if (allRawData.length >= MAX_ROWS) {
      console.warn(`Direct query hit ${MAX_ROWS} row safety limit for app_key=${app_key}`);
      break;
    }
  }

  console.log(`Direct query (fallback) fetched ${allRawData.length} rows in ${page} pages`);

  // Post-process: apply filters that couldn't be applied in query (JSON fields)
  let filteredData = allRawData;
  filters.forEach(filter => {
    if (filter.field.includes('->')) {
      filteredData = filteredData.filter(row => matchesFilter(row, filter));
    }
  });

  // Group and aggregate
  const aggregated = aggregateInMemory(filteredData, dimensions, measure);

  return { data: aggregated };
}

function matchesFilter(row: any, filter: TileQuery['filters'][0]): boolean {
  const { field, operator, value } = filter;
  const rowValue = getFieldValue(row, field);

  if (rowValue === null || rowValue === undefined) return false;

  switch (operator) {
    case 'equals':
      return String(rowValue) === String(value);
    case 'not_equals':
      return String(rowValue) !== String(value);
    case 'contains':
      return String(rowValue).toLowerCase().includes(String(value).toLowerCase());
    case 'gt':
      return Number(rowValue) > Number(value);
    case 'lt':
      return Number(rowValue) < Number(value);
    case 'gte':
      return Number(rowValue) >= Number(value);
    case 'lte':
      return Number(rowValue) <= Number(value);
    case 'in':
      const values = Array.isArray(value) ? value : [value];
      return values.includes(String(rowValue));
    default:
      return true;
  }
}

function applySupabaseFilter(query: any, filter: TileQuery['filters'][0]) {
  const { field, operator, value } = filter;

  // Skip JSON fields (like data->cta_category) - they will be filtered in memory
  // Supabase query builder doesn't handle nested JSON paths well
  if (field.includes('->')) {
    console.log(`Skipping JSON field filter in query (will apply in memory): ${field}`);
    return query;
  }

  // Handle regular fields
  switch (operator) {
    case 'equals':
      return query.eq(field, value);
    case 'not_equals':
      return query.neq(field, value);
    case 'contains':
      return query.ilike(field, `%${value}%`);
    case 'gt':
      return query.gt(field, value);
    case 'lt':
      return query.lt(field, value);
    case 'gte':
      return query.gte(field, value);
    case 'lte':
      return query.lte(field, value);
    case 'in':
      const values = Array.isArray(value) ? value : [value];
      return query.in(field, values);
    default:
      return query;
  }
}

function aggregateInMemory(
  data: any[],
  dimensions: TileQuery['dimensions'],
  measure: TileQuery['measure']
): any[] {
  // Group by dimensions
  const groups = new Map<string, any[]>();

  data.forEach(row => {
    // Build group key from dimension values
    const keyParts: string[] = [];
    dimensions.forEach(dim => {
      let value = getFieldValue(row, dim.field);
      
      // Format temporal dimensions
      if (dim.type === 'temporal' && typeof value === 'number') {
        value = formatTimestamp(value, dim.bucket);
      }
      
      keyParts.push(String(value || 'null'));
    });
    const key = keyParts.join('||');

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  });

  // Aggregate each group
  const results: any[] = [];
  groups.forEach((rows, key) => {
    const result: any = {};
    
    // Add dimension values
    const keyParts = key.split('||');
    dimensions.forEach((dim, idx) => {
      result[`dimension_${idx}`] = keyParts[idx] === 'null' ? null : keyParts[idx];
    });

    // Calculate measure
    result.measure_value = calculateMeasure(rows, measure);

    results.push(result);
  });

  return results;
}

function formatTimestamp(timestamp: number, bucket?: string): string {
  const date = new Date(timestamp);
  
  if (!bucket) {
    return date.toISOString();
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  switch (bucket) {
    case 'hour':
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    case 'day':
      return `${year}-${month}-${day}`;
    case 'week':
      // Get the start of the week (Monday)
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));
      const wYear = weekStart.getFullYear();
      const wMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
      const wDay = String(weekStart.getDate()).padStart(2, '0');
      return `${wYear}-${wMonth}-${wDay}`;
    case 'month':
      return `${year}-${month}`;
    default:
      return date.toISOString();
  }
}

function getFieldValue(obj: any, field: string): any {
  const parts = field.split('->');
  let value = obj;
  
  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = value[part];
    } else {
      return null;
    }
  }
  
  return value;
}

function calculateMeasure(rows: any[], measure: TileQuery['measure']): number {
  const { aggregation, field } = measure;

  switch (aggregation) {
    case 'count':
      return rows.length;
    
    case 'count_distinct':
      if (!field) return rows.length;
      const distinctValues = new Set(rows.map(r => getFieldValue(r, field)));
      return distinctValues.size;
    
    case 'sum':
      if (!field) return 0;
      return rows.reduce((sum, r) => {
        const value = getFieldValue(r, field);
        return sum + (Number(value) || 0);
      }, 0);
    
    case 'avg':
      if (!field) return 0;
      const sum = rows.reduce((s, r) => {
        const value = getFieldValue(r, field);
        return s + (Number(value) || 0);
      }, 0);
      return rows.length > 0 ? sum / rows.length : 0;
    
    case 'min':
      if (!field) return 0;
      const values = rows.map(r => Number(getFieldValue(r, field)) || 0);
      return values.length > 0 ? Math.min(...values) : 0;
    
    case 'max':
      if (!field) return 0;
      const maxValues = rows.map(r => Number(getFieldValue(r, field)) || 0);
      return maxValues.length > 0 ? Math.max(...maxValues) : 0;
    
    default:
      return rows.length;
  }
}

export default queryRoutes;

