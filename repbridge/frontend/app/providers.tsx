'use client';

import { WagmiProvider } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { useState, useEffect, ReactNode, useMemo } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  
  // Only create config on client side
  const config = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return getDefaultConfig({
      appName: 'RepBridge',
      projectId: 'repbridge-demo',
      chains: [base, baseSepolia],
      ssr: false,
    });
  }, []);

  const queryClient = useMemo(() => new QueryClient(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show nothing during SSR and initial hydration
  if (!mounted || !config) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading RepBridge...</div>
    </div>;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
