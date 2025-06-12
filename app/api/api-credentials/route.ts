import { NextRequest, NextResponse } from 'next/server';
import { db, apiCredentials, type NewApiCredentials } from '@/src/db';
import { eq, and } from 'drizzle-orm';
import { getEncryptionService, SecureEncryptionService } from '@/src/services/secure-encryption-service';

// GET /api/api-credentials?userId=xxx&provider=mexc
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const provider = searchParams.get('provider') || 'mexc';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(apiCredentials)
      .where(and(
        eq(apiCredentials.userId, userId),
        eq(apiCredentials.provider, provider)
      ))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(null);
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
      // Return error but don't leak encryption details
      return NextResponse.json(
        { error: 'Failed to retrieve credentials', code: 'DECRYPT_ERROR' },
        { status: 500 }
      );
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Failed to fetch API credentials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API credentials' },
      { status: 500 }
    );
  }
}

// POST /api/api-credentials
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, provider = 'mexc', apiKey, secretKey, passphrase } = body;

    if (!userId || !apiKey || !secretKey) {
      return NextResponse.json(
        { error: 'userId, apiKey, and secretKey are required' },
        { status: 400 }
      );
    }

    // Validate API key format (enhanced validation)
    if (apiKey.length < 10 || secretKey.length < 10) {
      return NextResponse.json(
        { error: 'API key and secret must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Additional security validation
    if (apiKey.includes(' ') || secretKey.includes(' ')) {
      return NextResponse.json(
        { error: 'API credentials cannot contain spaces' },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: 'Failed to secure credentials', code: 'ENCRYPT_ERROR' },
        { status: 500 }
      );
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

    return NextResponse.json({ 
      success: true, 
      message: 'API credentials saved securely',
      provider,
      maskedApiKey: SecureEncryptionService.maskSensitiveData(apiKey),
      maskedSecretKey: SecureEncryptionService.maskSensitiveData(secretKey),
    });
  } catch (error) {
    console.error('[API] Failed to save API credentials:', error);
    return NextResponse.json(
      { error: 'Failed to save API credentials' },
      { status: 500 }
    );
  }
}

// DELETE /api/api-credentials
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const provider = searchParams.get('provider') || 'mexc';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    await db
      .delete(apiCredentials)
      .where(and(
        eq(apiCredentials.userId, userId),
        eq(apiCredentials.provider, provider)
      ));

    return NextResponse.json({ 
      success: true, 
      message: 'API credentials deleted successfully' 
    });
  } catch (error) {
    console.error('[API] Failed to delete API credentials:', error);
    return NextResponse.json(
      { error: 'Failed to delete API credentials' },
      { status: 500 }
    );
  }
}