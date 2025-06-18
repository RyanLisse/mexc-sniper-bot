import { NextRequest, NextResponse } from "next/server";
import { getRecommendedMexcService } from "@/src/services/mexc-unified-exports";
import {
  createSuccessResponse,
  createErrorResponse,
  apiResponse,
  HTTP_STATUS
} from "@/src/lib/api-response";
import { authenticatedRoute } from "@/src/lib/auth-decorators";

// POST /api/mexc/test-credentials
export const POST = authenticatedRoute(async (request: NextRequest, user: any) => {
  try {
    console.log('[DEBUG] Test credentials endpoint called by user:', user?.id);

    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('[DEBUG] JSON parsing failed:', jsonError);
      return apiResponse(
        createErrorResponse('Invalid request body', {
          message: 'Request body must be valid JSON',
          code: 'INVALID_JSON'
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { apiKey, secretKey, passphrase } = body;

    // Validate required fields
    if (!apiKey || !secretKey) {
      return apiResponse(
        createErrorResponse('Missing credentials', {
          message: 'Both apiKey and secretKey are required',
          code: 'MISSING_CREDENTIALS'
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Validate credential format
    if (typeof apiKey !== 'string' || typeof secretKey !== 'string') {
      return apiResponse(
        createErrorResponse('Invalid credential format', {
          message: 'Credentials must be strings',
          code: 'INVALID_FORMAT'
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Basic format validation
    if (apiKey.length < 10 || secretKey.length < 20) {
      return apiResponse(
        createErrorResponse('Invalid credential length', {
          message: 'API key must be at least 10 characters, secret key at least 20 characters',
          code: 'INVALID_LENGTH'
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    console.log('[DEBUG] Testing credentials with format validation passed');

    // Create MEXC service with provided credentials (never log the actual credentials)
    let mexcService;
    try {
      mexcService = getRecommendedMexcService({
        apiKey: apiKey.trim(),
        secretKey: secretKey.trim(),
        passphrase: passphrase?.trim() || undefined
      });
      console.log('[DEBUG] MEXC service created successfully');
    } catch (serviceError) {
      console.error('[DEBUG] Failed to create MEXC service:', serviceError);
      return apiResponse(
        createErrorResponse('Failed to initialize MEXC service', {
          message: 'Could not create MEXC API service with provided credentials',
          code: 'SERVICE_INIT_ERROR'
        }),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    // Test 1: Check if service has credentials by testing account balances
    console.log('[DEBUG] Testing credential loading via account balances...');
    let hasCredentials = false;
    try {
      const balanceTestResult = await mexcService.getAccountBalances();
      hasCredentials = balanceTestResult.success;
      console.log('[DEBUG] Account balance test result:', {
        success: balanceTestResult.success,
        error: balanceTestResult.error
      });
      
      if (!hasCredentials) {
        return apiResponse(
          createErrorResponse('Credentials not properly loaded', {
            message: balanceTestResult.error || 'MEXC service could not validate the provided credentials',
            code: 'CREDENTIALS_NOT_LOADED'
          }),
          HTTP_STATUS.BAD_REQUEST
        );
      }
    } catch (credCheckError) {
      console.error('[DEBUG] Credential check failed:', credCheckError);
      return apiResponse(
        createErrorResponse('Failed to validate credentials', {
          message: 'Could not test credential loading',
          code: 'CREDENTIAL_CHECK_ERROR'
        }),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    // Test 2: Basic connectivity test
    console.log('[DEBUG] Testing basic connectivity...');
    let connectivityResult;
    try {
      connectivityResult = await mexcService.testConnectivity();
      console.log('[DEBUG] Connectivity test result:', connectivityResult);
    } catch (connectError) {
      console.error('[DEBUG] Connectivity test failed:', connectError);
      return apiResponse(
        createErrorResponse('MEXC API connectivity failed', {
          message: 'Unable to reach MEXC API endpoints',
          code: 'CONNECTIVITY_ERROR',
          details: connectError instanceof Error ? connectError.message : String(connectError)
        }),
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    if (!connectivityResult.success || !connectivityResult.data) {
      return apiResponse(
        createErrorResponse('MEXC API unreachable', {
          message: connectivityResult.error || 'MEXC API endpoints are not responding',
          code: 'API_UNREACHABLE'
        }),
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    // Test 3: Credential validation (account info)
    console.log('[DEBUG] Testing credential validation...');
    let accountResult;
    try {
      accountResult = await mexcService.getAccountBalances();
      console.log('[DEBUG] Account balances test result:', {
        success: accountResult.success,
        error: accountResult.error,
        hasData: !!accountResult.data
      });
    } catch (credError) {
      console.error('[DEBUG] Account balances test failed:', credError);
      return apiResponse(
        createErrorResponse('Credential validation failed', {
          message: 'Failed to authenticate with MEXC using provided credentials',
          code: 'CREDENTIAL_VALIDATION_ERROR',
          details: credError instanceof Error ? credError.message : String(credError)
        }),
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Analyze results
    if (!accountResult.success) {
      const errorMsg = accountResult.error || 'Unknown error';
      console.log('[DEBUG] Account validation failed:', errorMsg);
      
      // Provide specific error messages based on common issues
      let userMessage = 'Invalid API credentials';
      let code = 'INVALID_CREDENTIALS';
      
      if (errorMsg.includes('signature')) {
        userMessage = 'API signature validation failed. Check if your secret key is correct and your server time is synchronized.';
        code = 'SIGNATURE_ERROR';
      } else if (errorMsg.includes('key')) {
        userMessage = 'API key is invalid or has insufficient permissions.';
        code = 'INVALID_API_KEY';
      } else if (errorMsg.includes('IP')) {
        userMessage = 'Your server IP address is not allowlisted in your MEXC API settings.';
        code = 'IP_NOT_ALLOWLISTED';
      } else if (errorMsg.includes('permission')) {
        userMessage = 'API key does not have required permissions. Enable trading and wallet permissions.';
        code = 'INSUFFICIENT_PERMISSIONS';
      }
      
      return apiResponse(
        createErrorResponse(userMessage, {
          message: userMessage,
          code: code,
          originalError: errorMsg
        }),
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Success!
    const { balances, totalUsdtValue } = accountResult.data;
    console.log('[DEBUG] Credential test successful - balances found:', balances?.length || 0);

    return apiResponse(
      createSuccessResponse({
        credentialsValid: true,
        connectivity: true,
        accountAccess: true,
        balanceCount: balances?.length || 0,
        totalValue: totalUsdtValue || 0,
        testResults: {
          hasCredentials: true,
          connectivityPassed: true,
          authenticationPassed: true,
          accountDataRetrieved: true
        },
        message: 'All credential tests passed successfully!'
      }, {
        message: 'MEXC API credentials are valid and working correctly'
      })
    );

  } catch (error) {
    console.error('[DEBUG] Credential test endpoint error:', error);
    console.error('[DEBUG] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name
    });

    return apiResponse(
      createErrorResponse('Credential test failed', {
        message: 'An unexpected error occurred during credential testing',
        code: 'TEST_ERROR',
        details: error instanceof Error ? error.message : String(error)
      }),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});