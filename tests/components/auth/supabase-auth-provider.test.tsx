/**
 * Supabase Auth Provider Component Tests
 * Tests authentication state management, context provider, and user flows
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { SupabaseAuthProvider, useSupabaseAuth } from '@/components/auth/supabase-auth-provider-clean';
import { componentMocks } from '@/tests/fixtures/component-mocks';

// Mock Next.js router
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
  },
};

vi.mock('@/src/lib/supabase-browser-client', () => ({
  getSupabaseBrowserClient: () => mockSupabaseClient,
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test component to access auth context
const TestComponent = () => {
  const auth = useSupabaseAuth();
  return (
    <div>
      <div data-testid="user-email">{auth.user?.email || 'No user'}</div>
      <div data-testid="session-status">{auth.session ? 'Has session' : 'No session'}</div>
      <div data-testid="loading-status">{auth.isLoading ? 'Loading' : 'Not loading'}</div>
      <div data-testid="hydrated-status">{auth.isHydrated ? 'Hydrated' : 'Not hydrated'}</div>
      <button onClick={() => auth.signOut()} data-testid="sign-out-btn">Sign Out</button>
      <button onClick={() => auth.signIn('test@example.com', 'password')} data-testid="sign-in-btn">Sign In</button>
      <button onClick={() => auth.signUp('test@example.com', 'password')} data-testid="sign-up-btn">Sign Up</button>
      <button onClick={() => auth.signInWithProvider('google')} data-testid="google-signin-btn">Google Sign In</button>
    </div>
  );
};

describe('SupabaseAuthProvider', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Provider Initialization', () => {
    it('should render children and provide auth context', async () => {
      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      expect(screen.getByTestId('user-email')).toHaveTextContent('No user');
      expect(screen.getByTestId('session-status')).toHaveTextContent('No session');
      
      await waitFor(() => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('Not loading');
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('hydrated-status')).toHaveTextContent('Hydrated');
      });
    });

    it('should initialize with provided session', async () => {
      render(
        <SupabaseAuthProvider initialSession={componentMocks.session}>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('session-status')).toHaveTextContent('Has session');
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Not loading');
    });

    it('should handle missing Supabase client gracefully', async () => {
      vi.mocked(vi.doMock('@/src/lib/supabase-browser-client', () => ({
        getSupabaseBrowserClient: () => null,
      })));

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading-status')).toHaveTextContent('Not loading');
      });
    });
  });

  describe('Session Management', () => {
    it('should fetch session on mount when no initial session', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: componentMocks.session },
        error: null,
      });

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      await waitFor(() => {
        expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled();
        expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      });
    });

    it('should handle session fetch errors', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Session fetch failed'),
      });

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('No user');
        expect(screen.getByTestId('session-status')).toHaveTextContent('No session');
      });
    });

    it('should handle session fetch exceptions', async () => {
      mockSupabaseClient.auth.getSession.mockRejectedValue(new Error('Network error'));

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toHaveTextContent('No user');
        expect(screen.getByTestId('session-status')).toHaveTextContent('No session');
      });
    });
  });

  describe('Auth State Changes', () => {
    it('should handle SIGNED_IN event', async () => {
      const mockCallback = vi.fn();
      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
        mockCallback.mockImplementation(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      // Simulate sign in event
      await act(async () => {
        await mockCallback('SIGNED_IN', componentMocks.session);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/supabase-session', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('should handle SIGNED_OUT event', async () => {
      const mockCallback = vi.fn();
      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
        mockCallback.mockImplementation(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      // Simulate sign out event
      await act(async () => {
        await mockCallback('SIGNED_OUT', null);
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth');
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('should handle TOKEN_REFRESHED event', async () => {
      const mockCallback = vi.fn();
      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
        mockCallback.mockImplementation(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      // Simulate token refresh event
      await act(async () => {
        await mockCallback('TOKEN_REFRESHED', componentMocks.session);
      });

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('should handle failed database sync on sign in', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const mockCallback = vi.fn();
      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
        mockCallback.mockImplementation(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      // Simulate sign in event
      await act(async () => {
        await mockCallback('SIGNED_IN', componentMocks.session);
      });

      // Should still refresh router even if sync fails
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('Authentication Actions', () => {
    it('should handle successful sign out', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      const signOutBtn = screen.getByTestId('sign-out-btn');
      await act(async () => {
        signOutBtn.click();
      });

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });

    it('should handle sign out errors', async () => {
      const signOutError = new Error('Sign out failed');
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: signOutError });

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      const signOutBtn = screen.getByTestId('sign-out-btn');
      await act(async () => {
        signOutBtn.click();
      });

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });

    it('should handle sign in', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({ error: null });

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      const signInBtn = screen.getByTestId('sign-in-btn');
      await act(async () => {
        signInBtn.click();
      });

      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
    });

    it('should handle sign up', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({ error: null });

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      const signUpBtn = screen.getByTestId('sign-up-btn');
      await act(async () => {
        signUpBtn.click();
      });

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
        options: {
          emailRedirectTo: 'http://localhost:3000/auth/callback',
        },
      });
    });

    it('should handle OAuth sign in', async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({ error: null });

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      const googleSignInBtn = screen.getByTestId('google-signin-btn');
      await act(async () => {
        googleSignInBtn.click();
      });

      expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase client unavailable for sign out', async () => {
      vi.mocked(vi.doMock('@/src/lib/supabase-browser-client', () => ({
        getSupabaseBrowserClient: () => null,
      })));

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      const signOutBtn = screen.getByTestId('sign-out-btn');
      await act(async () => {
        signOutBtn.click();
      });

      // Should handle gracefully without throwing
      expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();
    });

    it('should handle sign out exceptions', async () => {
      mockSupabaseClient.auth.signOut.mockRejectedValue(new Error('Network error'));

      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      const signOutBtn = screen.getByTestId('sign-out-btn');
      await act(async () => {
        signOutBtn.click();
      });

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('Hook Usage', () => {
    it('should throw error when useSupabaseAuth used outside provider', () => {
      const TestComponentOutside = () => {
        useSupabaseAuth();
        return <div>Test</div>;
      };

      expect(() => {
        render(<TestComponentOutside />);
      }).toThrow('useSupabaseAuth must be used within a SupabaseAuthProvider');
    });

    it('should provide auth context correctly', () => {
      render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      // Context should be available
      expect(screen.getByTestId('user-email')).toBeInTheDocument();
      expect(screen.getByTestId('session-status')).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from auth state changes on unmount', () => {
      const mockUnsubscribe = vi.fn();
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      });

      const { unmount } = render(
        <SupabaseAuthProvider>
          <TestComponent />
        </SupabaseAuthProvider>
      );

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});