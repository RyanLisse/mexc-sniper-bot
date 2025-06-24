import { NextRequest, NextResponse } from 'next/server';
import { getUnifiedMexcService } from "../../../../src/services/unified-mexc-service-factory";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS 
} from "../../../../src/lib/api-response";
import { 
  AccountBalanceQuerySchema,
  AccountBalanceResponseSchema,
  validateMexcApiRequest,
  validateMexcApiResponse,
  type AccountBalanceResponse
} from "../../../../src/schemas/mexc-api-validation-schemas";
import { balancePersistenceService } from "../../../../src/services/balance-persistence-service";
import { publicRoute } from "../../../../src/lib/auth-decorators";

export const GET = publicRoute(async (request: NextRequest) => {
  const startTime = Date.now();
  
  try {
    console.info('[API] Account balance request received');

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const queryValidation = validateMexcApiRequest(AccountBalanceQuerySchema, queryParams);
    if (!queryValidation.success) {
      return apiResponse(
        createErrorResponse(queryValidation.error, {
          code: 'VALIDATION_ERROR',
          details: queryValidation.details
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { userId } = queryValidation.data;

    // Use unified service factory for consistent credential resolution
    const mexcService = await getUnifiedMexcService({
      userId: userId || undefined,
      skipCache: false // Use cache for better performance
    });

    // Determine if we're using user-specific credentials
    const hasUserCredentials = Boolean(userId);

    console.info('[API] MEXC service initialized:', {
      hasCredentials: mexcService.hasCredentials(),
      userId: userId || 'none',
      hasUserCredentials,
      requestDuration: `${Date.now() - startTime}ms`
    });
    
    // Fetch account balances with USDT conversion
    const balanceResponse = await mexcService.getAccountBalances();
    
    if (!balanceResponse.success) {
      console.error('[API] Account balance fetch failed:', { error: balanceResponse.error });
      return apiResponse(
        createErrorResponse(
          balanceResponse.error || 'Failed to fetch account balances',
          {
            code: 'MEXC_API_ERROR',
            fallbackData: {
              balances: [],
              totalUsdtValue: 0,
              lastUpdated: new Date().toISOString(),
              hasUserCredentials,
              credentialsType: hasUserCredentials ? 'user-specific' : 'environment-fallback',
            },
            requestDuration: `${Date.now() - startTime}ms`
          }
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    console.info(`[API] Account balance success: ${balanceResponse.data?.balances?.length || 0} balances`);

    // Extract and structure response data
    const portfolio = balanceResponse.data;
    const responseData: AccountBalanceResponse = {
      balances: portfolio?.balances || [],
      totalUsdtValue: portfolio?.totalUsdtValue || 0,
      lastUpdated: new Date().toISOString(),
      hasUserCredentials,
      credentialsType: hasUserCredentials ? 'user-specific' : 'environment-fallback',
    };

    // Save balance data to database for persistence (addressing critical gap)
    if (userId && portfolio?.balances && portfolio.balances.length > 0) {
      try {
        await balancePersistenceService.saveBalanceSnapshot(userId, {
          balances: portfolio.balances,
          totalUsdtValue: portfolio.totalUsdtValue || 0,
        }, {
          snapshotType: 'periodic',
          dataSource: 'api',
          priceSource: 'mexc'
        });
        
        console.info('[API] Balance data persisted to database', {
          userId,
          assetCount: portfolio.balances.length,
          totalUsdValue: portfolio.totalUsdtValue
        });
      } catch (persistError) {
        // Check if this is a database connectivity issue
        const isDbError = persistError instanceof Error && (
          persistError.message.includes('ECONNREFUSED') ||
          persistError.message.includes('timeout') ||
          persistError.message.includes('connection') ||
          persistError.message.includes('ENOTFOUND')
        );
        
        if (isDbError) {
          console.error('[API] Database connectivity error during balance persistence', {
            userId,
            error: persistError.message,
            code: 'DB_CONNECTION_ERROR'
          });
          // Don't fail the API request, but log as DB issue
        } else {
          // Log but don't fail the API request if persistence fails
          console.error('[API] Failed to persist balance data', {
            userId,
            error: persistError instanceof Error ? persistError.message : String(persistError)
          });
        }
      }
    }

    // Validate response data
    const responseValidation = validateMexcApiResponse(
      AccountBalanceResponseSchema, 
      responseData, 
      'account balance'
    );
    
    if (!responseValidation.success) {
      console.error('[API] Response validation failed:', { error: responseValidation.error });
      // Return data anyway but log the validation issue
    }
    
    return apiResponse(
      createSuccessResponse(responseData, {
        requestDuration: `${Date.now() - startTime}ms`,
        balanceCount: responseData.balances.length,
        credentialSource: hasUserCredentials ? 'user-database' : 'environment-variables'
      })
    );
  } catch (error) {
    console.error('[API] Account balance error:', { operation: 'account_balance' }, error instanceof Error ? error : new Error(String(error)));
    
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : 'Unknown error occurred',
        {
          code: 'INTERNAL_ERROR',
          fallbackData: {
            balances: [],
            totalUsdtValue: 0,
            lastUpdated: new Date().toISOString(),
            hasUserCredentials: false,
            credentialsType: 'environment-fallback' as const,
          },
          requestDuration: `${Date.now() - startTime}ms`
        }
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

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