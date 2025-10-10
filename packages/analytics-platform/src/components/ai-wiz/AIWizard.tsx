'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sparkles, Save, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { DynamicChart } from './DynamicChart'
import { validateQuerySpec } from './QuerySpecValidator'

interface AIWizResponse {
  naturalLanguageAnswer: string
  querySpec: {
    measure: string
    dimensions: string[]
    filters: Array<{
      field: string
      operator: 'eq' | 'between' | 'gt' | 'lt' | 'contains'
      value: any
    }>
    sort?: { field: string; order: 'asc' | 'desc' }
    limit?: number
  }
  visualizationSpec: {
    type: 'bar' | 'line' | 'pie' | 'table' | 'metric'
    xField?: string
    yField?: string
    orientation?: 'horizontal' | 'vertical'
    color?: string
  }
  followUpSuggestions: string[]
}

export function AIWizard({ appId }: { appId: string }) {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<AIWizResponse | null>(null)
  const [queryData, setQueryData] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showQueryDetails, setShowQueryDetails] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleAsk = async () => {
    if (!prompt.trim()) return
    
    setIsLoading(true)
    setError(null)
    setResponse(null)
    setQueryData([])
    setSaveSuccess(false)
    
    try {
      // Step 1: Get analytics schema
      console.log('Fetching schema for appId:', appId)
      const schemaRes = await fetch(`/api/analytics/${appId}/schema`)
      console.log('Schema response status:', schemaRes.status)
      
      if (!schemaRes.ok) {
        const errorData = await schemaRes.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Schema fetch failed:', errorData)
        throw new Error(errorData.error || 'Failed to fetch analytics schema')
      }
      const schema = await schemaRes.json()
      console.log('Schema loaded:', schema)
      
      // Step 2: Send to LLM
      const aiRes = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: prompt,
          schema: {
            measures: schema.measures?.map((m: any) => m.name) || [],
            dimensions: schema.dimensions?.map((d: any) => d.name) || [],
            currentDate: new Date().toISOString().split('T')[0]
          }
        })
      })
      
      if (!aiRes.ok) {
        throw new Error('Failed to get AI response')
      }
      
      const aiResponse: AIWizResponse = await aiRes.json()
      
      // Step 3: Validate query spec
      validateQuerySpec(aiResponse.querySpec, schema)
      
      // Step 4: Execute query
      const dataRes = await fetch(`/api/analytics/${appId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiResponse.querySpec)
      })
      
      if (!dataRes.ok) {
        throw new Error('Failed to execute query')
      }
      
      const data = await dataRes.json()
      
      setResponse(aiResponse)
      setQueryData(data.rows || [])
      
    } catch (err) {
      console.error('AI Wizard error:', err)
      setError(err instanceof Error ? err.message : 'Failed to process query')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFollowUp = (question: string) => {
    setPrompt(question)
    setTimeout(() => handleAsk(), 100)
  }

  const handleSaveAsTile = async () => {
    if (!response) return
    
    setSaveLoading(true)
    try {
      const res = await fetch(`/api/tiles/${appId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prompt.slice(0, 50),
          querySpec: response.querySpec,
          visualizationSpec: response.visualizationSpec
        })
      })
      
      if (!res.ok) {
        throw new Error('Failed to save tile')
      }
      
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Save tile error:', err)
      setError('Failed to save to dashboard')
    } finally {
      setSaveLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">AI Analytics Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Ask questions in natural language and get instant insights
          </p>
        </div>
      </div>

      {/* Prompt Input */}
      <div className="space-y-3">
        <Textarea
          placeholder="Ask anything about your analytics... e.g., 'What were my top pages last month?' or 'Show me user trends over time'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleAsk()
            }
          }}
          className="min-h-[100px] text-base resize-none transition-all duration-200 focus:ring-2 focus:ring-purple-500"
          disabled={isLoading}
        />
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            Press ⌘ + Enter to ask
          </span>
          <Button 
            onClick={handleAsk} 
            disabled={!prompt.trim() || isLoading}
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Ask AI
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="transition-all duration-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      )}

      {/* Response */}
      {response && !isLoading && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Natural Language Insight */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800 transition-all duration-200 hover:shadow-md">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
              <p className="text-base leading-relaxed text-gray-800 dark:text-gray-200">
                {response.naturalLanguageAnswer}
              </p>
            </div>
          </div>

          {/* Visualization */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 shadow-sm transition-all duration-200">
            <DynamicChart 
              spec={response.visualizationSpec}
              data={queryData}
            />
          </div>

          {/* Actions Row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Button 
              variant="outline" 
              onClick={handleSaveAsTile}
              disabled={saveLoading || saveSuccess}
              className="gap-2 transition-all duration-200 hover:border-purple-400 hover:text-purple-600"
            >
              <Save className="w-4 h-4" />
              {saveSuccess ? 'Saved!' : saveLoading ? 'Saving...' : 'Save to Dashboard'}
            </Button>
            
            {/* Query Details (collapsible) */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowQueryDetails(!showQueryDetails)}
              className="gap-2"
            >
              {showQueryDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              View Query Details
            </Button>
          </div>

          {/* Query Details Panel */}
          {showQueryDetails && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Query Specification
              </h3>
              <pre className="text-xs bg-white dark:bg-gray-950 p-4 rounded border overflow-auto">
                {JSON.stringify(response.querySpec, null, 2)}
              </pre>
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Visualization Specification
              </h3>
              <pre className="text-xs bg-white dark:bg-gray-950 p-4 rounded border overflow-auto">
                {JSON.stringify(response.visualizationSpec, null, 2)}
              </pre>
            </div>
          )}

          {/* Follow-up Suggestions */}
          {response.followUpSuggestions && response.followUpSuggestions.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Related questions you might ask:
              </p>
              <div className="flex flex-wrap gap-2">
                {response.followUpSuggestions.map((suggestion, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleFollowUp(suggestion)}
                    className="text-sm transition-all duration-200 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 dark:hover:bg-purple-950/20"
                  >
                    {suggestion} →
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!response && !isLoading && !error && (
        <div className="text-center py-12 space-y-4">
          <div className="inline-flex p-4 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-full">
            <Sparkles className="w-8 h-8 text-purple-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Start with a question</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Try asking about user trends, top pages, conversion rates, or any metric you're curious about
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center pt-4">
            {[
              "What were my top 5 pages last week?",
              "Show me user trends this month",
              "What's my conversion rate today?"
            ].map((example, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => setPrompt(example)}
                className="text-sm"
              >
                {example}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

