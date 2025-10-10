import { NextRequest, NextResponse } from 'next/server'
import { MEASURES, DIMENSIONS } from '@/lib/tile-types'

const ANALYTICS_SERVICE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082'

interface RouteContext {
  params: {
    appId: string
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const appId = params.appId
    const querySpec = await request.json()
    
    console.log('[Query API] Executing query for appId:', appId)
    console.log('[Query API] Query spec:', JSON.stringify(querySpec, null, 2))

    if (!appId) {
      return NextResponse.json(
        { error: 'App ID is required' },
        { status: 400 }
      )
    }

    // Transform the AI-generated query spec to the format expected by the analytics service
    // The AI returns: { measure, dimensions, filters, sort, limit }
    // The service expects: { app_key, measure, dimensions, filters, date_range }
    
    // Look up the measure definition to get the aggregation type
    const measureDef = MEASURES.find(m => m.id === querySpec.measure)
    if (!measureDef) {
      return NextResponse.json(
        { error: `Unknown measure: ${querySpec.measure}` },
        { status: 400 }
      )
    }
    
    // Build date range from temporal filters if present, otherwise default to last 7 days
    let startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)
    let endDate = new Date()
    
    // Check for temporal dimension filters to extract date range
    const temporalFilters = (querySpec.filters || []).filter((filter: any) => {
      const dimDef = DIMENSIONS.find(d => d.id === filter.field)
      return dimDef && dimDef.type === 'temporal'
    })
    
    if (temporalFilters.length > 0) {
      const dateFilter = temporalFilters[0]
      if (dateFilter.operator === 'between' && Array.isArray(dateFilter.value) && dateFilter.value.length === 2) {
        startDate = new Date(dateFilter.value[0])
        endDate = new Date(dateFilter.value[1])
        console.log(`[Query API] Using date range from filter: ${startDate.toISOString()} to ${endDate.toISOString()}`)
      }
    }

    const tileQueryRequest = {
      app_key: appId,
      measure: {
        aggregation: measureDef.aggregation,
        field: measureDef.field
      },
      dimensions: (querySpec.dimensions || []).map((dimId: string) => {
        const dimDef = DIMENSIONS.find(d => d.id === dimId)
        if (!dimDef) {
          console.warn(`[Query API] Unknown dimension: ${dimId}, using as-is`)
          return {
            field: dimId,
            type: 'categorical' as const
          }
        }
        
        const dimension: any = {
          field: dimDef.field,
          type: dimDef.type
        }
        
        // Add bucket for temporal dimensions
        if (dimDef.type === 'temporal') {
          dimension.bucket = dimId // 'hour', 'day', 'week', 'month'
        }
        
        return dimension
      }),
      filters: (querySpec.filters || [])
        .filter((filter: any) => {
          // Skip temporal dimension filters - they should be handled via date_range
          const dimDef = DIMENSIONS.find(d => d.id === filter.field || d.field === filter.field)
          if (dimDef && dimDef.type === 'temporal') {
            console.log(`[Query API] Skipping temporal filter on ${filter.field}, should use date_range instead`)
            return false
          }
          return true
        })
        .map((filter: any) => {
          // Transform dimension IDs to field names in filters
          const dimDef = DIMENSIONS.find(d => d.id === filter.field)
          const measureDef = MEASURES.find(m => m.id === filter.field)
          
          let actualField = filter.field
          if (dimDef) {
            actualField = dimDef.field
          } else if (measureDef && measureDef.field) {
            actualField = measureDef.field
          }
          
          return {
            field: actualField,
            operator: transformOperator(filter.operator),
            value: filter.value
          }
        }),
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    }

    console.log('[Query API] Transformed query request:', JSON.stringify(tileQueryRequest, null, 2))

    // Call the analytics service
    const response = await fetch(`${ANALYTICS_SERVICE_URL}/query/tile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tileQueryRequest)
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Query API] Analytics service error:', error)
      throw new Error('Failed to execute query')
    }

    const result = await response.json()

    if (!result.ok) {
      throw new Error(result.error || 'Query execution failed')
    }

    // Apply sorting and limiting if specified
    let rows = result.data || []
    
    if (querySpec.sort) {
      rows = rows.sort((a: any, b: any) => {
        const aVal = a[querySpec.sort.field]
        const bVal = b[querySpec.sort.field]
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return querySpec.sort.order === 'asc' ? aVal - bVal : bVal - aVal
        }
        
        const aStr = String(aVal)
        const bStr = String(bVal)
        return querySpec.sort.order === 'asc' 
          ? aStr.localeCompare(bStr) 
          : bStr.localeCompare(aStr)
      })
    }

    if (querySpec.limit && querySpec.limit > 0) {
      rows = rows.slice(0, querySpec.limit)
    }

    return NextResponse.json({ rows })
  } catch (error) {
    console.error('Query execution error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute query' },
      { status: 500 }
    )
  }
}

function transformOperator(op: string): string {
  const operatorMap: Record<string, string> = {
    'eq': 'equals',
    'contains': 'contains',
    'gt': 'gt',
    'lt': 'lt',
    'between': 'in' // Approximate for now
  }
  
  return operatorMap[op] || 'equals'
}

