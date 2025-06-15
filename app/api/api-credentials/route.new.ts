/**
 * API Credentials - Migrated to new middleware system
 * 
 * This demonstrates how the new middleware system handles sensitive data operations
 * with enhanced security, logging, and standardized error handling.
 */

import { NextRequest } from 'next/server';
import { db, apiCredentials, type NewApiCredentials } from '@/src/db';
import { eq, and } from 'drizzle-orm';
import { getEncryptionService, SecureEncryptionService } from '@/src/services/secure-encryption-service';
import { 
  sensitiveDataHandler,
  type ApiContext 
} from '@/src/lib/api-middleware';
import { 
  ApiCredentialsQuerySchema,
  ApiCredentialsCreateSchema 
} from '@/src/lib/api-schemas';

// GET /api/api-credentials?userId=xxx&provider=mexc
export const GET = sensitiveDataHandler({
  validation: ApiCredentialsQuerySchema,
  userAccess: 'query',
})(async (request: NextRequest, context: ApiContext) => {
  const userId = context.searchParams.get('userId')!;
  const provider = context.searchParams.get('provider') || 'mexc';

  const result = await db
    .select()
    .from(apiCredentials)
    .where(and(
      eq(apiCredentials.userId, userId),
      eq(apiCredentials.provider, provider)
    ))
    .limit(1);

  if (result.length === 0) {
    return context.success(null, {
      message: 'No API credentials found for user'
    });
  }

  const creds = result[0];
  const encryptionService = getEncryptionService();

  // Decrypt keys securely
  let apiKey = '';
  let secretKey = '';
  let passphrase: string | null = null;

  try {
    apiKey = encryptionService.decrypt(creds.encryptedApiKey);
    secretKey = encryptionService.decrypt(creds.encryptedSecretKey);
    if (creds.encryptedPassphrase) {
      passphrase = encryptionService.decrypt(creds.encryptedPassphrase);
    }
  } catch (decryptError) {
    console.error('[API] Failed to decrypt credentials:', decryptError);
    return context.error('Failed to retrieve credentials', 500, {
      code: 'DECRYPT_ERROR'
    });
  }

  const response = {
    id: creds.id,
    userId: creds.userId,
    provider: creds.provider,
    apiKey: SecureEncryptionService.maskSensitiveData(apiKey),
    secretKey: SecureEncryptionService.maskSensitiveData(secretKey),
    passphrase: passphrase ? SecureEncryptionService.maskSensitiveData(passphrase) : null,
    isActive: creds.isActive,
    lastUsed: creds.lastUsed,
    createdAt: creds.createdAt,
    updatedAt: creds.updatedAt,
  };

  return context.success(response);
});

// POST /api/api-credentials
export const POST = sensitiveDataHandler({
  parseBody: true,
  validation: ApiCredentialsCreateSchema,
  userAccess: 'body',
})(async (request: NextRequest, context: ApiContext) => {
  const { userId, provider = 'mexc', apiKey, secretKey, passphrase } = context.body;

  const encryptionService = getEncryptionService();

  // Encrypt the credentials securely
  let encryptedApiKey: string;
  let encryptedSecretKey: string;
  let encryptedPassphrase: string | null = null;

  try {
    encryptedApiKey = encryptionService.encrypt(apiKey);
    encryptedSecretKey = encryptionService.encrypt(secretKey);
    if (passphrase) {
      encryptedPassphrase = encryptionService.encrypt(passphrase);
    }
  } catch (encryptError) {
    console.error('[API] Failed to encrypt credentials:', encryptError);
    return context.error('Failed to secure credentials', 500, {
      code: 'ENCRYPT_ERROR'
    });
  }

  const credentialsData: NewApiCredentials = {
    userId,
    provider,
    encryptedApiKey,
    encryptedSecretKey,
    encryptedPassphrase,
    isActive: true,
    updatedAt: new Date(),
  };

  // Check if credentials already exist for this user/provider
  const existing = await db
    .select()
    .from(apiCredentials)
    .where(and(
      eq(apiCredentials.userId, userId),
      eq(apiCredentials.provider, provider)
    ))
    .limit(1);

  if (existing.length > 0) {
    // Update existing credentials
    await db
      .update(apiCredentials)
      .set(credentialsData)
      .where(eq(apiCredentials.id, existing[0].id));
  } else {
    // Insert new credentials
    await db.insert(apiCredentials).values(credentialsData);
  }

  return context.success({
    provider,
    maskedApiKey: SecureEncryptionService.maskSensitiveData(apiKey),
    maskedSecretKey: SecureEncryptionService.maskSensitiveData(secretKey),
  }, {
    message: 'API credentials saved securely'
  });
});

// DELETE /api/api-credentials?userId=xxx&provider=mexc
export const DELETE = sensitiveDataHandler({
  validation: ApiCredentialsQuerySchema,
  userAccess: 'query',
})(async (request: NextRequest, context: ApiContext) => {
  const userId = context.searchParams.get('userId')!;
  const provider = context.searchParams.get('provider') || 'mexc';

  await db
    .delete(apiCredentials)
    .where(and(
      eq(apiCredentials.userId, userId),
      eq(apiCredentials.provider, provider)
    ));

  return context.success(null, {
    message: 'API credentials deleted successfully'
  });
});