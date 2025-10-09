'use client';

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Play, 
  Download, 
  Clock, 
  Database, 
  Loader2, 
  AlertCircle,
  CheckCircle,
  History,
  Trash2,
  Copy,
  Save
} from 'lucide-react';

interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTimeMs: number;
  query: string;
}

interface QueryHistory {
  id: string;
  query: string;
  timestamp: number;
  executionTimeMs?: number;
  success: boolean;
  error?: string;
}

interface SQLSandboxProps {
  appKey: string;
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'OFFSET',
  'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
  'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT(DISTINCT',
  'HAVING', 'DISTINCT', 'AS', 'ON', 'UNION', 'INTERSECT', 'EXCEPT',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'CAST', 'COALESCE', 'NULLIF',
  'TO_TIMESTAMP', 'DATE_TRUNC', 'TO_CHAR', 'EXTRACT',
  'NOW', 'CURRENT_DATE', 'CURRENT_TIMESTAMP',
  'ASC', 'DESC'
];

// Generate example queries with app key
function getExampleQueries(appKey: string) {
  return [
    {
      name: 'Event Count by Type',
      query: `SELECT 
  event_type,
  COUNT(*) as event_count
FROM analytics_product_events
WHERE app_key = '${appKey}'
  AND ts >= EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
GROUP BY event_type
ORDER BY event_count DESC
LIMIT 10;`
    },
    {
      name: 'Daily Active Users',
      query: `SELECT 
  TO_CHAR(TO_TIMESTAMP(ts / 1000), 'YYYY-MM-DD') as date,
  COUNT(DISTINCT user_id) as daily_active_users
FROM analytics_product_events
WHERE app_key = '${appKey}'
  AND user_id IS NOT NULL
  AND ts >= EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days') * 1000
GROUP BY date
ORDER BY date DESC;`
    },
    {
      name: 'Session Analysis',
      query: `SELECT 
  session_id,
  COUNT(*) as events_per_session,
  MIN(TO_TIMESTAMP(ts / 1000)) as session_start,
  MAX(TO_TIMESTAMP(ts / 1000)) as session_end
FROM analytics_product_events
WHERE app_key = '${appKey}'
  AND ts >= EXTRACT(EPOCH FROM NOW() - INTERVAL '1 day') * 1000
GROUP BY session_id
ORDER BY events_per_session DESC
LIMIT 10;`
    },
    {
      name: 'Top Event Properties',
      query: `SELECT 
  event_type,
  jsonb_object_keys(data) as property_key,
  COUNT(*) as usage_count
FROM analytics_product_events
WHERE app_key = '${appKey}'
  AND ts >= EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
GROUP BY event_type, property_key
ORDER BY usage_count DESC
LIMIT 20;`
    }
  ];
}

