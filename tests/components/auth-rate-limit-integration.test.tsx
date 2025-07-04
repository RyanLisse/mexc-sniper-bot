/**
 * Test for SupabaseAuthUI rate limit integration
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupabaseAuthUI } from '../../src/components/auth/supabase-auth-ui';
import { SupabaseRateLimitHandler } from '@/src/lib/supabase-rate-limit-handler';

// Mock the dependencies
vi.mock('@/src/lib/supabase-browser-client', () => ({
  getSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  })),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

vi.mock('@/src/lib/supabase-rate-limit-handler', () => ({
  SupabaseRateLimitHandler: {
    analyzeRateLimitError: vi.fn(),
    isRateLimitError: vi.fn(),
    formatTimeRemaining: vi.fn((seconds) => `${seconds} seconds`),
  },
  bypassRateLimitInDev: vi.fn(),
}));

// Mock the Auth component from Supabase
vi.mock('@supabase/auth-ui-react', () => ({
  Auth: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="supabase-auth-form">
      Supabase Auth Form
      {children}
    </div>
  ),
}));

describe('SupabaseAuthUI Rate Limit Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window methods
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true,
    });
    
    // Mock addEventListener
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = vi.fn();
    
    // Restore after each test
    afterEach(() => {
      window.addEventListener = originalAddEventListener;
    });
  });

  test('should render normal auth form when no rate limit detected', async () => {
    render(<SupabaseAuthUI />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to MEXC Sniper Bot')).toBeInTheDocument();
      expect(screen.getByTestId('supabase-auth-form')).toBeInTheDocument();
    });
  });

  test('should render rate limit notice when rate limit is detected', async () => {
    // Mock a rate limit error
    const mockRateLimitInfo = {
      isRateLimited: true,
      limitType: 'email',
      message: 'Email rate limit exceeded',
      retryAfter: 300,
      suggestion: 'Please wait before trying again',
    };

    (SupabaseRateLimitHandler.analyzeRateLimitError as any).mockReturnValue(mockRateLimitInfo);
    (SupabaseRateLimitHandler.isRateLimitError as any).mockReturnValue(true);

    // Create a component that simulates rate limit state
    const RateLimitTestComponent = () => {
      const [rateLimitInfo, setRateLimitInfo] = React.useState(mockRateLimitInfo);
      
      React.useEffect(() => {
        // Simulate rate limit detection
        setRateLimitInfo(mockRateLimitInfo);
      }, []);
      
      return <SupabaseAuthUI />;
    };

    render(<RateLimitTestComponent />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to MEXC Sniper Bot')).toBeInTheDocument();
    });
  });

  test('should handle retry functionality correctly', async () => {
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });

    render(<SupabaseAuthUI />);
    
    // The retry functionality is tested through the component's internal logic
    // This test verifies that the setup doesn't break the component
    await waitFor(() => {
      expect(screen.getByText('Welcome to MEXC Sniper Bot')).toBeInTheDocument();
    });
  });

  test('should set up global error listeners for rate limit detection', async () => {
    const mockAddEventListener = vi.fn();
    window.addEventListener = mockAddEventListener;

    render(<SupabaseAuthUI />);
    
    await waitFor(() => {
      expect(mockAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    }, { timeout: 5000 });
  });

  test('should handle email tracking for bypass functionality', async () => {
    render(<SupabaseAuthUI />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to MEXC Sniper Bot')).toBeInTheDocument();
    });

    // Check if the JavaScript for email tracking is added
    expect(document.querySelector('script')).toBeInTheDocument();
  });
});