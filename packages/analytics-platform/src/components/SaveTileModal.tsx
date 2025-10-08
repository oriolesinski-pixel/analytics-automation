// components/SaveTileModal.tsx
'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface SaveTileModalProps {
  onSave: (name: string, description?: string) => Promise<void>;
  onCancel: () => void;
  initialName?: string;
  initialDescription?: string;
}

export default function SaveTileModal({
  onSave,
  onCancel,
  initialName = '',
  initialDescription = '',
}: SaveTileModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Tile name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(name.trim(), description.trim() || undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to save tile');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Save Tile</h2>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSaving}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="tile-name" className="block text-sm font-medium text-gray-700 mb-1">
              Tile Name <span className="text-red-500">*</span>
            </label>
            <input
              id="tile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Page Views"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isSaving}
              autoFocus
              maxLength={255}
            />
          </div>

          <div>
            <label htmlFor="tile-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="tile-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this tile shows..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              disabled={isSaving}
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving || !name.trim()}
            >
              {isSaving ? 'Saving...' : 'Save Tile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

