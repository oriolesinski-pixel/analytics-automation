import { Sparkles, MessageSquare, BarChart3, Brain, Zap } from 'lucide-react';

export default function AIWizPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">AI Analytics Wizard</h1>
          </div>
          <p className="text-gray-600">Ask questions about your data in natural language</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* Coming Soon Card */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-12 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-2xl mb-6">
              <Brain className="w-10 h-10 text-purple-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">Coming Soon</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-8">
              AI-powered chat interface for querying analytics data and generating charts on the fly. Natural language to insights in seconds.
            </p>
            
            {/* Example Prompts Preview */}
            <div className="mt-8 text-left max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                <p className="text-sm font-semibold text-gray-900">Example prompts:</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "What's my conversion rate this week?",
                  "Show me top 5 pages by traffic",
                  "Compare button clicks by CTA type",
                  "What's the average session duration?"
                ].map((prompt, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-gray-700 bg-white rounded-lg px-4 py-3 border border-purple-100">
                    <BarChart3 className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <span>{prompt}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-12">
              <FeatureCard
                icon={MessageSquare}
                title="Natural Language"
                description="Ask questions in plain English"
              />
              <FeatureCard
                icon={BarChart3}
                title="Instant Charts"
                description="Auto-generate visualizations"
              />
              <FeatureCard
                icon={Zap}
                title="Smart Insights"
                description="AI-powered recommendations"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <Icon className="w-8 h-8 text-purple-600 mb-3" />
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

