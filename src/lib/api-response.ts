import { NextResponse } from "next/server";

/**
 * Unified API response handler for consistent response formatting
 * across all API routes
 */
export class ApiResponse {
  /**
   * Creates a successful response with consistent structure
   */
  static success<T>(data: T, metadata?: Record<string, unknown>) {
    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Creates an error response with consistent structure
   */
  static error(
    error: unknown,
    status = 500,
    metadata?: Record<string, unknown>
  ) {
    // Log the error for debugging
    console.error("[API Error]", error);

    // Extract error message
    let errorMessage = "Unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
      { status }
    );
  }

  /**
   * Creates a validation error response (400)
   */
  static validationError(message: string, errors?: Record<string, string[]>) {
    return NextResponse.json(
      {
        success: false,
        error: message,
        errors,
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  /**
   * Creates an unauthorized response (401)
   */
  static unauthorized(message = "Unauthorized") {
    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 401 }
    );
  }

  /**
   * Creates a forbidden response (403)
   */
  static forbidden(message = "Forbidden") {
    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 403 }
    );
  }

  /**
   * Creates a not found response (404)
   */
  static notFound(resource = "Resource") {
    return NextResponse.json(
      {
        success: false,
        error: `${resource} not found`,
        timestamp: new Date().toISOString(),
      },
      { status: 404 }
    );
  }

  /**
   * Creates a rate limit response (429)
   */
  static rateLimited(retryAfter?: number) {
    const response = NextResponse.json(
      {
        success: false,
        error: "Too many requests",
        timestamp: new Date().toISOString(),
        retryAfter,
      },
      { status: 429 }
    );

    if (retryAfter) {
      response.headers.set("Retry-After", retryAfter.toString());
    }

    return response;
  }
}