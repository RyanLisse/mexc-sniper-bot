import type { NextRequest, NextResponse } from "next/server";
import { apiResponse, createErrorResponse, HTTP_STATUS } from "./api-response";

export interface ApiError extends Error {
  code?: string;
  status?: number;
  retryable?: boolean;
  details?: any;
}

export class DatabaseConnectionError extends Error {
  constructor(
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public details?: any
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Central API error handler that provides consistent error responses
 * and proper HTTP status codes based on error types
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  const timestamp = new Date().toISOString();

  // Log the error for debugging
  console.error(`[API Error ${context ? `- ${context}` : ""}]:`, {
    error,
    timestamp,
    stack: error instanceof Error ? error.stack : undefined,
  });

  // Handle different error types
  if (error instanceof DatabaseConnectionError) {
    return apiResponse(
      createErrorResponse("Database connectivity issue - service temporarily unavailable", {
        code: "DB_CONNECTION_ERROR",
        retryable: true,
        timestamp,
        context,
      }),
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );
  }

  if (error instanceof ValidationError) {
    return apiResponse(
      createErrorResponse(error.message, {
        code: "VALIDATION_ERROR",
        field: error.field,
        details: error.details,
        retryable: false,
        timestamp,
        context,
      }),
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Handle database-related errors based on error message patterns
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();

    // Database connectivity issues
    if (
      errorMessage.includes("econnrefused") ||
      errorMessage.includes("enotfound") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("connection") ||
      (errorMessage.includes("database") && errorMessage.includes("unavailable"))
    ) {
      return apiResponse(
        createErrorResponse("Database connectivity issue - service temporarily unavailable", {
          code: "DB_CONNECTION_ERROR",
          retryable: true,
          timestamp,
          context,
          originalError: error.message,
        }),
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    // Authentication/authorization errors
    if (
      errorMessage.includes("unauthorized") ||
      errorMessage.includes("forbidden") ||
      errorMessage.includes("authentication")
    ) {
      return apiResponse(
        createErrorResponse("Authentication required", {
          code: "AUTH_ERROR",
          retryable: false,
          timestamp,
          context,
        }),
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Rate limiting errors
    if (errorMessage.includes("rate limit") || errorMessage.includes("too many requests")) {
      return apiResponse(
        createErrorResponse("Rate limit exceeded - please try again later", {
          code: "RATE_LIMIT_ERROR",
          retryable: true,
          timestamp,
          context,
        }),
        HTTP_STATUS.TOO_MANY_REQUESTS
      );
    }
  }

  // Default internal server error
  return apiResponse(
    createErrorResponse(error instanceof Error ? error.message : "Unknown error occurred", {
      code: "INTERNAL_ERROR",
      retryable: false,
      timestamp,
      context,
      ...(error instanceof Error && { originalError: error.message }),
    }),
    HTTP_STATUS.INTERNAL_SERVER_ERROR
  );
}

/**
 * Database operation wrapper that automatically detects and handles DB connectivity issues
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  timeout: number = 10000
): Promise<T> {
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new DatabaseConnectionError(`${operationName} timeout after ${timeout}ms`)),
          timeout
        )
      ),
    ]);
  } catch (error) {
    if (error instanceof DatabaseConnectionError) {
      throw error;
    }

    // Check if this is a database connectivity error
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes("econnrefused") ||
        errorMessage.includes("enotfound") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("connection") ||
        errorMessage.includes("database")
      ) {
        throw new DatabaseConnectionError(
          `Database connectivity issue during ${operationName}`,
          error
        );
      }
    }

    // Re-throw other errors as-is
    throw error;
  }
}

/**
 * API route wrapper that provides automatic error handling
 */
export function withApiErrorHandling(
  handler: (request: NextRequest) => Promise<NextResponse>,
  context?: string
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      return handleApiError(error, context);
    }
  };
}

/**
 * Validation helper that throws ValidationError for invalid inputs
 */
export function validateRequired(value: any, fieldName: string): void {
  if (value === null || value === undefined || value === "") {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
}

/**
 * Validation helper for userId parameter
 */
export function validateUserId(userId: string | null): string {
  if (!userId || userId.trim() === "") {
    throw new ValidationError("userId parameter is required and cannot be empty", "userId");
  }

  // Basic validation to prevent obvious invalid userIds
  if (userId === "undefined" || userId === "null" || userId.includes("default-user:")) {
    throw new ValidationError(
      "Invalid userId format - appears to be a placeholder or default value",
      "userId"
    );
  }

  return userId.trim();
}

/**
 * Helper to check if an error indicates a retryable condition
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof DatabaseConnectionError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("rate limit")
    );
  }

  return false;
}
