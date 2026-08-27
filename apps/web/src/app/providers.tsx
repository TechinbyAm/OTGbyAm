'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { useState } from 'react';
import { COLORS, FONTS } from '@/utils/theme';

/** Create a client that persists across re-renders */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function Providers({ children }: { children: ReactNode }) {
  // Initialize query client once
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* On-brand toast styling — sonner's `richColors` is its own generic
          green/red/blue palette, not this app's brand colors. White surface
          + app border/radius/shadow + DM Sans, with a colored left accent
          per type (teal/terracotta/navy) instead. Hex values must stay in
          sync with COLORS in theme.ts — Tailwind arbitrary-value classes
          can't reference a JS import. */}
      <Toaster
        position="top-right"
        toastOptions={{
          unstyled: false,
          style: {
            fontFamily: FONTS.body,
            color: COLORS.ink,
            background: COLORS.white,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '1rem',
            boxShadow: '0 8px 24px rgba(20,33,61,0.14)',
            padding: '0.9rem 1.1rem',
          },
          classNames: {
            title: 'text-sm font-medium',
            description: 'text-sm',
            success: '![border-left:4px_solid_#2C5F5A]',
            error: '![border-left:4px_solid_#C4622A]',
            warning: '![border-left:4px_solid_#C9A227]',
            info: '![border-left:4px_solid_#07325F]',
          },
        }}
      />
    </QueryClientProvider>
  );
}
