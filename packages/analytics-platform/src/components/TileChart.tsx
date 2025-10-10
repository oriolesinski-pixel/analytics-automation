// components/TileChart.tsx
'use client';

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Label,
  LabelList,
} from 'recharts';
import { ChartType, Dimension } from '../lib/tile-types';

interface TileChartProps {
  data: Array<Record<string, any>>;
  chartType: ChartType;
  dimensions: Dimension[];
  measureLabel: string;
  isLoading?: boolean;
  pivotAxis?: boolean;
  showLabels?: boolean;
  flowSteps?: Array<{
    id: string;
    label: string;
    conditions?: Array<{ id: string; field: string; value: string }>;
    field?: string;
    eventType?: string;
  }>;
}

// Custom label formatter to avoid overlap
const renderCustomLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  
  // Format the value
  const formattedValue = typeof value === 'number' 
    ? value >= 1000000 
      ? `${(value / 1000000).toFixed(1)}M`
      : value >= 1000 
        ? `${(value / 1000).toFixed(1)}K`
        : value.toLocaleString()
    : value;

  // Position label inside bar if there's space, otherwise outside
  const labelY = height > 25 ? y + height / 2 : y - 10;
  const labelFill = height > 25 ? '#ffffff' : '#374151';

  return (
    <text
      x={x + width / 2}
      y={labelY}
      fill={labelFill}
      textAnchor="middle"
      dominantBaseline="middle"
      className="text-xs font-semibold"
    >
      {formattedValue}
    </text>
  );
};

// Custom line label formatter
const renderLineLabel = (props: any) => {
  const { x, y, value } = props;
  
  const formattedValue = typeof value === 'number' 
    ? value >= 1000000 
      ? `${(value / 1000000).toFixed(1)}M`
      : value >= 1000 
        ? `${(value / 1000).toFixed(1)}K`
        : value.toLocaleString()
    : value;

  return (
    <text
      x={x}
      y={y - 10}
      fill="#4f46e5"
      textAnchor="middle"
      className="text-xs font-semibold"
    >
      {formattedValue}
    </text>
  );
};

const COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#ef4444', // Red
  '#84cc16', // Lime
  '#06b6d4', // Cyan
  '#a855f7', // Purple
  '#f43f5e', // Rose
  '#eab308', // Yellow
  '#22c55e', // Green
  '#6366f1', // Indigo (repeat for more data)
];

export default function TileChart({
  data,
  chartType,
  dimensions,
  measureLabel,
  isLoading = false,
  pivotAxis = false,
  showLabels = false,
  flowSteps = [],
}: TileChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-400">
        <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-base font-medium text-gray-900 mb-1">No data available</h3>
        <p className="text-sm text-gray-500">
          Try adjusting your filters or date range
        </p>
      </div>
    );
  }

  // Render based on chart type
  switch (chartType) {
    case 'number':
      return <BigNumber data={data} label={measureLabel} />;
    case 'line':
      return <LineChartComponent data={data} dimensions={dimensions} pivotAxis={pivotAxis} showLabels={showLabels} />;
    case 'bar':
      return <BarChartComponent data={data} dimensions={dimensions} pivotAxis={pivotAxis} showLabels={showLabels} />;
    case 'pie':
      return <PieChartComponent data={data} dimensions={dimensions} />;
    case 'funnel':
      return <FunnelChartComponent data={data} dimensions={dimensions} />;
    case 'scatter':
      return <ScatterChartComponent data={data} dimensions={dimensions} measureLabel={measureLabel} />;
    case 'sankey':
      return <SankeyChartComponent />;
    case 'flow':
      return <FlowChartComponent flowSteps={flowSteps} data={data} />;
    case 'table':
      return <TableComponent data={data} dimensions={dimensions} measureLabel={measureLabel} />;
    default:
      return <BarChartComponent data={data} dimensions={dimensions} pivotAxis={pivotAxis} />;
  }
}

