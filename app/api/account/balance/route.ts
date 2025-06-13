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

    // Try to get user-specific credentials first
    let mexcClient;
    let hasUserCredentials = false;

    if (userId) {
      try {
        const credentials = await db
          .select()
          .from(apiCredentials)
          .where(and(
            eq(apiCredentials.userId, userId),
            eq(apiCredentials.provider, 'mexc'),
            eq(apiCredentials.isActive, true)
          ))
          .limit(1);

        if (credentials[0]) {
          const encryptionService = getEncryptionService();
          const apiKey = encryptionService.decrypt(credentials[0].encryptedApiKey);
          const secretKey = encryptionService.decrypt(credentials[0].encryptedSecretKey);
          
          mexcClient = getMexcClient({ apiKey, secretKey });
          hasUserCredentials = true;
          console.log('[API] Using user-specific credentials');
        }
      } catch (error) {
        console.error('[API] Failed to load user credentials:', error);
      }
    }

    // Fallback to environment credentials if no user credentials
    if (!mexcClient) {
      console.log('[API] Using environment credentials as fallback');
      mexcClient = getMexcClient();
    }
    
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