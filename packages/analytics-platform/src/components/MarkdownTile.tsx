// components/MarkdownTile.tsx
'use client';

import React from 'react';

interface MarkdownTileProps {
  content: string;
  backgroundColor?: string;
  textColor?: string;
}

export default function MarkdownTile({
  content,
  backgroundColor = '#ffffff',
  textColor = '#111827',
}: MarkdownTileProps) {
  // Simple markdown parsing (can be enhanced with a library later)
  const renderMarkdown = (text: string) => {
    return text
      .split('\n')
      .map((line, idx) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={idx} className="text-lg font-semibold mt-4 mb-2">{line.substring(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={idx} className="text-xl font-bold mt-4 mb-2">{line.substring(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={idx} className="text-2xl font-bold mt-4 mb-3">{line.substring(2)}</h1>;
        }
        
        // Bold
        const boldText = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        const italicText = boldText.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Bullet points
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <li key={idx} className="ml-4 mb-1" dangerouslySetInnerHTML={{ __html: italicText.substring(2) }} />
          );
        }
        
        // Links
        const linkText = italicText.replace(
          /\[(.*?)\]\((.*?)\)/g,
          '<a href="$2" class="text-blue-600 hover:underline" target="_blank">$1</a>'
        );
        
        // Regular paragraph
        if (line.trim()) {
          return <p key={idx} className="mb-2" dangerouslySetInnerHTML={{ __html: linkText }} />;
        }
        
        return <br key={idx} />;
      });
  };

  return (
    <div
      className="h-full p-6 overflow-y-auto prose prose-sm max-w-none flex items-center justify-center"
      style={{ backgroundColor, color: textColor }}
    >
      <div className="text-center">
        {renderMarkdown(content)}
      </div>
    </div>
  );
}

// Markdown Editor Component
export function MarkdownEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (content: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 h-96">
      {/* Editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Markdown Content
        </label>
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="# Title&#10;&#10;Write your markdown here...&#10;&#10;- Bullet point&#10;- **Bold text**&#10;- *Italic text*&#10;- [Link](https://example.com)"
          className="w-full h-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm resize-none"
        />
      </div>

      {/* Preview */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Preview
        </label>
        <div className="h-full border border-gray-300 rounded-lg overflow-y-auto bg-white">
          <MarkdownTile content={content} />
        </div>
      </div>
    </div>
  );
}

