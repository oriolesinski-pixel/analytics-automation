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
  X,
  BookOpen,
  Plus,
  Shield,
  ShieldOff
} from 'lucide-react';
import { AppSelector } from './AppSelector';
import { useAppKey } from '@/lib/AppKeyContext';

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
  { id: 'data-contracts', label: 'Data Contracts', icon: BookOpen, path: '/data-contracts', available: true },
  { id: 'ai-wiz', label: 'AI Wiz', icon: Sparkles, path: '/ai-wiz', available: true },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', available: true }
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['workspace']));
  const { appKey, isAdmin, setAdminMode } = useAppKey();

  // Update CSS variable for main content margin
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      isCollapsed ? '4rem' : '16rem'
    );
  }, [isCollapsed]);

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

      <aside className={`fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-50 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 dark:from-indigo-500 dark:to-violet-500 rounded-lg flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 40 30" fill="none" className="w-5 h-4">
                  <path d="M8 17C5 17 3 14.5 4 12C5 9.5 8 8.5 10.5 10C12 5 16.5 2.5 20 3.5C23.5 2.5 28 5 29.5 10C32 8.5 35 9.5 36 12C37 14.5 35 17 32 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 27C10 20 15 20 20 24C25 28 30 28 35 21" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M5 21C10 28 15 28 20 24C25 20 30 20 35 27" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h1 className="text-[15px] font-bold bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent tracking-tight leading-tight">
                  Glint
                </h1>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 font-semibold tracking-[0.08em] uppercase leading-tight">
                  Analytics Automation
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>

        {/* App Selector */}
        {!isCollapsed && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <AppSelector variant="sidebar" />
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
                        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                        : isDisabled
                        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
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

        {/* Add New App Button */}
        {!isCollapsed ? (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <Link
              href="/onboarding"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Add New App</span>
            </Link>
          </div>
        ) : (
          <div className="px-2 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-center">
            <Link
              href="/onboarding"
              className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
              title="Add New App"
            >
              <Plus className="w-5 h-5" />
            </Link>
          </div>
        )}

        {/* Footer: App Key + Admin Toggle */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              App Key: <code className="text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">{appKey || 'None'}</code>
            </div>
            <button
              onClick={() => setAdminMode(!isAdmin)}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isAdmin
                  ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={isAdmin ? 'Disable admin mode (shows all apps data)' : 'Enable admin mode to see all apps data'}
            >
              {isAdmin ? (
                <>
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Mode</span>
                  <span className="ml-auto text-[10px] bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded-full">ON</span>
                </>
              ) : (
                <>
                  <ShieldOff className="w-3.5 h-3.5" />
                  <span>Tenant Isolated</span>
                  <span className="ml-auto text-[10px] bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full">Secure</span>
                </>
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
