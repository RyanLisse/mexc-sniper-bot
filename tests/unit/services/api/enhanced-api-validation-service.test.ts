/**
 * Unit tests for Enhanced API Validation Service
 * Tests multi-stage validation including credentials, connectivity, authentication, permissions, and security analysis
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  EnhancedApiValidationService,
  enhancedApiValidationService,
  enhancedApiValidation,
  type ApiValidationConfig,
  type ValidationResult,
} from '../../../../src/services/api/enhanced-api-validation-service';

// Mock dependencies
vi.mock('../../../../src/services/notification/error-logging-service', () => ({
  ErrorLoggingService: {
    getInstance: vi.fn(() => ({
      logError: vi.fn(),
    })),
  },
}));

vi.mock('../../../../src/services/risk/circuit-breaker', () => ({
  circuitBreakerRegistry: {
    getBreaker: vi.fn(() => ({
      getState: vi.fn(() => 'CLOSED'),
    })),
  },
}));

vi.mock('../../../../src/services/api/mexc-unified-exports', () => ({
  getUnifiedMexcClient: vi.fn(),
}));

// Import mocked dependencies
import { ErrorLoggingService } from '../../../../src/services/notification/error-logging-service';
import { circuitBreakerRegistry } from '../../../../src/services/risk/circuit-breaker';
import { getUnifiedMexcClient } from '../../../../src/services/api/mexc-unified-exports';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

describe('Enhanced API Validation Service', () => {
  let mockConsole: any;
  let validationService: EnhancedApiValidationService;
  let mockMexcClient: any;
  let mockErrorLogger: any;
  
  // Common valid configuration for tests
  const validConfig: ApiValidationConfig = {
    apiKey: 'valid-api-key-with-sufficient-length',
    secretKey: 'valid-secret-key-with-sufficient-length-and-complexity',
    validateIpAllowlist: true,
    performanceBenchmark: true,
    securityChecks: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods
    mockConsole = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    global.console.info = mockConsole.info;
    global.console.warn = mockConsole.warn;
    global.console.error = mockConsole.error;
    global.console.debug = mockConsole.debug;

    // Mock MEXC client with proper response structures
    mockMexcClient = {
      testConnectivity: vi.fn().mockResolvedValue(true), // Should return boolean true for success
      getServerTime: vi.fn().mockResolvedValue(Date.now()), // Should return timestamp directly
      getAccountInfo: vi.fn().mockResolvedValue({ success: true, data: { account: 'test' } }),
      getAccountBalances: vi.fn().mockResolvedValue({ success: true, data: { balances: [] } }),
      validateOrderParameters: vi.fn().mockReturnValue({ valid: true, data: {} }),
    };

    // Mock error logger
    mockErrorLogger = {
      logError: vi.fn(),
    };

    vi.mocked(getUnifiedMexcClient).mockReturnValue(mockMexcClient);
    vi.mocked(ErrorLoggingService.getInstance).mockReturnValue(mockErrorLogger);

    validationService = EnhancedApiValidationService.getInstance();
    validationService.clearCache(); // Clear cache before each test
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
  
  });

  describe('Singleton Pattern', () => {
    it('should return same instance for multiple calls', () => {
      const instance1 = EnhancedApiValidationService.getInstance();
      const instance2 = EnhancedApiValidationService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBe(validationService);
    });

    it('should export singleton instances', () => {
      expect(enhancedApiValidationService).toBeDefined();
      expect(enhancedApiValidation).toBeDefined();
      expect(enhancedApiValidationService).toBe(enhancedApiValidation);
      expect(enhancedApiValidationService).toBeInstanceOf(EnhancedApiValidationService);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache successfully', () => {
      validationService.clearCache();

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[Enhanced API Validation] Cache cleared'
      );

      const stats = validationService.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toEqual([]);
    });

    it('should track cache statistics', () => {
      const stats = validationService.getCacheStats();

      expect(stats).toMatchObject({
        size: expect.any(Number),
        entries: expect.any(Array),
      });
    });
  });

  describe('validateApiCredentials', () => {
    const validConfig: ApiValidationConfig = {
      apiKey: 'valid-api-key-with-sufficient-length',
      secretKey: 'valid-secret-key-with-sufficient-length-and-complexity',
      validateIpAllowlist: true,
      performanceBenchmark: true,
      securityChecks: true,
    };

    beforeEach(() => {
      // Mock successful responses by default
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getServerTime.mockResolvedValue(Date.now());
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ 
        success: true, 
        data: [{ free: '100', locked: '0', asset: 'USDT' }] 
      });
      mockMexcClient.validateOrderParameters.mockReturnValue({ valid: true });
    });

    it('should successfully validate complete API credentials', withTimeout(async () => {const result = await validationService.validateApiCredentials(validConfig);

      expect(result.valid).toBe(true);
      expect(result.stage).toBe('completed');
      expect(result.details).toMatchObject({
        networkConnectivity: true,
        credentialFormat: true,
        apiAuthentication: true,
        permissionChecks: true,
        ipAllowlisting: true,
      });
      expect(result.details.performanceMetrics).toBeDefined();
      expect(result.details.securityAnalysis).toBeDefined();
      expect(result.recommendations).toContain(
        'API credentials are fully validated and ready for trading'
      );
    });

    it('should use cached result when available', async () => {
      // First call
      await validationService.validateApiCredentials(validConfig);

      // Second call should use cache
      const result = await validationService.validateApiCredentials(validConfig);

      expect(result.valid).toBe(true);
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[Enhanced API Validation] Using cached validation result'
      );
    });

    it('should fail on invalid credential format - empty API key', async () => {
      const invalidConfig = { 
        ...validConfig, 
        apiKey: '' 
      };

      const result = await validationService.validateApiCredentials(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.stage).toBe('credential_format');
      expect(result.error).toBe('API key is required and must be a string');
      expect(result.recommendations).toContain(
        'Provide a valid MEXC API key from your account settings'
      );
    });

    it('should fail on invalid credential format - short API key', async () => {
      const invalidConfig = { 
        ...validConfig, 
        apiKey: 'short' 
      };

      const result = await validationService.validateApiCredentials(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.stage).toBe('credential_format');
      expect(result.error).toBe('API key appears to be too short');
      expect(result.recommendations).toContain(
        'Verify the API key is complete and properly copied'
      );
    });

    it('should fail on invalid credential format - empty secret key', async () => {
      const invalidConfig = { 
        ...validConfig, 
        secretKey: '' 
      };

      const result = await validationService.validateApiCredentials(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.stage).toBe('credential_format');
      expect(result.error).toBe('Secret key is required and must be a string');
    });

    it('should fail on invalid credential format - identical keys', async () => {
      const sameKey = 'same-key-used-for-both-api-and-secret';
      const invalidConfig = { 
        ...validConfig, 
        apiKey: sameKey,
        secretKey: sameKey,
      };

      const result = await validationService.validateApiCredentials(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.stage).toBe('credential_format');
      expect(result.error).toBe('API key and secret key cannot be the same');
    });

    it('should detect spaces in credentials', async () => {
      // Ensure connectivity test passes for this specific test
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getServerTime.mockResolvedValue(Date.now());
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: [] });
      
      const configWithSpaces = { 
        ...validConfig, 
        apiKey: 'valid-api-key-with-sufficient-length with space',
        validateIpAllowlist: false, // Disable to simplify test
        performanceBenchmark: false, // Disable to simplify test
        securityChecks: false, // Disable to simplify test
      };

      const result = await validationService.validateApiCredentials(configWithSpaces);

      expect(result.recommendations).toContain('Remove any spaces from API keys');
      
      // TIMEOUT ELIMINATION: Ensure all promises are flushed
      await flushPromises();
    }, TIMEOUT_CONFIG.STANDARD));

    it('should fail on network connectivity issues', withTimeout(async () => {mockMexcClient.testConnectivity.mockResolvedValue(false);

      const result = await validationService.validateApiCredentials(validConfig);

      expect(result.valid).toBe(false);
      expect(result.stage).toBe('network_connectivity');
      expect(result.error).toBe('Unable to connect to MEXC API endpoints');
      expect(result.recommendations).toContain(
        'Check internet connection and firewall settings'
      );
    });

    it('should handle network connectivity errors', async () => {
      // Create a fresh mock that throws the error
      const throwingClient = {
        ...mockMexcClient,
        testConnectivity: vi.fn().mockRejectedValue(new Error('Network timeout')),
      };
      vi.mocked(getUnifiedMexcClient).mockReturnValue(throwingClient);

      const result = await validationService.validateApiCredentials(validConfig);

      expect(result.valid).toBe(false);
      expect(result.stage).toBe('network_connectivity');
      expect(result.error).toBe('Network timeout');
      
      // Restore original mock
      vi.mocked(getUnifiedMexcClient).mockReturnValue(mockMexcClient);
    });

    it('should fail on API authentication errors - signature issues', async () => {
      // Ensure connectivity passes first
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      // Then make authentication fail  
      mockMexcClient.getAccountInfo.mockResolvedValue({
        success: false,
        error: 'signature validation failed',
      });

      const result = await validationService.validateApiCredentials(validConfig);

      expect(result.valid).toBe(false);
      expect(result.stage).toBe('api_authentication');
      expect(result.error).toBe('API signature validation failed');
      expect(result.recommendations).toContain('Verify your secret key is correct');
    });

    it('should fail on API authentication errors - invalid key', async () => {
      // Ensure connectivity passes first
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      // Then make authentication fail
      mockMexcClient.getAccountInfo.mockResolvedValue({
        success: false,
        error: '10072: Api key info invalid',
      });

      const result = await validationService.validateApiCredentials(validConfig);

      expect(result.valid).toBe(false);
      expect(result.stage).toBe('api_authentication');
      expect(result.error).toBe('Invalid API key');
      expect(result.recommendations).toContain('Verify API key is active and correct');
    });

    it('should fail on API authentication errors - IP restrictions', async () => {
      // Ensure connectivity passes first
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      // Then make authentication fail
      mockMexcClient.getAccountInfo.mockResolvedValue({
        success: false,
        error: '403: IP address not allowlisted',
      });

      const result = await validationService.validateApiCredentials(validConfig);

      expect(result.valid).toBe(false);
      expect(result.stage).toBe('api_authentication');
      expect(result.error).toBe('IP address not allowlisted');
      expect(result.recommendations).toContain(
        'Add your server IP to the API key allowlist in MEXC settings'
      );
    });

    it('should detect time synchronization issues', async () => {
      // Ensure connectivity and auth passes first
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: [] });
      
      const futureTime = Date.now() + 10000; // 10 seconds in future
      mockMexcClient.getServerTime.mockResolvedValue(futureTime);

      const config = {
        ...validConfig,
        validateIpAllowlist: false, // Disable to simplify test
        performanceBenchmark: false, // Disable to simplify test
        securityChecks: false, // Disable to simplify test
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.recommendations).toContain(
        'Server time difference detected. Ensure system clock is synchronized'
      );
      
      // TIMEOUT ELIMINATION: Ensure all promises are flushed
      await flushPromises();
    }, TIMEOUT_CONFIG.STANDARD));

    it('should fail on permission validation - account access denied', withTimeout(async () => {// Ensure connectivity and auth passes first
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getServerTime.mockResolvedValue(Date.now());
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      // Then make permissions fail
      mockMexcClient.getAccountBalances.mockResolvedValue({
        success: false,
        error: 'Permission denied',
      });

      const result = await validationService.validateApiCredentials(validConfig);

      expect(result.valid).toBe(false);
      expect(result.stage).toBe('permission_checks');
      expect(result.error).toBe('API key lacks account read permissions');
      expect(result.recommendations).toContain(
        'Enable "Read" permissions for your API key in MEXC settings'
      );
      
      // TIMEOUT ELIMINATION: Ensure all promises are flushed
      await flushPromises();
    }, TIMEOUT_CONFIG.STANDARD));

    it('should detect trading permissions', withTimeout(async () => {// Ensure all stages pass properly  
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getServerTime.mockResolvedValue(Date.now());
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: [] });
      mockMexcClient.validateOrderParameters.mockReturnValue({ valid: true });

      const config = {
        ...validConfig,
        validateIpAllowlist: false, // Disable to simplify test
        performanceBenchmark: false, // Disable to simplify test
        securityChecks: false, // Disable to simplify test
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.recommendations).toContain(
        'API key has trading validation capabilities'
      );
      
      // TIMEOUT ELIMINATION: Ensure all promises are flushed
      await flushPromises();
    }, TIMEOUT_CONFIG.STANDARD));

    it('should detect missing trading permissions', withTimeout(async () => {// Ensure all stages pass properly except trading
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getServerTime.mockResolvedValue(Date.now());
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: [] });
      mockMexcClient.validateOrderParameters.mockImplementation(() => {
        throw new Error('Trading not allowed');
      });

      const config = {
        ...validConfig,
        validateIpAllowlist: false, // Disable to simplify test
        performanceBenchmark: false, // Disable to simplify test
        securityChecks: false, // Disable to simplify test
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.recommendations).toContain(
        'API key may lack trading permissions - verify if trading is required'
      );
      
      // TIMEOUT ELIMINATION: Ensure all promises are flushed
      await flushPromises();
    }, TIMEOUT_CONFIG.STANDARD));

    it('should validate IP allowlisting successfully', withTimeout(async () => {// Ensure all stages pass properly
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getServerTime.mockResolvedValue(Date.now());
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: [] });

      const result = await validationService.validateApiCredentials(validConfig);

      expect(result.details.ipAllowlisting).toBe(true);
      expect(result.recommendations).toContain(
        'IP allowlisting appears to be properly configured'
      );
      
      // TIMEOUT ELIMINATION: Ensure all promises are flushed
      await flushPromises();
    }, TIMEOUT_CONFIG.STANDARD));

    it('should detect intermittent IP allowlisting issues', withTimeout(async () => {// Clear all existing mocks and set up fresh ones
      vi.clearAllMocks();
      
      // For the main validation stages (up to IP testing)
      const mainClient = {
        testConnectivity: vi.fn().mockResolvedValue(true),
        getServerTime: vi.fn().mockResolvedValue(Date.now()),
        getAccountInfo: vi.fn().mockResolvedValue({ success: true }),
        getAccountBalances: vi.fn().mockResolvedValue({ success: true, data: [] }),
        validateOrderParameters: vi.fn().mockReturnValue({ valid: true }),
      };

      // For the IP allowlisting validation that should have intermittent failures
      // (some succeed, some fail to trigger "Intermittent authentication failures detected")
      const ipClient = {
        getAccountInfo: vi.fn().mockResolvedValue({ success: true }), // Succeeds
        getServerTime: vi.fn().mockRejectedValue(new Error('403 Forbidden')), // Fails
        getAccountBalances: vi.fn().mockResolvedValue({ success: true, data: [] }), // Succeeds
        validateOrderParameters: vi.fn().mockReturnValue({ valid: true }),
      };

      // Mock the calls in sequence
      vi.mocked(getUnifiedMexcClient)
        .mockReturnValueOnce(mainClient as any) // For connectivity test
        .mockReturnValueOnce(mainClient as any) // For auth test  
        .mockReturnValueOnce(mainClient as any) // For permissions test
        .mockReturnValueOnce(ipClient as any); // For IP allowlisting test

      const result = await validationService.validateApiCredentials(validConfig);

      expect(result.details.ipAllowlisting).toBe(false);
      expect(result.error).toBe('Intermittent authentication failures detected');
      expect(result.recommendations).toContain(
        'Check IP allowlist settings in MEXC API configuration'
      );
      
      // Restore the default mock for subsequent tests
      vi.mocked(getUnifiedMexcClient).mockReturnValue(mockMexcClient);
      
      // TIMEOUT ELIMINATION: Ensure all promises are flushed
      await flushPromises();
    }, TIMEOUT_CONFIG.STANDARD));

    it('should skip optional validations when disabled', withTimeout(async () => {const basicConfig = {
        apiKey: 'valid-api-key-with-sufficient-length',
        secretKey: 'valid-secret-key-with-sufficient-length-and-complexity',
        validateIpAllowlist: false,
        performanceBenchmark: false,
        securityChecks: false,
      };

      const result = await validationService.validateApiCredentials(basicConfig);

      expect(result.valid).toBe(true);
      expect(result.details.ipAllowlisting).toBe(true); // Skipped = true
      expect(result.details.performanceMetrics).toBeUndefined();
      expect(result.details.securityAnalysis).toBeUndefined();
    });

    it('should handle unexpected errors gracefully', async () => {
      mockMexcClient.testConnectivity.mockRejectedValue(new Error('Unexpected system error'));

      const result = await validationService.validateApiCredentials(validConfig);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unexpected system error');
      expect(result.stage).toBe('network_connectivity');
      
      // Test that the service handles errors gracefully and returns appropriate error response
      expect(result.recommendations).toContain('Check internet connection and firewall settings');
      
      // Since ErrorLoggingService is instantiated internally, we verify the error is handled correctly
      // by checking the result properties rather than mocking internal logger calls
      expect(result.details.networkConnectivity).toBe(false);
      expect(result.details.credentialFormat).toBe(true); // Should pass format validation first
    });
  });

  describe('Performance Benchmarking', () => {
    beforeEach(() => {
      // Ensure proper mock response structures for performance benchmarking
      mockMexcClient.testConnectivity.mockResolvedValue(true); // Should return boolean true
      mockMexcClient.getServerTime.mockResolvedValue(Date.now()); // Should return timestamp directly
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true, data: { account: 'test' } });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: { balances: [] } });
      mockMexcClient.validateOrderParameters.mockReturnValue({ valid: true, data: {} });
    });

    it('should generate performance metrics', async () => {
      const config = {
        apiKey: 'valid-api-key-with-sufficient-length',
        secretKey: 'valid-secret-key-with-sufficient-length-and-complexity',
        performanceBenchmark: true,
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.details.performanceMetrics).toMatchObject({
        averageLatency: expect.any(Number),
        maxLatency: expect.any(Number),
        successRate: expect.any(Number),
        circuitBreakerStatus: expect.any(String),
      });
    });

    it('should detect high latency issues', async () => {
      // Ensure all validation stages pass
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: [] });
      mockMexcClient.validateOrderParameters.mockReturnValue({ valid: true });
      
      // Mock slow responses for getServerTime to trigger high latency detection
      // Need to mock the auth call first (fast), then all performance benchmark calls (slow)
      mockMexcClient.getServerTime
        .mockResolvedValueOnce(Date.now()) // For auth stage (fast)
        .mockImplementation(() => 
          // All benchmark calls are slow (2.5 seconds each to ensure average > 2 seconds)
          new Promise(resolve => setTimeout(() => resolve(Date.now()), 2500))
        );

      const config = {
        apiKey: 'valid-api-key-with-sufficient-length',
        secretKey: 'valid-secret-key-with-sufficient-length-and-complexity',
        performanceBenchmark: true,
        validateIpAllowlist: false, // Disable to simplify test
        securityChecks: false, // Disable to simplify test
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.recommendations).toContain(
        'High API latency detected - consider optimizing network connection'
      );
      
      // TIMEOUT ELIMINATION: Ensure all promises are flushed
      await flushPromises();
    }, TIMEOUT_CONFIG.STANDARD)); // 20 second timeout to account for 5 slow calls

    it('should detect low success rate', async () => {
      // First, let all main validation stages pass
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: [] });

      // For performance benchmarking, make most getServerTime calls fail (4 out of 5)
      mockMexcClient.getServerTime
        .mockResolvedValueOnce(Date.now()) // For auth stage
        .mockRejectedValueOnce(new Error('API Error')) // For perf benchmark 1
        .mockRejectedValueOnce(new Error('API Error')) // For perf benchmark 2
        .mockRejectedValueOnce(new Error('API Error')) // For perf benchmark 3
        .mockRejectedValueOnce(new Error('API Error')) // For perf benchmark 4
        .mockResolvedValueOnce(Date.now()); // For perf benchmark 5

      const config = {
        apiKey: 'valid-api-key-with-sufficient-length',
        secretKey: 'valid-secret-key-with-sufficient-length-and-complexity',
        performanceBenchmark: true,
        securityChecks: false, // Disable to focus on performance
        validateIpAllowlist: false, // Disable to simplify
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.recommendations).toContain(
        'Low API success rate - check network stability and API limits'
      );
    });

    it('should detect circuit breaker status', async () => {
      vi.mocked(circuitBreakerRegistry.getBreaker).mockReturnValue({
        getState: vi.fn(() => 'OPEN'),
      } as any);

      const config = {
        apiKey: 'valid-api-key-with-sufficient-length',
        secretKey: 'valid-secret-key-with-sufficient-length-and-complexity',
        performanceBenchmark: true,
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.recommendations).toContain(
        'Circuit breaker is open - API may be experiencing issues'
      );
    });
  });

  describe('Security Analysis', () => {
    beforeEach(() => {
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getServerTime.mockResolvedValue(Date.now());
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: [] });
    });

    it('should analyze strong security posture', async () => {
      const config = {
        apiKey: 'very-long-and-complex-api-key-with-sufficient-entropy-for-security',
        secretKey: 'extremely-long-and-complex-secret-key-with-high-entropy-for-maximum-security-validation',
        validateIpAllowlist: true,
        securityChecks: true,
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.details.securityAnalysis).toMatchObject({
        keyStrength: 'strong',
        riskLevel: 'low',
        recommendedActions: expect.any(Array),
      });
    });

    it('should detect weak key strength', async () => {
      // Reset mocks to ensure successful validation stages but with weak keys
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getServerTime.mockResolvedValue(Date.now());
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: [] });
      mockMexcClient.validateOrderParameters.mockReturnValue({ valid: true });

      const config = {
        // Keys that pass format validation (length requirements) but are considered weak for security
        apiKey: 'short-weak-api-key-12', // 18 chars - passes 16 char minimum but < 20 so weak
        secretKey: 'weak-short-secret-key-123456789012', // 36 chars - passes 32 char minimum but < 40 so weak  
        securityChecks: true,
        validateIpAllowlist: false, // Simplify test
        performanceBenchmark: false, // Simplify test
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.details.securityAnalysis).toMatchObject({
        keyStrength: 'weak',
        riskLevel: 'high',
      });
      expect(result.details.securityAnalysis?.recommendedActions).toContain(
        'Consider regenerating API keys for better security'
      );
    });

    it('should detect repeated patterns in keys', async () => {
      const config = {
        apiKey: 'api-key-with-repeated-aaaa-pattern',
        secretKey: 'secret-key-with-repeated-bbbb-pattern',
        securityChecks: true,
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.details.securityAnalysis?.riskLevel).toBe('high');
      expect(result.details.securityAnalysis?.recommendedActions).toContain(
        'API keys contain repeated patterns - regenerate recommended'
      );
    });

    it('should include security recommendations', async () => {
      const config = {
        apiKey: 'valid-api-key-with-sufficient-length',
        secretKey: 'valid-secret-key-with-sufficient-length-and-complexity',
        securityChecks: true,
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.recommendations).toContain(
        'Store API credentials securely using environment variables'
      );
      expect(result.recommendations).toContain(
        'Regularly rotate API keys (recommended: every 90 days)'
      );
      expect(result.recommendations).toContain(
        'Monitor API key usage for unauthorized activity'
      );
    });
  });

  describe('Service Integration Methods', () => {
    beforeEach(() => {
      mockMexcClient.testConnectivity.mockResolvedValue(true);
    });

    it('should initialize service successfully', async () => {
      await validationService.initialize();

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[Enhanced API Validation] Initializing service...'
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[Enhanced API Validation] Service initialized successfully'
      );
    });

    it('should handle initialization errors', async () => {
      // Mock testConnectivity to throw an error directly
      mockMexcClient.testConnectivity.mockRejectedValue(new Error('Network error'));

      await expect(validationService.initialize()).rejects.toThrow('Network error');

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[Enhanced API Validation] Service initialization failed:',
        expect.any(Error)
      );
    });

    it('should perform comprehensive validation', async () => {
      mockMexcClient.getServerTime.mockResolvedValue(Date.now());
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: [] });

      const credentials = {
        apiKey: 'valid-api-key-with-sufficient-length',
        secretKey: 'valid-secret-key-with-sufficient-length-and-complexity',
      };

      const result = await validationService.performComprehensiveValidation('user-123', credentials);

      expect(result).toMatchObject({
        credentialsValid: true,
        securityRisks: expect.any(Array),
        recommendations: expect.any(Array),
        validationDetails: expect.any(Object),
      });
    });

    it('should handle missing credentials in comprehensive validation', async () => {
      const result = await validationService.performComprehensiveValidation('user-123');

      expect(result).toMatchObject({
        credentialsValid: false,
        securityRisks: ['No credentials provided'],
        recommendations: ['Provide valid MEXC API credentials'],
      });
    });

    it('should perform quick validation successfully', async () => {
      const result = await validationService.performQuickValidation();

      expect(result).toMatchObject({
        systemHealthy: true,
      });
    });

    it('should handle quick validation errors', async () => {
      mockMexcClient.testConnectivity.mockRejectedValue(new Error('Network down'));

      const result = await validationService.performQuickValidation();

      expect(result).toMatchObject({
        systemHealthy: false,
        error: 'Network down',
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed credential types', async () => {
      const invalidConfig = {
        apiKey: 123 as any, // Wrong type
        secretKey: null as any, // Wrong type
      };

      const result = await validationService.validateApiCredentials(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('API key is required and must be a string');
    });

    it('should handle complex server time responses', async () => {
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getServerTime.mockResolvedValue({
        data: { serverTime: Date.now() }
      });
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: [] });

      const config = {
        apiKey: 'valid-api-key-with-sufficient-length',
        secretKey: 'valid-secret-key-with-sufficient-length-and-complexity',
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.valid).toBe(true);
    });

    it('should handle all authentication requests failing for IP validation', async () => {
      // First, ensure API authentication and permissions pass
      mockMexcClient.testConnectivity.mockResolvedValue(true);
      mockMexcClient.getServerTime.mockResolvedValue(Date.now());
      mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
      mockMexcClient.getAccountBalances.mockResolvedValue({ success: true, data: [] });

      // Create a client for IP validation where all requests fail
      const ipMexcClient = {
        getAccountInfo: vi.fn().mockRejectedValue(new Error('403 Forbidden')),
        getServerTime: vi.fn().mockRejectedValue(new Error('403 Forbidden')),
        getAccountBalances: vi.fn().mockRejectedValue(new Error('403 Forbidden')),
      };

      // Mock getUnifiedMexcClient to return different clients for different calls
      vi.mocked(getUnifiedMexcClient)
        .mockReturnValueOnce(mockMexcClient) // For connectivity test
        .mockReturnValueOnce(mockMexcClient) // For auth test
        .mockReturnValueOnce(mockMexcClient) // For permissions test
        .mockReturnValueOnce(ipMexcClient as any); // For IP allowlisting test

      const config = {
        apiKey: 'valid-api-key-with-sufficient-length',
        secretKey: 'valid-secret-key-with-sufficient-length-and-complexity',
        validateIpAllowlist: true,
      };

      const result = await validationService.validateApiCredentials(config);

      expect(result.details.ipAllowlisting).toBe(false);
      expect(result.error).toBe('All authenticated requests failed - likely IP allowlist issue');
    });
  });
});