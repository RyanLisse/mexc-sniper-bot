/**
 * Unit tests for MexcAuthService
 * Tests authentication, signature generation, credential validation, and security operations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as crypto from 'node:crypto';
import { MexcAuthService } from '../../../../src/services/api/mexc-auth-service';
import type { UnifiedMexcConfig } from '@/src/schemas/unified/mexc-api-schemas';
import type { ApiParams, AuthenticationContext } from '../../../../src/services/api/mexc-api-types';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

// Mock crypto module
vi.mock('node:crypto', () => ({
  createHmac: vi.fn(),
}));

describe('MexcAuthService', () => {
  let authService: MexcAuthService;
  let mockConfig: Required<UnifiedMexcConfig>;
  let mockHmac: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock configuration
    mockConfig = {
      apiKey: 'test-api-key-12345678901234567890',
      secretKey: 'test-secret-key-12345678901234567890',
      baseUrl: 'https://api.mexc.com',
      timeout: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimitDelay: 100,
      enableCaching: true,
      cacheTTL: 60000,
    };

    // Setup mock HMAC
    mockHmac = {
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('mocked-signature-hash'),
    };

    const mockCreateHmac = crypto.createHmac as any;
    mockCreateHmac.mockReturnValue(mockHmac);

    authService = new MexcAuthService(mockConfig);
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
  
  });

  describe('Constructor', () => {
    it('should create auth service with configuration', () => {
      expect(authService).toBeDefined();
      expect(authService).toBeInstanceOf(MexcAuthService);
    });
  });

  describe('Credential Management', () => {
    describe('hasCredentials', () => {
      it('should return true when valid credentials are configured', () => {
        const result = authService.hasCredentials();
        expect(result).toBe(true);
      });

      it('should return false when API key is missing', () => {
        const configWithoutApiKey = { ...mockConfig, apiKey: '' };
        const service = new MexcAuthService(configWithoutApiKey);
        
        const result = service.hasCredentials();
        expect(result).toBe(false);
      });

      it('should return false when secret key is missing', () => {
        const configWithoutSecret = { ...mockConfig, secretKey: '' };
        const service = new MexcAuthService(configWithoutSecret);
        
        const result = service.hasCredentials();
        expect(result).toBe(false);
      });

      it('should return false when API key is only whitespace', () => {
        const configWithWhitespace = { ...mockConfig, apiKey: '   ' };
        const service = new MexcAuthService(configWithWhitespace);
        
        const result = service.hasCredentials();
        expect(result).toBe(false);
      });

      it('should return false when secret key is only whitespace', () => {
        const configWithWhitespace = { ...mockConfig, secretKey: '   ' };
        const service = new MexcAuthService(configWithWhitespace);
        
        const result = service.hasCredentials();
        expect(result).toBe(false);
      });

      it('should return false when both credentials are missing', () => {
        const configEmpty = { ...mockConfig, apiKey: '', secretKey: '' };
        const service = new MexcAuthService(configEmpty);
        
        const result = service.hasCredentials();
        expect(result).toBe(false);
      });
    });

    describe('validateApiKey', () => {
      it('should validate correct API key format', () => {
        const validKey = 'abcdefghijklmnopqrstuvwxyz123456';
        const result = authService.validateApiKey(validKey);
        expect(result).toBe(true);
      });

      it('should reject API key that is too short', () => {
        const shortKey = 'short';
        const result = authService.validateApiKey(shortKey);
        expect(result).toBe(false);
      });

      it('should reject empty API key', () => {
        const result = authService.validateApiKey('');
        expect(result).toBe(false);
      });

      it('should reject null API key', () => {
        const result = authService.validateApiKey(null as any);
        expect(result).toBe(false);
      });

      it('should reject undefined API key', () => {
        const result = authService.validateApiKey(undefined as any);
        expect(result).toBe(false);
      });

      it('should reject non-string API key', () => {
        const result = authService.validateApiKey(123456 as any);
        expect(result).toBe(false);
      });
    });

    describe('validateApiSecret', () => {
      it('should validate correct API secret format', () => {
        const validSecret = 'abcdefghijklmnopqrstuvwxyz123456';
        const result = authService.validateApiSecret(validSecret);
        expect(result).toBe(true);
      });

      it('should reject API secret that is too short', () => {
        const shortSecret = 'short';
        const result = authService.validateApiSecret(shortSecret);
        expect(result).toBe(false);
      });

      it('should reject empty API secret', () => {
        const result = authService.validateApiSecret('');
        expect(result).toBe(false);
      });

      it('should reject null API secret', () => {
        const result = authService.validateApiSecret(null as any);
        expect(result).toBe(false);
      });

      it('should reject undefined API secret', () => {
        const result = authService.validateApiSecret(undefined as any);
        expect(result).toBe(false);
      });

      it('should reject non-string API secret', () => {
        const result = authService.validateApiSecret(123456 as any);
        expect(result).toBe(false);
      });
    });

    describe('validateCredentials', () => {
      it('should validate correct credentials', () => {
        const result = authService.validateCredentials();
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should return errors for invalid API key', () => {
        const configWithInvalidKey = { ...mockConfig, apiKey: 'short' };
        const service = new MexcAuthService(configWithInvalidKey);
        
        const result = service.validateCredentials();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid API key format');
      });

      it('should return errors for invalid API secret', () => {
        const configWithInvalidSecret = { ...mockConfig, secretKey: 'short' };
        const service = new MexcAuthService(configWithInvalidSecret);
        
        const result = service.validateCredentials();
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid API secret format');
      });

      it('should return multiple errors for both invalid credentials', () => {
        const configWithInvalidBoth = { ...mockConfig, apiKey: 'short', secretKey: 'invalid' };
        const service = new MexcAuthService(configWithInvalidBoth);
        
        const result = service.validateCredentials();
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(result.errors).toContain('Invalid API key format');
        expect(result.errors).toContain('Invalid API secret format');
      });
    });

    describe('testCredentials', () => {
      it('should test credentials successfully', async () => {
        const result = await authService.testCredentials();
        
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(crypto.createHmac).toHaveBeenCalledWith('sha256', mockConfig.secretKey);
        expect(mockHmac.update).toHaveBeenCalledWith(expect.stringContaining('test=true&timestamp='));
        expect(mockHmac.digest).toHaveBeenCalledWith('hex');
      });

      it('should fail when credentials are not configured', async () => {
        const configEmpty = { ...mockConfig, apiKey: '', secretKey: '' };
        const service = new MexcAuthService(configEmpty);
        
        const result = await service.testCredentials();
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('API credentials not configured');
      });

      it('should fail when credentials are invalid format', async () => {
        const configInvalid = { ...mockConfig, apiKey: 'short', secretKey: 'invalid' };
        const service = new MexcAuthService(configInvalid);
        
        const result = await service.testCredentials();
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid API key format, Invalid API secret format');
      });

      it('should fail when signature generation is invalid', async () => {
        mockHmac.digest.mockReturnValue(''); // Invalid signature length
        
        const result = await authService.testCredentials();
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid signature generation');
      });

      it('should fail when signature generation throws error', async () => {
        mockHmac.digest.mockImplementation(() => {
          throw new Error('Crypto error');
        });
        
        const result = await authService.testCredentials();
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Crypto error');
      });

      it('should handle non-Error thrown values', async () => {
        mockHmac.digest.mockImplementation(() => {
          throw 'String error';
        });
        
        const result = await authService.testCredentials();
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Unknown authentication error');
      });
    });
  });

  describe('Signature Generation', () => {
    describe('createSignature', () => {
      it('should create signature successfully', () => {
        const queryString = 'symbol=BTCUSDT&timestamp=1640995200000';
        
        const result = authService.createSignature(queryString);
        
        expect(result).toBe('mocked-signature-hash');
        expect(crypto.createHmac).toHaveBeenCalledWith('sha256', mockConfig.secretKey);
        expect(mockHmac.update).toHaveBeenCalledWith(queryString);
        expect(mockHmac.digest).toHaveBeenCalledWith('hex');
      });

      it('should throw error when credentials are not configured', () => {
        const configEmpty = { ...mockConfig, apiKey: '', secretKey: '' };
        const service = new MexcAuthService(configEmpty);
        
        expect(() => {
          service.createSignature('test=true');
        }).toThrow('API credentials not configured');
      });

      it('should handle empty query string', () => {
        const result = authService.createSignature('');
        
        expect(result).toBe('mocked-signature-hash');
        expect(mockHmac.update).toHaveBeenCalledWith('');
      });

      it('should handle special characters in query string', () => {
        const queryString = 'symbol=BTC/USDT&amount=1.5&type=market&side=buy';
        
        const result = authService.createSignature(queryString);
        
        expect(result).toBe('mocked-signature-hash');
        expect(mockHmac.update).toHaveBeenCalledWith(queryString);
      });
    });

    describe('buildQueryString', () => {
      it('should build query string from simple parameters', () => {
        const params: ApiParams = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: 1.0,
          price: 50000,
        };

        const result = (authService as any).buildQueryString(params);
        
        expect(result).toBe('symbol=BTCUSDT&side=BUY&type=LIMIT&quantity=1&price=50000');
      });

      it('should handle array parameters', () => {
        const params: ApiParams = {
          symbols: ['BTCUSDT', 'ETHUSDT'],
          types: ['LIMIT', 'MARKET'],
        };

        const result = (authService as any).buildQueryString(params);
        
        expect(result).toBe('symbols=BTCUSDT%2CETHUSDT&types=LIMIT%2CMARKET');
      });

      it('should exclude null and undefined values', () => {
        const params: ApiParams = {
          symbol: 'BTCUSDT',
          price: null,
          quantity: undefined,
          side: 'BUY',
        };

        const result = (authService as any).buildQueryString(params);
        
        expect(result).toBe('symbol=BTCUSDT&side=BUY');
      });

      it('should handle boolean values', () => {
        const params: ApiParams = {
          symbol: 'BTCUSDT',
          reduceOnly: true,
          postOnly: false,
        };

        const result = (authService as any).buildQueryString(params);
        
        expect(result).toBe('symbol=BTCUSDT&reduceOnly=true&postOnly=false');
      });

      it('should handle number values including zero', () => {
        const params: ApiParams = {
          symbol: 'BTCUSDT',
          quantity: 0,
          price: 0.001,
          timeInForce: 1,
        };

        const result = (authService as any).buildQueryString(params);
        
        expect(result).toBe('symbol=BTCUSDT&quantity=0&price=0.001&timeInForce=1');
      });

      it('should handle empty object', () => {
        const params: ApiParams = {};

        const result = (authService as any).buildQueryString(params);
        
        expect(result).toBe('');
      });

      it('should handle empty arrays', () => {
        const params: ApiParams = {
          symbol: 'BTCUSDT',
          emptyArray: [],
        };

        const result = (authService as any).buildQueryString(params);
        
        expect(result).toBe('symbol=BTCUSDT&emptyArray=');
      });
    });
  });

  describe('Authentication Context', () => {
    describe('generateAuthContext', () => {
      beforeEach(() => {
        // Mock Date.now to return consistent timestamp
        vi.spyOn(Date, 'now').mockReturnValue(1640995200000);
      });

      afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
        vi.restoreAllMocks();
      
  });

      it('should generate authentication context successfully', () => {
        const params: ApiParams = {
          symbol: 'BTCUSDT',
          side: 'BUY',
        };

        const result = authService.generateAuthContext(params);

        expect(result).toEqual({
          apiKey: mockConfig.apiKey,
          apiSecret: mockConfig.secretKey,
          timestamp: 1640995200000,
          signature: 'mocked-signature-hash',
        });

        // Verify signature was created with correct query string
        expect(mockHmac.update).toHaveBeenCalledWith(
          'symbol=BTCUSDT&side=BUY&timestamp=1640995200000&recvWindow=5000'
        );
      });

      it('should generate context with empty parameters', () => {
        const result = authService.generateAuthContext();

        expect(result.timestamp).toBe(1640995200000);
        expect(result.signature).toBe('mocked-signature-hash');
        expect(mockHmac.update).toHaveBeenCalledWith(
          'timestamp=1640995200000&recvWindow=5000'
        );
      });

      it('should throw error when credentials are not configured', () => {
        const configEmpty = { ...mockConfig, apiKey: '', secretKey: '' };
        const service = new MexcAuthService(configEmpty);

        expect(() => {
          service.generateAuthContext();
        }).toThrow('API credentials not configured');
      });

      it('should handle complex parameters', () => {
        const params: ApiParams = {
          symbol: 'BTCUSDT',
          orders: ['order1', 'order2'],
          metadata: 'test data',
          amount: 1.5,
        };

        const result = authService.generateAuthContext(params);

        expect(result.timestamp).toBe(1640995200000);
        expect(mockHmac.update).toHaveBeenCalledWith(
          expect.stringContaining('symbol=BTCUSDT')
        );
        expect(mockHmac.update).toHaveBeenCalledWith(
          expect.stringContaining('orders=order1%2Corder2')
        );
      });
    });

    describe('addAuthHeaders', () => {
      it('should add authentication headers', () => {
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'MEXC-Client',
        };

        const authContext: AuthenticationContext = {
          apiKey: 'test-api-key',
          apiSecret: 'test-secret-key',
          timestamp: 1640995200000,
          signature: 'test-signature',
        };

        const result = authService.addAuthHeaders(headers, authContext);

        expect(result).toEqual({
          'Content-Type': 'application/json',
          'User-Agent': 'MEXC-Client',
          'X-MEXC-APIKEY': 'test-api-key',
        });
      });

      it('should handle empty headers', () => {
        const authContext: AuthenticationContext = {
          apiKey: 'test-api-key',
          apiSecret: 'test-secret-key',
          timestamp: 1640995200000,
          signature: 'test-signature',
        };

        const result = authService.addAuthHeaders({}, authContext);

        expect(result).toEqual({
          'X-MEXC-APIKEY': 'test-api-key',
        });
      });

      it('should override existing MEXC API key header', () => {
        const headers = {
          'X-MEXC-APIKEY': 'old-api-key',
          'Content-Type': 'application/json',
        };

        const authContext: AuthenticationContext = {
          apiKey: 'new-api-key',
          apiSecret: 'test-secret-key',
          timestamp: 1640995200000,
          signature: 'test-signature',
        };

        const result = authService.addAuthHeaders(headers, authContext);

        expect(result['X-MEXC-APIKEY']).toBe('new-api-key');
      });
    });

    describe('addAuthParams', () => {
      it('should add authentication parameters', () => {
        const params: ApiParams = {
          symbol: 'BTCUSDT',
          side: 'BUY',
        };

        const authContext: AuthenticationContext = {
          apiKey: 'test-api-key',
          apiSecret: 'test-secret-key',
          timestamp: 1640995200000,
          signature: 'test-signature',
        };

        const result = authService.addAuthParams(params, authContext);

        expect(result).toEqual({
          symbol: 'BTCUSDT',
          side: 'BUY',
          timestamp: 1640995200000,
          signature: 'test-signature',
          recvWindow: 5000,
        });
      });

      it('should handle empty parameters', () => {
        const authContext: AuthenticationContext = {
          apiKey: 'test-api-key',
          apiSecret: 'test-secret-key',
          timestamp: 1640995200000,
          signature: 'test-signature',
        };

        const result = authService.addAuthParams({}, authContext);

        expect(result).toEqual({
          timestamp: 1640995200000,
          signature: 'test-signature',
          recvWindow: 5000,
        });
      });

      it('should override existing timestamp and signature', () => {
        const params: ApiParams = {
          symbol: 'BTCUSDT',
          timestamp: 1111111111,
          signature: 'old-signature',
        };

        const authContext: AuthenticationContext = {
          apiKey: 'test-api-key',
          apiSecret: 'test-secret-key',
          timestamp: 1640995200000,
          signature: 'new-signature',
        };

        const result = authService.addAuthParams(params, authContext);

        expect(result.timestamp).toBe(1640995200000);
        expect(result.signature).toBe('new-signature');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle crypto module errors gracefully', () => {
      const mockCreateHmac = crypto.createHmac as any;
      mockCreateHmac.mockImplementation(() => {
        throw new Error('Crypto module error');
      });

      expect(() => {
        authService.createSignature('test=true');
      }).toThrow('Crypto module error');
    });

    it('should handle special characters in credentials', () => {
      const configWithSpecialChars = {
        ...mockConfig,
        apiKey: 'api-key-with-special-chars-!@#$%^&*()',
        secretKey: 'secret-key-with-special-chars-!@#$%^&*()',
      };
      const service = new MexcAuthService(configWithSpecialChars);

      const result = service.hasCredentials();
      expect(result).toBe(true);

      const validationResult = service.validateCredentials();
      expect(validationResult.valid).toBe(true);
    });

    it('should handle very long credentials', () => {
      const longCredential = 'a'.repeat(1000);
      const configWithLongCreds = {
        ...mockConfig,
        apiKey: longCredential,
        secretKey: longCredential,
      };
      const service = new MexcAuthService(configWithLongCreds);

      const result = service.validateCredentials();
      expect(result.valid).toBe(true);
    });

    it('should handle unicode characters in parameters', () => {
      const params: ApiParams = {
        symbol: 'BTCUSDT',
        comment: '测试注释 🚀',
        emoji: '💰',
      };

      const result = (authService as any).buildQueryString(params);
      expect(result).toContain('comment=%E6%B5%8B%E8%AF%95%E6%B3%A8%E9%87%8A%20%F0%9F%9A%80');
      expect(result).toContain('emoji=%F0%9F%92%B0');
    });
  });
});