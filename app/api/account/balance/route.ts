import { NextRequest, NextResponse } from 'next/server';
import { getMexcClient } from '@/src/services/mexc-api-client';
import { db, apiCredentials } from '@/src/db';
import { eq, and } from 'drizzle-orm';
import { getEncryptionService } from '@/src/services/secure-encryption-service';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  handleApiError, 
  apiResponse, 
  HTTP_STATUS 
} from '@/src/lib/api-response';

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
      return apiResponse(
        createErrorResponse(
          balanceResponse.error || 'Failed to fetch account balances',
          {
            fallbackData: {
              balances: [],
              totalUsdtValue: 0,
              lastUpdated: new Date().toISOString(),
            }
          }
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    console.log(`[API] Account balance success: ${balanceResponse.data.balances.length} balances, total: ${balanceResponse.data.totalUsdtValue.toFixed(2)} USDT`);

    return apiResponse(
      createSuccessResponse({
        ...balanceResponse.data,
        hasUserCredentials,
        credentialsType: hasUserCredentials ? 'user-specific' : 'environment-fallback',
      })
    );
  } catch (error) {
    console.error('[API] Account balance error:', error);
    
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : 'Unknown error occurred',
        {
          fallbackData: {
            balances: [],
            totalUsdtValue: 0,
            lastUpdated: new Date().toISOString(),
          }
        }
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

// For testing purposes, allow OPTIONS
export async function OPTIONS() {
  return NextResponse.json(
    createSuccessResponse(null, { message: 'CORS preflight request' }), 
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}