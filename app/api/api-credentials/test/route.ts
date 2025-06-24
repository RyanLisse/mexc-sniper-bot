import { NextRequest, NextResponse } from 'next/server';
import { createSafeLogger } from '../../../../src/lib/structured-logger';
import {
  createSuccessResponse,
  createErrorResponse,
  apiResponse,
  HTTP_STATUS,
  createValidationErrorResponse
} from "../../../../src/lib/api-response";
import { sensitiveDataRoute } from "../../../../src/lib/auth-decorators";
import { 
  ApiCredentialsTestRequestSchema,
  validateMexcApiRequest,
  type ApiCredentialsTestRequest
} from "../../../../src/schemas/mexc-api-validation-schemas";
import { apiCredentialsTestService } from "../../../../src/services/api-credentials-test-service";

const logger = createSafeLogger('route');

// POST /api/api-credentials/test
export const POST = sensitiveDataRoute(async (request: NextRequest, user: any) => {
  const startTime = Date.now();
  const requestId = `api_cred_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    logger.info('[API] API credentials test endpoint called', {
      requestId,
      userAuthenticated: !!user,
      userId: user?.id,
      timestamp: new Date().toISOString()
    });

    const body = await request.json();
    
    // Validate request body with Zod schema
    const validation = validateMexcApiRequest(ApiCredentialsTestRequestSchema, body);
    if (!validation.success) {
      logger.info('[API] Request validation failed', {
        requestId,
        error: validation.error,
        details: validation.details
      });
      
      return apiResponse(
        createErrorResponse(validation.error, {
          code: 'VALIDATION_ERROR',
          details: validation.details,
          requestId
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const testRequest: ApiCredentialsTestRequest = validation.data;

    logger.info('[API] Validated test request', {
      requestId,
      providedUserId: testRequest.userId,
      authenticatedUserId: user?.id,
      provider: testRequest.provider,
      userIdMatch: user?.id === testRequest.userId
    });

    // Use modular service for credential testing
    const testResult = await apiCredentialsTestService.testCredentials(
      testRequest, 
      user.id
    );

    if (!testResult.success) {
      logger.info('[API] Credential test failed', {
        requestId,
        error: testResult.error,
        code: testResult.code,
        duration: Date.now() - startTime
      });

      const statusCode = testResult.code === 'ACCESS_DENIED' 
        ? HTTP_STATUS.FORBIDDEN 
        : testResult.code === 'NO_CREDENTIALS' 
        ? HTTP_STATUS.BAD_REQUEST 
        : testResult.code?.includes('AUTHENTICATION') || testResult.code?.includes('SIGNATURE') || testResult.code?.includes('INVALID_API_KEY')
        ? HTTP_STATUS.UNAUTHORIZED
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;

      return apiResponse(
        createErrorResponse(testResult.error, {
          code: testResult.code,
          requestId,
          duration: Date.now() - startTime,
          ...(testResult.details && { details: testResult.details })
        }),
        statusCode
      );
    }

    logger.info('[API] Credential test completed successfully', {
      requestId,
      userId: testRequest.userId,
      provider: testRequest.provider,
      duration: Date.now() - startTime,
      connectivity: testResult.data.connectivity,
      authentication: testResult.data.authentication
    });

    return apiResponse(
      createSuccessResponse(testResult.data, {
        message: "API credentials are valid and working correctly",
        code: "TEST_SUCCESS",
        requestId,
        duration: Date.now() - startTime
      }),
      HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('[API] Unexpected error in credentials test:', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    });
    
    return apiResponse(
      createErrorResponse('API credentials test failed', {
        message: error instanceof Error ? error.message : 'Unknown error occurred during test',
        code: 'TEST_ERROR',
        requestId,
        duration: Date.now() - startTime
      }),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});