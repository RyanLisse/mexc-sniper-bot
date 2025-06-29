import { NextRequest, NextResponse } from "next/server";
import { createJsonErrorResponse, parseJsonRequest, validateFieldTypes, validateRequiredFields } from "@/src/lib/api-json-parser";
import {
  apiResponse,
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS
} from "@/src/lib/api-response";
import { authenticatedRoute } from "@/src/lib/auth-decorators";
import { enhancedApiValidationService } from "@/src/services/api/enhanced-api-validation-service";
import { getRecommendedMexcService } from "@/src/services/api/mexc-unified-exports";

// POST /api/mexc/test-credentials
export const POST = authenticatedRoute(async (request: NextRequest, user: any) => {
  try {
    console.info('[DEBUG] Test credentials endpoint called by user:', user?.id);

    // Use centralized JSON parsing with consistent error handling
    const parseResult = await parseJsonRequest(request);
    
    if (!parseResult.success) {
      console.error('[DEBUG] JSON parsing failed:', { 
        error: parseResult.error,
        code: parseResult.errorCode,
        details: parseResult.details
      });
      return apiResponse(createJsonErrorResponse(parseResult), HTTP_STATUS.BAD_REQUEST);
    }
    
    const body = parseResult.data;
    const { apiKey, secretKey, passphrase } = body;

    // Validate required fields using centralized validator
    const fieldValidation = validateRequiredFields(body, ['apiKey', 'secretKey']);
    if (!fieldValidation.success) {
      return apiResponse(
        createErrorResponse(fieldValidation.error || 'Missing credentials', {
          message: 'Both apiKey and secretKey are required',
          code: 'MISSING_CREDENTIALS',
          missingField: fieldValidation.missingField
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Validate field types using centralized validator
    const typeValidation = validateFieldTypes(body, {
      apiKey: 'string',
      secretKey: 'string',
      passphrase: 'string'
    });
    if (!typeValidation.success) {
      return apiResponse(
        createErrorResponse(typeValidation.error || 'Invalid credential format', {
          message: 'Credentials must be strings',
          code: 'INVALID_FORMAT',
          invalidField: typeValidation.invalidField
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

    console.info('[DEBUG] Testing credentials with enhanced validation service...');

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
    
    console.info('[DEBUG] Enhanced validation result:', {
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
    
    console.info('[DEBUG] Enhanced credential validation successful - balances found:', { balanceCount: balances?.length || 0 });

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
    console.error('[DEBUG] Credential test endpoint error:', { error });
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