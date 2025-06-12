# Encryption Migration Strategy

## Overview

This document outlines the migration strategy from the vulnerable hardcoded encryption to a secure, production-ready encryption system.

## Migration Steps

### Phase 1: Preparation (Immediate)

1. **Generate Master Key**
   ```bash
   # Generate a secure 256-bit key
   openssl rand -base64 32
   ```

2. **Update Environment Variables**
   ```bash
   # Add to .env.local (development)
   ENCRYPTION_MASTER_KEY="your-generated-key-here"
   
   # For migration only (if using non-default old key)
   OLD_ENCRYPTION_KEY="default-key-change-in-production-32ch"
   ```

3. **Backup Database**
   ```bash
   # SQLite backup
   cp mexc_sniper.db mexc_sniper.db.backup-$(date +%Y%m%d-%H%M%S)
   
   # TursoDB backup (if applicable)
   # Use TursoDB's backup mechanisms
   ```

### Phase 2: Code Deployment

1. **Deploy Updated Code**
   - Deploy the new encryption service
   - Deploy updated API routes
   - Ensure ENCRYPTION_MASTER_KEY is set in production environment

2. **Verify Deployment**
   - Check application logs for encryption service initialization
   - Test that new credentials can be saved (use test account)

### Phase 3: Data Migration

1. **Test Migration Locally**
   ```bash
   # Test with local database copy
   cp mexc_sniper.db mexc_sniper.db.test
   DATABASE_URL="sqlite:///./mexc_sniper.db.test" bun run scripts/migrate-encryption.ts --force
   ```

2. **Production Migration**
   ```bash
   # Run migration script
   bun run scripts/migrate-encryption.ts --force
   ```

3. **Verify Migration**
   - Check migration logs for any failures
   - Test credential retrieval for a few users
   - Monitor error logs

### Phase 4: Cleanup

1. **Remove Old Encryption Code**
   - Already completed in this update

2. **Remove Old Environment Variables**
   ```bash
   # Remove from .env files
   # OLD_ENCRYPTION_KEY (after successful migration)
   # ENCRYPTION_KEY (old variable)
   ```

3. **Update Documentation**
   - Update .env.example
   - Update deployment docs
   - Update README

## Rollback Plan

If issues occur during migration:

1. **Immediate Rollback**
   ```bash
   # Restore database backup
   cp mexc_sniper.db.backup-[timestamp] mexc_sniper.db
   
   # Revert code deployment
   git revert [commit-hash]
   
   # Redeploy previous version
   ```

2. **Partial Rollback**
   - Keep new code but add compatibility layer
   - Support both encryption methods temporarily
   - Migrate gradually

## Security Considerations

### Key Management

1. **Production Key Storage**
   - Use environment variables (minimum)
   - Consider cloud KMS for enhanced security:
     - AWS KMS
     - Google Cloud KMS
     - Azure Key Vault
     - HashiCorp Vault

2. **Key Rotation**
   - Plan for quarterly key rotation
   - Implement key versioning
   - Keep old keys for decryption only

3. **Access Control**
   - Limit who can access production environment variables
   - Use separate keys for dev/staging/production
   - Audit key access

### Monitoring

1. **Error Monitoring**
   ```typescript
   // Add to encryption service
   if (decryptError) {
     // Log to monitoring service
     logger.error('Decryption failed', {
       userId: context.userId,
       timestamp: new Date(),
       error: decryptError.message
     });
   }
   ```

2. **Success Metrics**
   - Track successful encryptions/decryptions
   - Monitor performance impact
   - Alert on unusual patterns

## Testing Strategy

### Unit Tests
```typescript
// Test encryption/decryption
describe('SecureEncryptionService', () => {
  it('should encrypt and decrypt data correctly', () => {
    const service = new SecureEncryptionService();
    const plaintext = 'test-api-key-12345';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });
  
  it('should generate different ciphertext for same input', () => {
    const service = new SecureEncryptionService();
    const plaintext = 'test-api-key-12345';
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });
});
```

### Integration Tests
- Test API credential save/retrieve flow
- Test with various credential formats
- Test error handling

### Performance Tests
- Measure encryption/decryption time
- Compare with old implementation
- Ensure < 50ms overhead per operation

## Timeline

- **Day 1**: Preparation and testing
- **Day 2**: Deploy code changes
- **Day 3**: Migrate development/staging data
- **Day 4**: Migrate production data
- **Day 5**: Verify and cleanup

## Communication Plan

1. **Internal Team**
   - Notify about maintenance window
   - Share rollback procedures
   - Provide testing checklist

2. **Users (if applicable)**
   - Announce brief maintenance
   - No action required from users
   - API keys remain unchanged

## Success Criteria

- ✅ All credentials successfully migrated
- ✅ No decryption errors in production
- ✅ Performance impact < 5%
- ✅ Security audit passed
- ✅ Monitoring in place

## Long-term Improvements

1. **Hardware Security Module (HSM)**
   ```typescript
   // Future implementation
   class HSMEncryptionService extends SecureEncryptionService {
     constructor(hsmClient: HSMClient) {
       super();
       this.hsm = hsmClient;
     }
   }
   ```

2. **Envelope Encryption**
   - Encrypt data keys with master key
   - Store encrypted data keys with data
   - Rotate data keys independently

3. **Field-level Encryption**
   - Encrypt at application level
   - Transparent to database
   - Granular access control

## Compliance Checklist

- [ ] Remove all hardcoded keys
- [ ] Implement strong key derivation
- [ ] Add authenticated encryption
- [ ] Enable key rotation
- [ ] Add audit logging
- [ ] Document key management
- [ ] Train team on security practices
- [ ] Schedule security review