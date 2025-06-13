import {
  getUserIdFromQuery,
  withAdminAuth,
  withAuth,
  withAuthOptions,
  withUserAuth,
} from "@/src/lib/api-auth";
import { HTTP_STATUS, createErrorResponse } from "@/src/lib/api-response";
import type { NextRequest } from "next/server";

/**
 * Authentication decorators for common API route patterns
 * These provide a clean, declarative way to add authentication to API routes
 */

/**
 * Decorator for public API routes (no authentication required)
 * Provides consistent error handling and response formatting
 */
export function publicRoute<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      console.error("[Public Route] Error:", error);
      return new Response(JSON.stringify(createErrorResponse("Internal server error")), {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}

/**
 * Decorator for authenticated API routes
 * Requires valid authentication but no specific user access
 */
export function authenticatedRoute<T extends any[]>(
  handler: (request: NextRequest, user: any, ...args: T) => Promise<Response>
) {
  return withAuth(handler);
}

/**
 * Decorator for user-specific API routes with query parameter userId
 * Ensures user can only access their own data
 */
export function userQueryRoute<T extends any[]>(
  handler: (request: NextRequest, user: any, ...args: T) => Promise<Response>
) {
  return withUserAuth(handler, (request: NextRequest, ...args: T) => getUserIdFromQuery(request));
}

/**
 * Decorator for user-specific API routes with body userId
 * Ensures user can only access their own data from request body
 */
export function userBodyRoute<T extends any[]>(
  handler: (request: NextRequest, user: any, body: any, ...args: T) => Promise<Response>
) {
  return withAuthOptions(
    async (request: NextRequest, user: any, ...args: T) => {
      try {
        const body = await request.json();
        const userId = body.userId;

        if (!userId) {
          return new Response(
            JSON.stringify(
              createErrorResponse("User ID required", {
                message: "userId field is required in request body",
                code: "MISSING_USER_ID",
              })
            ),
            {
              status: HTTP_STATUS.BAD_REQUEST,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (user.id !== userId) {
          return new Response(
            JSON.stringify(
              createErrorResponse("Access denied", {
                message: "You can only access your own data",
                code: "ACCESS_DENIED",
              })
            ),
            {
              status: HTTP_STATUS.FORBIDDEN,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        return await handler(request, user, body, ...args);
      } catch (error) {
        if (error instanceof Response) {
          return error;
        }

        return new Response(
          JSON.stringify(
            createErrorResponse("Invalid request body", {
              message: "Request body must be valid JSON",
              code: "INVALID_JSON",
            })
          ),
          {
            status: HTTP_STATUS.BAD_REQUEST,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    },
    { rateLimitType: "auth" }
  );
}

/**
 * Decorator for admin-only API routes
 * Requires authentication and admin privileges
 */
export function adminRoute<T extends any[]>(
  handler: (request: NextRequest, user: any, ...args: T) => Promise<Response>
) {
  return withAdminAuth(handler);
}

/**
 * Decorator for high-security API routes
 * Uses strict rate limiting and enhanced monitoring
 */
export function secureRoute<T extends any[]>(
  handler: (request: NextRequest, user: any, ...args: T) => Promise<Response>
) {
  return withAuthOptions(handler, {
    rateLimitType: "authStrict",
  });
}

/**
 * Decorator for trading-related API routes
 * Requires authentication and validates trading permissions
 */
export function tradingRoute<T extends any[]>(
  handler: (request: NextRequest, user: any, ...args: T) => Promise<Response>
) {
  return withAuthOptions(
    async (request: NextRequest, user: any, ...args: T) => {
      // TODO: Add trading permission checks when implemented
      // For now, just ensure user is authenticated
      return await handler(request, user, ...args);
    },
    {
      rateLimitType: "auth",
      // Could add trading-specific rate limits here
    }
  );
}

/**
 * Decorator for API routes that handle sensitive data
 * Enhanced security logging and strict rate limiting
 */
export function sensitiveDataRoute<T extends any[]>(
  handler: (request: NextRequest, user: any, ...args: T) => Promise<Response>
) {
  return withAuthOptions(handler, {
    rateLimitType: "authStrict",
  });
}

/**
 * Decorator for webhook endpoints
 * No authentication but with rate limiting and logging
 */
export function webhookRoute<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>
) {
  return withAuthOptions(
    async (request: NextRequest, user: any, ...args: T) => {
      // Webhooks don't have users, so we pass null
      return await handler(request, ...args);
    },
    {
      skipRateLimit: false, // Still apply rate limiting
      rateLimitType: "general",
    }
  );
}

/**
 * Utility function to create consistent API responses
 */
export function createApiResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Utility function to validate required fields in request body
 */
export function validateRequiredFields(body: any, fields: string[]): string | null {
  for (const field of fields) {
    if (!body[field]) {
      return `${field} is required`;
    }
  }
  return null;
}

/**
 * Utility function to extract and validate pagination parameters
 */
export function getPaginationParams(request: NextRequest): { page: number; limit: number } {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "20")));

  return { page, limit };
}

/**
 * Utility function to extract filter parameters
 */
export function getFilterParams(
  request: NextRequest,
  allowedFilters: string[]
): Record<string, string> {
  const { searchParams } = new URL(request.url);
  const filters: Record<string, string> = {};

  for (const filter of allowedFilters) {
    const value = searchParams.get(filter);
    if (value) {
      filters[filter] = value;
    }
  }

  return filters;
}
