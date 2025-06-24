import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '../../../../src/lib/structured-logger';
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
import { publicRoute } from "../../../../src/lib/auth-decorators";

const logger = createLogger('account-balance-api');

export const GET = publicRoute(async (request: NextRequest) => {
  const startTime = Date.now();
  
  try {
    logger.info('[API] Account balance request received');

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

    logger.info('[API] MEXC service initialized:', {
      hasCredentials: mexcService.hasCredentials(),
      userId: userId || 'none',
      hasUserCredentials,
      requestDuration: `${Date.now() - startTime}ms`
    });
    
    // Fetch account balances with USDT conversion
    const balanceResponse = await mexcService.getAccountBalances();
    
    if (!balanceResponse.success) {
      logger.error('[API] Account balance fetch failed:', { error: balanceResponse.error });
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

    logger.info(`[API] Account balance success: ${balanceResponse.data?.balances?.length || 0} balances`);

    // Extract and structure response data
    const portfolio = balanceResponse.data;
    const responseData: AccountBalanceResponse = {
      balances: portfolio?.balances || [],
      totalUsdtValue: portfolio?.totalUsdtValue || 0,
      lastUpdated: new Date().toISOString(),
      hasUserCredentials,
      credentialsType: hasUserCredentials ? 'user-specific' : 'environment-fallback',
    };

    // Validate response data
    const responseValidation = validateMexcApiResponse(
      AccountBalanceResponseSchema, 
      responseData, 
      'account balance'
    );
    
    if (!responseValidation.success) {
      logger.error('[API] Response validation failed:', { error: responseValidation.error });
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
    logger.error('[API] Account balance error:', { operation: 'account_balance' }, error instanceof Error ? error : new Error(String(error)));
    
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