// Big Number Display (for no dimensions)
function BigNumber({ data, label }: { data: Array<Record<string, any>>; label: string }) {
  // Safe access with proper null/undefined checks
  const value = (data && Array.isArray(data) && data.length > 0) ? (data[0]?.value || 0) : 0;
  
  // Format value based on size
  let formattedValue: string;
  let suffix = '';
  
  if (typeof value === 'number') {
    if (value >= 1000000) {
      formattedValue = (value / 1000000).toFixed(2);
      suffix = 'M';
    } else if (value >= 1000) {
      formattedValue = (value / 1000).toFixed(1);
      suffix = 'K';
    } else {
      formattedValue = value.toLocaleString();
    }
  } else {
    formattedValue = String(value);
  }

  return (
    <div className="flex items-center justify-center h-96 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
      <div className="text-center p-8">
        <div className="text-7xl font-bold text-blue-600 mb-2">
          {formattedValue}
          {suffix && <span className="text-5xl text-blue-500">{suffix}</span>}
        </div>
        <div className="text-xl font-medium text-gray-700 mt-4">{label}</div>
        {typeof value === 'number' && (
          <div className="text-sm text-gray-500 mt-2">
            Exact: {value.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

// Line Chart
function LineChartComponent({
  data,
  dimensions,
  pivotAxis = false,
  showLabels = false,
}: {
  data: Array<Record<string, any>>;
  dimensions: Dimension[];
  pivotAxis?: boolean;
  showLabels?: boolean;
}) {
  // Get the x-axis key (first dimension label)
  const xKey = dimensions[0]?.label || 'dimension';

  // For pivoted axis, we'd need to transform the chart orientation
  // For line charts, pivot doesn't make as much sense, so we'll keep it simple
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: showLabels ? 30 : 10, right: 30, left: 20, bottom: 70 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xKey}
          stroke="#6b7280"
          fontSize={11}
          angle={-45}
          textAnchor="end"
          height={100}
          tick={{ fill: '#6b7280' }}
          tickFormatter={(value) => {
            // Format timestamps
            if (typeof value === 'string' && value.match(/^\d{4}-\d{2}/)) {
              // Already formatted by backend (YYYY-MM-DD or YYYY-MM)
              return value;
            }
            if (value instanceof Date || !isNaN(Date.parse(value))) {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            // Truncate long strings
            return String(value).length > 15 ? String(value).substring(0, 12) + '...' : String(value);
          }}
        />
        <YAxis
          stroke="#6b7280"
          fontSize={11}
          tick={{ fill: '#6b7280' }}
          tickFormatter={(value) => {
            // Format large numbers
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value;
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            padding: '12px',
          }}
          labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
          formatter={(value: any) => [typeof value === 'number' ? value.toLocaleString() : value, '']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#6366f1"
          strokeWidth={3}
          dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: 7, fill: '#4f46e5' }}
        >
          {showLabels && <LabelList content={renderLineLabel} />}
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}

// Bar Chart
function BarChartComponent({
  data,
  dimensions,
  pivotAxis = false,
  showLabels = false,
}: {
  data: Array<Record<string, any>>;
  dimensions: Dimension[];
  pivotAxis?: boolean;
  showLabels?: boolean;
}) {
  const xKey = dimensions[0]?.label || 'dimension';

  if (pivotAxis) {
    // Horizontal bar chart
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: showLabels ? 80 : 30, left: 120, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            stroke="#6b7280"
            fontSize={11}
            tick={{ fill: '#6b7280' }}
            tickFormatter={(value) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
              return value;
            }}
          />
          <YAxis
            type="category"
            dataKey={xKey}
            stroke="#6b7280"
            fontSize={11}
            tick={{ fill: '#6b7280' }}
            width={110}
            tickFormatter={(value) => {
              const str = String(value);
              return str.length > 18 ? str.substring(0, 15) + '...' : str;
            }}
          />
          <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            padding: '12px',
          }}
          labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
          formatter={(value: any) => [typeof value === 'number' ? value.toLocaleString() : value, '']}
        />
        <Bar
          dataKey="value"
          fill="#6366f1"
          radius={[0, 8, 8, 0]}
        >
          {showLabels && (
            <LabelList 
              dataKey="value" 
              position="right"
              formatter={(value: any) => {
                if (typeof value === 'number') {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                  return value.toLocaleString();
                }
                return value;
              }}
              style={{ fill: '#374151', fontSize: '11px', fontWeight: 600 }}
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

  // Standard vertical bar chart
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ top: showLabels ? 30 : 10, right: 30, left: 20, bottom: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xKey}
          stroke="#6b7280"
          fontSize={11}
          angle={-45}
          textAnchor="end"
          height={100}
          tick={{ fill: '#6b7280' }}
            tickFormatter={(value) => {
              // Truncate long labels
              const str = String(value);
              return str.length > 20 ? str.substring(0, 17) + '...' : str;
            }}
          />
        <YAxis
          stroke="#6b7280"
          fontSize={11}
          tick={{ fill: '#6b7280' }}
          tickFormatter={(value) => {
            // Format large numbers
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value;
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            padding: '12px',
          }}
          labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
          formatter={(value: any) => [typeof value === 'number' ? value.toLocaleString() : value, '']}
        />
        <Bar
          dataKey="value"
          fill="#6366f1"
          radius={[8, 8, 0, 0]}
        >
          {showLabels && <LabelList content={renderCustomLabel} />}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Pie Chart
function PieChartComponent({
  data,
  dimensions,
}: {
  data: Array<Record<string, any>>;
  dimensions: Dimension[];
}) {
  const nameKey = dimensions[0]?.label || 'dimension';

  // Transform data for pie chart
  const pieData = data.map((item) => ({
    name: String(item[nameKey]).length > 20 
      ? String(item[nameKey]).substring(0, 17) + '...'
      : item[nameKey],
    fullName: item[nameKey],
    value: item.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          labelLine={true}
          label={({ name, percent, value }) => 
            percent > 0.05 ? `${name}: ${(percent * 100).toFixed(1)}%` : ''
          }
          outerRadius={130}
          fill="#8884d8"
          dataKey="value"
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            padding: '12px',
          }}
          formatter={(value: any, name: string, props: any) => [
            typeof value === 'number' ? value.toLocaleString() : value,
            props.payload.fullName
          ]}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value, entry: any) => entry.payload.fullName}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Funnel Chart (using horizontal bars to simulate funnel)
function FunnelChartComponent({
  data,
  dimensions,
}: {
  data: Array<Record<string, any>>;
  dimensions: Dimension[];
}) {
  const nameKey = dimensions[0]?.label || 'dimension';

  // Sort data by value descending to create funnel effect
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const maxValue = sortedData[0]?.value || 1;

  return (
    <div className="flex flex-col items-center justify-center h-96 px-8">
      <div className="w-full max-w-2xl space-y-3">
        {sortedData.map((item, index) => {
          const percentage = (item.value / maxValue) * 100;
          const label = String(item[nameKey]);
          const truncatedLabel = label.length > 30 ? label.substring(0, 27) + '...' : label;
          
          return (
            <div key={index} className="relative">
              {/* Funnel bar */}
              <div 
                className="relative h-16 rounded-lg flex items-center justify-between px-6 transition-all hover:shadow-md"
                style={{ 
                  width: `${Math.max(percentage, 20)}%`,
                  margin: '0 auto',
                  background: `linear-gradient(135deg, ${COLORS[index % COLORS.length]}, ${COLORS[(index + 1) % COLORS.length]})`,
                }}
              >
                <span className="font-medium text-white text-sm">{truncatedLabel}</span>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-white">
                    {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                  </span>
                  <span className="text-xs text-white/80 font-medium">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
              
              {/* Connection line to next stage */}
              {index < sortedData.length - 1 && (
                <div className="h-2 w-px bg-gray-300 mx-auto" />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="mt-6 text-center text-sm text-gray-600">
        Conversion funnel showing drop-off at each stage
      </div>
    </div>
  );
}

// Sankey/Flow Diagram (deprecated - use FlowChartComponent instead)
function SankeyChartComponent() {
  return (
    <div className="flex flex-col items-center justify-center h-96 px-8">
      <div className="w-full max-w-3xl bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-8 border-2 border-indigo-200">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Flow Visualization</h3>
          <p className="text-sm text-gray-600 mb-6">
            Track user journeys through multiple steps and events
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 mb-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">How it works:</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-center font-bold mr-3 flex-shrink-0">1</span>
              <span>Define multiple steps (e.g., Landing → Product View → Cart → Checkout)</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-center font-bold mr-3 flex-shrink-0">2</span>
              <span>Select event types or field values for each step</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-center font-bold mr-3 flex-shrink-0">3</span>
              <span>Visualize user transitions and drop-off between steps</span>
            </li>
          </ul>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-900">Configuration Required</p>
              <p className="text-xs text-yellow-700 mt-1">
                Use the left panel to add flow steps and configure the user journey you want to analyze.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Flow Chart Component - Actual working implementation
function FlowChartComponent({
  flowSteps,
  data,
}: {
  flowSteps: Array<{ 
    id: string; 
    label: string; 
    conditions?: Array<{ id: string; field: string; value: string }>;
    field?: string; 
    eventType?: string;
  }>;
  data: Array<Record<string, any>>;
}) {
  const [displayMode, setDisplayMode] = React.useState<'funnel' | 'sankey'>('sankey');

  if (!flowSteps || flowSteps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 px-8">
        <div className="w-full max-w-3xl bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-8 border-2 border-indigo-200">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Flow Visualization</h3>
            <p className="text-sm text-gray-600 mb-6">
              Track user journeys through multiple steps and events
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 mb-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">How it works:</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="inline-block w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-center font-bold mr-3 flex-shrink-0">1</span>
                <span>Define multiple steps (e.g., Landing → Product View → Cart → Checkout)</span>
              </li>
              <li className="flex items-start">
                <span className="inline-block w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-center font-bold mr-3 flex-shrink-0">2</span>
                <span>Select event types or field values for each step</span>
              </li>
              <li className="flex items-start">
                <span className="inline-block w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-center font-bold mr-3 flex-shrink-0">3</span>
                <span>Visualize user transitions and drop-off between steps</span>
              </li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-900">Configuration Required</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Add flow steps in the middle panel to track your user journey.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use actual data from the measure - data should be array with step results
  // Map each flow step with its corresponding data
  const flowData = flowSteps.map((step, index) => {
    // If we have data, try to find matching data for this step index
    const stepData = data && data.length > index ? data[index] : null;
    return {
      ...step,
      users: stepData?.value || 0,
      percentage: 0, // Will calculate below
    };
  });

  // Calculate percentages
  const maxValue = flowData[0]?.users || 1;
  flowData.forEach((step, index) => {
    step.percentage = maxValue > 0 ? (step.users / maxValue) * 100 : 0;
  });

  const hasData = data && data.length > 0;

  return (
    <div className="flex flex-col min-h-[500px] px-8 py-6">
      <div className="w-full max-w-5xl mx-auto">
        {/* Header with view toggle */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">User Flow Analysis</h3>
            {hasData && (
              <p className="text-sm text-gray-600 mt-1">
                {flowData[0]?.users.toLocaleString()} users in flow • {((flowData[flowData.length - 1]?.users / flowData[0]?.users) * 100).toFixed(1)}% completion
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setDisplayMode('sankey')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                displayMode === 'sankey'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Transition View
            </button>
            <button
              onClick={() => setDisplayMode('funnel')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                displayMode === 'funnel'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Funnel View
            </button>
          </div>
        </div>

        {!hasData && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900">Run Query to See Data</p>
                <p className="text-xs text-blue-700 mt-1">
                  Click "Run" to execute the query and visualize your flow with real data. The diagram below shows your configured steps.
                </p>
              </div>
            </div>
          </div>
        )}

        {displayMode === 'sankey' ? (
          <SankeyFlowView flowData={flowData} hasData={hasData} />
        ) : (
          <FunnelFlowView flowData={flowData} hasData={hasData} maxValue={maxValue} />
        )}
      </div>
    </div>
  );
}

// Sankey/Transition View Component
function SankeyFlowView({
  flowData,
  hasData,
}: {
  flowData: Array<any>;
  hasData: boolean;
}) {
  return (
    <div className="space-y-6">
      {flowData.map((step, index) => {
        const nextStep = flowData[index + 1];
        const dropOff = nextStep ? step.users - nextStep.users : 0;
        const dropOffPercentage = nextStep && step.users > 0 
          ? ((dropOff / step.users) * 100).toFixed(1) 
          : '0';
        const continuePercentage = nextStep && step.users > 0
          ? (((step.users - dropOff) / step.users) * 100).toFixed(1)
          : '0';
        
        // Support both old and new format
        const conditions = step.conditions || (step.field && step.eventType ? [{
          id: '1',
          field: step.field,
          value: step.eventType
        }] : []);
        
        return (
          <div key={step.id} className="relative">
            {/* Step Rectangle */}
            <div className="flex items-center gap-4">
              {/* Step Number */}
              <div className="flex-shrink-0 w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{index + 1}</span>
              </div>
              
              {/* Step Box */}
              <div className="flex-1 bg-white border-2 border-gray-300 rounded-lg p-4 hover:border-indigo-400 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-base mb-1">{step.label}</h4>
                    <div className="space-y-0.5">
                      {conditions.map((condition: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-500">
                          {idx > 0 && <span className="font-semibold text-indigo-500 text-[10px]">AND</span>}
                          <span>
                            {condition.field} = <span className="font-medium text-indigo-600">{condition.value}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right ml-6">
                    <div className="text-2xl font-bold text-gray-900">
                      {hasData ? step.users.toLocaleString() : '—'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {hasData && step.percentage > 0 ? `${step.percentage.toFixed(1)}%` : 'users'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Transition Arrows */}
            {index < flowData.length - 1 && (
              <div className="ml-14 my-2 pl-6 relative">
                <div className="flex items-center gap-8">
                  {/* Continue Arrow */}
                  <div className="flex items-center gap-3 flex-1">
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <div className="flex-1 bg-green-50 border border-green-200 rounded px-3 py-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-green-900">Continued</span>
                        {hasData && (
                          <span className="font-bold text-green-700">
                            {nextStep?.users.toLocaleString()} ({continuePercentage}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Drop-off */}
                  {hasData && dropOff > 0 && (
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <div className="bg-red-50 border border-red-200 rounded px-3 py-2">
                        <div className="text-xs">
                          <span className="font-medium text-red-900">
                            {dropOff.toLocaleString()} dropped ({dropOffPercentage}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Funnel View Component
function FunnelFlowView({
  flowData,
  hasData,
  maxValue,
}: {
  flowData: Array<any>;
  hasData: boolean;
  maxValue: number;
}) {
  return (
    <div className="space-y-4">
      {flowData.map((step, index) => {
        const percentage = maxValue > 0 ? (step.users / maxValue) * 100 : 50;
        const prevUsers = index > 0 ? flowData[index - 1].users : step.users;
        const dropOff = prevUsers - step.users;
        const dropOffPercentage = index > 0 && prevUsers > 0 ? ((dropOff / prevUsers) * 100).toFixed(1) : '0';
        
        // Support both old and new format
        const conditions = step.conditions || (step.field && step.eventType ? [{
          id: '1',
          field: step.field,
          value: step.eventType
        }] : []);
        
        return (
          <div key={step.id}>
            {/* Step Box */}
            <div className="relative">
              <div 
                className="relative rounded-lg transition-all hover:shadow-lg"
                style={{ 
                  width: `${Math.max(percentage, 30)}%`,
                  margin: '0 auto',
                  background: `linear-gradient(135deg, ${COLORS[index % COLORS.length]}, ${COLORS[(index + 1) % COLORS.length]})`,
                }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-white/30 text-white text-sm font-bold rounded-full flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-white text-base">{step.label}</h4>
                        <div className="space-y-0.5 mt-1">
                          {conditions.map((condition: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1 text-xs text-white/80">
                              {idx > 0 && <span className="font-semibold text-white/60 text-[10px]">AND</span>}
                              <span>{condition.field} = {condition.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xl font-bold text-white">
                        {hasData ? step.users.toLocaleString() : '—'}
                      </div>
                      <div className="text-xs text-white/80">
                        {hasData && percentage > 0 ? `${percentage.toFixed(1)}%` : 'users'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Connection/Drop-off visualization */}
            {index < flowData.length - 1 && hasData && (
              <div className="flex items-center justify-center py-2">
                <div className="bg-gray-100 rounded-lg px-4 py-2 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    {dropOff > 0 && (
                      <span className="text-xs font-medium text-gray-700">
                        {dropOff.toLocaleString()} dropped ({dropOffPercentage}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Scatter Plot
function ScatterChartComponent({
  data,
  dimensions,
  measureLabel,
}: {
  data: Array<Record<string, any>>;
  dimensions: Dimension[];
  measureLabel: string;
}) {
  const xKey = dimensions[0]?.label || 'dimension';

  // Transform data for scatter plot - we'll use index as x-axis and value as y-axis
  const scatterData = data.map((item, index) => ({
    x: index + 1,
    y: item.value,
    name: String(item[xKey]),
    value: item.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          type="number"
          dataKey="x"
          name="Index"
          stroke="#6b7280"
          fontSize={11}
          tick={{ fill: '#6b7280' }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={measureLabel}
          stroke="#6b7280"
          fontSize={11}
          tick={{ fill: '#6b7280' }}
          tickFormatter={(value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
            return value;
          }}
        />
        <ZAxis range={[100, 400]} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            padding: '12px',
          }}
          formatter={(value: any, name: string) => {
            return [typeof value === 'number' ? value.toLocaleString() : value, ''];
          }}
          labelFormatter={(label: any, payload: any) => {
            if (payload && payload[0]) {
              return `${payload[0].payload.name}`;
            }
            return label;
          }}
        />
        <Scatter
          data={scatterData}
          fill="#6366f1"
          shape="circle"
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// Table View
function TableComponent({
  data,
  dimensions,
  measureLabel,
}: {
  data: Array<Record<string, any>>;
  dimensions: Dimension[];
  measureLabel: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {dimensions.map((dim) => (
              <th
                key={dim.id}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {dim.label}
              </th>
            ))}
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              {measureLabel}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              {dimensions.map((dim) => (
                <td key={dim.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCellValue(row[dim.label])}
                </td>
              ))}
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                {typeof row.value === 'number' ? row.value.toLocaleString() : row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCellValue(value: any): string {
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  if (typeof value === 'string' && !isNaN(Date.parse(value))) {
    return new Date(value).toLocaleString();
  }
  return String(value ?? '-');
}

