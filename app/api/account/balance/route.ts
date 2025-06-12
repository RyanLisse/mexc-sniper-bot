import { NextRequest, NextResponse } from 'next/server';
import { getMexcClient } from '@/src/services/mexc-api-client';
import { db, apiCredentials } from '@/src/db';
import { eq, and } from 'drizzle-orm';
import { getEncryptionService } from '@/src/services/secure-encryption-service';

export async function GET(request: NextRequest) {
  try {
    console.log('[API] Account balance request received');

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Use environment credentials directly (same as working /api/mexc/account route)
    console.log('[API] Using environment credentials directly');
    const mexcClient = getMexcClient();
    const hasUserCredentials = false;
    
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