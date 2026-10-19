'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { DialogProvider } from '@/components/dialog-provider';
import { registerAppWorker } from '@/lib/pwa';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Application installable et page hors ligne sur tout le site
    registerAppWorker();
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DialogProvider>{children}</DialogProvider>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}