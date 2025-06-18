/**
 * Standardized API Middleware System
 *
 * This module provides a composable middleware system for Next.js API routes.
 * It standardizes authentication, validation, error handling, and response formatting.
 *
 * Usage:
 * export const GET = createApiHandler({
 *   auth: 'required',
 *   validation: UserPreferencesSchema,
 *   rateLimit: 'auth',
 * })(async (request, context) => {
 *   // Your handler logic here
 *   return context.success(data);
 * });
 */

import {
  getOptionalAuth,
  getUserIdFromBody,
  getUserIdFromQuery,
  requireApiAuth,
  validateUserAccess,
} from "./api-auth";
import {
  type ApiResponse,
  HTTP_STATUS,
  apiResponse,
  createAuthErrorResponse,
  createErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse,
} from "./api-response";
import { globalAPIResponseCache } from "./api-response-cache";
import { generateCacheKey } from "./cache-manager";
import { handleApiError } from "./error-handler";
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIP,
  logSecurityEvent,
} from "./rate-limiter";
import type { NextRequest } from "next/server";

// =======================
// Types and Interfaces
// =======================

export interface ApiContext {
  /** Authenticated user (if auth is enabled) */
  user?: any;
  /** Client IP address */
  clientIP: string;
  /** User agent string */
  userAgent?: string;
  /** Request URL pathname */
  endpoint: string;
  /** Parsed request body (if applicable) */
  body?: any;
  /** URL search parameters */
  searchParams: URLSearchParams;
  /** Success response helper */
  success: <T>(data: T, meta?: ApiResponse<T>["meta"]) => Response;
  /** Error response helper */
  error: (message: string, status?: number, meta?: ApiResponse["meta"]) => Response;
  /** Validation error response helper */
  validationError: (field: string, message: string) => Response;
}

export interface MiddlewareConfig {
  /** Authentication requirement */
  auth?: "none" | "optional" | "required" | "admin" | "user-access";
  /** Rate limiting configuration */
  rateLimit?:
    | "none"
    | "general"
    | "auth"
    | "authStrict"
    | {
        type: "general" | "auth" | "authStrict";
        skip?: boolean;
      };
  /** Request body parsing */
  parseBody?: boolean;
  /** Request validation schema or validator function */
  validation?: ValidationSchema | ValidationFunction;
  /** CORS configuration */
  cors?: CorsConfig | boolean;
  /** Request logging */
  logging?: boolean | LoggingConfig;
  /** User access validation (requires userId in query/body) */
  userAccess?: "query" | "body" | "none";
  /** Custom middleware functions */
  middleware?: MiddlewareFunction[];
  /** Response caching configuration */
  cache?: CacheConfig | boolean;
}

export interface CacheConfig {
  /** Enable response caching */
  enabled?: boolean;
  /** Cache TTL in milliseconds */
  ttl?: number;
  /** Cache key generator function */
  keyGenerator?: (request: NextRequest, context: Partial<ApiContext>) => string;
  /** Cache bypass condition */
  bypassCondition?: (request: NextRequest, context: Partial<ApiContext>) => boolean;
  /** Cache invalidation dependencies */
  dependencies?: string[];
  /** Cache freshness requirement */
  freshnessRequirement?: "strict" | "moderate" | "relaxed";
}

export type ValidationSchema = Record<string, ValidationRule>;
export type ValidationRule = "required" | "string" | "number" | "email" | ValidationFunction;
export type ValidationFunction = (value: any, field: string, data: any) => any;
export type MiddlewareFunction = (
  request: NextRequest,
  context: Partial<ApiContext>
) => Promise<void>;

export interface CorsConfig {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}

export interface LoggingConfig {
  includeBody?: boolean;
  includeHeaders?: boolean;
  logLevel?: "info" | "debug" | "warn" | "error";
}

export type ApiHandler = (request: NextRequest, context: ApiContext) => Promise<Response>;

// =======================
// Core Middleware Factory
// =======================

/**
 * Creates a standardized API handler with configurable middleware
 */
