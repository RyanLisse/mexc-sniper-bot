/**
 * Credential Cache Service
 * Minimal implementation for build optimization
 */

import { getEncryptionService } from '@/src/services/api/secure-encryption-service';

interface CachedCredentials {
  apiKey: string;
  secretKey: string;
  passphrase?: string;
}

const cache = new Map<string, { credentials: CachedCredentials; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCachedCredentials(
  userId: string,
  encryptedApiKey: string,
  encryptedSecretKey: string,
  encryptedPassphrase?: string
): Promise<CachedCredentials> {
  const cacheKey = `${userId}:${encryptedApiKey}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.credentials;
  }

  const encryptionService = getEncryptionService();
  
  const credentials: CachedCredentials = {
    apiKey: encryptionService.decrypt(encryptedApiKey),
    secretKey: encryptionService.decrypt(encryptedSecretKey),
    ...(encryptedPassphrase && { passphrase: encryptionService.decrypt(encryptedPassphrase) })
  };

  cache.set(cacheKey, {
    credentials,
    timestamp: Date.now()
  });

  return credentials;
}

export function clearCredentialCache(userId?: string): void {
  if (userId) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}