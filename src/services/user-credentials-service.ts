import { db, apiCredentials } from '@/src/db';
import { eq, and } from 'drizzle-orm';
import { getEncryptionService } from './secure-encryption-service';

export interface DecryptedCredentials {
  apiKey: string;
  secretKey: string;
  passphrase?: string;
  provider: string;
  isActive: boolean;
  lastUsed?: Date;
}

/**
 * Get decrypted API credentials for a specific user and provider
 */
export async function getUserCredentials(
  userId: string, 
  provider: string = 'mexc'
): Promise<DecryptedCredentials | null> {
  try {
    // Query the database for user credentials
    const result = await db
      .select()
      .from(apiCredentials)
      .where(and(
        eq(apiCredentials.userId, userId),
        eq(apiCredentials.provider, provider)
      ))
      .limit(1);

    if (result.length === 0) {
      console.log(`[UserCredentialsService] No credentials found for user ${userId} and provider ${provider}`);
      return null;
    }

    const creds = result[0];
    
    if (!creds.isActive) {
      console.log(`[UserCredentialsService] Credentials found but inactive for user ${userId}`);
      return null;
    }

    const encryptionService = getEncryptionService();

    // Decrypt the credentials
    let apiKey: string;
    let secretKey: string;
    let passphrase: string | undefined;

    try {
      apiKey = encryptionService.decrypt(creds.encryptedApiKey);
      secretKey = encryptionService.decrypt(creds.encryptedSecretKey);
      
      if (creds.encryptedPassphrase) {
        passphrase = encryptionService.decrypt(creds.encryptedPassphrase);
      }
    } catch (decryptError) {
      console.error(`[UserCredentialsService] Failed to decrypt credentials for user ${userId}:`, decryptError);
      throw new Error('Failed to decrypt API credentials');
    }

    // Update last used timestamp
    await db
      .update(apiCredentials)
      .set({ lastUsed: new Date() })
      .where(eq(apiCredentials.id, creds.id));

    return {
      apiKey,
      secretKey,
      passphrase,
      provider: creds.provider,
      isActive: creds.isActive,
      lastUsed: creds.lastUsed || undefined,
    };

  } catch (error) {
    console.error(`[UserCredentialsService] Error getting credentials for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Check if user has active credentials for a provider
 */
export async function hasUserCredentials(
  userId: string, 
  provider: string = 'mexc'
): Promise<boolean> {
  try {
    const result = await db
      .select({ id: apiCredentials.id })
      .from(apiCredentials)
      .where(and(
        eq(apiCredentials.userId, userId),
        eq(apiCredentials.provider, provider),
        eq(apiCredentials.isActive, true)
      ))
      .limit(1);

    return result.length > 0;
  } catch (error) {
    console.error(`[UserCredentialsService] Error checking credentials for user ${userId}:`, error);
    return false;
  }
}