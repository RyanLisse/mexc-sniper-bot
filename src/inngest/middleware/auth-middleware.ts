/**
 * Authentication Middleware for Inngest Workflows
 * 
 * Provides authentication and authorization utilities for Inngest workflow functions.
 * Validates user sessions and ensures proper access control.
 */

import { createSupabaseServerClient, getSession, requireAuth, type SupabaseUser } from "@/src/lib/supabase-auth";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { tradingStrategies } from "@/src/db/schemas/strategies";

export interface AuthenticatedEventData {
  userId?: string;
  sessionToken?: string;
  [key: string]: any;
}

export interface AuthContext {
  user: SupabaseUser;
  isAuthenticated: true;
  sessionValidated: boolean;
}

export class InngestAuthError extends Error {
  constructor(message: string, public code: string = "AUTH_FAILED") {
    super(message);
    this.name = "InngestAuthError";
  }
}

/**
 * Validates user authentication for Inngest workflows
 */
export async function validateWorkflowAuth(
  eventData: AuthenticatedEventData
): Promise<AuthContext> {
  try {
    // Extract userId from event data (optional)
    const { userId, sessionToken } = eventData;

    // Get current session
    const session = await getSession();
    
    if (!session.isAuthenticated || !session.user) {
      throw new InngestAuthError("No valid session found", "INVALID_SESSION");
    }

    // Verify the userId matches the authenticated user (if provided in event data)
    if (userId && session.user.id !== userId) {
      throw new InngestAuthError(
        "User ID mismatch between event and session", 
        "USER_ID_MISMATCH"
      );
    }

    // Additional session token validation if provided
    if (sessionToken) {
      const supabase = await createSupabaseServerClient();
      const { data: { session: tokenSession }, error } = await supabase.auth.getSession();
      
      if (error || !tokenSession || tokenSession.access_token !== sessionToken) {
        throw new InngestAuthError("Invalid session token", "INVALID_TOKEN");
      }
    }

    return {
      user: session.user,
      isAuthenticated: true,
      sessionValidated: true,
    };
  } catch (error) {
    if (error instanceof InngestAuthError) {
      throw error;
    }
    
    throw new InngestAuthError(
      `Authentication validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "VALIDATION_FAILED"
    );
  }
}

/**
 * Validates user access to a specific strategy
 */
export async function validateStrategyAccess(
  strategyId: string,
  user: SupabaseUser
): Promise<boolean> {
  try {
    const strategies = await db
      .select({ userId: tradingStrategies.userId })
      .from(tradingStrategies)
      .where(eq(tradingStrategies.id, strategyId))
      .limit(1);

    if (strategies.length === 0) {
      throw new InngestAuthError(`Strategy not found: ${strategyId}`, "STRATEGY_NOT_FOUND");
    }

    const strategy = strategies[0];
    
    if (strategy.userId !== user.id) {
      throw new InngestAuthError(
        `User ${user.id} is not authorized to access strategy ${strategyId}`,
        "UNAUTHORIZED_STRATEGY_ACCESS"
      );
    }

    return true;
  } catch (error) {
    if (error instanceof InngestAuthError) {
      throw error;
    }
    
    throw new InngestAuthError(
      `Strategy access validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "STRATEGY_ACCESS_FAILED"
    );
  }
}

/**
 * Validates admin access for system-level operations
 */
export async function validateAdminAccess(user: SupabaseUser): Promise<boolean> {
  try {
    // Check environment-based admin list
    const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(email => email.trim()) || [];
    if (adminEmails.includes(user.email)) {
      return true;
    }

    // Check admin user IDs from environment
    const adminUserIds = process.env.ADMIN_USER_IDS?.split(",").map(id => id.trim()) || [];
    if (adminUserIds.includes(user.id)) {
      return true;
    }

    // Check for admin claims in user metadata
    if (user.name?.includes("admin") || (user as any).role === "admin") {
      return true;
    }

    throw new InngestAuthError(
      `User ${user.id} does not have admin access`,
      "INSUFFICIENT_PRIVILEGES"
    );
  } catch (error) {
    if (error instanceof InngestAuthError) {
      throw error;
    }
    
    throw new InngestAuthError(
      `Admin access validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "ADMIN_ACCESS_FAILED"
    );
  }
}

/**
 * Higher-order function to wrap Inngest functions with authentication
 */
export function withWorkflowAuth<T extends AuthenticatedEventData>(
  workflowFn: (data: T, authContext: AuthContext) => Promise<any>
) {
  return async (eventData: T) => {
    try {
      // Validate authentication
      const authContext = await validateWorkflowAuth(eventData);
      
      // Execute the workflow with auth context
      return await workflowFn(eventData, authContext);
    } catch (error) {
      // Log authentication failures
      console.error("[Inngest Auth] Workflow authentication failed:", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: eventData.userId || "unknown",
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  };
}

/**
 * Higher-order function to wrap strategy-specific workflows with auth + strategy validation
 */
export function withStrategyAuth<T extends AuthenticatedEventData & { strategyId: string }>(
  workflowFn: (data: T, authContext: AuthContext) => Promise<any>
) {
  return async (eventData: T) => {
    try {
      // Validate authentication
      const authContext = await validateWorkflowAuth(eventData);
      
      // Validate strategy access
      await validateStrategyAccess(eventData.strategyId, authContext.user);
      
      // Execute the workflow with auth context
      return await workflowFn(eventData, authContext);
    } catch (error) {
      // Log authentication/authorization failures
      console.error("[Inngest Auth] Strategy workflow authentication failed:", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: eventData.userId || "unknown",
        strategyId: eventData.strategyId,
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  };
}

/**
 * Higher-order function to wrap admin workflows with auth + admin validation
 */
export function withAdminAuth<T extends AuthenticatedEventData>(
  workflowFn: (data: T, authContext: AuthContext) => Promise<any>
) {
  return async (eventData: T) => {
    try {
      // Validate authentication
      const authContext = await validateWorkflowAuth(eventData);
      
      // Validate admin access
      await validateAdminAccess(authContext.user);
      
      // Execute the workflow with auth context
      return await workflowFn(eventData, authContext);
    } catch (error) {
      // Log authentication/authorization failures
      console.error("[Inngest Auth] Admin workflow authentication failed:", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: eventData.userId || "unknown",
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  };
}

/**
 * Utility to create authenticated event data
 */
export async function createAuthenticatedEventData<T extends Record<string, any>>(
  data: T
): Promise<T & AuthenticatedEventData> {
  try {
    const session = await getSession();
    
    if (!session.isAuthenticated || !session.user) {
      throw new InngestAuthError("No authenticated session found", "NO_SESSION");
    }

    return {
      ...data,
      userId: session.user.id,
      sessionToken: session.accessToken,
    };
  } catch (error) {
    throw new InngestAuthError(
      `Failed to create authenticated event data: ${error instanceof Error ? error.message : "Unknown error"}`,
      "EVENT_DATA_CREATION_FAILED"
    );
  }
}

/**
 * Logging utility for workflow authentication events
 */
export function logAuthEvent(
  event: string,
  userId: string,
  metadata: Record<string, any> = {}
) {
  console.info("[Inngest Auth]", {
    event,
    userId,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}