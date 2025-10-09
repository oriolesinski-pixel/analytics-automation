'use client';

import { Bell, Search, User } from 'lucide-react';

export function GlobalHeader() {
  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-end px-8">
      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Search">
          <Search className="w-5 h-5 text-gray-600" />
        </button>

        {/* Notifications */}
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative" title="Notifications">
          <Bell className="w-5 h-5 text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
        </button>

        {/* User Menu */}
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Account">
          <User className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </header>
  );
}

