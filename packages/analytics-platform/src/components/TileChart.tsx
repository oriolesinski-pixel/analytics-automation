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
} from 'recharts';
import { ChartType, Dimension } from '../lib/tile-types';

interface TileChartProps {
  data: Array<Record<string, any>>;
  chartType: ChartType;
  dimensions: Dimension[];
  measureLabel: string;
  isLoading?: boolean;
}

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
}: TileChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading chart...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No data</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your filters or date range
          </p>
        </div>
      </div>
    );
  }

  // Render based on chart type
  switch (chartType) {
    case 'number':
      return <BigNumber data={data} label={measureLabel} />;
    case 'line':
      return <LineChartComponent data={data} dimensions={dimensions} />;
    case 'bar':
      return <BarChartComponent data={data} dimensions={dimensions} />;
    case 'pie':
      return <PieChartComponent data={data} dimensions={dimensions} />;
    case 'table':
      return <TableComponent data={data} dimensions={dimensions} measureLabel={measureLabel} />;
    default:
      return <BarChartComponent data={data} dimensions={dimensions} />;
  }
}

// Big Number Display (for no dimensions)
function BigNumber({ data, label }: { data: Array<Record<string, any>>; label: string }) {
  const value = data[0]?.value || 0;
  
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
    <div className="flex items-center justify-center h-96 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg">
      <div className="text-center p-8">
        <div className="text-7xl font-bold text-indigo-600 mb-2">
          {formattedValue}
          {suffix && <span className="text-5xl text-indigo-500">{suffix}</span>}
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
}: {
  data: Array<Record<string, any>>;
  dimensions: Dimension[];
}) {
  // Get the x-axis key (first dimension label)
  const xKey = dimensions[0]?.label || 'dimension';

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 70 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xKey}
          stroke="#6b7280"
          fontSize={11}
          angle={-45}
          textAnchor="end"
          height={100}
          tick={{ fill: '#6b7280' }}
          label={{
            value: xKey,
            position: 'insideBottom',
            offset: -60,
            style: { fontSize: 13, fontWeight: 600, fill: '#374151' }
          }}
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
          label={{
            value: 'Count',
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 12, fontWeight: 600, fill: '#374151' }
          }}
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
          formatter={(value: any) => [typeof value === 'number' ? value.toLocaleString() : value, 'Value']}
        />
        <Legend wrapperStyle={{ paddingTop: '20px' }} />
        <Line
          type="monotone"
          dataKey="value"
          name="Value"
          stroke="#6366f1"
          strokeWidth={3}
          dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: 7, fill: '#4f46e5' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Bar Chart
function BarChartComponent({
  data,
  dimensions,
}: {
  data: Array<Record<string, any>>;
  dimensions: Dimension[];
}) {
  const xKey = dimensions[0]?.label || 'dimension';

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xKey}
          stroke="#6b7280"
          fontSize={11}
          angle={-45}
          textAnchor="end"
          height={100}
          tick={{ fill: '#6b7280' }}
          label={{
            value: xKey,
            position: 'insideBottom',
            offset: -65,
            style: { fontSize: 13, fontWeight: 600, fill: '#374151' }
          }}
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
          label={{
            value: 'Count',
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 12, fontWeight: 600, fill: '#374151' }
          }}
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
          formatter={(value: any) => [typeof value === 'number' ? value.toLocaleString() : value, 'Value']}
        />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <Bar
          dataKey="value"
          name="Value"
          fill="#6366f1"
          radius={[8, 8, 0, 0]}
        />
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

