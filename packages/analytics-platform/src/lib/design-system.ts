// Reusable class name strings for consistency

export const DS = {
  // Layout
  page: 'min-h-screen bg-gray-50',
  container: 'max-w-7xl mx-auto',
  card: 'bg-white rounded-xl border border-gray-200 shadow-sm',
  
  // Typography
  h1: 'text-3xl font-bold text-gray-900',
  h2: 'text-2xl font-semibold text-gray-900',
  h3: 'text-lg font-semibold text-gray-900',
  body: 'text-sm text-gray-700',
  muted: 'text-sm text-gray-600',
  
  // Buttons
  button: {
    primary: 'px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    secondary: 'px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2',
    ghost: 'px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors',
  },
  
  // Form inputs
  input: 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  select: 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white',
  
  // States
  disabled: 'opacity-50 cursor-not-allowed',
  loading: 'animate-pulse',
};

// Usage example:
// <button className={DS.button.primary}>Save</button>
// <div className={DS.card}>Content</div>

