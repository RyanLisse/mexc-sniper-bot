/**
 * Component Test Utilities
 * Provides helpers and utilities for comprehensive React component testing
 */

import { render, RenderOptions, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock providers and contexts
export const createMockQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

// Mock Supabase auth context
export const mockSupabaseAuthContext = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email_verified: true,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    role: 'authenticated',
  },
  session: {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: Date.now() + 3600000,
    token_type: 'bearer',
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email_verified: true,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      role: 'authenticated',
    },
  },
  isLoading: false,
  error: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
};

// All providers wrapper for components
interface AllProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export const AllProviders = ({ children, queryClient }: AllProvidersProps) => {
  const client = queryClient || createMockQueryClient();
  
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
};

// Custom render function with all necessary providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  wrapper?: React.ComponentType<any>;
}

export const renderWithProviders = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { queryClient, wrapper, ...renderOptions } = options;
  
  const Wrapper = wrapper || (({ children }: { children: ReactNode }) => 
    <AllProviders queryClient={queryClient}>{children}</AllProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock data factories
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockApiCredentials = (overrides = {}) => ({
  id: 'test-creds-123',
  userId: 'test-user-123',
  mexcApiKey: 'encrypted_test-api-key',
  mexcSecretKey: 'encrypted_test-secret-key',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockTradingData = (overrides = {}) => ({
  symbol: 'BTCUSDT',
  price: 45000,
  quantity: 0.001,
  side: 'BUY',
  type: 'MARKET',
  status: 'FILLED',
  timestamp: new Date(),
  ...overrides,
});

export const createMockBalance = (overrides = {}) => ({
  asset: 'USDT',
  free: '1000.00',
  locked: '0.00',
  total: '1000.00',
  ...overrides,
});

export const createMockPatternData = (overrides = {}) => ({
  id: 'pattern-123',
  symbol: 'BTCUSDT',
  patternType: 'BULLISH_BREAKOUT',
  confidence: 0.85,
  timestamp: new Date(),
  indicators: {
    rsi: 65,
    macd: 0.02,
    volume: 1000000,
  },
  ...overrides,
});

// Helper functions for testing interactions
export const userEvent = {
  click: (element: HTMLElement) => fireEvent.click(element),
  type: (element: HTMLElement, text: string) => fireEvent.change(element, { target: { value: text } }),
  submit: (form: HTMLElement) => fireEvent.submit(form),
  keyDown: (element: HTMLElement, key: string) => fireEvent.keyDown(element, { key }),
  focus: (element: HTMLElement) => fireEvent.focus(element),
  blur: (element: HTMLElement) => fireEvent.blur(element),
};

// Accessibility helpers
export const axeMatchers = {
  toHaveNoViolations: (received: any) => {
    const pass = received.violations.length === 0;
    if (pass) {
      return {
        message: () => 'Expected element to have accessibility violations',
        pass: true,
      };
    } else {
      return {
        message: () => `Expected element to have no accessibility violations, but found ${received.violations.length}`,
        pass: false,
      };
    }
  },
};

// Mock API responses
export const mockApiResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
  headers: new Headers({ 'content-type': 'application/json' }),
});

// Wait for async operations
export const waitForAsync = async (callback: () => void, timeout = 5000) => {
  return await waitFor(callback, { timeout });
};

// Component visibility checks
export const expectVisible = (element: HTMLElement | null) => {
  expect(element).toBeInTheDocument();
  expect(element).toBeVisible();
};

export const expectHidden = (element: HTMLElement | null) => {
  expect(element).not.toBeInTheDocument();
};

// Form testing helpers
export const fillForm = (formData: Record<string, string>) => {
  Object.entries(formData).forEach(([name, value]) => {
    const input = screen.getByRole('textbox', { name: new RegExp(name, 'i') }) ||
                 screen.getByLabelText(new RegExp(name, 'i'));
    userEvent.type(input, value);
  });
};

export const submitForm = () => {
  const submitButton = screen.getByRole('button', { name: /submit|save|confirm/i });
  userEvent.click(submitButton);
};

// Error boundary testing
export const ErrorBoundaryTestComponent = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error for error boundary');
  }
  return <div>Test component</div>;
};

// Mock window methods - LEGACY: Most browser APIs are now handled by comprehensive-browser-environment.ts
export const mockWindowMethods = () => {
  console.log('📝 Component helpers: Using comprehensive browser environment (most methods already available)')
  
  // This function is kept for backwards compatibility but is mostly redundant
  // The comprehensive browser environment handles localStorage, sessionStorage, matchMedia, etc.
  
  // Any component-specific overrides can be added here if needed
};

// Component performance testing helpers
export const measureRenderTime = async (component: ReactElement): Promise<number> => {
  const start = performance.now();
  renderWithProviders(component);
  const end = performance.now();
  return end - start;
};

export const expectFastRender = async (component: ReactElement, maxTime = 100) => {
  const renderTime = await measureRenderTime(component);
  expect(renderTime).toBeLessThan(maxTime);
};

// Mock intersection observer for components that use it - LEGACY: Now handled by comprehensive environment
export const mockIntersectionObserver = () => {
  console.log('📝 Component helpers: IntersectionObserver already available via comprehensive environment')
  
  // This function is kept for backwards compatibility
  // The comprehensive browser environment already provides IntersectionObserver
};

// Component state testing
export const expectComponentState = (component: any, expectedState: any) => {
  Object.entries(expectedState).forEach(([key, value]) => {
    expect(component.state[key]).toBe(value);
  });
};

// Mock resize observer - LEGACY: Now handled by comprehensive environment
export const mockResizeObserver = () => {
  console.log('📝 Component helpers: ResizeObserver already available via comprehensive environment')
  
  // This function is kept for backwards compatibility
  // The comprehensive browser environment already provides ResizeObserver
};

// Testing utilities export
export const testUtils = {
  createMockQueryClient,
  mockSupabaseAuthContext,
  renderWithProviders,
  createMockUser,
  createMockApiCredentials,
  createMockTradingData,
  createMockBalance,
  createMockPatternData,
  userEvent,
  axeMatchers,
  mockApiResponse,
  waitForAsync,
  expectVisible,
  expectHidden,
  fillForm,
  submitForm,
  ErrorBoundaryTestComponent,
  mockWindowMethods,
  measureRenderTime,
  expectFastRender,
  mockIntersectionObserver,
  expectComponentState,
  mockResizeObserver,
};

export default testUtils;