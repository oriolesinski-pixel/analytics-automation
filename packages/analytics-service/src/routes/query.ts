// src/routes/query.ts
// Analytics tile query endpoint

import { FastifyPluginAsync } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Validation schema
const TileQuerySchema = z.object({
  app_key: z.string(),
  event_type: z.string().optional(),
  measure: z.object({
    aggregation: z.enum(['count', 'count_distinct', 'sum', 'avg', 'min', 'max']),
    field: z.string().optional(),
  }),
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
});

type TileQuery = z.infer<typeof TileQuerySchema>;

const queryRoutes: FastifyPluginAsync = async (fastify) => {
  
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

      // Execute query with timeout
      const queryPromise = supabase.rpc('execute_raw_sql', {
        sql_query: cleanSqlQuery
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

      // Execute query
      const { data, error } = await supabase.rpc('execute_tile_query', {
        query_sql: sql
      });

      if (error) {
        console.error('Query execution error:', error);
        // If the RPC doesn't exist, fall back to direct query
        const result = await executeDirectQuery(query);
        
        return reply.send({
          ok: true,
          data: result.data,
          metadata: {
            total_rows: result.data.length,
            query_time_ms: Date.now() - startTime,
          },
        });
      }

      return reply.send({
        ok: true,
        data: data || [],
        metadata: {
          total_rows: data?.length || 0,
          query_time_ms: Date.now() - startTime,
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
    dimensions,
    filters,
    date_range,
  } = query;

  // Build SELECT clause
  const selectParts: string[] = [];
  
  // Add dimensions
  dimensions.forEach((dim, idx) => {
    if (dim.type === 'temporal' && dim.bucket) {
      // Time bucketing
      const bucketClause = getTimeBucketClause(dim.field, dim.bucket);
      selectParts.push(`${bucketClause} as dimension_${idx}`);
    } else {
      // Regular dimension
      selectParts.push(`${dim.field} as dimension_${idx}`);
    }
  });

  // Add measure
  const measureClause = getMeasureClause(measure);
  selectParts.push(`${measureClause} as measure_value`);

  // Build WHERE clause
  // The ts column is bigint (Unix timestamp in milliseconds)
  const startTimestamp = new Date(date_range.start).getTime();
  const endTimestamp = new Date(date_range.end).getTime();
  
  const whereParts: string[] = [
    `app_key = '${app_key}'`,
    `ts >= ${startTimestamp}`,
    `ts <= ${endTimestamp}`,
  ];

  if (event_type) {
    whereParts.push(`event_type = '${event_type}'`);
  }

  // Add custom filters (skip JSON fields - they'll be filtered in executeDirectQuery)
  filters.forEach(filter => {
    if (!filter.field.includes('->')) {
      whereParts.push(buildFilterClause(filter));
    }
  });

  // Build GROUP BY clause
  const groupByParts: string[] = [];
  dimensions.forEach((dim, idx) => {
    groupByParts.push(`dimension_${idx}`);
  });

  // Construct final SQL
  let sql = `
    SELECT ${selectParts.join(', ')}
    FROM analytics_product_events
    WHERE ${whereParts.join(' AND ')}
  `;

  if (groupByParts.length > 0) {
    sql += `\nGROUP BY ${groupByParts.join(', ')}`;
    sql += `\nORDER BY ${groupByParts.join(', ')}`;
  }

  sql += `\nLIMIT 10000`; // Safety limit

  return sql;
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

  switch (aggregation) {
    case 'count':
      return 'COUNT(*)';
    case 'count_distinct':
      return field ? `COUNT(DISTINCT ${field})` : 'COUNT(*)';
    case 'sum':
      return field ? `SUM((${field})::numeric)` : '0';
    case 'avg':
      return field ? `AVG((${field})::numeric)` : '0';
    case 'min':
      return field ? `MIN((${field})::numeric)` : '0';
    case 'max':
      return field ? `MAX((${field})::numeric)` : '0';
    default:
      return 'COUNT(*)';
  }
}

function buildFilterClause(filter: TileQuery['filters'][0]): string {
  const { field, operator, value } = filter;

  switch (operator) {
    case 'equals':
      return `${field} = '${value}'`;
    case 'not_equals':
      return `${field} != '${value}'`;
    case 'contains':
      return `${field}::text ILIKE '%${value}%'`;
    case 'gt':
      return `${field} > ${value}`;
    case 'lt':
      return `${field} < ${value}`;
    case 'gte':
      return `${field} >= ${value}`;
    case 'lte':
      return `${field} <= ${value}`;
    case 'in':
      const values = Array.isArray(value) ? value : [value];
      return `${field} IN (${values.map(v => `'${v}'`).join(', ')})`;
    default:
      return '1=1';
  }
}

// Fallback: execute query directly using Supabase query builder
async function executeDirectQuery(query: TileQuery) {
  const {
    app_key,
    event_type,
    measure,
    dimensions,
    filters,
    date_range,
  } = query;

  // Start with base query
  // The ts column is stored as bigint (Unix timestamp in milliseconds)
  // Convert ISO strings to Unix timestamps
  const startTimestamp = new Date(date_range.start).getTime();
  const endTimestamp = new Date(date_range.end).getTime();
  
  let supabaseQuery = supabase
    .from('analytics_product_events')
    .select('*')
    .eq('app_key', app_key)
    .gte('ts', startTimestamp)
    .lte('ts', endTimestamp);

  // Apply event type filter
  if (event_type) {
    supabaseQuery = supabaseQuery.eq('event_type', event_type);
  }

  // Apply custom filters
  filters.forEach(filter => {
    supabaseQuery = applySupabaseFilter(supabaseQuery, filter);
  });

  // Fetch raw data
  const { data: rawData, error } = await supabaseQuery;

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  // Post-process: apply filters that couldn't be applied in query (JSON fields)
  let filteredData = rawData || [];
  
  // Apply JSON field filters in memory
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

// Helper function to execute raw SQL directly using Supabase client
async function executeRawSQLDirect(sqlQuery: string) {
  // Use postgrest-js raw query capability
  // Note: This is a fallback and should be used carefully
  try {
    const { data, error } = await supabase.rpc('query', {
      query_text: sqlQuery
    });

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (err: any) {
    // If RPC doesn't exist, we need to parse and execute using Supabase query builder
    // For now, return error indicating RPC is needed
    throw new Error('SQL execution requires database RPC function. Please contact administrator to set up execute_raw_sql function.');
  }
}

export default queryRoutes;

