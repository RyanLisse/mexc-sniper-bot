import { NextRequest, NextResponse } from 'next/server';
import { getMexcClient } from '@/src/services/mexc-api-client';
import { db, apiCredentials } from '@/src/db';
import { eq, and } from 'drizzle-orm';
import { createDecipheriv } from 'crypto';

// Decryption helper (should match api-credentials route)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32ch';
const ALGORITHM = 'aes-256-cbc';

function getKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32);
  return Buffer.from(key, 'utf8');
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

export async function GET(request: NextRequest) {
  try {
    console.log('[API] Account balance request received');

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Try to get user-specific API credentials first
    let mexcClient;
    let hasUserCredentials = false;

    if (userId && userId !== 'anonymous') {
      try {
        const credentialResult = await db
          .select()
          .from(apiCredentials)
          .where(and(
            eq(apiCredentials.userId, userId),
            eq(apiCredentials.provider, 'mexc'),
            eq(apiCredentials.isActive, true)
          ))
          .limit(1);

        if (credentialResult.length > 0) {
          const creds = credentialResult[0];
          const apiKey = decryptString(creds.encryptedApiKey);
          const secretKey = decryptString(creds.encryptedSecretKey);
          
          if (apiKey && secretKey) {
            console.log('[API] Using user-specific credentials for userId:', userId);
            mexcClient = getMexcClient({ apiKey, secretKey });
            hasUserCredentials = true;
          }
        }
      } catch (error) {
        console.error('[API] Failed to fetch user credentials:', error);
      }
    }

    // Fall back to environment credentials if no user credentials
    if (!mexcClient) {
      console.log('[API] Using environment credentials (fallback)');
      mexcClient = getMexcClient();
    }
    
    // Fetch account balances with USDT conversion
    const balanceResponse = await mexcClient.getAccountBalances();
    
    if (!balanceResponse.success) {
      console.error('[API] Account balance fetch failed:', balanceResponse.error);
      return NextResponse.json(
        { 
          success: false, 
          error: balanceResponse.error || 'Failed to fetch account balances',
          data: {
            balances: [],
            totalUsdtValue: 0,
            lastUpdated: new Date().toISOString(),
          }
        },
        { status: 500 }
      );
    }

    console.log(`[API] Account balance success: ${balanceResponse.data.balances.length} balances, total: ${balanceResponse.data.totalUsdtValue.toFixed(2)} USDT`);

    return NextResponse.json({
      success: true,
      data: {
        ...balanceResponse.data,
        hasUserCredentials,
        credentialsType: hasUserCredentials ? 'user-specific' : 'environment-fallback',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Account balance error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: {
          balances: [],
          totalUsdtValue: 0,
          lastUpdated: new Date().toISOString(),
        }
      },
      { status: 500 }
    );
  }
}

// For testing purposes, allow OPTIONS
export async function OPTIONS() {
  return NextResponse.json({ success: true }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}