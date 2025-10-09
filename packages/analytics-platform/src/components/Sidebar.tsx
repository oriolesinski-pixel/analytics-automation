'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  LineChart, 
  Settings, 
  Sparkles, 
  Activity,
  LayoutDashboard,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { AppSelector } from './AppSelector';

interface NavItem {
  id: string;
  label: string;
  icon: any;
  path?: string;
  available: boolean;
  children?: NavItem[];
}

const SECTIONS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3, path: '/overview', available: true },
  { id: 'analytics', label: 'Analytics', icon: LineChart, path: '/analytics', available: true },
  { 
    id: 'workspace', 
    label: 'Workspace', 
    icon: FolderOpen, 
    available: true,
    children: [
      { id: 'tiles', label: 'My Tiles', icon: BarChart3, path: '/workspace', available: true },
      { id: 'dashboards', label: 'Dashboards', icon: LayoutDashboard, path: '/dashboards', available: true }
    ]
  },
  { id: 'events', label: 'Events', icon: Activity, path: '/events', available: true },
  { id: 'ai-wiz', label: 'AI Wiz', icon: Sparkles, path: '/ai-wiz', available: false },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', available: false }
];

interface App {
  app_key: string;
  name?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['workspace']));
  const [selectedApp, setSelectedApp] = useState('');

  // Update CSS variable for main content margin
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      isCollapsed ? '4rem' : '16rem'
    );
  }, [isCollapsed]);

  // Get selected app from storage
  useEffect(() => {
    const storedKey = localStorage.getItem('app_key') || sessionStorage.getItem('app_key');
    if (storedKey) {
      setSelectedApp(storedKey);
    }
  }, []);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      <aside className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-200 flex flex-col z-50 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
                  Analytics E2E Automation
                </h1>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <Menu className="w-5 h-5 text-gray-600" />
            ) : (
              <X className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* App Selector */}
        {!isCollapsed && (
          <div className="p-4 border-b border-gray-200">
            <AppSelector variant="sidebar" onAppChange={setSelectedApp} />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = section.path ? pathname?.startsWith(section.path) : false;
            const isDisabled = !section.available;
            const hasChildren = section.children && section.children.length > 0;
            const isExpanded = expandedSections.has(section.id);
            
            return (
              <div key={section.id}>
                {/* Parent Item */}
                {hasChildren ? (
                  <button
                    onClick={() => !isDisabled && toggleSection(section.id)}
                    disabled={isDisabled}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all relative
                      ${isDisabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                    title={isCollapsed ? section.label : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-left">{section.label}</span>
                        {!isDisabled && (
                          isExpanded ? 
                            <ChevronDown className="w-4 h-4" /> : 
                            <ChevronRight className="w-4 h-4" />
                        )}
                        {isDisabled && (
                          <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">Soon</span>
                        )}
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={isDisabled ? '#' : section.path!}
                    className={`
                      flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all relative
                      ${isActive 
                        ? 'bg-blue-50 text-blue-700' 
                        : isDisabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                    onClick={(e) => isDisabled && e.preventDefault()}
                    title={isCollapsed ? section.label : undefined}
                  >
                    {isActive && !isCollapsed && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r" />
                    )}
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium">{section.label}</span>
                        {isDisabled && (
                          <span className="ml-auto text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">Soon</span>
                        )}
                      </>
                    )}
                  </Link>
                )}

                {/* Children Items */}
                {hasChildren && isExpanded && !isCollapsed && (
                  <div className="ml-4 mt-1 space-y-1">
                    {section.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = child.path ? pathname === child.path : false;
                      
                      return (
                        <Link
                          key={child.id}
                          href={child.path!}
                          className={`
                            flex items-center gap-3 px-4 py-2 mx-2 rounded-lg transition-all relative
                            ${isChildActive 
                              ? 'bg-blue-50 text-blue-700' 
                              : 'text-gray-600 hover:bg-gray-50'
                            }
                          `}
                        >
                          {isChildActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r" />
                          )}
                          <ChildIcon className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              App Key: <code className="text-gray-700 bg-gray-100 px-1 py-0.5 rounded text-xs">{selectedApp || 'None'}</code>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
