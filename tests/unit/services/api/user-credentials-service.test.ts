/**
 * Unit tests for User Credentials Service
 * Tests credential retrieval, decryption, database operations, and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getUserCredentials,
  hasUserCredentials,
  type DecryptedCredentials,
} from '../../../../src/services/api/user-credentials-service';

// Mock dependencies
vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => 'mocked-and-condition'),
  eq: vi.fn(() => 'mocked-eq-condition'),
}));

vi.mock('@/src/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
  apiCredentials: {
    userId: 'userId',
    provider: 'provider',
    id: 'id',
    isActive: 'isActive',
    encryptedApiKey: 'encryptedApiKey',
    encryptedSecretKey: 'encryptedSecretKey',
    encryptedPassphrase: 'encryptedPassphrase',
    lastUsed: 'lastUsed',
  },
}));

vi.mock('../../../../src/services/api/secure-encryption-service', () => ({
  getEncryptionService: vi.fn(),
}));

describe('User Credentials Service', () => {
  let mockDb: any;
  let mockApiCredentials: any;
  let mockEncryptionService: any;
  let mockGetEncryptionService: any;
  let mockConsole: any;

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

    // Setup mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    mockApiCredentials = {
      userId: 'userId',
      provider: 'provider',
      id: 'id',
      isActive: 'isActive',
      encryptedApiKey: 'encryptedApiKey',
      encryptedSecretKey: 'encryptedSecretKey',
      encryptedPassphrase: 'encryptedPassphrase',
      lastUsed: 'lastUsed',
    };

    // Setup mock encryption service
    mockEncryptionService = {
      decrypt: vi.fn(),
    };

    mockGetEncryptionService = require('../../../../src/services/api/secure-encryption-service').getEncryptionService;
    mockGetEncryptionService.mockReturnValue(mockEncryptionService);

    // Mock database module
    const dbModule = require('@/src/db');
    dbModule.db = mockDb;
    dbModule.apiCredentials = mockApiCredentials;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserCredentials', () => {
    it('should retrieve and decrypt user credentials successfully', async () => {
      const mockCredentials = {
        id: 'cred-123',
        userId: 'user-123',
        provider: 'mexc',
        isActive: true,
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
        encryptedPassphrase: 'encrypted-passphrase',
        lastUsed: new Date('2023-01-01'),
      };

      // Mock database query
      mockDb.limit.mockResolvedValue([mockCredentials]);

      // Mock decryption
      mockEncryptionService.decrypt
        .mockReturnValueOnce('decrypted-api-key')
        .mockReturnValueOnce('decrypted-secret-key')
        .mockReturnValueOnce('decrypted-passphrase');

      // Mock database update
      mockDb.where.mockResolvedValue(undefined);

      const result = await getUserCredentials('user-123', 'mexc');

      expect(result).toEqual({
        apiKey: 'decrypted-api-key',
        secretKey: 'decrypted-secret-key',
        passphrase: 'decrypted-passphrase',
        provider: 'mexc',
        isActive: true,
        lastUsed: new Date('2023-01-01'),
      });

      // Verify database operations
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(mockApiCredentials);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);

      // Verify decryption calls
      expect(mockEncryptionService.decrypt).toHaveBeenCalledTimes(3);
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-api-key');
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-secret-key');
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-passphrase');

      // Verify last used update
      expect(mockDb.update).toHaveBeenCalledWith(mockApiCredentials);
      expect(mockDb.set).toHaveBeenCalledWith({ lastUsed: expect.any(Date) });
    });

    it('should handle credentials without passphrase', async () => {
      const mockCredentials = {
        id: 'cred-123',
        userId: 'user-123',
        provider: 'mexc',
        isActive: true,
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
        encryptedPassphrase: null, // No passphrase
        lastUsed: null,
      };

      mockDb.limit.mockResolvedValue([mockCredentials]);

      mockEncryptionService.decrypt
        .mockReturnValueOnce('decrypted-api-key')
        .mockReturnValueOnce('decrypted-secret-key');

      mockDb.where.mockResolvedValue(undefined);

      const result = await getUserCredentials('user-123', 'mexc');

      expect(result).toEqual({
        apiKey: 'decrypted-api-key',
        secretKey: 'decrypted-secret-key',
        passphrase: undefined,
        provider: 'mexc',
        isActive: true,
        lastUsed: undefined,
      });

      // Should only decrypt API key and secret key (not passphrase)
      expect(mockEncryptionService.decrypt).toHaveBeenCalledTimes(2);
    });

    it('should return null when no credentials found', async () => {
      mockDb.limit.mockResolvedValue([]); // Empty result

      const result = await getUserCredentials('user-123', 'mexc');

      expect(result).toBeNull();
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UserCredentialsService] No credentials found for user user-123 and provider mexc'
      );
    });

    it('should return null when credentials are inactive', async () => {
      const mockCredentials = {
        id: 'cred-123',
        userId: 'user-123',
        provider: 'mexc',
        isActive: false, // Inactive credentials
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
      };

      mockDb.limit.mockResolvedValue([mockCredentials]);

      const result = await getUserCredentials('user-123', 'mexc');

      expect(result).toBeNull();
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UserCredentialsService] Credentials found but inactive for user user-123'
      );
    });

    it('should use default provider when not specified', async () => {
      mockDb.limit.mockResolvedValue([]);

      await getUserCredentials('user-123'); // No provider specified

      // Should use 'mexc' as default provider
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UserCredentialsService] No credentials found for user user-123 and provider mexc'
      );
    });

    it('should handle encryption service initialization failure', async () => {
      const mockCredentials = {
        id: 'cred-123',
        userId: 'user-123',
        provider: 'mexc',
        isActive: true,
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
      };

      mockDb.limit.mockResolvedValue([mockCredentials]);
      mockGetEncryptionService.mockImplementation(() => {
        throw new Error('Encryption service unavailable');
      });

      await expect(getUserCredentials('user-123', 'mexc')).rejects.toThrow(
        'Encryption service unavailable - check ENCRYPTION_MASTER_KEY environment variable'
      );

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[UserCredentialsService] Encryption service initialization failed for user user-123:',
        expect.any(Error)
      );
    });

    it('should handle decryption failure', async () => {
      const mockCredentials = {
        id: 'cred-123',
        userId: 'user-123',
        provider: 'mexc',
        isActive: true,
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
      };

      mockDb.limit.mockResolvedValue([mockCredentials]);
      mockEncryptionService.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      await expect(getUserCredentials('user-123', 'mexc')).rejects.toThrow(
        'Failed to decrypt API credentials - encryption key may be incorrect'
      );

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[UserCredentialsService] Failed to decrypt credentials for user user-123:',
        expect.any(Error)
      );
    });

    it('should handle database query failure', async () => {
      mockDb.limit.mockRejectedValue(new Error('Database connection failed'));

      await expect(getUserCredentials('user-123', 'mexc')).rejects.toThrow(
        'Database connection failed'
      );

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[UserCredentialsService] Error getting credentials for user user-123:',
        expect.any(Error)
      );
    });

    it('should handle database update failure gracefully', async () => {
      const mockCredentials = {
        id: 'cred-123',
        userId: 'user-123',
        provider: 'mexc',
        isActive: true,
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
      };

      mockDb.limit.mockResolvedValue([mockCredentials]);
      mockEncryptionService.decrypt
        .mockReturnValueOnce('decrypted-api-key')
        .mockReturnValueOnce('decrypted-secret-key');

      // Mock update failure
      mockDb.where.mockRejectedValue(new Error('Update failed'));

      // Should still throw the error since it's in the main function
      await expect(getUserCredentials('user-123', 'mexc')).rejects.toThrow('Update failed');
    });

    it('should handle partial decryption failure', async () => {
      const mockCredentials = {
        id: 'cred-123',
        userId: 'user-123',
        provider: 'mexc',
        isActive: true,
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
        encryptedPassphrase: 'encrypted-passphrase',
      };

      mockDb.limit.mockResolvedValue([mockCredentials]);
      
      // First two decryptions succeed, third fails
      mockEncryptionService.decrypt
        .mockReturnValueOnce('decrypted-api-key')
        .mockReturnValueOnce('decrypted-secret-key')
        .mockImplementation(() => {
          throw new Error('Passphrase decryption failed');
        });

      await expect(getUserCredentials('user-123', 'mexc')).rejects.toThrow(
        'Failed to decrypt API credentials - encryption key may be incorrect'
      );
    });

    it('should propagate specific encryption service errors', async () => {
      const mockCredentials = {
        id: 'cred-123',
        userId: 'user-123',
        provider: 'mexc',
        isActive: true,
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
      };

      mockDb.limit.mockResolvedValue([mockCredentials]);
      mockGetEncryptionService.mockImplementation(() => {
        const error = new Error('Encryption service unavailable');
        error.name = 'EncryptionServiceError';
        throw error;
      });

      await expect(getUserCredentials('user-123', 'mexc')).rejects.toThrow(
        'Encryption service unavailable - check ENCRYPTION_MASTER_KEY environment variable'
      );
    });
  });

  describe('hasUserCredentials', () => {
    it('should return true when active credentials exist', async () => {
      // Mock successful query with results
      mockDb.limit.mockResolvedValue([{ id: 'cred-123' }]);

      const result = await hasUserCredentials('user-123', 'mexc');

      expect(result).toBe(true);
      expect(mockDb.select).toHaveBeenCalledWith({ id: mockApiCredentials.id });
      expect(mockDb.from).toHaveBeenCalledWith(mockApiCredentials);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('should return false when no credentials exist', async () => {
      mockDb.limit.mockResolvedValue([]); // Empty result

      const result = await hasUserCredentials('user-123', 'mexc');

      expect(result).toBe(false);
    });

    it('should use default provider when not specified', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await hasUserCredentials('user-123'); // No provider specified

      expect(result).toBe(false);
      // Verify the query was executed (default provider should be used)
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should handle database query failure gracefully', async () => {
      mockDb.limit.mockRejectedValue(new Error('Database connection failed'));

      const result = await hasUserCredentials('user-123', 'mexc');

      expect(result).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[UserCredentialsService] Error checking credentials for user user-123:',
        expect.any(Error)
      );
    });

    it('should handle network timeout gracefully', async () => {
      mockDb.limit.mockRejectedValue(new Error('Network timeout'));

      const result = await hasUserCredentials('user-123', 'mexc');

      expect(result).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[UserCredentialsService] Error checking credentials for user user-123:',
        expect.any(Error)
      );
    });

    it('should handle malformed database results', async () => {
      mockDb.limit.mockResolvedValue(null); // Unexpected null result

      const result = await hasUserCredentials('user-123', 'mexc');

      expect(result).toBe(false);
    });

    it('should handle non-array database results', async () => {
      mockDb.limit.mockResolvedValue({ id: 'cred-123' }); // Object instead of array

      const result = await hasUserCredentials('user-123', 'mexc');

      expect(result).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should work with different providers', async () => {
      mockDb.limit.mockResolvedValue([]);

      await getUserCredentials('user-123', 'binance');
      await hasUserCredentials('user-123', 'coinbase');

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UserCredentialsService] No credentials found for user user-123 and provider binance'
      );
    });

    it('should handle concurrent requests gracefully', async () => {
      const mockCredentials = {
        id: 'cred-123',
        userId: 'user-123',
        provider: 'mexc',
        isActive: true,
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
      };

      mockDb.limit.mockResolvedValue([mockCredentials]);
      mockEncryptionService.decrypt
        .mockReturnValueOnce('decrypted-api-key')
        .mockReturnValueOnce('decrypted-secret-key');
      mockDb.where.mockResolvedValue(undefined);

      // Make concurrent requests
      const [result1, result2] = await Promise.all([
        getUserCredentials('user-123', 'mexc'),
        hasUserCredentials('user-123', 'mexc'),
      ]);

      expect(result1).toBeTruthy();
      expect(result2).toBe(true);
    });

    it('should handle empty string parameters gracefully', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await getUserCredentials('', '');

      expect(result).toBeNull();
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UserCredentialsService] No credentials found for user  and provider '
      );
    });

    it('should handle special characters in user IDs', async () => {
      mockDb.limit.mockResolvedValue([]);

      await getUserCredentials('user@123!', 'mexc');

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UserCredentialsService] No credentials found for user user@123! and provider mexc'
      );
    });
  });
});