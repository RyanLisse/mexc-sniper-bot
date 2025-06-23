/**
 * API Credentials Test Endpoint - Dynamic Response Verification Tests
 * 
 * Verifies that the API credentials test endpoint returns dynamic data from MEXC API
 * instead of hardcoded values like "accountType: spot" and "canTrade: Yes"
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/api-credentials/test/route';
import { getRecommendedMexcService } from '../../src/services/mexc-unified-exports';
import { getUserCredentials } from '../../src/services/user-credentials-service';

// Mock dependencies
vi.mock('../../src/services/mexc-unified-exports');
vi.mock('../../src/services/user-credentials-service');
vi.mock('@kinde-oss/kinde-auth-nextjs/server', () => ({
  getKindeServerSession: vi.fn()
}));

const mockGetRecommendedMexcService = vi.mocked(getRecommendedMexcService);
const mockGetUserCredentials = vi.mocked(getUserCredentials);

describe('API Credentials Test Endpoint - Dynamic Response', () => {
  let mockMexcService: any;
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock MEXC service with dynamic response capability
    mockMexcService = {
      testConnectivity: vi.fn(),
      getAccountInfo: vi.fn()
    };

    mockGetRecommendedMexcService.mockReturnValue(mockMexcService);
    
    // Mock user credentials
    mockGetUserCredentials.mockResolvedValue({
      apiKey: 'test-api-key',
      secretKey: 'test-secret-key'
    });

    // Mock request
    mockRequest = {
      json: vi.fn().mockResolvedValue({
        userId: 'test-user-123',
        provider: 'mexc'
      }),
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return dynamic account type from MEXC API response', async () => {
    // Arrange: Mock successful connectivity and dynamic account info
    mockMexcService.testConnectivity.mockResolvedValue(true);
    mockMexcService.getAccountInfo.mockResolvedValue({
      success: true,
      data: {
        accountType: 'MARGIN', // Dynamic value, not hardcoded "spot"
        permissions: ['SPOT', 'MARGIN', 'FUTURES'],
        canTrade: true,
        balances: [
          { asset: 'BTC', free: '1.0', locked: '0.0' },
          { asset: 'ETH', free: '10.0', locked: '0.0' }
        ],
        updateTime: 1640995200000
      }
    });

    // Mock authenticated user
    const mockUser = { id: 'test-user-123' };

    // Act: Call the endpoint with mocked auth context
    const response = await POST(mockRequest, mockUser);
    const responseData = await response.json();

    // Assert: Verify dynamic response structure
    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.data).toBeDefined();
    
    // Verify dynamic values (not hardcoded)
    expect(responseData.data.accountType).toBe('margin'); // Normalized to lowercase
    expect(responseData.data.canTrade).toBe(true); // Dynamic from API response
    expect(responseData.data.balanceCount).toBe(2); // Dynamic count from balances array
    expect(responseData.data.permissions).toEqual(['SPOT', 'MARGIN', 'FUTURES']);
    expect(responseData.data.lastUpdate).toBe(1640995200000);
    
    // Verify service calls
    expect(mockMexcService.testConnectivity).toHaveBeenCalledOnce();
    expect(mockMexcService.getAccountInfo).toHaveBeenCalledOnce();
  });

  it('should derive canTrade from permissions when not explicitly provided', async () => {
    // Arrange: Mock account info without explicit canTrade field
    mockMexcService.testConnectivity.mockResolvedValue(true);
    mockMexcService.getAccountInfo.mockResolvedValue({
      success: true,
      data: {
        accountType: 'SPOT',
        permissions: ['SPOT', 'TRADE'], // Has trading permissions
        balances: []
        // Note: no explicit canTrade field
      }
    });

    const mockUser = { id: 'test-user-123' };

    // Act
    const response = await POST(mockRequest, mockUser);
    const responseData = await response.json();

    // Assert: canTrade should be derived from permissions
    expect(responseData.data.canTrade).toBe(true); // Derived from SPOT/TRADE permissions
    expect(responseData.data.accountType).toBe('spot');
    expect(responseData.data.permissions).toEqual(['SPOT', 'TRADE']);
  });

  it('should handle account with no trading permissions', async () => {
    // Arrange: Mock account with read-only permissions
    mockMexcService.testConnectivity.mockResolvedValue(true);
    mockMexcService.getAccountInfo.mockResolvedValue({
      success: true,
      data: {
        accountType: 'SPOT',
        permissions: ['DATA'], // No trading permissions
        canTrade: false,
        balances: []
      }
    });

    const mockUser = { id: 'test-user-123' };

    // Act
    const response = await POST(mockRequest, mockUser);
    const responseData = await response.json();

    // Assert: Should reflect actual trading restrictions
    expect(responseData.data.canTrade).toBe(false);
    expect(responseData.data.accountType).toBe('spot');
    expect(responseData.data.permissions).toEqual(['DATA']);
  });

  it('should use fallback values when account data is incomplete', async () => {
    // Arrange: Mock minimal account info response
    mockMexcService.testConnectivity.mockResolvedValue(true);
    mockMexcService.getAccountInfo.mockResolvedValue({
      success: true,
      data: {
        // Minimal data - testing fallback behavior
        balances: []
      }
    });

    const mockUser = { id: 'test-user-123' };

    // Act
    const response = await POST(mockRequest, mockUser);
    const responseData = await response.json();

    // Assert: Should use appropriate fallback values
    expect(responseData.data.accountType).toBe('spot'); // Fallback to "SPOT" normalized
    expect(responseData.data.permissions).toEqual(['SPOT']); // Fallback permissions
    expect(responseData.data.canTrade).toBe(true); // Derived from fallback SPOT permission
    expect(responseData.data.balanceCount).toBe(0); // Empty balances array
  });

  it('should handle MEXC API authentication failure', async () => {
    // Arrange: Mock connectivity success but authentication failure
    mockMexcService.testConnectivity.mockResolvedValue(true);
    mockMexcService.getAccountInfo.mockResolvedValue({
      success: false,
      error: 'Invalid API signature'
    });

    const mockUser = { id: 'test-user-123' };

    // Act
    const response = await POST(mockRequest, mockUser);
    const responseData = await response.json();

    // Assert: Should return authentication error
    expect(response.status).toBe(401);
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBeDefined();
    expect(responseData.error.code).toBe('INVALID_CREDENTIALS');
    expect(responseData.error.details.authentication).toBe(false);
    expect(responseData.error.details.mexcError).toBe('Invalid API signature');
  });

  it('should handle connectivity failure gracefully', async () => {
    // Arrange: Mock connectivity failure
    mockMexcService.testConnectivity.mockResolvedValue(false);

    const mockUser = { id: 'test-user-123' };

    // Act
    const response = await POST(mockRequest, mockUser);
    const responseData = await response.json();

    // Assert: Should return network error
    expect(response.status).toBe(503);
    expect(responseData.success).toBe(false);
    expect(responseData.error.code).toBe('NETWORK_ERROR');
    expect(responseData.error.details.connectivity).toBe(false);
    expect(responseData.error.details.authentication).toBe(false);
  });

  it('should prevent users from testing other users credentials', async () => {
    // Arrange: Mock request with different user ID
    const unauthorizedRequest = {
      json: vi.fn().mockResolvedValue({
        userId: 'other-user-456',
        provider: 'mexc'
      }),
    } as any;

    const mockUser = { id: 'test-user-123' };

    // Act
    const response = await POST(unauthorizedRequest, mockUser);
    const responseData = await response.json();

    // Assert: Should return access denied
    expect(response.status).toBe(403);
    expect(responseData.success).toBe(false);
    expect(responseData.error.code).toBe('ACCESS_DENIED');
  });

  it('should handle missing user credentials', async () => {
    // Arrange: Mock no credentials found
    mockGetUserCredentials.mockRejectedValue(new Error('No credentials found'));

    const mockUser = { id: 'test-user-123' };

    // Act
    const response = await POST(mockRequest, mockUser);
    const responseData = await response.json();

    // Assert: Should return credentials error
    expect(response.status).toBe(400);
    expect(responseData.success).toBe(false);
    expect(responseData.error.code).toBe('NO_CREDENTIALS');
  });

  it('should not return hardcoded values for any scenario', async () => {
    // Arrange: Test multiple different scenarios to ensure no hardcoded responses
    const scenarios = [
      {
        name: 'margin account',
        accountType: 'MARGIN',
        permissions: ['SPOT', 'MARGIN'],
        canTrade: true,
        balances: [{ asset: 'BTC', free: '1', locked: '0' }]
      },
      {
        name: 'futures account',
        accountType: 'FUTURES',
        permissions: ['FUTURES'],
        canTrade: true,
        balances: []
      },
      {
        name: 'restricted account',
        accountType: 'SPOT',
        permissions: ['DATA'],
        canTrade: false,
        balances: [{ asset: 'USDT', free: '100', locked: '0' }]
      }
    ];

    for (const scenario of scenarios) {
      // Arrange
      mockMexcService.testConnectivity.mockResolvedValue(true);
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: true,
        data: scenario
      });

      const mockUser = { id: 'test-user-123' };

      // Act
      const response = await POST(mockRequest, mockUser);
      const responseData = await response.json();

      // Assert: Each scenario should return different dynamic values
      expect(responseData.data.accountType).toBe(scenario.accountType.toLowerCase());
      expect(responseData.data.canTrade).toBe(scenario.canTrade);
      expect(responseData.data.permissions).toEqual(scenario.permissions);
      expect(responseData.data.balanceCount).toBe(scenario.balances.length);

      // Verify no hardcoded "spot" or generic responses
      if (scenario.accountType !== 'SPOT') {
        expect(responseData.data.accountType).not.toBe('spot');
      }
    }
  });
});