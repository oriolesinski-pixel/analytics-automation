interface Schema {
  measures: Array<{ name: string }>
  dimensions: Array<{ name: string }>
}

interface QuerySpec {
  measure: string
  dimensions: string[]
  filters?: Array<{
    field: string
    operator: 'eq' | 'between' | 'gt' | 'lt' | 'contains'
    value: any
  }>
  sort?: { field: string; order: 'asc' | 'desc' }
  limit?: number
}

export function validateQuerySpec(spec: QuerySpec, schema: Schema): boolean {
  // Validate measure
  if (!spec.measure) {
    throw new Error('Query spec must include a measure')
  }
  
  if (!schema.measures.find(m => m.name === spec.measure)) {
    throw new Error(`Invalid measure: ${spec.measure}. Available measures: ${schema.measures.map(m => m.name).join(', ')}`)
  }

  // Validate dimensions
  if (spec.dimensions && spec.dimensions.length > 0) {
    for (const dim of spec.dimensions) {
      if (!schema.dimensions.find(d => d.name === dim)) {
        throw new Error(`Invalid dimension: ${dim}. Available dimensions: ${schema.dimensions.map(d => d.name).join(', ')}`)
      }
    }
  }

  // Validate filters
  if (spec.filters && spec.filters.length > 0) {
    const validFields = [
      ...schema.measures.map(m => m.name),
      ...schema.dimensions.map(d => d.name)
    ]
    
    for (const filter of spec.filters) {
      if (!filter.field) {
        throw new Error('Filter must have a field')
      }
      
      if (!validFields.includes(filter.field)) {
        throw new Error(`Invalid filter field: ${filter.field}. Valid fields: ${validFields.join(', ')}`)
      }
      
      if (!filter.operator) {
        throw new Error('Filter must have an operator')
      }
      
      const validOperators = ['eq', 'between', 'gt', 'lt', 'contains']
      if (!validOperators.includes(filter.operator)) {
        throw new Error(`Invalid operator: ${filter.operator}. Valid operators: ${validOperators.join(', ')}`)
      }
      
      if (filter.value === undefined || filter.value === null) {
        throw new Error(`Filter for field ${filter.field} must have a value`)
      }
    }
  }

  // Validate sort
  if (spec.sort) {
    const validSortFields = [
      spec.measure,
      ...(spec.dimensions || [])
    ]
    
    if (!validSortFields.includes(spec.sort.field)) {
      throw new Error(`Invalid sort field: ${spec.sort.field}. Must be one of: ${validSortFields.join(', ')}`)
    }
    
    if (!['asc', 'desc'].includes(spec.sort.order)) {
      throw new Error('Sort order must be "asc" or "desc"')
    }
  }

  // Validate limit
  if (spec.limit !== undefined) {
    if (typeof spec.limit !== 'number' || spec.limit < 1) {
      throw new Error('Limit must be a positive number')
    }
    
    if (spec.limit > 1000) {
      throw new Error('Limit cannot exceed 1000')
    }
  }

  return true
}

