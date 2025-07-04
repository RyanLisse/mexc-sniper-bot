/**
 * Unit tests for Secure Encryption Service
 * Tests encryption/decryption, key derivation, authentication, masking, and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as crypto from 'node:crypto';
import {
  SecureEncryptionService,
  getEncryptionService,
  generateMasterKey,
} from '../../../../src/services/api/secure-encryption-service';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

describe('Secure Encryption Service', () => {
  let mockConsole: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original environment
    originalEnv = { ...process.env };

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

    // Set up a test master key
    process.env.ENCRYPTION_MASTER_KEY = 'dGVzdC1tYXN0ZXIta2V5LWZvci10ZXN0aW5nLTMyLWJ5dGVz'; // base64 encoded 32-byte key
    process.env.ENCRYPTION_KEY_ID = 'test-key-id';
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
    
    // Restore original environment
    process.env = originalEnv;
  
  });

  describe('Constructor and Initialization', () => {
    it('should create service with valid master key', () => {
      const service = new SecureEncryptionService();
      
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SecureEncryptionService);
    });

    it('should throw error when master key is missing', () => {
      delete process.env.ENCRYPTION_MASTER_KEY;
      
      expect(() => new SecureEncryptionService()).toThrow(
        'ENCRYPTION_MASTER_KEY environment variable is required'
      );
    });

    it('should throw error for invalid base64 master key', () => {
      process.env.ENCRYPTION_MASTER_KEY = 'invalid-base64-key!@#$';
      
      expect(() => new SecureEncryptionService()).toThrow(
        'Invalid ENCRYPTION_MASTER_KEY format'
      );
    });

    it('should throw error for master key that is too short', () => {
      // 16 bytes (too short, needs 32)
      process.env.ENCRYPTION_MASTER_KEY = Buffer.from('short-key-16-bytes').toString('base64');
      
      expect(() => new SecureEncryptionService()).toThrow(
        'Master key must be at least 256 bits (32 bytes)'
      );
    });

    it('should use default key ID when not provided', () => {
      delete process.env.ENCRYPTION_KEY_ID;
      
      const service = new SecureEncryptionService();
      expect(service['keyId']).toBe('default');
    });

    it('should use custom key ID when provided', () => {
      process.env.ENCRYPTION_KEY_ID = 'custom-key-id';
      
      const service = new SecureEncryptionService();
      expect(service['keyId']).toBe('custom-key-id');
    });
  });

  describe('Encryption Operations', () => {
    let service: SecureEncryptionService;

    beforeEach(() => {
      service = new SecureEncryptionService();
    });

    it('should encrypt and decrypt data successfully', () => {
      const plaintext = 'sensitive-api-key-123456789';
      
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/); // Valid base64
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'same-data-different-encryption';
      
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2); // Different due to random salt/nonce
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle different data types correctly', () => {
      const testCases = [
        '',
        'simple-string',
        'string with spaces and special chars !@#$%^&*()',
        '{"json": "object", "with": ["array", "values"]}',
        'very-long-string-' + 'x'.repeat(1000),
        'unicode-字符串-тест-🔐',
      ];

      testCases.forEach(testData => {
        const encrypted = service.encrypt(testData);
        const decrypted = service.decrypt(encrypted);
        expect(decrypted).toBe(testData);
      });
    });

    it('should include proper encryption metadata', () => {
      const plaintext = 'test-data';
      const encrypted = service.encrypt(plaintext);
      
      // Parse the encrypted structure
      const encryptedData = JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'));
      
      expect(encryptedData).toMatchObject({
        version: 1,
        salt: expect.any(String),
        nonce: expect.any(String),
        tag: expect.any(String),
        ciphertext: expect.any(String),
      });

      // Verify component lengths (base64 encoded)
      expect(Buffer.from(encryptedData.salt, 'base64')).toHaveLength(32); // 256 bits
      expect(Buffer.from(encryptedData.nonce, 'base64')).toHaveLength(16); // 128 bits
      expect(Buffer.from(encryptedData.tag, 'base64')).toHaveLength(16); // 128 bits
    });
  });

  describe('Decryption Operations', () => {
    let service: SecureEncryptionService;

    beforeEach(() => {
      service = new SecureEncryptionService();
    });

    it('should fail decryption with invalid format', () => {
      const invalidFormats = [
        'not-base64-at-all',
        'aW52YWxpZC1qc29u', // "invalid-json" in base64
        Buffer.from('{"incomplete": "data"}').toString('base64'),
        '',
      ];

      invalidFormats.forEach(invalid => {
        expect(() => service.decrypt(invalid)).toThrow('Failed to decrypt data');
      });
    });

    it('should fail decryption with unsupported version', () => {
      const futureVersionData = {
        version: 999,
        salt: 'c2FsdA==',
        nonce: 'bm9uY2U=',
        tag: 'dGFn',
        ciphertext: 'Y2lwaGVy',
      };
      
      const encoded = Buffer.from(JSON.stringify(futureVersionData)).toString('base64');
      
      expect(() => service.decrypt(encoded)).toThrow('Failed to decrypt data');
    });

    it('should fail decryption with modified ciphertext', () => {
      const plaintext = 'tamper-test-data';
      const encrypted = service.encrypt(plaintext);
      
      // Parse and tamper with ciphertext
      const encryptedData = JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'));
      const originalCiphertext = Buffer.from(encryptedData.ciphertext, 'base64');
      
      // Flip a bit in the ciphertext
      originalCiphertext[0] ^= 1;
      encryptedData.ciphertext = originalCiphertext.toString('base64');
      
      const tamperedEncrypted = Buffer.from(JSON.stringify(encryptedData)).toString('base64');
      
      expect(() => service.decrypt(tamperedEncrypted)).toThrow('Failed to decrypt data');
    });

    it('should fail decryption with modified authentication tag', () => {
      const plaintext = 'auth-tag-test';
      const encrypted = service.encrypt(plaintext);
      
      // Parse and tamper with auth tag
      const encryptedData = JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'));
      const originalTag = Buffer.from(encryptedData.tag, 'base64');
      
      // Flip a bit in the auth tag
      originalTag[0] ^= 1;
      encryptedData.tag = originalTag.toString('base64');
      
      const tamperedEncrypted = Buffer.from(JSON.stringify(encryptedData)).toString('base64');
      
      expect(() => service.decrypt(tamperedEncrypted)).toThrow('Failed to decrypt data');
    });

    it('should fail decryption with wrong master key', () => {
      const plaintext = 'wrong-key-test';
      const encrypted = service.encrypt(plaintext);
      
      // Create new service with different master key
      process.env.ENCRYPTION_MASTER_KEY = Buffer.from('different-master-key-32-bytes-').toString('base64');
      const wrongKeyService = new SecureEncryptionService();
      
      expect(() => wrongKeyService.decrypt(encrypted)).toThrow('Failed to decrypt data');
    });
  });

  describe('Re-encryption', () => {
    let service: SecureEncryptionService;

    beforeEach(() => {
      service = new SecureEncryptionService();
    });

    it('should re-encrypt data with new salt and nonce', () => {
      const plaintext = 'reencrypt-test-data';
      
      const original = service.encrypt(plaintext);
      const reencrypted = service.reencrypt(original);
      
      expect(original).not.toBe(reencrypted); // Different encryption
      expect(service.decrypt(original)).toBe(plaintext);
      expect(service.decrypt(reencrypted)).toBe(plaintext);
    });

    it('should maintain data integrity during re-encryption', () => {
      const complexData = JSON.stringify({
        apiKey: 'sk-test-key-with-complex-data',
        secretKey: 'very-long-secret-key-with-special-chars-!@#$%^&*()',
        metadata: {
          created: new Date().toISOString(),
          permissions: ['read', 'write', 'trade'],
        },
      });
      
      const original = service.encrypt(complexData);
      const reencrypted = service.reencrypt(original);
      
      expect(service.decrypt(reencrypted)).toBe(complexData);
    });

    it('should fail re-encryption with invalid input', () => {
      expect(() => service.reencrypt('invalid-encrypted-data')).toThrow('Failed to decrypt data');
    });
  });

  describe('Validation Methods', () => {
    let service: SecureEncryptionService;

    beforeEach(() => {
      service = new SecureEncryptionService();
    });

    it('should validate correctly encrypted format', () => {
      const plaintext = 'validation-test-data';
      const encrypted = service.encrypt(plaintext);
      
      expect(service.isValidEncryptedFormat(encrypted)).toBe(true);
    });

    it('should reject invalid encrypted formats', () => {
      const invalidFormats = [
        'not-encrypted-data',
        'aW52YWxpZC1kYXRh', // "invalid-data" in base64
        Buffer.from('{"missing": "fields"}').toString('base64'),
        Buffer.from('{"version": "string", "salt": 123}').toString('base64'),
        '',
      ];

      invalidFormats.forEach(invalid => {
        expect(service.isValidEncryptedFormat(invalid)).toBe(false);
      });
    });

    it('should validate all required fields are present', () => {
      const validStructure = {
        version: 1,
        salt: 'c2FsdA==',
        nonce: 'bm9uY2U=',
        tag: 'dGFn',
        ciphertext: 'Y2lwaGVy',
      };
      
      const encoded = Buffer.from(JSON.stringify(validStructure)).toString('base64');
      expect(service.isValidEncryptedFormat(encoded)).toBe(true);
      
      // Test missing fields
      const requiredFields = ['version', 'salt', 'nonce', 'tag', 'ciphertext'];
      
      requiredFields.forEach(field => {
        const incomplete = { ...validStructure };
        delete incomplete[field as keyof typeof incomplete];
        
        const incompleteEncoded = Buffer.from(JSON.stringify(incomplete)).toString('base64');
        expect(service.isValidEncryptedFormat(incompleteEncoded)).toBe(false);
      });
    });
  });

  describe('Static Utility Methods', () => {
    it('should generate secure random keys', () => {
      const key1 = SecureEncryptionService.generateSecureKey();
      const key2 = SecureEncryptionService.generateSecureKey();
      
      expect(key1).not.toBe(key2); // Should be random
      expect(key1).toMatch(/^[A-Za-z0-9+/]+=*$/); // Valid base64
      expect(Buffer.from(key1, 'base64')).toHaveLength(32); // 256 bits
    });

    it('should mask sensitive data correctly', () => {
      const testCases = [
        { input: 'short', expected: '*****' },
        { input: 'medium-length', expected: 'medi*******ngth' },
        { input: 'very-long-api-key-with-many-characters', expected: 'very***************ters' },
        { input: 'exactlyeight', expected: 'exac****ight' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(SecureEncryptionService.maskSensitiveData(input)).toBe(expected);
      });
    });

    it('should handle edge cases in masking', () => {
      expect(SecureEncryptionService.maskSensitiveData('')).toBe('');
      expect(SecureEncryptionService.maskSensitiveData(undefined)).toBe('***undefined***');
      expect(SecureEncryptionService.maskSensitiveData(null)).toBe('***undefined***');
      expect(SecureEncryptionService.maskSensitiveData('a')).toBe('*');
      expect(SecureEncryptionService.maskSensitiveData('ab')).toBe('**');
      expect(SecureEncryptionService.maskSensitiveData('abc')).toBe('***');
    });

    it('should support custom visible character count', () => {
      const data = 'custom-masking-test-data';
      
      expect(SecureEncryptionService.maskSensitiveData(data, 2)).toBe('cu****************ta');
      expect(SecureEncryptionService.maskSensitiveData(data, 6)).toBe('custom**********g-data');
      expect(SecureEncryptionService.maskSensitiveData(data, 0)).toBe('**********************');
    });

    it('should handle non-string input to masking', () => {
      expect(SecureEncryptionService.maskSensitiveData(123 as any)).toBe('***undefined***');
      expect(SecureEncryptionService.maskSensitiveData({} as any)).toBe('***undefined***');
      expect(SecureEncryptionService.maskSensitiveData([] as any)).toBe('***undefined***');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance for multiple calls', () => {
      const instance1 = getEncryptionService();
      const instance2 = getEncryptionService();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(SecureEncryptionService);
    });

    it('should maintain encryption consistency across instances', () => {
      const service1 = getEncryptionService();
      const service2 = getEncryptionService();
      
      const plaintext = 'singleton-test-data';
      const encrypted = service1.encrypt(plaintext);
      const decrypted = service2.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Error Handling and Logging', () => {
    let service: SecureEncryptionService;

    beforeEach(() => {
      service = new SecureEncryptionService();
    });

    it('should log encryption errors', () => {
      // Mock crypto functions to throw errors
      const originalCreateCipheriv = crypto.createCipheriv;
      vi.mocked(crypto.createCipheriv).mockImplementation(() => {
        throw new Error('Crypto error');
      });

      expect(() => service.encrypt('test')).toThrow('Failed to encrypt data');
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[secure-encryption-service]',
        '[Encryption] Encryption failed:',
        '',
        expect.any(Error)
      );

      // Restore original function
      crypto.createCipheriv = originalCreateCipheriv;
    });

    it('should log decryption errors', () => {
      const invalidEncrypted = Buffer.from('{"invalid": "format"}').toString('base64');
      
      expect(() => service.decrypt(invalidEncrypted)).toThrow('Failed to decrypt data');
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[secure-encryption-service]',
        '[Encryption] Decryption failed:',
        '',
        expect.any(Error)
      );
    });

    it('should not leak sensitive information in error messages', () => {
      const plaintext = 'secret-api-key-do-not-leak';
      const encrypted = service.encrypt(plaintext);
      
      // Tamper with encryption
      const tamperedData = encrypted.slice(0, -4) + 'XXXX';
      
      try {
        service.decrypt(tamperedData);
      } catch (error) {
        expect(error.message).toBe('Failed to decrypt data');
        expect(error.message).not.toContain(plaintext);
        expect(error.message).not.toContain('secret');
      }
    });
  });

  describe('Key Generation Utility', () => {
    it('should generate master key and log instructions', () => {
      generateMasterKey();
      
      expect(mockConsole.info).toHaveBeenCalledWith('\n🔐 Generated new master encryption key:');
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/^ENCRYPTION_MASTER_KEY="[A-Za-z0-9+/]+=*"$/)
      );
      expect(mockConsole.info).toHaveBeenCalledWith('\n⚠️  Add this to your .env.local file and keep it secure!');
      expect(mockConsole.info).toHaveBeenCalledWith('⚠️  Never commit this key to version control!');
      expect(mockConsole.info).toHaveBeenCalledWith('⚠️  Loss of this key means loss of all encrypted data!\n');
    });
  });

  describe('Integration and Performance', () => {
    let service: SecureEncryptionService;

    beforeEach(() => {
      service = new SecureEncryptionService();
    });

    it('should handle large data efficiently', () => {
      const largeData = 'x'.repeat(10000); // 10KB of data
      
      const startTime = Date.now();
      const encrypted = service.encrypt(largeData);
      const decrypted = service.decrypt(encrypted);
      const endTime = Date.now();
      
      expect(decrypted).toBe(largeData);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent operations correctly', async () => {
      const testData = Array.from({ length: 10 }, (_, i) => `concurrent-test-${i}`);
      
      // Encrypt all data concurrently
      const encryptPromises = testData.map(data => 
        Promise.resolve(service.encrypt(data))
      );
      const encryptedResults = await Promise.all(encryptPromises);
      
      // Decrypt all data concurrently
      const decryptPromises = encryptedResults.map(encrypted => 
        Promise.resolve(service.decrypt(encrypted))
      );
      const decryptedResults = await Promise.all(decryptPromises);
      
      expect(decryptedResults).toEqual(testData);
      expect(new Set(encryptedResults).size).toBe(10); // All encryptions should be unique
    });

    it('should maintain security with multiple encryption cycles', () => {
      const originalData = 'multi-cycle-test-data';
      let currentData = originalData;
      
      // Encrypt and decrypt multiple times
      for (let i = 0; i < 5; i++) {
        const encrypted = service.encrypt(currentData);
        currentData = service.decrypt(encrypted);
        expect(currentData).toBe(originalData);
      }
    });
  });

  describe('Cryptographic Properties', () => {
    let service: SecureEncryptionService;

    beforeEach(() => {
      service = new SecureEncryptionService();
    });

    it('should use different salts for each encryption', () => {
      const plaintext = 'salt-uniqueness-test';
      
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      
      const data1 = JSON.parse(Buffer.from(encrypted1, 'base64').toString('utf8'));
      const data2 = JSON.parse(Buffer.from(encrypted2, 'base64').toString('utf8'));
      
      expect(data1.salt).not.toBe(data2.salt);
      expect(data1.nonce).not.toBe(data2.nonce);
    });

    it('should use proper key derivation parameters', () => {
      const plaintext = 'pbkdf2-test';
      const encrypted = service.encrypt(plaintext);
      
      // Verify we can decrypt (indicating proper PBKDF2 usage)
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
      
      // Check that different master keys produce different results
      const originalKey = process.env.ENCRYPTION_MASTER_KEY;
      process.env.ENCRYPTION_MASTER_KEY = Buffer.from('different-key-32-bytes-test-').toString('base64');
      
      const differentService = new SecureEncryptionService();
      const differentEncrypted = differentService.encrypt(plaintext);
      
      expect(encrypted).not.toBe(differentEncrypted);
      
      // Restore original key
      process.env.ENCRYPTION_MASTER_KEY = originalKey;
    });

    it('should provide authenticated encryption', () => {
      const plaintext = 'authenticated-encryption-test';
      const encrypted = service.encrypt(plaintext);
      
      // Parse structure to verify auth tag presence
      const encryptedData = JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'));
      
      expect(encryptedData.tag).toBeDefined();
      expect(Buffer.from(encryptedData.tag, 'base64')).toHaveLength(16); // GCM tag is 128 bits
      
      // Verify authentication by tampering with ciphertext
      const originalCiphertext = Buffer.from(encryptedData.ciphertext, 'base64');
      originalCiphertext[0] ^= 1; // Flip one bit
      encryptedData.ciphertext = originalCiphertext.toString('base64');
      
      const tamperedEncrypted = Buffer.from(JSON.stringify(encryptedData)).toString('base64');
      
      // Should fail authentication
      expect(() => service.decrypt(tamperedEncrypted)).toThrow('Failed to decrypt data');
    });
  });
});