'use client';

import { ToastProvider } from '@/components/ui/toast';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AppKeyProvider } from '@/lib/AppKeyContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppKeyProvider>
        <ToastProvider>{children}</ToastProvider>
      </AppKeyProvider>
    </ThemeProvider>
  );
}

