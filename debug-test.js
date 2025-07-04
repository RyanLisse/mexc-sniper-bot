// Debug test to see actual values
const { describe, it, expect, beforeEach, vi, afterEach } = require('vitest');

// Import the service
import {
  EnhancedApiValidationService,
} from './src/services/api/enhanced-api-validation-service';

// Mock dependencies
vi.mock('./src/services/notification/error-logging-service', () => ({
  ErrorLoggingService: {
    getInstance: vi.fn(() => ({
      logError: vi.fn(),
    })),
  },
}));

vi.mock('./src/services/risk/circuit-breaker', () => ({
  circuitBreakerRegistry: {
    getBreaker: vi.fn(() => ({
      getState: vi.fn(() => 'CLOSED'),
    })),
  },
}));

vi.mock('./src/services/api/mexc-client-factory', () => ({
  getUnifiedMexcClient: vi.fn(),
}));

import { getUnifiedMexcClient } from './src/services/api/mexc-client-factory';

async function debugTest() {
  const mockMexcClient = {
    testConnectivity: vi.fn(),
    getServerTime: vi.fn(),
    getAccountInfo: vi.fn(),
    getAccountBalances: vi.fn(),
    validateOrderParameters: vi.fn(),
  };

  // Mock successful responses
  mockMexcClient.testConnectivity.mockResolvedValue(true);
  mockMexcClient.getServerTime.mockResolvedValue(Date.now());
  mockMexcClient.getAccountInfo.mockResolvedValue({ success: true });
  mockMexcClient.getAccountBalances.mockResolvedValue({ 
    success: true, 
    data: [{ free: '100', locked: '0', asset: 'USDT' }] 
  });
  mockMexcClient.validateOrderParameters.mockReturnValue({ valid: true });

  vi.mocked(getUnifiedMexcClient).mockReturnValue(mockMexcClient);

  const validationService = EnhancedApiValidationService.getInstance();
  validationService.clearCache();

  const configWithSpaces = { 
    apiKey: 'valid-api-key-with-sufficient-length with space',
    secretKey: 'valid-secret-key-with-sufficient-length-and-complexity',
    validateIpAllowlist: true,
    performanceBenchmark: true,
    securityChecks: true,
  };

  const result = await validationService.validateApiCredentials(configWithSpaces);
  
  console.log('DEBUG: Full result object:');
  console.log(JSON.stringify(result, null, 2));
  console.log('DEBUG: Recommendations array:');
  console.log(result.recommendations);
  console.log('DEBUG: Looking for:', 'Remove any spaces from API keys');
  console.log('DEBUG: Contains?', result.recommendations.includes('Remove any spaces from API keys'));
}

debugTest().catch(console.error);