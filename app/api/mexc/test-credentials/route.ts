import { NextRequest, NextResponse } from "next/server";
import { createLogger } from '../../../../src/lib/structured-logger';
import { getRecommendedMexcService } from "../../../../src/services/mexc-unified-exports";
import { enhancedApiValidationService } from "../../../../src/services/enhanced-api-validation-service";
import {
  createSuccessResponse,
  createErrorResponse,
  apiResponse,
  HTTP_STATUS
} from "../../../../src/lib/api-response";
import { authenticatedRoute } from "../../../../src/lib/auth-decorators";

const logger = createLogger('route');

// POST /api/mexc/test-credentials
export const POST = authenticatedRoute(async (request: NextRequest, user: any) => {
  try {
    logger.info('[DEBUG] Test credentials endpoint called by user:', user?.id);

    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      logger.error('[DEBUG] JSON parsing failed:', jsonError);
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

    logger.info('[DEBUG] Testing credentials with enhanced validation service...');

    // Use enhanced validation service for comprehensive testing
    const validationConfig = {
      apiKey: apiKey.trim(),
      secretKey: secretKey.trim(),
      passphrase: passphrase?.trim(),
      testNetwork: false,
      validateIpAllowlist: true,
      performanceBenchmark: true,
      securityChecks: true,
    };

    const validationResult = await enhancedApiValidationService.validateApiCredentials(validationConfig);
    
    logger.info('[DEBUG] Enhanced validation result:', {
      valid: validationResult.valid,
      stage: validationResult.stage,
      error: validationResult.error,
      details: validationResult.details,
      recommendations: validationResult.recommendations.length
    });

    if (!validationResult.valid) {
      // Determine appropriate HTTP status based on validation stage
      let status: number = HTTP_STATUS.BAD_REQUEST;
      let code = 'VALIDATION_FAILED';
      
      switch (validationResult.stage) {
        case 'credential_format':
          status = HTTP_STATUS.BAD_REQUEST;
          code = 'INVALID_FORMAT';
          break;
        case 'network_connectivity':
          status = HTTP_STATUS.SERVICE_UNAVAILABLE;
          code = 'CONNECTIVITY_ERROR';
          break;
        case 'api_authentication':
          status = HTTP_STATUS.UNAUTHORIZED;
          code = 'AUTHENTICATION_FAILED';
          break;
        case 'permission_checks':
          status = HTTP_STATUS.FORBIDDEN;
          code = 'INSUFFICIENT_PERMISSIONS';
          break;
        case 'ip_allowlisting':
          status = HTTP_STATUS.FORBIDDEN;
          code = 'IP_NOT_ALLOWLISTED';
          break;
        default:
          status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
          code = 'VALIDATION_ERROR';
      }

      return apiResponse(
        createErrorResponse(validationResult.error || 'API validation failed', {
          message: validationResult.error || 'Comprehensive API validation failed',
          code: code,
          stage: validationResult.stage,
          details: validationResult.details,
          recommendations: validationResult.recommendations
        }),
        status
      );
    }

    // Get final account data for success response
    const mexcService = getRecommendedMexcService({
      apiKey: apiKey.trim(),
      secretKey: secretKey.trim(),
      passphrase: passphrase?.trim() || undefined
    });
    
    const accountResult = await mexcService.getAccountBalances();
    const balances = accountResult.data?.balances || [];
    const totalUsdtValue = balances.reduce((sum: number, balance: any) => sum + (balance.usdtValue || 0), 0);
    
    logger.info('[DEBUG] Enhanced credential validation successful - balances found:', balances?.length || 0);

    return apiResponse(
      createSuccessResponse({
        credentialsValid: true,
        validationStage: validationResult.stage,
        connectivity: validationResult.details.networkConnectivity,
        accountAccess: validationResult.details.apiAuthentication,
        balanceCount: balances?.length || 0,
        totalValue: totalUsdtValue || 0,
        enhancedValidation: {
          networkConnectivity: validationResult.details.networkConnectivity,
          credentialFormat: validationResult.details.credentialFormat,
          apiAuthentication: validationResult.details.apiAuthentication,
          permissionChecks: validationResult.details.permissionChecks,
          ipAllowlisting: validationResult.details.ipAllowlisting,
          performanceMetrics: validationResult.details.performanceMetrics,
          securityAnalysis: validationResult.details.securityAnalysis,
        },
        recommendations: validationResult.recommendations,
        timestamp: validationResult.timestamp,
        message: 'Enhanced API validation completed successfully!'
      }, {
        message: 'MEXC API credentials are fully validated and optimized for trading'
      })
    );

  } catch (error) {
    logger.error('[DEBUG] Credential test endpoint error:', { error });
    logger.error('[DEBUG] Error details:', {
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