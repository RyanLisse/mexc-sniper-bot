# Secure Encryption Quick Start Guide

## 🚀 Quick Setup

### 1. Generate Master Key
```bash
# Generate a secure key
openssl rand -base64 32

# Example output: 
# 7K8xNmPqRsTuVwXyZ1234567890ABCDEFGHIJKLMNOPQr=
```

### 2. Add to Environment
```bash
# Add to .env.local
echo 'ENCRYPTION_MASTER_KEY="your-generated-key-here"' >> .env.local
```

### 3. Use in Code

#### Encrypting Data
```typescript
import { getEncryptionService } from '@/src/services/secure-encryption-service';

// Get the encryption service instance
const encryptionService = getEncryptionService();

// Encrypt sensitive data
const apiKey = 'mx0x_1234567890abcdef';
const encryptedApiKey = encryptionService.encrypt(apiKey);

// Store encryptedApiKey in database
```

#### Decrypting Data
```typescript
import { getEncryptionService } from '@/src/services/secure-encryption-service';

// Get the encryption service instance
const encryptionService = getEncryptionService();

// Decrypt data from database
const encryptedApiKey = 'eyJ2ZXJzaW9uIj...'; // From database
const apiKey = encryptionService.decrypt(encryptedApiKey);

// Use the decrypted API key
```

#### Masking Sensitive Data
```typescript
import { SecureEncryptionService } from '@/src/services/secure-encryption-service';

// Mask for display
const maskedKey = SecureEncryptionService.maskSensitiveData(apiKey);
// Result: "mx0x****cdef"
```

## 🔄 Migration Guide

### For Existing Data
```bash
# 1. Set old key (if not using default)
export OLD_ENCRYPTION_KEY="your-old-key"

# 2. Run migration
bun run scripts/migrate-encryption.ts --force
```

### Manual Migration (Single Record)
```typescript
// If you need to migrate a single record manually
const oldDecrypted = decryptOldMethod(oldEncrypted);
const newEncrypted = encryptionService.encrypt(oldDecrypted);
```

## 🛡️ Security Best Practices

### DO ✅
- Generate a new key for each environment (dev/staging/prod)
- Store keys in secure environment variables
- Use the provided encryption service for ALL sensitive data
- Rotate keys quarterly
- Monitor for decryption errors

### DON'T ❌
- Hardcode keys in source code
- Use the same key across environments
- Store plaintext API credentials
- Log decrypted values
- Share master keys via insecure channels

## 🔍 Troubleshooting

### Common Errors

#### "ENCRYPTION_MASTER_KEY environment variable is required"
**Solution**: Generate and set the master key
```bash
openssl rand -base64 32
# Add to .env.local
```

#### "Failed to decrypt data"
**Possible causes**:
1. Wrong master key
2. Data encrypted with old method
3. Corrupted encrypted data

**Solution**: Check logs and run migration if needed

#### "Master key must be at least 256 bits"
**Solution**: Ensure your key is properly generated
```bash
# This generates a 256-bit (32-byte) key
openssl rand -base64 32
```

## 📊 Performance Tips

### Batch Operations
```typescript
// Instead of encrypting one by one
for (const item of items) {
  encrypted.push(encryptionService.encrypt(item));
}

// Consider parallel processing for large batches
const encrypted = await Promise.all(
  items.map(item => 
    Promise.resolve(encryptionService.encrypt(item))
  )
);
```

### Caching Decrypted Values
```typescript
// Cache decrypted values in memory (be careful with security)
const cache = new Map<string, string>();

function getDecrypted(encrypted: string): string {
  if (cache.has(encrypted)) {
    return cache.get(encrypted)!;
  }
  
  const decrypted = encryptionService.decrypt(encrypted);
  cache.set(encrypted, decrypted);
  
  // Clear cache after 5 minutes
  setTimeout(() => cache.delete(encrypted), 5 * 60 * 1000);
  
  return decrypted;
}
```

## 🧪 Testing

### Unit Test Example
```typescript
import { vi, describe, it, expect } from 'vitest';

describe('API Credentials', () => {
  it('should encrypt credentials before saving', async () => {
    // Mock the encryption service
    const mockEncrypt = vi.fn().mockReturnValue('encrypted-value');
    vi.spyOn(encryptionService, 'encrypt').mockImplementation(mockEncrypt);
    
    // Test your code
    await saveCredentials({ apiKey: 'test-key' });
    
    // Verify encryption was called
    expect(mockEncrypt).toHaveBeenCalledWith('test-key');
  });
});
```

## 🚨 Emergency Procedures

### If Master Key is Compromised
1. Generate new master key immediately
2. Re-encrypt all data with new key
3. Rotate all user API credentials
4. Audit access logs

### If Unable to Decrypt
1. Check environment variables
2. Verify key format (base64)
3. Check migration status
4. Contact security team

## 📚 Additional Resources

- [Full Technical Documentation](./src/services/secure-encryption-service.ts)
- [Migration Strategy](./ENCRYPTION_MIGRATION_STRATEGY.md)
- [Security Report](./SECURITY_REMEDIATION_REPORT.md)
- [OWASP Crypto Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)