export default function SQLSandbox({ appKey }: SQLSandboxProps) {
  // Initialize with default query immediately
  const [query, setQuery] = useState(`SELECT 
  event_type,
  COUNT(*) as event_count
FROM analytics_product_events
WHERE app_key = '${appKey}'
  AND ts >= EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
GROUP BY event_type
ORDER BY event_count DESC
LIMIT 10;`);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([]);
  const [showExamples, setShowExamples] = useState(true);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  // Load query history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('sql_query_history');
    if (savedHistory) {
      try {
        setQueryHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to load query history:', e);
      }
    }
  }, []);

  // Save query history to localStorage
  const saveQueryHistory = (history: QueryHistory[]) => {
    localStorage.setItem('sql_query_history', JSON.stringify(history.slice(0, 50))); // Keep last 50
    setQueryHistory(history);
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure SQL language support
    monaco.languages.setLanguageConfiguration('sql', {
      comments: {
        lineComment: '--',
        blockComment: ['/*', '*/']
      },
      brackets: [
        ['(', ')'],
        ['[', ']']
      ],
      autoClosingPairs: [
        { open: '(', close: ')' },
        { open: '[', close: ']' },
        { open: "'", close: "'" },
        { open: '"', close: '"' }
      ]
    });

    // Register advanced autocomplete provider
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const suggestions = [];

        // Add SQL keywords
        SQL_KEYWORDS.forEach(keyword => {
          suggestions.push({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            range: range,
            detail: 'SQL Keyword'
          });
        });

        // Add table name
        suggestions.push({
          label: 'analytics_product_events',
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: 'analytics_product_events',
          range: range,
          detail: 'Analytics Events Table',
          documentation: 'Main table containing all analytics events'
        });

        // Add column names with types and descriptions
        const columns = [
          { name: 'id', type: 'UUID', desc: 'Unique event identifier' },
          { name: 'event_type', type: 'TEXT', desc: 'Type of event (e.g., page_view, click)' },
          { name: 'app_key', type: 'TEXT', desc: 'Application key' },
          { name: 'user_id', type: 'TEXT', desc: 'User identifier (nullable)' },
          { name: 'session_id', type: 'TEXT', desc: 'Session identifier' },
          { name: 'ts', type: 'BIGINT', desc: 'Timestamp in milliseconds (Unix epoch)' },
          { name: 'data', type: 'JSONB', desc: 'Event payload data' },
          { name: 'created_at', type: 'TIMESTAMPTZ', desc: 'Record creation time' }
        ];

        columns.forEach(col => {
          suggestions.push({
            label: col.name,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: col.name,
            range: range,
            detail: col.type,
            documentation: col.desc
          });
        });

        // Add SQL functions
        const functions = [
          { name: 'COUNT(*)', desc: 'Count all rows' },
          { name: 'COUNT(DISTINCT $1)', desc: 'Count distinct values' },
          { name: 'SUM($1)', desc: 'Sum of values' },
          { name: 'AVG($1)', desc: 'Average of values' },
          { name: 'MIN($1)', desc: 'Minimum value' },
          { name: 'MAX($1)', desc: 'Maximum value' },
          { name: 'TO_TIMESTAMP(ts / 1000)', desc: 'Convert Unix timestamp to timestamp' },
          { name: 'DATE_TRUNC(\'day\', $1)', desc: 'Truncate to day/hour/month' },
          { name: 'TO_CHAR($1, \'YYYY-MM-DD\')', desc: 'Format timestamp as string' },
          { name: 'EXTRACT(EPOCH FROM NOW())', desc: 'Get Unix timestamp of current time' },
          { name: 'NOW()', desc: 'Current timestamp' },
          { name: 'CURRENT_DATE', desc: 'Current date' },
          { name: 'INTERVAL \'7 days\'', desc: 'Time interval' },
          { name: 'jsonb_object_keys(data)', desc: 'Get JSON object keys' },
          { name: 'data->>\'key\'', desc: 'Extract JSON field as text' },
          { name: 'data->\'key\'', desc: 'Extract JSON field as JSON' }
        ];

        functions.forEach(func => {
          suggestions.push({
            label: func.name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: func.name,
            range: range,
            detail: 'SQL Function',
            documentation: func.desc
          });
        });

        // Add common patterns
        const patterns = [
          {
            label: 'WHERE app_key template',
            insertText: `WHERE app_key = '\${1:${appKey}}'`,
            detail: 'Filter by app key'
          },
          {
            label: 'Last 7 days filter',
            insertText: 'ts >= EXTRACT(EPOCH FROM NOW() - INTERVAL \'7 days\') * 1000',
            detail: 'Filter events from last 7 days'
          },
          {
            label: 'Group by day',
            insertText: 'TO_CHAR(TO_TIMESTAMP(ts / 1000), \'YYYY-MM-DD\') as date',
            detail: 'Group events by day'
          },
          {
            label: 'Count by event type',
            insertText: `SELECT event_type, COUNT(*) as count
FROM analytics_product_events
WHERE app_key = '\${1:${appKey}}'
GROUP BY event_type
ORDER BY count DESC;`,
            detail: 'Count events by type'
          }
        ];

        patterns.forEach(pattern => {
          suggestions.push({
            label: pattern.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: pattern.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
            detail: pattern.detail
          });
        });

        return { suggestions };
      }
    });

    // Add keyboard shortcut for running query (Cmd/Ctrl + Enter)
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        executeQuery();
      }
    );
  };

  const executeQuery = async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    setIsExecuting(true);
    setError(null);
    setResult(null);

    const startTime = Date.now();
    
    try {
      const serviceUrl = process.env.NEXT_PUBLIC_ANALYTICS_SERVICE_URL || 'http://localhost:8082';
      
      // Execute raw SQL query
      const response = await fetch(`${serviceUrl}/query/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          app_key: appKey,
          timeout: 30000 // 30 second timeout
        })
      });

      const executionTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Query execution failed');
      }

      const data = await response.json();
      
      // Extract columns and rows from the result
      const columns = data.data && data.data.length > 0 ? Object.keys(data.data[0]) : [];
      const rows = data.data || [];

      setResult({
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs,
        query: query.trim()
      });

      // Add to history
      const historyItem: QueryHistory = {
        id: Date.now().toString(),
        query: query.trim(),
        timestamp: Date.now(),
        executionTimeMs,
        success: true
      };
      saveQueryHistory([historyItem, ...queryHistory]);

    } catch (err: any) {
      const executionTimeMs = Date.now() - startTime;
      setError(err.message || 'An error occurred while executing the query');
      
      // Add failed query to history
      const historyItem: QueryHistory = {
        id: Date.now().toString(),
        query: query.trim(),
        timestamp: Date.now(),
        executionTimeMs,
        success: false,
        error: err.message
      };
      saveQueryHistory([historyItem, ...queryHistory]);
    } finally {
      setIsExecuting(false);
    }
  };

  const exportToCSV = () => {
    if (!result || result.rows.length === 0) return;

    const csv = [
      result.columns.join(','),
      ...result.rows.map(row => 
        result.columns.map(col => {
          const value = row[col];
          // Handle values that contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadQueryFromHistory = (historyItem: QueryHistory) => {
    setQuery(historyItem.query);
    setShowHistory(false);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear query history?')) {
      setQueryHistory([]);
      localStorage.removeItem('sql_query_history');
    }
  };

  const loadExample = (example: { name: string; query: string }) => {
    setQuery(example.query);
    setShowExamples(false);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-lg">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">SQL Sandbox</h2>
          </div>
          <div className="text-sm text-gray-500 ml-4">
            {appKey}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            Examples
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            History ({queryHistory.length})
          </button>
          <button
            onClick={executeQuery}
            disabled={isExecuting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Query
              </>
            )}
          </button>
        </div>
      </div>

      {/* Examples Panel */}
      {showExamples && (
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-blue-900">Example Queries</h3>
            <button
              onClick={() => setShowExamples(false)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {getExampleQueries(appKey).map((example, idx) => (
              <button
                key={idx}
                onClick={() => loadExample(example)}
                className="text-left p-3 bg-white rounded-md border border-blue-200 hover:border-blue-400 hover:shadow-sm transition-all"
              >
                <div className="font-medium text-sm text-gray-900 mb-1">{example.name}</div>
                <div className="text-xs text-gray-600 font-mono line-clamp-2">
                  {example.query.split('\n')[0]}...
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <div className="px-6 py-4 bg-slate-50 border-b border-gray-200 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Query History</h3>
            <div className="flex gap-2">
              <button
                onClick={clearHistory}
                className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-600 hover:text-gray-800 text-sm"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {queryHistory.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No query history yet</p>
            ) : (
              queryHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-white rounded-md border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
                  onClick={() => loadQueryFromHistory(item)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {item.success ? (
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                      {item.executionTimeMs && (
                        <span className="text-xs text-gray-400">
                          {item.executionTimeMs}ms
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-700 font-mono line-clamp-2">
                    {item.query}
                  </div>
                  {item.error && (
                    <div className="text-xs text-red-600 mt-1">
                      {item.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={query}
          onChange={(value) => setQuery(value || '')}
          onMount={handleEditorDidMount}
          theme="vs-light"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            renderLineHighlight: 'all',
            bracketPairColorization: { enabled: true }
          }}
        />
      </div>

      {/* Status Bar */}
      <div className="px-6 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4 text-gray-600">
          <div className="flex items-center gap-1">
            <Database className="w-4 h-4" />
            <span>analytics_product_events</span>
          </div>
          {result && (
            <>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{result.executionTimeMs}ms</span>
              </div>
              <div>
                {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </div>
        <div className="text-gray-500">
          Press <kbd className="px-2 py-0.5 bg-gray-200 rounded text-xs">⌘</kbd> + <kbd className="px-2 py-0.5 bg-gray-200 rounded text-xs">Enter</kbd> to run
        </div>
      </div>

      {/* Results */}
      {(result || error) && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {error ? 'Error' : 'Results'}
            </h3>
            {result && result.rows.length > 0 && (
              <button
                onClick={exportToCSV}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>

          {error ? (
            <div className="px-6 py-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-red-900 mb-1">Query Error</div>
                  <div className="text-sm text-red-700 font-mono">{error}</div>
                </div>
              </div>
            </div>
          ) : result && (
            <div className="max-h-96 overflow-auto">
              {result.rows.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  Query executed successfully, but returned no results.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      {result.columns.map((col, idx) => (
                        <th
                          key={idx}
                          className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {result.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-gray-50">
                        {result.columns.map((col, colIdx) => (
                          <td
                            key={colIdx}
                            className="px-4 py-2 text-gray-900 whitespace-nowrap max-w-xs truncate"
                            title={String(row[col])}
                          >
                            {row[col] === null || row[col] === undefined ? (
                              <span className="text-gray-400 italic">null</span>
                            ) : typeof row[col] === 'object' ? (
                              <span className="text-xs font-mono text-blue-600">
                                {JSON.stringify(row[col])}
                              </span>
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

