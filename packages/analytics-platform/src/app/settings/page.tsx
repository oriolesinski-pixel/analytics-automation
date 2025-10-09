import { Settings as SettingsIcon, Key, Database, Code, Zap } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your app configuration and analytics schema</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Coming Soon Card */}
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <SettingsIcon className="w-20 h-20 text-gray-600 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">Coming Soon</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-8">
              Configure your apps, regenerate schemas, analyze code, and manage integrations all in one place.
            </p>
            
            {/* Feature Preview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto mt-8">
              <FeatureCard
                icon={Key}
                title="API Keys"
                description="Manage authentication"
              />
              <FeatureCard
                icon={Database}
                title="Schema"
                description="Event type configuration"
              />
              <FeatureCard
                icon={Code}
                title="Integration"
                description="Code snippets & SDK"
              />
              <FeatureCard
                icon={Zap}
                title="Performance"
                description="Optimize tracking"
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
      <Icon className="w-8 h-8 text-gray-600 mb-3" />
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

