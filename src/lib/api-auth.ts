import { HTTP_STATUS, createErrorResponse } from "@/src/lib/api-response";
import { getSession, requireAuth } from "@/src/lib/kinde-auth";
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIP,
  isIPSuspicious,
  logSecurityEvent,
} from "@/src/lib/rate-limiter";
import type { NextRequest } from "next/server";

/**
 * Alias for requireApiAuth to maintain compatibility
 */
export const validateRequest = requireApiAuth;

/**
 * Middleware to require authentication for API routes with rate limiting
 * Returns the authenticated user or throws an error response
 */
export async function requireApiAuth(
  request: NextRequest,
  options?: {
    skipRateLimit?: boolean;
    rateLimitType?: "auth" | "authStrict" | "general";
  }
) {
  const ip = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || undefined;
  const endpoint = new URL(request.url).pathname;

  // Check for suspicious IP before proceeding
  if (isIPSuspicious(ip)) {
    logSecurityEvent({
      type: "SUSPICIOUS_ACTIVITY",
      ip,
      endpoint,
      userAgent,
      metadata: {
        reason: "blocked_suspicious_ip",
        action: "auth_attempt_blocked",
      },
    });

    throw new Response(
      JSON.stringify(
        createErrorResponse("Access temporarily restricted", {
          message: "Your IP has been temporarily restricted due to suspicious activity",
          code: "IP_RESTRICTED",
        })
      ),
      {
        status: HTTP_STATUS.FORBIDDEN,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Apply rate limiting unless explicitly skipped
  if (!options?.skipRateLimit) {
    const rateLimitType = options?.rateLimitType || "auth";
    const rateLimitResult = checkRateLimit(ip, endpoint, rateLimitType, userAgent);

    if (!rateLimitResult.success) {
      // Log additional security event for repeated violations
      if (!rateLimitResult.isFirstViolation) {
        logSecurityEvent({
          type: "SUSPICIOUS_ACTIVITY",
          ip,
          endpoint,
          userAgent,
          metadata: {
            reason: "repeated_rate_limit_violations",
            severity: "medium",
          },
        });
      }

      throw createRateLimitResponse(rateLimitResult.resetTime);
    }
  }

  try {
    const user = await requireAuth();

    // Log successful authentication for monitoring
    logSecurityEvent({
      type: "AUTH_ATTEMPT",
      ip,
      endpoint,
      userAgent,
      userId: user.id,
      metadata: {
        success: true,
        method: "kinde_session",
      },
    });

    return user;
  } catch (error) {
    // Log failed authentication attempt
    logSecurityEvent({
      type: "AUTH_ATTEMPT",
      ip,
      endpoint,
      userAgent,
      metadata: {
        success: false,
        error: error instanceof Error ? error.message : "unknown_error",
        method: "kinde_session",
      },
    });

    throw new Response(
      JSON.stringify(
        createErrorResponse("Authentication required", {
          message: "Please sign in to access this resource",
          code: "AUTHENTICATION_REQUIRED",
        })
      ),
      {
        status: HTTP_STATUS.UNAUTHORIZED,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Validate that the userId parameter matches the authenticated user
 */
export async function validateUserAccess(_request: NextRequest, userId: string) {
  try {
    const user = await requireAuth();

    if (user.id !== userId) {
      throw new Response(
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

    return user;
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    throw new Response(
      JSON.stringify(
        createErrorResponse("Authentication required", {
          message: "Please sign in to access this resource",
          code: "AUTHENTICATION_REQUIRED",
        })
      ),
      {
        status: HTTP_STATUS.UNAUTHORIZED,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Get the current user session (optional - doesn't throw if not authenticated)
 */
export async function getOptionalAuth() {
  try {
    const session = await getSession();
    return session.isAuthenticated ? session.user : null;
  } catch (_error) {
    return null;
  }
}

/**
 * Wrapper for API routes that require authentication
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, user: any, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      const user = await requireApiAuth(request);
      return await handler(request, user, ...args);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      return new Response(JSON.stringify(createErrorResponse("Internal server error")), {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}

/**
 * Wrapper for API routes that require user access validation
 */
export function withUserAccess<T extends any[]>(
  handler: (request: NextRequest, user: any, ...args: T) => Promise<Response>,
  getUserId: (request: NextRequest, ...args: T) => string
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      const userId = getUserId(request, ...args);
      const user = await validateUserAccess(request, userId);
      return await handler(request, user, ...args);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      return new Response(JSON.stringify(createErrorResponse("Internal server error")), {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}

/**
 * Enhanced wrapper for API routes with flexible authentication options
 */
export function withAuthOptions<T extends any[]>(
  handler: (request: NextRequest, user: any, ...args: T) => Promise<Response>,
  options?: {
    rateLimitType?: "auth" | "authStrict" | "general";
    skipRateLimit?: boolean;
    requireUserAccess?: boolean;
    getUserId?: (request: NextRequest, ...args: T) => string;
    adminOnly?: boolean;
  }
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      // Apply authentication with specified options
      const user = await requireApiAuth(request, {
        rateLimitType: options?.rateLimitType,
        skipRateLimit: options?.skipRateLimit,
      });

      // Check admin access if required
      if (options?.adminOnly) {
        // TODO: Implement admin role check when role system is available
        // For now, log admin access attempts
        const ip = getClientIP(request);
        const endpoint = new URL(request.url).pathname;

        logSecurityEvent({
          type: "AUTH_ATTEMPT",
          ip,
          endpoint,
          userId: user.id,
          metadata: {
            adminAccess: true,
            granted: true, // Would be false if admin check fails
          },
        });
      }

      // Validate user access if required
      if (options?.requireUserAccess && options?.getUserId) {
        const userId = options.getUserId(request, ...args);
        if (user.id !== userId) {
          throw new Response(
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
      }

      return await handler(request, user, ...args);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      return new Response(JSON.stringify(createErrorResponse("Internal server error")), {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}

/**
 * Simplified wrapper for user-specific API routes
 */
export function withUserAuth<T extends any[]>(
  handler: (request: NextRequest, user: any, ...args: T) => Promise<Response>,
  getUserIdFromParams: (request: NextRequest, ...args: T) => string
) {
  return withAuthOptions(handler, {
    requireUserAccess: true,
    getUserId: getUserIdFromParams,
    rateLimitType: "auth",
  });
}

/**
 * Wrapper for admin-only API routes
 */
export function withAdminAuth<T extends any[]>(
  handler: (request: NextRequest, user: any, ...args: T) => Promise<Response>
) {
  return withAuthOptions(handler, {
    adminOnly: true,
    rateLimitType: "authStrict",
  });
}

/**
 * Utility to extract userId from query parameters
 */
export function getUserIdFromQuery(request: NextRequest): string {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    throw new Response(
      JSON.stringify(
        createErrorResponse("User ID required", {
          message: "userId parameter is required",
          code: "MISSING_USER_ID",
        })
      ),
      {
        status: HTTP_STATUS.BAD_REQUEST,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return userId;
}

/**
 * Utility to extract userId from request body
 */
export async function getUserIdFromBody(request: NextRequest): Promise<string> {
  try {
    const body = await request.json();
    const userId = body.userId;

    if (!userId) {
      throw new Response(
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

    return userId;
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    throw new Response(
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
}

/**
 * API Auth Wrapper - Wraps API route handlers with authentication
 * This is the main wrapper function used in API routes
 */
export function apiAuthWrapper<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      // Apply basic authentication and rate limiting
      await requireApiAuth(request);
      
      // Execute the handler
      return await handler(request, ...args);
    } catch (error) {
      console.error("[API Auth] Request failed:", error);
      
      if (error instanceof Response) {
        return error;
      }

      return new Response(
        JSON.stringify(createErrorResponse("Internal server error")), 
        {
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  };
}
