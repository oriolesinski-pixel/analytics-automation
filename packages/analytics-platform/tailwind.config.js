/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../analytics-ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-blue-500',
    'text-white',
    'p-4',
    'rounded-lg',
    'mb-4',
    'bg-gray-950',
    'bg-gray-900',
    'bg-gray-800',
    'text-gray-400',
    'border-gray-800'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}