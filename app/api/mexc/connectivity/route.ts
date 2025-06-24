import { NextRequest } from 'next/server';
import { createLogger } from '../../../../src/lib/structured-logger';
import { mexcConnectivityService } from "../../../../src/services/mexc-connectivity-service";
import { 
  createSuccessResponse,
  createErrorResponse,
  apiResponse,
  HTTP_STATUS
} from "../../../../src/lib/api-response";
import { 
  ConnectivityTestRequestSchema,
  validateMexcApiRequest,
  type ConnectivityTestRequest
} from "../../../../src/schemas/mexc-api-validation-schemas";
import { publicRoute } from "../../../../src/lib/auth-decorators";

const logger = createLogger('route');

export const GET = publicRoute(async (request: NextRequest) => {
  const startTime = Date.now();
  
  try {
    logger.info('[API] MEXC connectivity test request received');

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Set defaults for optional parameters
    const requestData = {
      includeCredentialTest: true,
      ...queryParams
    };
    
    const queryValidation = validateMexcApiRequest(ConnectivityTestRequestSchema, requestData);
    if (!queryValidation.success) {
      return apiResponse(
        createErrorResponse(queryValidation.error, {
          code: 'VALIDATION_ERROR',
          details: queryValidation.details
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const connectivityRequest: ConnectivityTestRequest = queryValidation.data;

    logger.info('[API] Validated connectivity test request', {
      userId: connectivityRequest.userId || 'none',
      includeCredentialTest: connectivityRequest.includeCredentialTest,
      requestDuration: `${Date.now() - startTime}ms`
    });

    // Use modular service for connectivity testing
    const testResult = await mexcConnectivityService.testConnectivity(connectivityRequest);

    if (!testResult.success) {
      logger.error('[API] Connectivity test failed:', { error: testResult.error });
      return apiResponse(
        createErrorResponse(testResult.error, {
          code: testResult.code,
          requestDuration: `${Date.now() - startTime}ms`,
          ...(testResult.details && { details: testResult.details })
        }),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    logger.info('[API] Connectivity test completed successfully', {
      connected: testResult.data.connected,
      credentialsValid: testResult.data.credentialsValid,
      connectionHealth: testResult.data.metrics?.connectionHealth,
      requestDuration: `${Date.now() - startTime}ms`
    });

    return apiResponse(
      createSuccessResponse(testResult.data, {
        message: testResult.data.connected 
          ? "MEXC connectivity test completed successfully" 
          : "MEXC connectivity test completed with issues",
        requestDuration: `${Date.now() - startTime}ms`,
        credentialSource: testResult.data.credentialSource,
        overallStatus: testResult.data.status
      })
    );

  } catch (error) {
    logger.error('[API] MEXC connectivity test error:', { error });
    
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : 'Unknown error occurred',
        {
          code: 'INTERNAL_ERROR',
          requestDuration: `${Date.now() - startTime}ms`
        }
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