export function createApiHandler(config: MiddlewareConfig = {}) {
  return (handler: ApiHandler) =>
    async (request: NextRequest, ..._args: any[]): Promise<Response> => {
      const startTime = Date.now();
      const context: Partial<ApiContext> = {
        clientIP: getClientIP(request),
        userAgent: request.headers.get("user-agent") || undefined,
        endpoint: new URL(request.url).pathname,
        searchParams: new URL(request.url).searchParams,
      };

      try {
        // Apply CORS middleware
        if (config.cors) {
          const corsResponse = await applyCorsMiddleware(request, config.cors);
          if (corsResponse) return corsResponse;
        }

        // Apply rate limiting
        if (config.rateLimit && config.rateLimit !== "none") {
          const rateLimitResponse = await applyRateLimitMiddleware(
            request,
            context,
            config.rateLimit
          );
          if (rateLimitResponse) return rateLimitResponse;
        }

        // Apply authentication
        if (config.auth && config.auth !== "none") {
          const authResponse = await applyAuthMiddleware(request, context, config.auth);
          if (authResponse) return authResponse;
        }

        // Parse request body if needed
        if (config.parseBody || config.validation || config.userAccess === "body") {
          context.body = await parseRequestBody(request);
        }

        // Apply user access validation
        if (config.userAccess && config.userAccess !== "none") {
          const userAccessResponse = await applyUserAccessMiddleware(
            request,
            context,
            config.userAccess
          );
          if (userAccessResponse) return userAccessResponse;
        }

        // Apply request validation
        if (config.validation) {
          const validationResponse = await applyValidationMiddleware(context, config.validation);
          if (validationResponse) return validationResponse;
        }

        // Apply custom middleware
        if (config.middleware && config.middleware.length > 0) {
          for (const middleware of config.middleware) {
            await middleware(request, context);
          }
        }

        // Create complete context with helper functions
        const completeContext: ApiContext = {
          ...(context as ApiContext),
          success: <T>(data: T, meta?: ApiResponse<T>["meta"]) => {
            return apiResponse(createSuccessResponse(data, meta));
          },
          error: (
            message: string,
            status = HTTP_STATUS.BAD_REQUEST,
            meta?: ApiResponse["meta"]
          ) => {
            return apiResponse(createErrorResponse(message, meta), status);
          },
          validationError: (field: string, message: string) => {
            return apiResponse(
              createValidationErrorResponse(field, message),
              HTTP_STATUS.BAD_REQUEST
            );
          },
        };

        // Apply request logging
        if (config.logging) {
          logRequest(request, completeContext, config.logging);
        }

        // Check cache before executing handler
        if (config.cache && request.method === "GET") {
          const cachedResponse = await applyCacheMiddleware(request, completeContext, config.cache);
          if (cachedResponse) {
            logResponse(completeContext, cachedResponse, Date.now() - startTime);
            return cachedResponse;
          }
        }

        // Execute the main handler
        const response = await handler(request, completeContext);

        // Cache response if caching is enabled
        if (config.cache && request.method === "GET" && response.status === 200) {
          await cacheResponse(request, completeContext, response, config.cache);
        }

        // Log successful response
        logResponse(completeContext, response, Date.now() - startTime);

        return response;
      } catch (error) {
        // Centralized error handling
        return handleMiddlewareError(error, context, Date.now() - startTime);
      }
    };
}

// =======================
// Middleware Functions
// =======================

async function applyCacheMiddleware(
  request: NextRequest,
  context: Partial<ApiContext>,
  cacheConfig: CacheConfig | boolean
): Promise<Response | null> {
  try {
    const config = typeof cacheConfig === "boolean" ? {} : cacheConfig;

    if (config.enabled === false) {
      return null;
    }

    // Check bypass condition
    if (config.bypassCondition?.(request, context)) {
      return null;
    }

    // Generate cache key
    const _cacheKey = config.keyGenerator
      ? config.keyGenerator(request, context)
      : generateDefaultCacheKey(request, context);

    // Get endpoint from URL
    const url = new URL(request.url);
    const endpoint = url.pathname.replace("/api/", "");

    // Try to get cached response
    const cached = await globalAPIResponseCache.get(
      endpoint,
      Object.fromEntries(url.searchParams.entries()),
      {
        method: request.method,
        acceptStale: true,
        requiredFreshness: config.freshnessRequirement,
      }
    );

    if (cached) {
      // Create response from cached data
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.set("X-Cache-Status", "HIT");
      headers.set("X-Cache-Level", cached.metadata.cacheLevel);
      headers.set("X-Cache-Timestamp", new Date(cached.metadata.timestamp).toISOString());
      headers.set("X-Cache-Freshness", cached.metadata.freshness);

      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers,
      });
    }

    return null;
  } catch (error) {
    console.error("[API Middleware] Cache retrieval error:", error);
    return null;
  }
}

