/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082',
    NEXT_PUBLIC_GENERATOR_API_URL: process.env.NEXT_PUBLIC_GENERATOR_API_URL || 'http://localhost:8081',
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
  async rewrites() {
    return [
      // Only proxy specific analytics service endpoints, not all /api routes
      {
        source: '/api/query/:path*',
        destination: 'http://localhost:8082/query/:path*',
      },
      {
        source: '/api/ingest/:path*',
        destination: 'http://localhost:8082/ingest/:path*',
      },
      {
        source: '/api/events/:path*',
        destination: 'http://localhost:8082/events/:path*',
      },
    ];
  },
  // Handle CORS for development
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: 'http://localhost:8082',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
