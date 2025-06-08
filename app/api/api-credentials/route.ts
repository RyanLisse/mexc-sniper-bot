import { NextRequest, NextResponse } from 'next/server';
import { db, apiCredentials, type NewApiCredentials } from '@/src/db';
import { eq, and } from 'drizzle-orm';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Simple encryption helper (in production, use proper encryption libraries)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32ch';
const ALGORITHM = 'aes-256-cbc';

// Ensure key is 32 bytes for AES-256
function getKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32);
  return Buffer.from(key, 'utf8');
}

function encryptString(text: string): string {
  try {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('[Encryption] Failed:', error);
    throw error;
  }
}

function decryptString(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[Decryption] Failed:', error);
    return '';
  }
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

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
    
    // Decrypt keys for testing (in production, you might want to keep them encrypted)
    const apiKey = decryptString(creds.encryptedApiKey);
    const secretKey = decryptString(creds.encryptedSecretKey);
    const passphrase = creds.encryptedPassphrase ? decryptString(creds.encryptedPassphrase) : null;

    const response = {
      id: creds.id,
      userId: creds.userId,
      provider: creds.provider,
      apiKey: maskApiKey(apiKey), // Return masked version for security
      secretKey: maskApiKey(secretKey), // Return masked version for security
      passphrase: passphrase ? maskApiKey(passphrase) : null,
      isActive: creds.isActive,
      lastUsed: creds.lastUsed,
      createdAt: creds.createdAt,
      updatedAt: creds.updatedAt,
      // Test credentials removed for production security
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

    // Validate API key format (basic validation)
    if (apiKey.length < 10 || secretKey.length < 10) {
      return NextResponse.json(
        { error: 'API key and secret must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Encrypt the credentials
    const encryptedApiKey = encryptString(apiKey);
    const encryptedSecretKey = encryptString(secretKey);
    const encryptedPassphrase = passphrase ? encryptString(passphrase) : null;

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
      message: 'API credentials saved successfully',
      provider,
      maskedApiKey: maskApiKey(apiKey),
      maskedSecretKey: maskApiKey(secretKey),
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