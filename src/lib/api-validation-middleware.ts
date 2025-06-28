import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiResponse,
  createErrorResponse,
  createValidationErrorResponse,
  HTTP_STATUS,
} from "@/src/lib/api-response";

/**
 * API Validation Middleware
 *
 * Provides reusable validation middleware functions for API routes
 * with comprehensive error handling and type safety.
 */

// ============================================================================
// Validation Result Types
// ============================================================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; statusCode: number };

// ============================================================================
// Request Body Validation
// ============================================================================

export async function validateRequestBody<T extends z.ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<ValidationResult<z.infer<T>>> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errorMessage = result.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");

      return {
        success: false,
        error: `Request body validation failed: ${errorMessage}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: "Invalid JSON in request body",
      statusCode: HTTP_STATUS.BAD_REQUEST,
    };
  }
}

// ============================================================================
// Query Parameters Validation
// ============================================================================

export function validateQueryParams<T extends z.ZodSchema>(
  request: NextRequest,
  schema: T
): ValidationResult<z.infer<T>> {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const result = schema.safeParse(params);

    if (!result.success) {
      const errorMessage = result.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");

      return {
        success: false,
        error: `Query parameters validation failed: ${errorMessage}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: "Invalid query parameters",
      statusCode: HTTP_STATUS.BAD_REQUEST,
    };
  }
}

// ============================================================================
// Path Parameters Validation
// ============================================================================

export function validatePathParams<T extends z.ZodSchema>(
  params: Record<string, string | string[]>,
  schema: T
): ValidationResult<z.infer<T>> {
  try {
    const result = schema.safeParse(params);

    if (!result.success) {
      const errorMessage = result.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");

      return {
        success: false,
        error: `Path parameters validation failed: ${errorMessage}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: "Invalid path parameters",
      statusCode: HTTP_STATUS.BAD_REQUEST,
    };
  }
}

// ============================================================================
// Response Data Validation
// ============================================================================

export function validateResponseData<T extends z.ZodSchema>(
  data: unknown,
  schema: T
): ValidationResult<z.infer<T>> {
  try {
    const result = schema.safeParse(data);

    if (!result.success) {
      const errorMessage = result.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");

      return {
        success: false,
        error: `Response data validation failed: ${errorMessage}`,
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: "Response data validation error",
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    };
  }
}

// ============================================================================
// Validation Error Response Helpers
// ============================================================================

export function createValidationErrorApiResponse(validationResult: ValidationResult<any>) {
  if (validationResult.success) {
    throw new Error("Cannot create error response for successful validation");
  }

  return apiResponse(createErrorResponse(validationResult.error), validationResult.statusCode);
}

export function handleValidationError(field: string, message: string) {
  return apiResponse(createValidationErrorResponse(field, message), HTTP_STATUS.BAD_REQUEST);
}

// ============================================================================
// Validation Middleware HOF
// ============================================================================

interface ValidationConfig<TBody, TQuery, TParams> {
  body?: z.ZodSchema<TBody>;
  query?: z.ZodSchema<TQuery>;
  params?: z.ZodSchema<TParams>;
}

export function withValidation<TBody = any, TQuery = any, TParams = any>(
  config: ValidationConfig<TBody, TQuery, TParams>
) {
  return <THandler extends Function>(handler: THandler): THandler =>
    (async (request: NextRequest, context?: any) => {
      const validationResults: Record<string, any> = {};

      // Validate request body
      if (config.body) {
        const bodyValidation = await validateRequestBody(request, config.body);
        if (!bodyValidation.success) {
          return createValidationErrorApiResponse(bodyValidation);
        }
        validationResults.body = bodyValidation.data;
      }

      // Validate query parameters
      if (config.query) {
        const queryValidation = validateQueryParams(request, config.query);
        if (!queryValidation.success) {
          return createValidationErrorApiResponse(queryValidation);
        }
        validationResults.query = queryValidation.data;
      }

      // Validate path parameters
      if (config.params && context?.params) {
        const paramsValidation = validatePathParams(context.params, config.params);
        if (!paramsValidation.success) {
          return createValidationErrorApiResponse(paramsValidation);
        }
        validationResults.params = paramsValidation.data;
      }

      // Attach validated data to request
      (request as any).validated = validationResults;

      // Call the original handler
      return handler(request, context);
    }) as THandler;
}

// ============================================================================
// Utility Functions for Accessing Validated Data
// ============================================================================

export function getValidatedBody<T>(request: NextRequest): T {
  return (request as any).validated?.body;
}

export function getValidatedQuery<T>(request: NextRequest): T {
  return (request as any).validated?.query;
}

export function getValidatedParams<T>(request: NextRequest): T {
  return (request as any).validated?.params;
}

// ============================================================================
// Common Validation Schemas
// ============================================================================

export const CommonQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
  page: z.coerce.number().min(1).default(1).optional(),
});

export const TimestampRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const UserContextSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const IdParamSchema = z.object({
  id: z.string().min(1, "ID parameter is required"),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CommonQuery = z.infer<typeof CommonQuerySchema>;
export type TimestampRange = z.infer<typeof TimestampRangeSchema>;
export type UserContext = z.infer<typeof UserContextSchema>;
export type IdParam = z.infer<typeof IdParamSchema>;
