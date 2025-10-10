'use client'

import { useState, useEffect } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'
import { AIWizard } from '@/components/ai-wiz/AIWizard'

interface App {
  app_key: string
  name: string
}

export default function AIWizPage() {
  const [selectedApp, setSelectedApp] = useState<string>('')
  const [apps, setApps] = useState<App[]>([])
  const [showAppDropdown, setShowAppDropdown] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchApps()
  }, [])

  const fetchApps = async () => {
    setLoading(true)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const response = await fetch(`${supabaseUrl}/rest/v1/apps?select=*`, {
        headers: {
          'apikey': supabaseAnonKey || '',
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      })

      const data = await response.json()
      console.log('[AI Wiz] Fetched apps:', data)
      setApps(data)
      
      if (data.length > 0) {
        // Select the most recently created app (last in the array)
        const latestApp = data[data.length - 1]
        console.log('[AI Wiz] Selected app:', latestApp)
        setSelectedApp(latestApp.app_key)
      }
    } catch (error) {
      console.error('Failed to fetch apps:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Analytics Wizard</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ask questions about your data in natural language</p>
              </div>
            </div>

            {/* App Selector */}
            {apps.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowAppDropdown(!showAppDropdown)}
                  className="flex flex-col items-end px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      {apps.find(a => a.app_key === selectedApp)?.name || 'Select App'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                    {selectedApp}
                  </span>
                </button>

                {showAppDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                    {apps.map(app => (
                      <button
                        key={app.app_key}
                        onClick={() => {
                          console.log('[AI Wiz] User selected app:', app.app_key)
                          setSelectedApp(app.app_key)
                          setShowAppDropdown(false)
                        }}
                        className="w-full flex flex-col items-start px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-gray-700 dark:text-gray-200 font-medium">{app.name || 'Unnamed App'}</span>
                          {app.app_key === selectedApp && (
                            <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">{app.app_key}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : !selectedApp ? (
          <div className="max-w-5xl mx-auto px-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400">No apps found. Please create an app first.</p>
            </div>
          </div>
        ) : (
          <AIWizard appId={selectedApp} />
        )}
      </div>
    </div>
  )
}