async function cacheResponse(
  request: NextRequest,
  context: Partial<ApiContext>,
  response: Response,
  cacheConfig: CacheConfig | boolean
): Promise<void> {
  try {
    const config = typeof cacheConfig === "boolean" ? {} : cacheConfig;

    if (config.enabled === false) {
      return;
    }

    // Check bypass condition
    if (config.bypassCondition?.(request, context)) {
      return;
    }

    // Get response data
    const responseClone = response.clone();
    const data = await responseClone.json();

    // Get endpoint and parameters
    const url = new URL(request.url);
    const endpoint = url.pathname.replace("/api/", "");
    const parameters = Object.fromEntries(url.searchParams.entries());

    // Cache the response
    await globalAPIResponseCache.set(endpoint, data, parameters, {
      method: request.method,
      ttl: config.ttl,
      responseTime: response.headers.get("X-Response-Time")
        ? Number.parseFloat(response.headers.get("X-Response-Time")!)
        : undefined,
    });
  } catch (error) {
    console.error("[API Middleware] Cache storage error:", error);
  }
}

function generateDefaultCacheKey(request: NextRequest, context: Partial<ApiContext>): string {
  const url = new URL(request.url);
  const components = [
    request.method,
    url.pathname,
    url.searchParams.toString(),
    context.user?.id || "anonymous",
  ];

  return generateCacheKey(...components);
}

async function applyCorsMiddleware(
  request: NextRequest,
  corsConfig: CorsConfig | boolean
): Promise<Response | null> {
  if (request.method === "OPTIONS") {
    const config = typeof corsConfig === "boolean" ? {} : corsConfig;
    const headers = new Headers();

    const origin = Array.isArray(config.origin) ? config.origin[0] : config.origin;
    headers.set("Access-Control-Allow-Origin", origin || "*");
    headers.set(
      "Access-Control-Allow-Methods",
      config.methods?.join(", ") || "GET, POST, PUT, DELETE, OPTIONS"
    );
    headers.set(
      "Access-Control-Allow-Headers",
      config.headers?.join(", ") || "Content-Type, Authorization"
    );

    if (config.credentials) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }

    return new Response(null, { status: 200, headers });
  }
  return null;
}

async function applyRateLimitMiddleware(
  _request: NextRequest,
  context: Partial<ApiContext>,
  rateLimitConfig: NonNullable<MiddlewareConfig["rateLimit"]>
): Promise<Response | null> {
  const config =
    typeof rateLimitConfig === "string" ? { type: rateLimitConfig, skip: false } : rateLimitConfig;

  if (config.skip) return null;

  const rateLimitType = typeof config === "string" ? config : config.type;
  const rateLimitResult = await checkRateLimit(
    context.clientIP!,
    context.endpoint!,
    rateLimitType as "general" | "auth" | "authStrict",
    context.userAgent,
    context.user?.id
  );

  if (!rateLimitResult.success) {
    if (!rateLimitResult.isFirstViolation) {
      logSecurityEvent({
        type: "SUSPICIOUS_ACTIVITY",
        ip: context.clientIP!,
        endpoint: context.endpoint!,
        userAgent: context.userAgent,
        metadata: {
          reason: "repeated_rate_limit_violations",
          severity: "medium",
        },
      });
    }

    return createRateLimitResponse(rateLimitResult.resetTime);
  }

  return null;
}

