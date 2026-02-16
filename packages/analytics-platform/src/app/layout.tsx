// // packages/analytics-platform/src/app/layout.tsx
// import type { Metadata } from 'next';
// import { Inter } from 'next/font/google';
// import './globals.css';

// const inter = Inter({ subsets: ['latin'] });

// export const metadata: Metadata = {
//   title: 'Analytics Platform - Real-time Insights',
//   description: 'Advanced multi-tenant analytics dashboard with real-time data streaming',
// };

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return (
//     <html lang="en">
//       <body className={inter.className}>{children}</body>
//     </html>
//   );
// }

import type { Metadata } from 'next';
import { Sidebar } from '@/components/Sidebar';
import { GlobalHeader } from '@/components/GlobalHeader';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Glint — Analytics Automation',
  description: 'Analytics automation platform — infra to insights',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 dark:bg-gray-900">
        <Providers>
          <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar />
            <div className="flex-1 transition-all duration-300 bg-gray-50 dark:bg-gray-900" style={{ marginLeft: 'var(--sidebar-width, 16rem)' }}>
              <GlobalHeader />
              <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}