/**
 * Standard API Response Interface
 *
 * This interface ensures consistent response format across all API routes
 */

import { toSafeError } from "./error-type-utils";
export interface ApiResponse<T = unknown> {
  /** Indicates if the request was successful */
  success: boolean;
  /** Response status (healthy, warning, unhealthy, error) */
  status?: "healthy" | "warning" | "unhealthy" | "error" | "pending" | "active" | "inactive";
  /** Human-readable message */
  message?: string;
  /** The actual response data */
  data?: T;
  /** Error message if the request failed */
  error?: string;
  /** Optional error details (for validation errors, etc.) */
  details?: Record<string, unknown>;
  /** Optional metadata like pagination, timestamps, etc. */
  meta?: {
    timestamp?: string;
    count?: number;
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    version?: string;
    environment?: string;
    requestId?: string;
    statusCode?: number;
    errorCode?: string;
    [key: string]: unknown;
  };
  /** Compatibility alias for metadata */
  metadata?: {
    timestamp?: string;
    count?: number;
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    version?: string;
    environment?: string;
    requestId?: string;
    statusCode?: number;
    errorCode?: string;
    [key: string]: unknown;
  };
}

/**
 * Creates a successful API response
 */

// Lazy logger initialization to prevent webpack bundling issues
let _logger: any = null;

function getLogger(): {
  info: (message: string, context?: any) => void;
  warn: (message: string, context?: any) => void;
  error: (message: string, context?: any, error?: Error) => void;
  debug: (message: string, context?: any) => void;
} {
  if (!_logger) {
    try {
      _logger = {
        info: (message: string, context?: any) =>
          console.info("[api-response]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[api-response]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[api-response]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[api-response]", message, context || ""),
      };
    } catch (_error) {
      // Fallback to console logging during build time
      _logger = {
        debug: console.debug.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        fatal: console.error.bind(console),
      } as any;
    }
  }
  return _logger;
}

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

// Add helper methods to apiResponse
apiResponse.success = <T>(
  data: T,
  meta?: ApiResponse<T>["meta"],
  status: number = HTTP_STATUS.OK
) => {
  const { NextResponse } = require("next/server");
  return NextResponse.json(createSuccessResponse(data, meta), { status });
};

apiResponse.error = (
  error: string,
  status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  details?: Record<string, unknown>
) => {
  const { NextResponse } = require("next/server");
  const response = createErrorResponse(error);
  if (details) {
    response.details = details;
  }
  return NextResponse.json(response, { status });
};

apiResponse.unauthorized = (message = "Unauthorized") => {
  const { NextResponse } = require("next/server");
  return NextResponse.json(createAuthErrorResponse(message), { status: HTTP_STATUS.UNAUTHORIZED });
};

apiResponse.badRequest = (error: string, details?: Record<string, unknown>) => {
  const { NextResponse } = require("next/server");
  const response = createErrorResponse(error);
  if (details) {
    response.details = details;
  }
  return NextResponse.json(response, { status: HTTP_STATUS.BAD_REQUEST });
};

apiResponse.validationError = (field: string, message: string) => {
  const { NextResponse } = require("next/server");
  return NextResponse.json(createValidationErrorResponse(field, message), {
    status: HTTP_STATUS.BAD_REQUEST,
  });
};

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
  METHOD_NOT_ALLOWED: 405,
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
export function createApiResponse<T>(response: ApiResponse<T>, status?: number): Response {
  const statusCode =
    status || (response.success ? HTTP_STATUS.OK : HTTP_STATUS.INTERNAL_SERVER_ERROR);

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
  const safeError = toSafeError(error);
  getLogger().error("API Error:", safeError);

  const errorMessage = safeError.message || defaultMessage;
  return createApiResponse(createErrorResponse(errorMessage), HTTP_STATUS.INTERNAL_SERVER_ERROR);
}

// ============================================================================
// Unified Response Builders for Common Patterns
// ============================================================================

/**
 * Health Check Response Builder
 * Standardizes all health check endpoints across the system
 */
export interface HealthCheckResult {
  status: "healthy" | "warning" | "unhealthy" | "error";
  message: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  version?: string;
}

export function createHealthResponse(
  result: HealthCheckResult,
  additionalData?: Record<string, unknown>
): ApiResponse<Record<string, unknown>> {
  const isHealthy = result.status === "healthy";
  const _statusCode = isHealthy
    ? HTTP_STATUS.OK
    : result.status === "warning"
      ? HTTP_STATUS.OK
      : HTTP_STATUS.SERVICE_UNAVAILABLE;

  return {
    success: isHealthy,
    status: result.status,
    message: result.message,
    data: additionalData,
    meta: {
      timestamp: result.timestamp || new Date().toISOString(),
      version: result.version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      ...result.details,
    },
  };
}

// ============================================================================
// Enhanced API Response Builders for Redundancy Elimination
// ============================================================================

/**
 * Standardized API route wrapper that eliminates redundant error handling patterns
 * Use this to replace manual try/catch blocks with consistent error handling and logging
 */
export function createApiRouteHandler<T = Record<string, unknown>>(
  serviceName: string,
  handler: () => Promise<ApiResponse<T>>
) {
  return async (): Promise<Response> => {
    try {
      const result = await handler();
      const statusCode = result.success ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST;
      return createApiResponse(result, statusCode);
    } catch (error) {
      getLogger().error(`[${serviceName}] API request failed:`, error);
      return handleApiError(error, `${serviceName} request failed`);
    }
  };
}

