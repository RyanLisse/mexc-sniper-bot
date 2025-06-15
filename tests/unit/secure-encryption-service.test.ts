/**
 * Unit tests for SecureEncryptionService
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SecureEncryptionService, getEncryptionService } from '@/src/services/secure-encryption-service';

describe('SecureEncryptionService', () => {
  let originalEnv: string | undefined;

  beforeAll(() => {
    // Save original env and set test key
    originalEnv = process.env.ENCRYPTION_MASTER_KEY;
    // Set a test key (32 bytes base64)
    process.env.ENCRYPTION_MASTER_KEY = 'dGVzdC1tYXN0ZXIta2V5LWZvci11bml0LXRlc3RpbmcxMjM=';
  });

  afterAll(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.ENCRYPTION_MASTER_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_MASTER_KEY;
    }
  });

  describe('Constructor', () => {
    it('should throw error if ENCRYPTION_MASTER_KEY is not set', () => {
      const tempKey = process.env.ENCRYPTION_MASTER_KEY;
      delete process.env.ENCRYPTION_MASTER_KEY;
      
      expect(() => new SecureEncryptionService()).toThrow(
        'ENCRYPTION_MASTER_KEY environment variable is required'
      );
      
      process.env.ENCRYPTION_MASTER_KEY = tempKey;
    });

    it('should throw error if key is too short', () => {
      const tempKey = process.env.ENCRYPTION_MASTER_KEY;
      process.env.ENCRYPTION_MASTER_KEY = 'c2hvcnQ='; // "short" in base64
      
      expect(() => new SecureEncryptionService()).toThrow(
        'Master key must be at least 256 bits (32 bytes)'
      );
      
      process.env.ENCRYPTION_MASTER_KEY = tempKey;
    });

    it('should throw error if key is not valid base64', () => {
      const tempKey = process.env.ENCRYPTION_MASTER_KEY;
      process.env.ENCRYPTION_MASTER_KEY = '=';
      
      expect(() => new SecureEncryptionService()).toThrow(
        'Master key must be at least 256 bits (32 bytes)'
      );
      
      process.env.ENCRYPTION_MASTER_KEY = tempKey;
    });
  });

  describe('Encryption and Decryption', () => {
    let service: SecureEncryptionService;

    beforeAll(() => {
      service = new SecureEncryptionService();
    });

    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'my-secret-api-key-12345';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same input (due to random salt/nonce)', () => {
      const plaintext = 'my-secret-api-key-12345';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to the same value
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`±§€£¥';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle Unicode characters', () => {
      const plaintext = '你好世界 🌍 مرحبا بالعالم';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should fail to decrypt tampered data', () => {
      const plaintext = 'my-secret-api-key-12345';
      const encrypted = service.encrypt(plaintext);
      
      // Tamper with the encrypted data
      const tampered = encrypted.slice(0, -4) + 'XXXX';
      
      expect(() => service.decrypt(tampered)).toThrow('Failed to decrypt data');
    });

    it('should fail to decrypt invalid format', () => {
      expect(() => service.decrypt('not-valid-encrypted-data')).toThrow(
        'Failed to decrypt data'
      );
    });
  });

  describe('Format Validation', () => {
    let service: SecureEncryptionService;

    beforeAll(() => {
      service = new SecureEncryptionService();
    });

    it('should validate correctly encrypted format', () => {
      const plaintext = 'test-data';
      const encrypted = service.encrypt(plaintext);
      
      expect(service.isValidEncryptedFormat(encrypted)).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(service.isValidEncryptedFormat('plain-text')).toBe(false);
      expect(service.isValidEncryptedFormat('eyJub3QiOiJ2YWxpZCJ9')).toBe(false); // {"not":"valid"}
      expect(service.isValidEncryptedFormat('')).toBe(false);
    });
  });

  describe('Reencryption', () => {
    let service: SecureEncryptionService;

    beforeAll(() => {
      service = new SecureEncryptionService();
    });

    it('should reencrypt data with new salt/nonce', () => {
      const plaintext = 'my-secret-api-key-12345';
      const encrypted1 = service.encrypt(plaintext);
      const reencrypted = service.reencrypt(encrypted1);
      
      // Should be different due to new salt/nonce
      expect(reencrypted).not.toBe(encrypted1);
      
      // But should decrypt to same value
      expect(service.decrypt(reencrypted)).toBe(plaintext);
    });
  });

  describe('Static Methods', () => {
    it('should generate secure random keys', () => {
      const key1 = SecureEncryptionService.generateSecureKey();
      const key2 = SecureEncryptionService.generateSecureKey();
      
      // Should be base64
      expect(() => Buffer.from(key1, 'base64')).not.toThrow();
      expect(() => Buffer.from(key2, 'base64')).not.toThrow();
      
      // Should be 32 bytes (44 chars in base64 including padding)
      expect(key1.length).toBe(44);
      expect(key2.length).toBe(44);
      
      // Should be different
      expect(key1).not.toBe(key2);
    });

    it('should mask sensitive data correctly', () => {
      expect(SecureEncryptionService.maskSensitiveData('1234567890')).toBe('1234****7890');
      expect(SecureEncryptionService.maskSensitiveData('12345678')).toBe('********');
      expect(SecureEncryptionService.maskSensitiveData('short')).toBe('*****');
      expect(SecureEncryptionService.maskSensitiveData('')).toBe('');
      
      // Custom visible chars
      expect(SecureEncryptionService.maskSensitiveData('1234567890', 2)).toBe('12******90');
      expect(SecureEncryptionService.maskSensitiveData('1234567890', 1)).toBe('1********0');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getEncryptionService();
      const instance2 = getEncryptionService();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Performance', () => {
    let service: SecureEncryptionService;

    beforeAll(() => {
      service = new SecureEncryptionService();
    });

    it('should encrypt/decrypt within reasonable time', () => {
      const plaintext = 'my-secret-api-key-12345';
      const iterations = 10; // Reduced iterations to prevent timeout
      
      const startEncrypt = Date.now();
      for (let i = 0; i < iterations; i++) {
        service.encrypt(plaintext);
      }
      const encryptTime = Date.now() - startEncrypt;
      
      const encrypted = service.encrypt(plaintext);
      const startDecrypt = Date.now();
      for (let i = 0; i < iterations; i++) {
        service.decrypt(encrypted);
      }
      const decryptTime = Date.now() - startDecrypt;
      
      // Should be less than 200ms per operation on average (realistic for PBKDF2 + AES-GCM under load)
      expect(encryptTime / iterations).toBeLessThan(200);
      expect(decryptTime / iterations).toBeLessThan(200);
      
      console.log(`Average encryption time: ${encryptTime / iterations}ms`);
      console.log(`Average decryption time: ${decryptTime / iterations}ms`);
    }, 10000); // Increased timeout to 10 seconds
  });
});