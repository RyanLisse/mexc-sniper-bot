/**
 * Standard API Response Interface
 *
 * This interface ensures consistent response format across all API routes
 */
export interface ApiResponse<T = any> {
  /** Indicates if the request was successful */
  success: boolean;
  /** The actual response data */
  data?: T;
  /** Error message if the request failed */
  error?: string;
  /** Optional error details (for validation errors, etc.) */
  details?: any;
  /** Optional metadata like pagination, timestamps, etc. */
  meta?: {
    timestamp?: string;
    count?: number;
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: any;
  };
}

/**
 * Creates a successful API response
 */
export function createSuccessResponse<T>(data: T, meta?: ApiResponse<T>["meta"]): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * Creates an error API response
 */
export function createErrorResponse(error: string, meta?: ApiResponse["meta"]): ApiResponse {
  return {
    success: false,
    error,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}


/**
 * Helper to create paginated responses
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): ApiResponse<T[]> {
  return createSuccessResponse(data, {
    count: data.length,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

/**
 * Response wrapper for Next.js API routes
 */
export function apiResponse<T>(response: ApiResponse<T>, status = 200) {
  const { NextResponse } = require("next/server");
  return NextResponse.json(response, { status });
}

/**
 * Common HTTP status codes for API responses
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Validation error response helper
 */
export function createValidationErrorResponse(field: string, message: string): ApiResponse {
  return createErrorResponse(`Validation error: ${field} - ${message}`, {
    validationError: true,
    field,
  });
}

/**
 * Authentication error response helper
 */
export function createAuthErrorResponse(message = "Authentication required"): ApiResponse {
  return createErrorResponse(message, {
    authRequired: true,
  });
}

/**
 * Rate limit error response helper
 */
export function createRateLimitErrorResponse(resetTime: number): ApiResponse {
  return createErrorResponse("Rate limit exceeded", {
    rateLimited: true,
    resetTime,
    retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
  });
}

/**
 * Generic API response creator that handles both success and error cases
 * This is the main function used by API routes
 */
export function createApiResponse<T>(
  response: ApiResponse<T>, 
  status?: number
): Response {
  const statusCode = status || (response.success ? HTTP_STATUS.OK : HTTP_STATUS.INTERNAL_SERVER_ERROR);
  
  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Handle API errors and return appropriate error response
 */
export function handleApiError(error: unknown, defaultMessage = "An error occurred"): Response {
  console.error("API Error:", error);
  
  if (error instanceof Error) {
    return createApiResponse(createErrorResponse(error.message), HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
  
  return createApiResponse(createErrorResponse(defaultMessage), HTTP_STATUS.INTERNAL_SERVER_ERROR);
}
