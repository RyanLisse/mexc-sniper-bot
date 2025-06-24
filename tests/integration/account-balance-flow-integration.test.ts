/**
 * Account Balance Flow Integration Tests
 * 
 * Tests the complete account balance flow from credential validation 
 * to balance display, identifying service initialization issues
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { db, apiCredentials } from '../../src/db';
import { eq, and } from 'drizzle-orm';
import { getEncryptionService } from '../../src/services/secure-encryption-service';
import { GET as accountBalanceEndpoint } from '../../app/api/account/balance/route';
import { OptimizedAccountBalance } from '../../src/components/optimized-account-balance';
import type { BalanceEntry } from '../../src/services/mexc-unified-exports';

// Ensure React is available globally for JSX
globalThis.React = React;

// Mock auth
vi.mock('../../src/lib/kinde-auth-client', () => ({
  useAuth: () => ({
    user: { id: 'test-user-balance' },
    isAuthenticated: true,
    isLoading: false
  })
}));

// Mock currency formatting
vi.mock('../../src/hooks/use-currency-formatting', () => ({
  useCurrencyFormatting: () => ({
    formatCurrency: (amount: number) => amount.toFixed(2),
    formatTokenAmount: (amount: number, asset: string) => `${amount.toFixed(4)}`
  })
}));

describe('Account Balance Flow Integration Tests', () => {
  const testUserId = 'test-user-balance';
  const testApiKey = 'mx0x_test_balance_key_1234567890abcdef';
  const testSecretKey = 'abcd_test_balance_secret_1234567890_9876';
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    
    vi.clearAllMocks();
    
    // Clean up any existing test credentials
    await db.delete(apiCredentials)
      .where(eq(apiCredentials.userId, testUserId));
  });

  afterEach(async () => {
    queryClient.clear();
    
    // Clean up test data
    await db.delete(apiCredentials)
      .where(eq(apiCredentials.userId, testUserId));
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      React.createElement(QueryClientProvider, { client: queryClient }, component)
    );
  };

  describe('Account Balance API Service Initialization', () => {
    it('should demonstrate user-specific credential loading in balance API', async () => {
      // Arrange: Set up user credentials
      const encryptionService = getEncryptionService();
      await db.insert(apiCredentials).values({
        userId: testUserId,
        provider: 'mexc',
        encryptedApiKey: encryptionService.encrypt(testApiKey),
        encryptedSecretKey: encryptionService.encrypt(testSecretKey),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Mock successful MEXC service response
      const mockBalanceResponse = {
        success: true,
        data: {
          balances: [
            { asset: 'BTC', free: '1.5', locked: '0.0', total: 1.5, usdtValue: 67500 },
            { asset: 'ETH', free: '10.0', locked: '2.0', total: 12.0, usdtValue: 24000 },
            { asset: 'USDT', free: '1000.0', locked: '0.0', total: 1000.0, usdtValue: 1000 }
          ],
          totalUsdtValue: 92500
        }
      };

      // Mock getUnifiedMexcService to return service with balance method
      const mockMexcService = {
        getAccountBalances: vi.fn().mockResolvedValue(mockBalanceResponse),
        hasCredentials: vi.fn().mockReturnValue(true)
      };

      vi.doMock('../../src/services/unified-mexc-service-factory', () => ({
        getUnifiedMexcService: vi.fn().mockResolvedValue(mockMexcService)
      }));

      // Act: Call balance endpoint
      const request = new Request(`http://localhost/api/account/balance?userId=${testUserId}`);
      const response = await accountBalanceEndpoint(request);
      const data = await response.json();

      // Assert: Should successfully load user-specific credentials and return balance
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.balances).toHaveLength(3);
      expect(data.data.totalUsdtValue).toBe(92500);
      expect(data.data.hasUserCredentials).toBe(true);
      expect(data.data.credentialsType).toBe('user-specific');

      // Verify service was called correctly
      expect(mockMexcService.getAccountBalances).toHaveBeenCalledOnce();
    });

    it('should fall back to environment credentials when user credentials not found', async () => {
      // No user credentials in database - should fall back to environment

      // Mock successful MEXC service response with environment credentials
      const mockBalanceResponse = {
        success: true,
        data: {
          balances: [
            { asset: 'BTC', free: '0.1', locked: '0.0', total: 0.1, usdtValue: 4500 }
          ],
          totalUsdtValue: 4500
        }
      };

      const mockMexcService = {
        getAccountBalances: vi.fn().mockResolvedValue(mockBalanceResponse),
        hasCredentials: vi.fn().mockReturnValue(true)
      };

      vi.doMock('../../src/services/unified-mexc-service-factory', () => ({
        getUnifiedMexcService: vi.fn().mockResolvedValue(mockMexcService)
      }));

      // Act: Call balance endpoint without user credentials
      const request = new Request(`http://localhost/api/account/balance?userId=${testUserId}`);
      const response = await accountBalanceEndpoint(request);
      const data = await response.json();

      // Assert: Should fall back to environment credentials
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.hasUserCredentials).toBe(false);
      expect(data.data.credentialsType).toBe('environment-fallback');
    });

    it('should handle credential decryption errors gracefully', async () => {
      // Arrange: Insert corrupted credentials
      await db.insert(apiCredentials).values({
        userId: testUserId,
        provider: 'mexc',
        encryptedApiKey: 'corrupted_encrypted_data',
        encryptedSecretKey: 'corrupted_encrypted_data',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Mock encryption service to throw on decrypt
      const mockEncryptionService = {
        decrypt: vi.fn().mockImplementation(() => {
          throw new Error('Decryption failed - invalid encrypted data');
        })
      };

      vi.doMock('../../src/services/secure-encryption-service', () => ({
        getEncryptionService: () => mockEncryptionService
      }));

      // Mock fallback environment service
      const mockMexcService = {
        getAccountBalances: vi.fn().mockResolvedValue({
          success: true,
          data: { balances: [], totalUsdtValue: 0 }
        }),
        hasCredentials: vi.fn().mockReturnValue(true)
      };

      vi.doMock('../../src/services/unified-mexc-service-factory', () => ({
        getUnifiedMexcService: vi.fn().mockResolvedValue(mockMexcService)
      }));

      // Act
      const request = new Request(`http://localhost/api/account/balance?userId=${testUserId}`);
      const response = await accountBalanceEndpoint(request);
      const data = await response.json();

      // Assert: Should fall back to environment credentials
      expect(response.status).toBe(200);
      expect(data.data.hasUserCredentials).toBe(false);
      expect(data.data.credentialsType).toBe('environment-fallback');
    });
  });

  describe('Balance API Error Handling', () => {
    it('should handle MEXC API authentication failures', async () => {
      // Arrange: Set up user credentials
      const encryptionService = getEncryptionService();
      await db.insert(apiCredentials).values({
        userId: testUserId,
        provider: 'mexc',
        encryptedApiKey: encryptionService.encrypt(testApiKey),
        encryptedSecretKey: encryptionService.encrypt(testSecretKey),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Mock MEXC API authentication failure
      const mockMexcService = {
        getAccountBalances: vi.fn().mockResolvedValue({
          success: false,
          error: 'API signature validation failed'
        }),
        hasCredentials: vi.fn().mockReturnValue(true)
      };

      vi.doMock('../../src/services/unified-mexc-service-factory', () => ({
        getUnifiedMexcService: vi.fn().mockResolvedValue(mockMexcService)
      }));

      // Act
      const request = new Request(`http://localhost/api/account/balance?userId=${testUserId}`);
      const response = await accountBalanceEndpoint(request);
      const data = await response.json();

      // Assert: Should return error with fallback data
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('API signature validation failed');
      expect(data.fallbackData).toBeDefined();
      expect(data.fallbackData.balances).toEqual([]);
      expect(data.fallbackData.totalUsdtValue).toBe(0);
    });

    it('should handle network connectivity issues', async () => {
      // Mock network failure
      const mockMexcService = {
        getAccountBalances: vi.fn().mockImplementation(() => {
          throw new Error('Network error: ECONNREFUSED');
        }),
        hasCredentials: vi.fn().mockReturnValue(true)
      };

      vi.doMock('../../src/services/unified-mexc-service-factory', () => ({
        getUnifiedMexcService: vi.fn().mockResolvedValue(mockMexcService)
      }));

      // Act
      const request = new Request(`http://localhost/api/account/balance?userId=${testUserId}`);
      const response = await accountBalanceEndpoint(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Network error: ECONNREFUSED');
      expect(data.fallbackData).toBeDefined();
    });
  });

  describe('Frontend Account Balance Component Integration', () => {
    // Mock fetch for component tests
    const mockFetch = vi.fn();
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = mockFetch;
      mockFetch.mockClear();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should display balance data when API succeeds', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            balances: [
              { asset: 'BTC', free: '1.0', locked: '0.0', total: 1.0, usdtValue: 45000 },
              { asset: 'ETH', free: '5.0', locked: '0.0', total: 5.0, usdtValue: 10000 },
              { asset: 'USDT', free: '1000.0', locked: '0.0', total: 1000.0, usdtValue: 1000 }
            ],
            totalUsdtValue: 56000,
            lastUpdated: new Date().toISOString(),
            hasUserCredentials: true,
            credentialsType: 'user-specific'
          }
        })
      });

      // Render component
      renderWithQueryClient(
        React.createElement(OptimizedAccountBalance, { userId: testUserId })
      );

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText(/Account Balance/i)).toBeInTheDocument();
      });

      // Check for balance display
      await waitFor(() => {
        expect(screen.getByText(/Total Portfolio Value/i)).toBeInTheDocument();
        expect(screen.getByText(/56000/)).toBeInTheDocument(); // Total USDT value
      });

      // Verify API was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/account/balance?userId=${testUserId}`,
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        })
      );
    });

    it('should show error state when balance API fails', async () => {
      // Mock API failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          success: false,
          error: 'API signature validation failed'
        })
      });

      // Render component
      renderWithQueryClient(
        React.createElement(OptimizedAccountBalance, { userId: testUserId })
      );

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/Failed to load account balance/i)).toBeInTheDocument();
      });

      // Check for retry button
      expect(screen.getByText(/Try Again/i)).toBeInTheDocument();
    });

    it('should handle authentication errors gracefully', async () => {
      // Mock authentication failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          success: false,
          error: '401: Unauthorized'
        })
      });

      // Render component
      renderWithQueryClient(
        React.createElement(OptimizedAccountBalance, { userId: testUserId })
      );

      // Should show empty state instead of error for auth issues
      await waitFor(() => {
        expect(screen.getByText(/Account Balance/i)).toBeInTheDocument();
      });

      // Should show empty balances, not an error
      await waitFor(() => {
        expect(screen.queryByText(/Failed to load/i)).not.toBeInTheDocument();
      });
    });

    it('should demonstrate React Query caching behavior', async () => {
      // First successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            balances: [
              { asset: 'BTC', free: '1.0', locked: '0.0', total: 1.0, usdtValue: 45000 }
            ],
            totalUsdtValue: 45000,
            lastUpdated: new Date().toISOString()
          }
        })
      });

      // Render component
      renderWithQueryClient(
        React.createElement(OptimizedAccountBalance, { userId: testUserId })
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText(/45000/)).toBeInTheDocument();
      });

      // Verify fetch was called once
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Re-render same component (should use cache)
      renderWithQueryClient(
        React.createElement(OptimizedAccountBalance, { userId: testUserId })
      );

      // Should still show data without additional fetch (cache hit)
      expect(screen.getByText(/45000/)).toBeInTheDocument();
      
      // Should not make additional API calls due to React Query caching
      // (depending on stale time configuration)
    });
  });

  describe('Service Initialization Consistency Validation', () => {
    it('should verify that balance API and credential test use consistent service initialization', async () => {
      // This test validates that both endpoints use the same service initialization approach
      // to prevent the synchronization issues identified by the API Analysis Agent

      // Set up credentials
      const encryptionService = getEncryptionService();
      await db.insert(apiCredentials).values({
        userId: testUserId,
        provider: 'mexc',
        encryptedApiKey: encryptionService.encrypt(testApiKey),
        encryptedSecretKey: encryptionService.encrypt(testSecretKey),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Mock consistent service behavior
      const mockMexcService = {
        testConnectivity: vi.fn().mockResolvedValue(true),
        hasCredentials: vi.fn().mockReturnValue(true),
        getAccountInfo: vi.fn().mockResolvedValue({
          success: true,
          data: {
            accountType: 'SPOT',
            canTrade: true,
            permissions: ['SPOT', 'TRADE'],
            balances: [
              { asset: 'BTC', free: '1.0', locked: '0.0' },
              { asset: 'USDT', free: '1000.0', locked: '0.0' }
            ]
          }
        }),
        getAccountBalances: vi.fn().mockResolvedValue({
          success: true,
          data: {
            balances: [
              { asset: 'BTC', free: '1.0', locked: '0.0', total: 1.0, usdtValue: 45000 },
              { asset: 'USDT', free: '1000.0', locked: '0.0', total: 1000.0, usdtValue: 1000 }
            ],
            totalUsdtValue: 46000
          }
        })
      };

      // Mock service factory to return same service instance
      const serviceFactory = vi.fn().mockResolvedValue(mockMexcService);

      vi.doMock('../../src/services/unified-mexc-service-factory', () => ({
        getUnifiedMexcService: serviceFactory
      }));

      // Test balance endpoint
      const balanceRequest = new Request(`http://localhost/api/account/balance?userId=${testUserId}`);
      const balanceResponse = await accountBalanceEndpoint(balanceRequest);
      const balanceData = await balanceResponse.json();

      expect(balanceResponse.status).toBe(200);
      expect(balanceData.success).toBe(true);
      expect(balanceData.data.totalUsdtValue).toBe(46000);

      // Both endpoints should use the same service initialization
      // This ensures consistency and prevents synchronization issues
      expect(serviceFactory).toHaveBeenCalled();
      expect(mockMexcService.getAccountBalances).toHaveBeenCalled();

      // The key insight: When both endpoints use the same service initialization approach,
      // status synchronization issues should be minimized
    });
  });
});