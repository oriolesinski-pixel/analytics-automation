import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

interface ChartProps {
  spec: {
    type: 'bar' | 'line' | 'pie' | 'table' | 'metric'
    xField?: string
    yField?: string
    orientation?: 'horizontal' | 'vertical'
    color?: string
  }
  data: any[]
}

export function DynamicChart({ spec, data }: ChartProps) {
  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="text-center space-y-2">
          <p className="text-sm">No data available</p>
          <p className="text-xs">Try adjusting your query or date range</p>
        </div>
      </div>
    )
  }

  // Metric Card (single number)
  if (spec.type === 'metric') {
    const value = data[0]?.[spec.yField || 'value'] || 0
    const label = spec.xField || 'Total'
    
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="text-muted-foreground mt-3 text-lg">
          {label}
        </div>
      </div>
    )
  }

  // Table
  if (spec.type === 'table') {
    const columns = Object.keys(data[0] || {})
    
    return (
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                {columns.map(key => (
                  <th key={key} className="p-3 text-left text-sm font-medium">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/20 transition-colors duration-150">
                  {columns.map((col, i) => {
                    const val = row[col]
                    return (
                      <td key={i} className="p-3 text-sm">
                        {typeof val === 'number' ? val.toLocaleString() : val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Bar Chart
  if (spec.type === 'bar') {
    const isHorizontal = spec.orientation === 'horizontal'
    
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart 
          data={data}
          layout={isHorizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          {isHorizontal ? (
            <>
              <XAxis type="number" className="text-xs" />
              <YAxis dataKey={spec.xField} type="category" width={150} className="text-xs" />
            </>
          ) : (
            <>
              <XAxis dataKey={spec.xField} className="text-xs" />
              <YAxis className="text-xs" />
            </>
          )}
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
          />
          <Legend />
          <Bar 
            dataKey={spec.yField} 
            fill={spec.color || '#6366f1'}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Line Chart
  if (spec.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={spec.xField} className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey={spec.yField} 
            stroke={spec.color || '#6366f1'}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // Pie Chart
  if (spec.type === 'pie') {
    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#14b8a6', '#f43f5e']
    
    return (
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            dataKey={spec.yField}
            nameKey={spec.xField}
            cx="50%"
            cy="50%"
            outerRadius={120}
            label={(entry) => {
              const percent = ((entry.value / data.reduce((acc, curr) => acc + curr[spec.yField || ''], 0)) * 100).toFixed(1)
              return `${entry[spec.xField || 'name']}: ${percent}%`
            }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return null
}

