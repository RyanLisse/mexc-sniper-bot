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
import { 
  withApiErrorHandling, 
  withDatabaseErrorHandling,
  ValidationError,
  validateUserId
} from "../../../../src/lib/central-api-error-handler";

export const GET = publicRoute(withApiErrorHandling(async (request: NextRequest) => {
  const startTime = Date.now();
  
  console.info('[API] Account balance request received');

  // Validate query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = Object.fromEntries(searchParams.entries());
  
  const queryValidation = validateMexcApiRequest(AccountBalanceQuerySchema, queryParams);
  if (!queryValidation.success) {
    throw new ValidationError(queryValidation.error, "query", queryValidation.details);
  }

  let { userId } = queryValidation.data;

  // Validate userId using our central validator to catch invalid values
  // If userId is invalid, treat it as "no userId provided" and use environment credentials
  if (userId) {
    try {
      userId = validateUserId(userId);
    } catch (error) {
      console.warn('[API] Invalid userId provided, falling back to environment credentials:', {
        providedUserId: userId,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      });
      userId = undefined; // Treat as no userId provided
    }
  }

    // Use unified service factory for consistent credential resolution
    let mexcService;
    try {
      mexcService = await getUnifiedMexcService({
        userId: userId || undefined,
        skipCache: false // Use cache for better performance
      });
    } catch (serviceError) {
      console.error('[API] Failed to initialize MEXC service:', serviceError);
      return apiResponse(
        createErrorResponse(
          'Failed to initialize MEXC service - please check API credentials configuration',
          {
            code: 'SERVICE_INITIALIZATION_ERROR',
            fallbackData: {
              balances: [],
              totalUsdtValue: 0,
              lastUpdated: new Date().toISOString(),
              hasUserCredentials: false,
              credentialsType: 'environment-fallback',
            },
            requestDuration: `${Date.now() - startTime}ms`,
            userId: userId || 'none'
          }
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

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
        await withDatabaseErrorHandling(async () => {
          await balancePersistenceService.saveBalanceSnapshot(userId, {
            balances: portfolio.balances,
            totalUsdtValue: portfolio.totalUsdtValue || 0,
          }, {
            snapshotType: 'periodic',
            dataSource: 'api',
            priceSource: 'mexc'
          });
        }, "balance-persistence", 5000); // 5 second timeout for persistence
        
        console.info('[API] Balance data persisted to database', {
          userId,
          assetCount: portfolio.balances.length,
          totalUsdValue: portfolio.totalUsdtValue
        });
      } catch (persistError) {
        // Log but don't fail the API request if persistence fails
        console.error('[API] Failed to persist balance data', {
          userId,
          error: persistError instanceof Error ? persistError.message : String(persistError),
          isDbError: persistError.constructor.name === 'DatabaseConnectionError'
        });
        // Continue with the API response even if persistence fails
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
}, "account-balance"));

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