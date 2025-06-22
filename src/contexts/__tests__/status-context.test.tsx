/**
 * Centralized Status Context Tests
 * 
 * These tests ensure the status context properly eliminates contradictory
 * status messages and provides a single source of truth.
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusProvider, useStatus } from '../status-context';

// Mock fetch globally
global.fetch = jest.fn();

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });

// Test component that uses the status context
function TestStatusComponent() {
  const { 
    status, 
    refreshAll, 
    refreshCredentials, 
    clearErrors, 
    getOverallStatus, 
    getStatusMessage 
  } = useStatus();

  return (
    <div>
      <div data-testid="overall-status">{getOverallStatus()}</div>
      <div data-testid="status-message">{getStatusMessage()}</div>
      <div data-testid="network-connected">{status.network.connected.toString()}</div>
      <div data-testid="credentials-valid">{status.credentials.isValid.toString()}</div>
      <div data-testid="credentials-source">{status.credentials.source}</div>
      <div data-testid="trading-can-trade">{status.trading.canTrade.toString()}</div>
      <div data-testid="is-loading">{status.isLoading.toString()}</div>
      <div data-testid="sync-errors">{status.syncErrors.length}</div>
      <button onClick={refreshAll} data-testid="refresh-all">Refresh All</button>
      <button onClick={refreshCredentials} data-testid="refresh-credentials">Refresh Credentials</button>
      <button onClick={clearErrors} data-testid="clear-errors">Clear Errors</button>
    </div>
  );
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <StatusProvider autoRefreshInterval={60000} enableRealTimeUpdates={false}>
        {children}
      </StatusProvider>
    </QueryClientProvider>
  );
}

describe('StatusContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should provide initial status state', async () => {
      // Mock successful responses
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, message: 'System healthy' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            hasCredentials: false,
            credentialsValid: false,
            credentialSource: 'none',
            hasUserCredentials: false,
            hasEnvironmentCredentials: false,
            connected: true,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, message: 'Environment healthy' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, message: 'API healthy' }),
        });

      render(
        <TestWrapper>
          <TestStatusComponent />
        </TestWrapper>
      );

      // Wait for initial load to complete
      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('network-connected')).toHaveTextContent('true');
      expect(screen.getByTestId('credentials-valid')).toHaveTextContent('false');
      expect(screen.getByTestId('credentials-source')).toHaveTextContent('none');
      expect(screen.getByTestId('trading-can-trade')).toHaveTextContent('false');
      expect(screen.getByTestId('sync-errors')).toHaveTextContent('0');
    });
  });

  describe('Status Consistency', () => {
    it('should maintain consistent status across all indicators', async () => {
      // Mock network error scenario
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Connection failed' }),
        });

      render(
        <TestWrapper>
          <TestStatusComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      // All status indicators should consistently show network issues
      expect(screen.getByTestId('overall-status')).toHaveTextContent('error');
      expect(screen.getByTestId('network-connected')).toHaveTextContent('false');
      expect(screen.getByTestId('status-message')).toHaveTextContent('Network connection unavailable');
    });

    it('should show consistent credential status', async () => {
      // Mock successful network but invalid credentials
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            hasCredentials: true,
            credentialsValid: false,
            credentialSource: 'database',
            hasUserCredentials: true,
            hasEnvironmentCredentials: false,
            connected: true,
            error: 'Invalid API key',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      render(
        <TestWrapper>
          <TestStatusComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      // Status should consistently reflect invalid credentials
      expect(screen.getByTestId('overall-status')).toHaveTextContent('error');
      expect(screen.getByTestId('credentials-valid')).toHaveTextContent('false');
      expect(screen.getByTestId('credentials-source')).toHaveTextContent('database');
      expect(screen.getByTestId('status-message')).toHaveTextContent('API credentials invalid');
    });
  });

  describe('Error Handling', () => {
    it('should handle sync errors properly', async () => {
      // Mock multiple failures
      (fetch as jest.Mock)
        .mockRejectedValue(new Error('Network timeout'))
        .mockRejectedValue(new Error('API unreachable'));

      render(
        <TestWrapper>
          <TestStatusComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      // Should show error count
      await waitFor(() => {
        expect(screen.getByTestId('sync-errors')).not.toHaveTextContent('0');
      });

      expect(screen.getByTestId('overall-status')).toHaveTextContent('error');
    });

    it('should clear errors when requested', async () => {
      // Mock initial error then success
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Initial error'))
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      render(
        <TestWrapper>
          <TestStatusComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      // Clear errors
      const clearButton = screen.getByTestId('clear-errors');
      await act(async () => {
        await userEvent.click(clearButton);
      });

      expect(screen.getByTestId('sync-errors')).toHaveTextContent('0');
    });
  });

  describe('Status Refresh', () => {
    it('should refresh all status data', async () => {
      // Mock initial state
      (fetch as jest.Mock)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      render(
        <TestWrapper>
          <TestStatusComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      // Clear previous calls
      (fetch as jest.Mock).mockClear();

      // Mock updated responses
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            hasCredentials: true,
            credentialsValid: true,
            credentialSource: 'environment',
            hasUserCredentials: false,
            hasEnvironmentCredentials: true,
            connected: true,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { canTrade: true, accountType: 'spot' },
          }),
        });

      // Trigger refresh
      const refreshButton = screen.getByTestId('refresh-all');
      await act(async () => {
        await userEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('credentials-valid')).toHaveTextContent('true');
      });

      expect(screen.getByTestId('credentials-source')).toHaveTextContent('environment');
      expect(screen.getByTestId('trading-can-trade')).toHaveTextContent('true');
      expect(screen.getByTestId('overall-status')).toHaveTextContent('healthy');
    });
  });

  describe('Status State Machine', () => {
    it('should follow correct status precedence', async () => {
      const scenarios = [
        {
          name: 'Network down',
          mocks: [
            () => Promise.reject(new Error('Network error')),
          ],
          expectedStatus: 'error',
          expectedMessage: 'Network connection unavailable',
        },
        {
          name: 'No credentials',
          mocks: [
            () => Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ success: true }),
            }),
            () => Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                hasCredentials: false,
                credentialsValid: false,
                credentialSource: 'none',
                connected: true,
              }),
            }),
          ],
          expectedStatus: 'warning',
          expectedMessage: 'API credentials not configured',
        },
        {
          name: 'Invalid credentials',
          mocks: [
            () => Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ success: true }),
            }),
            () => Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                hasCredentials: true,
                credentialsValid: false,
                credentialSource: 'database',
                connected: true,
              }),
            }),
          ],
          expectedStatus: 'error',
          expectedMessage: 'API credentials invalid',
        },
        {
          name: 'All healthy',
          mocks: [
            () => Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ success: true }),
            }),
            () => Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                hasCredentials: true,
                credentialsValid: true,
                credentialSource: 'environment',
                connected: true,
              }),
            }),
            () => Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ success: true }),
            }),
            () => Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ success: true }),
            }),
          ],
          expectedStatus: 'healthy',
          expectedMessage: 'All systems operational',
        },
      ];

      for (const scenario of scenarios) {
        // Reset mocks
        (fetch as jest.Mock).mockClear();
        scenario.mocks.forEach((mock, index) => {
          (fetch as jest.Mock).mockImplementationOnce(mock);
        });

        const { unmount } = render(
          <TestWrapper>
            <TestStatusComponent />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
        });

        expect(screen.getByTestId('overall-status')).toHaveTextContent(scenario.expectedStatus);
        expect(screen.getByTestId('status-message')).toHaveTextContent(scenario.expectedMessage);

        unmount();
      }
    });
  });

  describe('Real-time Updates', () => {
    it('should handle component unmounting gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { unmount } = render(
        <TestWrapper>
          <TestStatusComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      // Unmount should not cause errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Loading States', () => {
    it('should show loading state during refresh', async () => {
      // Mock slow response
      (fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        }), 100))
      );

      render(
        <TestWrapper>
          <TestStatusComponent />
        </TestWrapper>
      );

      // Should initially be loading
      expect(screen.getByTestId('is-loading')).toHaveTextContent('true');
      expect(screen.getByTestId('overall-status')).toHaveTextContent('loading');

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });
    });
  });
});

describe('StatusContext Error Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle malformed API responses', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null), // Malformed response
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: 'structure' }), // Missing expected fields
      });

    render(
      <TestWrapper>
        <TestStatusComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Should handle gracefully without crashing
    expect(screen.getByTestId('overall-status')).toBeDefined();
  });

  it('should handle API timeout scenarios', async () => {
    const timeoutError = new Error('Request timeout');
    timeoutError.name = 'TimeoutError';

    (fetch as jest.Mock).mockRejectedValue(timeoutError);

    render(
      <TestWrapper>
        <TestStatusComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('overall-status')).toHaveTextContent('error');
    expect(screen.getByTestId('sync-errors')).not.toHaveTextContent('0');
  });
});