import type { NextRequest } from "next/server";
import { createErrorResponse, HTTP_STATUS } from "./api-response";
import { shouldBypassRateLimit } from "./bypass-rate-limit";
import { AuthorizationError } from "./errors";
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIP,
  isIPSuspicious,
  logSecurityEvent,
} from "./rate-limiter";
import { getSession, requireAuth } from "./supabase-auth";
/**
 * Alias for requireApiAuth to maintain compatibility
 */
export const validateRequest = requireApiAuth;

/**
 * Middleware to require authentication for API routes with rate limiting
 * Returns the authenticated user or throws an error response
 */
// Lazy logger initialization to prevent build-time errors
let _logger: any = null;

function getLogger() {
  if (!_logger) {
    _logger = {
      info: (message: string, context?: any) =>
        console.info("[api-auth]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[api-auth]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[api-auth]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[api-auth]", message, context || ""),
    };
  }
  return _logger;
}

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

  // Check for suspicious IP before proceeding (bypass in development)
  if (!shouldBypassRateLimit(ip) && isIPSuspicious(ip)) {
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
          message:
            "Your IP has been temporarily restricted due to suspicious activity",
          code: "IP_RESTRICTED",
        })
      ),
      {
        status: HTTP_STATUS.FORBIDDEN,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Apply rate limiting unless explicitly skipped or bypassed
  if (!options?.skipRateLimit && !shouldBypassRateLimit(ip)) {
    const rateLimitType = options?.rateLimitType || "auth";
    const rateLimitResult = await checkRateLimit(
      ip,
      endpoint,
      rateLimitType,
      userAgent
    );

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
        method: "supabase_session",
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
        method: "supabase_session",
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
export async function validateUserAccess(
  _request: NextRequest,
  userId: string
) {
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
        // Implement comprehensive admin role check
        const isAdmin = await checkAdminRole(user);

        if (!isAdmin) {
          const ip = getClientIP(request);
          const endpoint = new URL(request.url).pathname;

          // Log unauthorized admin access attempt using SUSPICIOUS_ACTIVITY type
          logSecurityEvent({
            type: "SUSPICIOUS_ACTIVITY",
            ip,
            endpoint,
            userAgent: request.headers.get("user-agent") || undefined,
            userId: user.id,
            metadata: {
              reason: "admin_access_denied",
              severity: "high",
              action: "attempted_admin_access",
            },
          });

          throw new AuthorizationError("Admin access required", {
            userId: user.id,
            endpoint,
            action: "admin_access_required",
          });
        }

        // Log successful admin access using AUTH_ATTEMPT type
        const ip = getClientIP(request);
        const endpoint = new URL(request.url).pathname;

        logSecurityEvent({
          type: "AUTH_ATTEMPT",
          ip,
          endpoint,
          userAgent: request.headers.get("user-agent") || undefined,
          userId: user.id,
          metadata: {
            adminAccess: true,
            granted: true,
            action: "admin_access_granted",
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
 * Check if user has admin role
 */
export async function checkAdminRole(user: any): Promise<boolean> {
  try {
    // Multi-level admin role check for comprehensive security

    // 1. Check environment-based admin list
    const adminEmails =
      process.env.ADMIN_EMAILS?.split(",").map((email) => email.trim()) || [];
    if (adminEmails.includes(user.email)) {
      return true;
    }

    // 2. Check admin user IDs from environment
    const adminUserIds =
      process.env.ADMIN_USER_IDS?.split(",").map((id) => id.trim()) || [];
    if (adminUserIds.includes(user.id)) {
      return true;
    }

    // 3. Check database for user roles when available
    try {
      const { db } = await import("../db");
      const { sql } = await import("drizzle-orm");

      // Check if user_roles table exists and query it
      const roleResult = await db.execute(sql`
        SELECT role FROM user_roles 
        WHERE user_id = ${user.id} AND is_active = true
        LIMIT 1
      `);

      if (roleResult.rows.length > 0) {
        const userRole = roleResult.rows[0].role;
        return userRole === "admin" || userRole === "super_admin";
      }
    } catch (dbError) {
      // Database role check failed, continue with other checks
      getLogger().warn("Database role check failed:", dbError);
    }

    // 4. Check for admin claim in user object (from JWT/session)
    if (user.role === "admin" || user.isAdmin === true || user.admin === true) {
      return true;
    }

    // 5. Check for specific admin permissions
    if (user.permissions && Array.isArray(user.permissions)) {
      return (
        user.permissions.includes("admin") ||
        user.permissions.includes("super_admin")
      );
    }

    // 6. Default to false if no admin role found
    getLogger().info(`Admin role check failed for user ${user.id}`, {
      userId: user.id,
      email: user.email,
      role: user.role,
      hasPermissions: !!user.permissions,
    });

    return false;
  } catch (error) {
    getLogger().error("Error checking admin role:", error);
    return false; // Fail secure - deny access on error
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
      getLogger().error("[API Auth] Request failed:", error);

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