async function applyAuthMiddleware(
  request: NextRequest,
  context: Partial<ApiContext>,
  authConfig: NonNullable<MiddlewareConfig["auth"]>
): Promise<Response | null> {
  try {
    switch (authConfig) {
      case "optional":
        context.user = await getOptionalAuth();
        break;

      case "required":
        context.user = await requireApiAuth(request, {
          rateLimitType: "auth",
          skipRateLimit: true, // Already handled in rate limit middleware
        });
        break;

      case "admin":
        context.user = await requireApiAuth(request, {
          rateLimitType: "authStrict",
          skipRateLimit: true,
        });
        // TODO: Add admin role check when role system is implemented
        logSecurityEvent({
          type: "AUTH_ATTEMPT",
          ip: context.clientIP!,
          endpoint: context.endpoint!,
          userId: context.user.id,
          metadata: { adminAccess: true, granted: true },
        });
        break;

      case "user-access":
        context.user = await requireApiAuth(request, {
          rateLimitType: "auth",
          skipRateLimit: true,
        });
        break;
    }
    return null;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
}

async function applyUserAccessMiddleware(
  request: NextRequest,
  context: Partial<ApiContext>,
  userAccessConfig: "query" | "body"
): Promise<Response | null> {
  if (!context.user) {
    return apiResponse(
      createAuthErrorResponse("Authentication required for user access validation"),
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  try {
    let userId: string;

    if (userAccessConfig === "query") {
      const queryUserId = getUserIdFromQuery(request);
      userId = typeof queryUserId === "string" ? queryUserId : "";
    } else {
      userId = await getUserIdFromBody(request);
    }

    await validateUserAccess(request, userId);
    return null;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
}

async function applyValidationMiddleware(
  context: Partial<ApiContext>,
  validation: ValidationSchema | ValidationFunction
): Promise<Response | null> {
  try {
    if (typeof validation === "function") {
      // Custom validation function
      validation(context.body, "body", context);
    } else {
      // Schema-based validation
      validateWithSchema(context.body || {}, validation);
    }
    return null;
  } catch (error) {
    if (error instanceof ValidationError) {
      return apiResponse(
        createValidationErrorResponse(error.field || "validation", error.message),
        HTTP_STATUS.BAD_REQUEST
      );
    }
    throw error;
  }
}

// =======================
// Utility Functions
// =======================

async function parseRequestBody(request: NextRequest): Promise<any> {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return await request.json();
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      const body: Record<string, any> = {};
      for (const [key, value] of formData.entries()) {
        body[key] = value;
      }
      return body;
    }

    return null;
  } catch (_error) {
    throw new ValidationError("Invalid request body format");
  }
}

function validateWithSchema(data: Record<string, any>, schema: ValidationSchema): void {
  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field];

    if (rule === "required" && (value === undefined || value === null || value === "")) {
      throw new ValidationError(`${field} is required`, field);
    }

    if (value !== undefined && value !== null) {
      if (rule === "string" && typeof value !== "string") {
        throw new ValidationError(`${field} must be a string`, field);
      }
      if (rule === "number" && typeof value !== "number") {
        throw new ValidationError(`${field} must be a number`, field);
      }
      if (rule === "email" && !isValidEmail(value)) {
        throw new ValidationError(`${field} must be a valid email`, field);
      }
      if (typeof rule === "function") {
        data[field] = rule(value, field, data);
      }
    }
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

function logRequest(
  request: NextRequest,
  context: ApiContext,
  loggingConfig: boolean | LoggingConfig
): void {
  const config = typeof loggingConfig === "boolean" ? {} : loggingConfig;
  const logData: any = {
    method: request.method,
    endpoint: context.endpoint,
    clientIP: context.clientIP,
    userAgent: context.userAgent,
    userId: context.user?.id,
  };

  if (config.includeBody && context.body) {
    logData.body = context.body;
  }

  if (config.includeHeaders) {
    logData.headers = Object.fromEntries(request.headers.entries());
  }

  console.log("[API Request]", logData);
}

function logResponse(context: ApiContext, response: Response, duration: number): void {
  console.log("[API Response]", {
    endpoint: context.endpoint,
    status: response.status,
    duration: `${duration}ms`,
    userId: context.user?.id,
  });
}

function handleMiddlewareError(
  error: unknown,
  context: Partial<ApiContext>,
  duration: number
): Response {
  console.error("[API Middleware Error]", {
    endpoint: context.endpoint,
    duration: `${duration}ms`,
    error: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
  });

  return handleApiError(error);
}

// =======================
// Convenience Factories
// =======================

/**
 * Creates a public API handler (no authentication required)
 */
export const publicHandler = (config: Omit<MiddlewareConfig, "auth"> = {}) =>
  createApiHandler({ ...config, auth: "none" });

/**
 * Creates an authenticated API handler
 */
export const authenticatedHandler = (config: Omit<MiddlewareConfig, "auth"> = {}) =>
  createApiHandler({ ...config, auth: "required" });

/**
 * Creates a user-specific API handler (validates user access)
 */
export const userHandler = (
  userAccess: "query" | "body" = "query",
  config: Omit<MiddlewareConfig, "auth" | "userAccess"> = {}
) => createApiHandler({ ...config, auth: "user-access", userAccess });

/**
 * Creates an admin-only API handler
 */
export const adminHandler = (config: Omit<MiddlewareConfig, "auth"> = {}) =>
  createApiHandler({ ...config, auth: "admin" });

/**
 * Creates a handler for sensitive data operations
 */
export const sensitiveDataHandler = (config: Omit<MiddlewareConfig, "auth" | "rateLimit"> = {}) =>
  createApiHandler({
    ...config,
    auth: "required",
    rateLimit: "authStrict",
    logging: true,
  });

/**
 * Creates a trading API handler with enhanced security
 */
export const tradingHandler = (config: Omit<MiddlewareConfig, "auth" | "rateLimit"> = {}) =>
  createApiHandler({
    ...config,
    auth: "required",
    rateLimit: "auth",
    parseBody: true,
    logging: true,
  });

/**
 * Creates a cached API handler for GET requests
 */
export const cachedHandler = (
  cacheConfig: CacheConfig | boolean = true,
  config: Omit<MiddlewareConfig, "cache"> = {}
) =>
  createApiHandler({
    ...config,
    cache: cacheConfig,
  });

/**
 * Creates a cached public API handler
 */
export const cachedPublicHandler = (
  cacheConfig: CacheConfig | boolean = true,
  config: Omit<MiddlewareConfig, "auth" | "cache"> = {}
) =>
  createApiHandler({
    ...config,
    auth: "none",
    cache: cacheConfig,
  });

/**
 * Creates a cached authenticated API handler
 */
export const cachedAuthenticatedHandler = (
  cacheConfig: CacheConfig | boolean = true,
  config: Omit<MiddlewareConfig, "auth" | "cache"> = {}
) =>
  createApiHandler({
    ...config,
    auth: "required",
    cache: cacheConfig,
  });

/**
 * Creates a high-performance cached handler for frequently accessed data
 */
export const highPerformanceHandler = (
  config: Omit<MiddlewareConfig, "cache" | "rateLimit"> = {}
) =>
  createApiHandler({
    ...config,
    cache: {
      enabled: true,
      ttl: 5 * 60 * 1000, // 5 minutes
      freshnessRequirement: "moderate",
      bypassCondition: (request) => request.headers.get("cache-control") === "no-cache",
    },
    rateLimit: "general",
  });

/**
 * Creates a real-time data handler with minimal caching
 */
export const realTimeHandler = (config: Omit<MiddlewareConfig, "cache"> = {}) =>
  createApiHandler({
    ...config,
    cache: {
      enabled: true,
      ttl: 30 * 1000, // 30 seconds
      freshnessRequirement: "strict",
      bypassCondition: (request) =>
        request.headers.get("x-real-time") === "true" ||
        request.headers.get("cache-control") === "no-cache",
    },
  });

/**
 * Creates a data-heavy handler with aggressive caching
 */
export const dataHeavyHandler = (config: Omit<MiddlewareConfig, "cache"> = {}) =>
  createApiHandler({
    ...config,
    cache: {
      enabled: true,
      ttl: 15 * 60 * 1000, // 15 minutes
      freshnessRequirement: "relaxed",
      dependencies: ["data/heavy"],
    },
  });
