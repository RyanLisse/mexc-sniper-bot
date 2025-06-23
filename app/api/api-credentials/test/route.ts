import { NextRequest, NextResponse } from 'next/server';
import { getRecommendedMexcService } from "../../../../src/services/mexc-unified-exports";
import { getUserCredentials } from "../../../../src/services/user-credentials-service";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import {
  createSuccessResponse,
  createErrorResponse,
  apiResponse,
  HTTP_STATUS,
  createValidationErrorResponse
} from "../../../../src/lib/api-response";
import {
  sensitiveDataRoute,
  validateRequiredFields
} from "../../../../src/lib/auth-decorators";

// POST /api/api-credentials/test
export const POST = sensitiveDataRoute(async (request: NextRequest, user: any) => {
  try {
    console.log('[DEBUG] API credentials test endpoint called', {
      userAuthenticated: !!user,
      userId: user?.id,
      timestamp: new Date().toISOString()
    });

    const body = await request.json();
    const { userId, provider = 'mexc' } = body;

    console.log('[DEBUG] Test request body received', {
      bodyKeys: Object.keys(body),
      providedUserId: userId,
      authenticatedUserId: user?.id,
      provider
    });

    // Validate required fields
    const missingField = validateRequiredFields(body, ['userId']);
    if (missingField) {
      console.log('[DEBUG] Missing required field:', missingField);
      return apiResponse(
        createValidationErrorResponse('required_fields', missingField),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Ensure user can only test their own credentials
    if (user.id !== userId) {
      return apiResponse(
        createErrorResponse("Access denied", {
          message: "You can only test your own API credentials",
          code: "ACCESS_DENIED"
        }),
        HTTP_STATUS.FORBIDDEN
      );
    }

    // Get user credentials
    let userCredentials = null;
    try {
      userCredentials = await getUserCredentials(userId, provider);
    } catch (error) {
      return apiResponse(
        createErrorResponse("No API credentials found", {
          message: "Please configure your MEXC API credentials first",
          code: "NO_CREDENTIALS"
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (!userCredentials) {
      return apiResponse(
        createErrorResponse("No API credentials found", {
          message: "Please configure your MEXC API credentials first",
          code: "NO_CREDENTIALS"
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Initialize MEXC service with user credentials
    const mexcService = getRecommendedMexcService({
      apiKey: userCredentials.apiKey,
      secretKey: userCredentials.secretKey
    });

    // Test basic connectivity first
    const connectivityTest = await mexcService.testConnectivity();
    if (!connectivityTest) {
      return apiResponse(
        createErrorResponse("Network connectivity failed", {
          message: "Unable to reach MEXC API. Please check your internet connection.",
          code: "NETWORK_ERROR",
          details: {
            connectivity: false,
            authentication: false,
            step: "connectivity_test"
          }
        }),
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    // Test authentication by getting account info
    try {
      // First get raw account info for account type and permissions
      const accountInfoResult = await mexcService.getAccountInfo();
      
      if (accountInfoResult.success) {
        // Extract dynamic account information from MEXC API response
        const accountData = accountInfoResult.data;
        const accountType = accountData?.accountType || "SPOT";
        const permissions = accountData?.permissions || ["SPOT"];
        
        // Derive canTrade from permissions or explicit field
        // MEXC API may return canTrade boolean or we derive it from permissions
        const canTrade = accountData?.canTrade !== undefined 
          ? accountData.canTrade 
          : permissions.includes("SPOT") || permissions.includes("MARGIN") || permissions.includes("TRADE");

        // Get balance count from balances array if available
        const balanceCount = accountData?.balances?.length || 0;

        // Success - credentials are valid
        return apiResponse(
          createSuccessResponse({
            connectivity: true,
            authentication: true,
            accountType: accountType.toLowerCase(), // Normalize to lowercase for consistency
            canTrade,
            balanceCount,
            credentialSource: "database",
            // Include additional account metadata if available
            ...(permissions.length > 0 && { permissions }),
            ...(accountData?.updateTime && { lastUpdate: accountData.updateTime })
          }, {
            message: "API credentials are valid and working correctly",
            code: "TEST_SUCCESS"
          }),
          HTTP_STATUS.OK
        );
      } else {
        // Authentication failed
        return apiResponse(
          createErrorResponse("API credentials are invalid", {
            message: accountInfoResult.error || "Authentication failed with MEXC API",
            code: "INVALID_CREDENTIALS",
            details: {
              connectivity: true,
              authentication: false,
              step: "authentication_test",
              mexcError: accountInfoResult.error
            }
          }),
          HTTP_STATUS.UNAUTHORIZED
        );
      }
    } catch (authError) {
      // Handle specific authentication errors
      const errorMessage = authError instanceof Error ? authError.message : "Unknown authentication error";
      
      // Check for specific MEXC error codes
      let errorCode = "AUTHENTICATION_ERROR";
      let userMessage = "Failed to authenticate with MEXC API";
      
      if (errorMessage.includes("700002") || errorMessage.includes("Signature for this request is not valid")) {
        errorCode = "SIGNATURE_ERROR";
        userMessage = "API signature validation failed. Please check your API credentials and ensure your IP is allowlisted.";
      } else if (errorMessage.includes("10072") || errorMessage.includes("Api key info invalid")) {
        errorCode = "INVALID_API_KEY";
        userMessage = "API key is invalid or expired. Please check your MEXC API credentials.";
      }

      return apiResponse(
        createErrorResponse(userMessage, {
          message: userMessage,
          code: errorCode,
          details: {
            connectivity: true,
            authentication: false,
            step: "authentication_test",
            originalError: errorMessage
          }
        }),
        HTTP_STATUS.UNAUTHORIZED
      );
    }

  } catch (error) {
    console.error('[API] API credentials test failed:', error);
    
    return apiResponse(
      createErrorResponse('API credentials test failed', {
        message: error instanceof Error ? error.message : 'Unknown error occurred during test',
        code: 'TEST_ERROR'
      }),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});
