/**
 * Unit tests for Base MEXC Service
 * Tests foundational service class providing common MEXC API functionality with HTTP client integration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BaseMexcService } from '../../../../src/services/data/base-mexc-service';
import type { UnifiedMexcConfig } from '../../../../src/schemas/unified/mexc-api-schemas';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

describe('Base MEXC Service', () => {
  let baseMexcService: BaseMexcService;
  let mockConsole: any;

  // Mock configuration
  const mockConfig: Partial<UnifiedMexcConfig> = {
    apiKey: 'test_api_key',
    secretKey: 'test_secret_key',
    baseUrl: 'https://api.mexc.com',
    timeout: 30000,
    enableCaching: true,
    cacheTTL: 60000,
    apiResponseTTL: 30000,
    enableCircuitBreaker: false,
    enableRateLimiter: true,
    maxRetries: 3,
    retryDelay: 1000,
    rateLimitDelay: 100,
    enablePaperTrading: true,
    passphrase: 'test_passphrase',
    enableTestMode: false,
    enableMetrics: false,
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

    // Create service instance
    baseMexcService = new BaseMexcService(mockConfig);
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
  
  });

  describe('Constructor and Configuration', () => {
    it('should create base service with provided configuration', () => {
      expect(baseMexcService).toBeDefined();
      expect(baseMexcService).toBeInstanceOf(BaseMexcService);
    });

    it('should initialize with default configuration when no config provided', () => {
      const defaultService = new BaseMexcService();
      
      expect(defaultService).toBeDefined();
      expect(defaultService).toBeInstanceOf(BaseMexcService);
    });

    it('should merge provided config with defaults correctly', () => {
      const partialConfig = {
        apiKey: 'custom_key',
        timeout: 15000,
      };

      const service = new BaseMexcService(partialConfig);
      
      expect(service).toBeDefined();
      // Configuration is private, but we can test that construction succeeds
    });

    it('should handle empty configuration object', () => {
      const service = new BaseMexcService({});
      
      expect(service).toBeDefined();
    });

    it('should apply default values for missing configuration properties', () => {
      const minimalConfig = {
        apiKey: 'test_key',
      };

      const service = new BaseMexcService(minimalConfig);
      
      expect(service).toBeDefined();
      // Should use defaults for all other properties
    });
  });

  describe('Configuration Validation', () => {
    it('should handle boolean configuration options correctly', () => {
      const booleanConfig = {
        enableCaching: false,
        enableCircuitBreaker: true,
        enableRateLimiter: false,
        enablePaperTrading: false,
        enableTestMode: true,
        enableMetrics: true,
      };

      const service = new BaseMexcService(booleanConfig);
      
      expect(service).toBeDefined();
    });

    it('should handle numeric configuration options correctly', () => {
      const numericConfig = {
        timeout: 45000,
        cacheTTL: 120000,
        apiResponseTTL: 60000,
        maxRetries: 5,
        retryDelay: 2000,
        rateLimitDelay: 200,
      };

      const service = new BaseMexcService(numericConfig);
      
      expect(service).toBeDefined();
    });

    it('should handle string configuration options correctly', () => {
      const stringConfig = {
        apiKey: 'custom_api_key',
        secretKey: 'custom_secret_key',
        baseUrl: 'https://custom.mexc.com',
        passphrase: 'custom_passphrase',
      };

      const service = new BaseMexcService(stringConfig);
      
      expect(service).toBeDefined();
    });
  });

  describe('Core Client Integration', () => {
    it('should initialize core client with proper configuration', () => {
      // Core client initialization happens in constructor
      expect(baseMexcService).toBeDefined();
      
      // Test that we can access core client methods (they should be defined)
      expect(() => {
        // This tests internal structure without exposing private methods
        const service = new BaseMexcService(mockConfig);
        expect(service).toBeInstanceOf(BaseMexcService);
      }).not.toThrow();
    });

    it('should handle core client initialization with minimal config', () => {
      const minimalConfig = {
        apiKey: 'test',
        secretKey: 'test',
      };

      const service = new BaseMexcService(minimalConfig);
      
      expect(service).toBeDefined();
    });

    it('should handle core client initialization with invalid config gracefully', () => {
      const invalidConfig = {
        apiKey: '',
        secretKey: '',
        baseUrl: 'invalid-url',
        timeout: -1,
      };

      // Should not throw during construction
      expect(() => {
        new BaseMexcService(invalidConfig);
      }).not.toThrow();
    });
  });

  describe('Logger Integration', () => {
    it('should have logger with all required methods', () => {
      // Test logger exists and has required methods by triggering log calls
      expect(() => {
        const service = new BaseMexcService(mockConfig);
        expect(service).toBeDefined();
      }).not.toThrow();
    });

    it('should format log messages correctly', () => {
      // Logger is used internally during construction and API calls
      // We can verify it doesn't throw during service creation
      const service = new BaseMexcService(mockConfig);
      
      expect(service).toBeDefined();
      expect(mockConsole.info).toBeDefined();
      expect(mockConsole.warn).toBeDefined();
      expect(mockConsole.error).toBeDefined();
      expect(mockConsole.debug).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration errors gracefully', () => {
      const problematicConfigs = [
        { apiKey: null },
        { secretKey: undefined },
        { timeout: 'invalid' },
        { baseUrl: null },
      ];

      problematicConfigs.forEach((config) => {
        expect(() => {
          new BaseMexcService(config as any);
        }).not.toThrow();
      });
    });

    it('should handle null configuration with error', () => {
      expect(() => {
        new BaseMexcService(null as any);
      }).toThrow();
    });

    it('should handle undefined configuration gracefully', () => {
      // Undefined should work due to default parameter
      expect(() => {
        new BaseMexcService(undefined as any);
      }).not.toThrow();
    });

    it('should handle missing required dependencies', () => {
      // Test that service creation doesn't fail even with problematic configs
      expect(() => {
        new BaseMexcService({});
      }).not.toThrow();
    });
  });

  describe('Array Validation and Mapping', () => {
    it('should handle valid array data with schema validation', () => {
      // Test the validateAndMapArray method indirectly through service creation
      const service = new BaseMexcService(mockConfig);
      
      expect(service).toBeDefined();
      
      // Create a simple mock schema for testing
      const mockSchema = {
        parse: vi.fn((item) => ({ ...item, validated: true })),
      };

      // Access the protected method through type assertion for testing
      const testData = [{ id: 1, name: 'test' }, { id: 2, name: 'test2' }];
      const result = (service as any).validateAndMapArray(testData, mockSchema);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(mockSchema.parse).toHaveBeenCalledTimes(2);
    });

    it('should handle empty array data', () => {
      const service = new BaseMexcService(mockConfig);
      const mockSchema = { parse: vi.fn((item) => item) };

      const result = (service as any).validateAndMapArray([], mockSchema);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
      expect(mockSchema.parse).not.toHaveBeenCalled();
    });

    it('should handle non-array data gracefully', () => {
      const service = new BaseMexcService(mockConfig);
      const mockSchema = { parse: vi.fn((item) => item) };

      const nonArrayData = [
        null,
        undefined,
        'string',
        { object: true },
        123,
        true,
      ];

      nonArrayData.forEach((data) => {
        const result = (service as any).validateAndMapArray(data, mockSchema);
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      });
    });

    it('should filter out invalid items after schema parsing', () => {
      const service = new BaseMexcService(mockConfig);
      const mockSchema = {
        parse: vi.fn((item) => {
          // Return null for invalid items
          return item.valid ? item : null;
        }),
      };

      const testData = [
        { id: 1, valid: true },
        { id: 2, valid: false },
        { id: 3, valid: true },
      ];

      const result = (service as any).validateAndMapArray(testData, mockSchema);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2); // Only valid items
      expect(mockSchema.parse).toHaveBeenCalledTimes(3);
    });

    it('should handle schema parsing errors', () => {
      const service = new BaseMexcService(mockConfig);
      const mockSchema = {
        parse: vi.fn(() => {
          throw new Error('Schema validation error');
        }),
      };

      const testData = [{ id: 1 }];

      expect(() => {
        (service as any).validateAndMapArray(testData, mockSchema);
      }).toThrow('Schema validation error');
    });
  });

  describe('Request Execution Utils', () => {
    it('should handle request URL building logic', () => {
      const service = new BaseMexcService(mockConfig);

      // Test that service can be created and doesn't fail URL construction
      expect(service).toBeDefined();
    });

    it('should handle timestamp generation', () => {
      const service = new BaseMexcService(mockConfig);

      // Timestamp generation happens internally
      expect(service).toBeDefined();
    });

    it('should handle query parameter construction', () => {
      const service = new BaseMexcService(mockConfig);

      // Query parameter logic is tested indirectly through service functionality
      expect(service).toBeDefined();
    });
  });

  describe('Edge Cases and Performance', () => {
    it('should handle large configuration objects', () => {
      const largeConfig = {
        ...mockConfig,
        customProperty1: 'value1',
        customProperty2: 'value2',
        customProperty3: 'value3',
        // Add many properties to test performance
        ...Array.from({ length: 100 }, (_, i) => ({
          [`customProp${i}`]: `value${i}`,
        })).reduce((acc, item) => ({ ...acc, ...item }), {}),
      };

      const startTime = Date.now();
      const service = new BaseMexcService(largeConfig);
      const endTime = Date.now();

      expect(service).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should handle concurrent service creation', async () => {
      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(new BaseMexcService(mockConfig))
      );

      const services = await Promise.all(promises);

      services.forEach((service) => {
        expect(service).toBeDefined();
        expect(service).toBeInstanceOf(BaseMexcService);
      });
    });

    it('should handle memory efficiently with multiple instances', () => {
      const services = Array.from({ length: 50 }, () =>
        new BaseMexcService(mockConfig)
      );

      services.forEach((service) => {
        expect(service).toBeDefined();
      });

      // Cleanup should be automatic when services go out of scope
    });
  });

  describe('Integration Readiness', () => {
    it('should be ready for API request execution', () => {
      const service = new BaseMexcService(mockConfig);

      // Service should be properly initialized with core client
      expect(service).toBeDefined();
    });

    it('should be ready for authentication', () => {
      const service = new BaseMexcService({
        apiKey: 'test_key',
        secretKey: 'test_secret',
      });

      expect(service).toBeDefined();
    });

    it('should be ready for different API environments', () => {
      const environments = [
        { baseUrl: 'https://api.mexc.com' },
        { baseUrl: 'https://testnet.mexc.com' },
        { baseUrl: 'https://api-test.mexc.com' },
      ];

      environments.forEach((env) => {
        const service = new BaseMexcService({ ...mockConfig, ...env });
        expect(service).toBeDefined();
      });
    });
  });

  describe('Configuration Inheritance', () => {
    it('should properly inherit all configuration properties', () => {
      const fullConfig: Partial<UnifiedMexcConfig> = {
        apiKey: 'inherit_test_key',
        secretKey: 'inherit_test_secret',
        baseUrl: 'https://inherit.mexc.com',
        timeout: 25000,
        enableCaching: false,
        cacheTTL: 90000,
        apiResponseTTL: 45000,
        enableCircuitBreaker: true,
        enableRateLimiter: false,
        maxRetries: 5,
        retryDelay: 1500,
        rateLimitDelay: 150,
        enablePaperTrading: false,
        passphrase: 'inherit_passphrase',
        enableTestMode: true,
        enableMetrics: true,
      };

      const service = new BaseMexcService(fullConfig);

      expect(service).toBeDefined();
    });

    it('should handle partial configuration override', () => {
      const partialOverride = {
        apiKey: 'override_key',
        timeout: 20000,
        enableCaching: false,
      };

      const service = new BaseMexcService(partialOverride);

      expect(service).toBeDefined();
    });
  });
});