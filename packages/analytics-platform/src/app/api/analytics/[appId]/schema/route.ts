import { NextRequest, NextResponse } from 'next/server'
import { MEASURES, DIMENSIONS } from '@/lib/tile-types'

interface RouteContext {
  params: {
    appId: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const appId = params.appId

    if (!appId) {
      return NextResponse.json(
        { error: 'App ID is required' },
        { status: 400 }
      )
    }

    console.log('[Schema API] Fetching schema for appId:', appId)

    // Return the predefined schema
    // In the future, this could be dynamically fetched based on the app's actual data
    const schema = {
      appId,
      measures: MEASURES.map(m => ({
        name: m.id,
        label: m.label,
        aggregation: m.aggregation,
        field: m.field,
        eventTypes: m.eventTypes
      })),
      dimensions: DIMENSIONS.map(d => ({
        name: d.id,
        label: d.label,
        field: d.field,
        type: d.type,
        options: d.options,
        eventTypes: d.eventTypes
      }))
    }

    console.log('Returning schema with', schema.measures.length, 'measures and', schema.dimensions.length, 'dimensions')

    return NextResponse.json(schema)
  } catch (error) {
    console.error('Schema fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schema', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

