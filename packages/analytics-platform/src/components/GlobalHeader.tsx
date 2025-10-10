'use client';

import { Bell, Search, User } from 'lucide-react';

export function GlobalHeader() {
  return (
    <header className="sticky top-0 right-0 left-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-30 flex items-center justify-end px-8">
      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Search">
          <Search className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Notifications */}
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors relative" title="Notifications">
          <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 dark:bg-blue-500 rounded-full"></span>
        </button>

        {/* User Menu */}
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Account">
          <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    </header>
  );
}

