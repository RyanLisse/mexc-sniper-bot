import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Make React available globally for JSX
global.React = React;

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  })),
  QueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock MEXC data hooks
vi.mock('@/src/hooks/use-mexc-data', () => ({
  useMexcConnectivity: vi.fn(() => ({
    data: {
      connected: true,
      credentialSource: 'database',
      timestamp: new Date().toISOString(),
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

// Mock API credentials hooks
vi.mock('@/src/hooks/use-api-credentials', () => ({
  useApiCredentials: vi.fn(() => ({
    data: {
      hasCredentials: false,
      provider: 'mexc',
      lastUpdated: null,
    },
    isLoading: false,
    error: null,
  })),
  useSaveApiCredentials: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  })),
  useDeleteApiCredentials: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  })),
  useTestApiCredentials: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({
      success: true,
      connected: true,
      balanceCount: 5
    }),
    isPending: false,
  })),
}));

// Global test setup
global.fetch = vi.fn();
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