/**
 * Enhanced success response builder that eliminates manual timestamp additions
 * Replaces patterns like: { ...data, timestamp: new Date().toISOString() }
 */
export function createTimestampedSuccessResponse<T>(
  message: string,
  data: T,
  additionalMeta?: Record<string, unknown>
): ApiResponse<T> {
  return createSuccessResponse(data, {
    message,
    ...additionalMeta,
    // timestamp is automatically added by createSuccessResponse
  });
}

/**
 * Enhanced error response builder that eliminates manual error logging and timestamps
 * Replaces patterns like: console.error + createErrorResponse + manual timestamp
 */
export function createTimestampedErrorResponse(
  message: string,
  details?: Record<string, unknown>
): ApiResponse {
  return createErrorResponse(message, {
    ...details,
    // timestamp is automatically added by createErrorResponse
  });
}

/**
 * Credential Validation Response Builder
 * Standardizes credential testing endpoints
 */
export interface CredentialValidationResult {
  hasCredentials: boolean;
  credentialsValid: boolean;
  credentialSource: "database" | "environment" | "none" | "provided";
  connected?: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

export function createCredentialResponse(
  result: CredentialValidationResult,
  additionalData?: Record<string, unknown>
): ApiResponse<Record<string, unknown>> {
  const isValid = result.hasCredentials && result.credentialsValid;
  const status = !result.hasCredentials
    ? "warning"
    : !result.credentialsValid
      ? "error"
      : "healthy";

  return {
    success: isValid,
    status,
    message:
      result.error ||
      (isValid
        ? `Credentials valid from ${result.credentialSource}`
        : "Invalid or missing credentials"),
    data: {
      ...result,
      ...additionalData,
    },
    error: result.error,
    meta: {
      timestamp: new Date().toISOString(),
      credentialSource: result.credentialSource,
    },
  };
}

/**
 * Service Status Response Builder
 * Standardizes service monitoring endpoints
 */
export interface ServiceStatusResult {
  serviceName: string;
  status: "active" | "inactive" | "warning" | "error";
  uptime?: number;
  lastChecked?: string;
  metrics?: Record<string, unknown>;
  issues?: string[];
}

export function createServiceStatusResponse(
  result: ServiceStatusResult
): ApiResponse<ServiceStatusResult> {
  const isActive = result.status === "active";

  return {
    success: isActive,
    status: result.status,
    message: `${result.serviceName} is ${result.status}`,
    data: result,
    meta: {
      timestamp: new Date().toISOString(),
      serviceName: result.serviceName,
      lastChecked: result.lastChecked || new Date().toISOString(),
    },
  };
}

/**
 * Configuration Validation Response Builder
 * Standardizes environment and config validation
 */
export interface ConfigValidationResult {
  valid: boolean;
  missingVars?: string[];
  invalidVars?: string[];
  warnings?: string[];
  configSource?: string;
}

export function createConfigResponse(
  result: ConfigValidationResult,
  configData?: Record<string, unknown>
): ApiResponse<Record<string, unknown>> {
  const allValid = result.valid && !result.missingVars?.length && !result.invalidVars?.length;
  const status = !result.valid ? "error" : result.warnings?.length ? "warning" : "healthy";

  return {
    success: allValid,
    status,
    message: allValid ? "Configuration is valid" : "Configuration issues detected",
    data: configData,
    details: {
      missingVars: result.missingVars,
      invalidVars: result.invalidVars,
      warnings: result.warnings,
    },
    meta: {
      timestamp: new Date().toISOString(),
      configSource: result.configSource,
      totalMissing: result.missingVars?.length || 0,
      totalInvalid: result.invalidVars?.length || 0,
      totalWarnings: result.warnings?.length || 0,
    },
  };
}

/**
 * System Overview Response Builder
 * Standardizes system status aggregation endpoints
 */
export interface SystemOverviewResult {
  overallStatus: "healthy" | "warning" | "unhealthy";
  components: Record<
    string,
    {
      status: string;
      message: string;
      details?: Record<string, unknown>;
    }
  >;
  summary?: {
    healthy: number;
    warnings: number;
    unhealthy: number;
    total: number;
  };
}

export function createSystemOverviewResponse(
  result: SystemOverviewResult
): ApiResponse<SystemOverviewResult> {
  return {
    success: result.overallStatus === "healthy",
    status: result.overallStatus,
    message:
      result.overallStatus === "healthy"
        ? "All systems operational"
        : `System has ${result.summary?.unhealthy || 0} critical issues`,
    data: result,
    meta: {
      timestamp: new Date().toISOString(),
      componentCount: Object.keys(result.components).length,
      ...result.summary,
    },
  };
}

/**
 * Generic Operation Result Response Builder
 * Standardizes operation responses (create, update, delete, etc.)
 */
export interface OperationResult<T = Record<string, unknown>> {
  success: boolean;
  operation: string;
  resourceId?: string;
  data?: T;
  error?: string;
  warnings?: string[];
}

export function createOperationResponse<T>(result: OperationResult<T>): ApiResponse<T> {
  return {
    success: result.success,
    status: result.success ? "healthy" : "error",
    message: result.success
      ? `${result.operation} completed successfully`
      : `${result.operation} failed: ${result.error}`,
    data: result.data,
    error: result.error,
    details: {
      operation: result.operation,
      resourceId: result.resourceId,
      warnings: result.warnings,
    },
    meta: {
      timestamp: new Date().toISOString(),
      operation: result.operation,
    },
  };
}
