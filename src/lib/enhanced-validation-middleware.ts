/**
 * Enhanced Validation Middleware with Runtime Type Checking
 * 
 * Provides comprehensive validation for API routes, external API responses,
 * and critical data flows with enhanced error handling and type safety.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiResponse,
  createErrorResponse,
  createValidationErrorResponse,
  HTTP_STATUS,
} from "@/src/lib/api-response";

// ============================================================================
// Enhanced Validation Types
// ============================================================================

export interface ValidationContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  timestamp: number;
}

export interface ValidationMetrics {
  validationTime: number;
  schemaSize: number;
  errorCount: number;
  validatedFields: string[];
}

export interface EnhancedValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  context?: ValidationContext;
  metrics?: ValidationMetrics;
  details?: {
    field?: string;
    expected?: string;
    received?: string;
    path?: string[];
  }[];
}

// ============================================================================
// Runtime Type Checking Decorators
// ============================================================================

export function withRuntimeValidation<T extends z.ZodSchema>(schema: T) {
  return function <TFunc extends (...args: any[]) => any>(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      try {
        // Validate input parameters
        if (args.length > 0) {
          const validationResult = schema.safeParse(args[0]);
          if (!validationResult.success) {
            throw new ValidationError(
              `Runtime validation failed for ${propertyKey}`,
              validationResult.error
            );
          }
          args[0] = validationResult.data;
        }
        
        const result = await originalMethod.apply(this, args);
        
        // Log validation metrics
        console.debug(`[RuntimeValidation] ${propertyKey} validated in ${Date.now() - startTime}ms`);
        
        return result;
      } catch (error) {
        console.error(`[RuntimeValidation] ${propertyKey} validation failed:`, error);
        throw error;
      }
    };
    
    return descriptor;
  };
}

// ============================================================================
// Enhanced Validation Error Class
// ============================================================================

export class ValidationError extends Error {
  public readonly zodError?: z.ZodError;
  public readonly context?: ValidationContext;
  public readonly statusCode: number;

  constructor(
    message: string,
    zodError?: z.ZodError,
    context?: ValidationContext,
    statusCode: number = HTTP_STATUS.BAD_REQUEST
  ) {
    super(message);
    this.name = "ValidationError";
    this.zodError = zodError;
    this.context = context;
    this.statusCode = statusCode;
  }

  public getFormattedErrors(): string[] {
    if (!this.zodError) return [this.message];
    
    return this.zodError.errors.map(
      (err) => `${err.path.join(".")}: ${err.message}`
    );
  }

  public getValidationDetails() {
    if (!this.zodError) return undefined;
    
    return this.zodError.errors.map((err) => ({
      field: err.path.join("."),
      expected: err.code,
      received: err.received,
      path: err.path,
      message: err.message,
    }));
  }
}

// ============================================================================
// Enhanced Request Validation
// ============================================================================

export async function validateRequestBodyEnhanced<T extends z.ZodSchema>(
  request: NextRequest,
  schema: T,
  context?: Partial<ValidationContext>
): Promise<EnhancedValidationResult<z.infer<T>>> {
  const startTime = Date.now();
  const requestId = context?.requestId || crypto.randomUUID();
  
  const validationContext: ValidationContext = {
    userId: context?.userId,
    ipAddress: request.ip || request.headers.get("x-forwarded-for") || "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
    requestId,
    timestamp: Date.now(),
  };

  try {
    let body: unknown;
    
    try {
      body = await request.json();
    } catch (parseError) {
      return {
        success: false,
        error: "Invalid JSON in request body",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        context: validationContext,
        metrics: {
          validationTime: Date.now() - startTime,
          schemaSize: 0,
          errorCount: 1,
          validatedFields: [],
        },
        details: [{
          field: "body",
          expected: "valid JSON",
          received: "invalid JSON",
          path: [],
        }],
      };
    }

    const result = schema.safeParse(body);
    const validationTime = Date.now() - startTime;

    if (!result.success) {
      const errorDetails = result.error.errors.map((err) => ({
        field: err.path.join("."),
        expected: err.code,
        received: err.received?.toString() || "undefined",
        path: err.path,
      }));

      return {
        success: false,
        error: `Request body validation failed: ${result.error.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ")}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        context: validationContext,
        metrics: {
          validationTime,
          schemaSize: Object.keys(body || {}).length,
          errorCount: result.error.errors.length,
          validatedFields: result.error.errors.map(err => err.path.join(".")),
        },
        details: errorDetails,
      };
    }

    // Extract validated field names
    const validatedFields = extractFieldNames(result.data);

    return {
      success: true,
      data: result.data,
      context: validationContext,
      metrics: {
        validationTime,
        schemaSize: validatedFields.length,
        errorCount: 0,
        validatedFields,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown validation error",
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      context: validationContext,
      metrics: {
        validationTime: Date.now() - startTime,
        schemaSize: 0,
        errorCount: 1,
        validatedFields: [],
      },
    };
  }
}

// ============================================================================
// External API Response Validation
// ============================================================================

export function validateExternalApiResponse<T extends z.ZodSchema>(
  schema: T,
  data: unknown,
  apiName: string = "external API"
): EnhancedValidationResult<z.infer<T>> {
  const startTime = Date.now();
  
  try {
    const result = schema.safeParse(data);
    const validationTime = Date.now() - startTime;

    if (!result.success) {
      console.warn(`[ExternalAPIValidation] ${apiName} response validation failed:`, {
        errors: result.error.errors,
        receivedData: JSON.stringify(data, null, 2).substring(0, 500),
      });

      return {
        success: false,
        error: `${apiName} response validation failed: ${result.error.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ")}`,
        statusCode: HTTP_STATUS.BAD_GATEWAY,
        metrics: {
          validationTime,
          schemaSize: 0,
          errorCount: result.error.errors.length,
          validatedFields: [],
        },
        details: result.error.errors.map((err) => ({
          field: err.path.join("."),
          expected: err.code,
          received: err.received?.toString() || "undefined",
          path: err.path,
        })),
      };
    }

    const validatedFields = extractFieldNames(result.data);

    console.debug(`[ExternalAPIValidation] ${apiName} response validated successfully`, {
      validationTime,
      fieldsCount: validatedFields.length,
    });

    return {
      success: true,
      data: result.data,
      metrics: {
        validationTime,
        schemaSize: validatedFields.length,
        errorCount: 0,
        validatedFields,
      },
    };
  } catch (error) {
    console.error(`[ExternalAPIValidation] ${apiName} validation error:`, error);
    
    return {
      success: false,
      error: `${apiName} validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      metrics: {
        validationTime: Date.now() - startTime,
        schemaSize: 0,
        errorCount: 1,
        validatedFields: [],
      },
    };
  }
}

// ============================================================================
// Critical Data Flow Validation
// ============================================================================

export class CriticalDataValidator {
  private static validationMetrics = new Map<string, ValidationMetrics[]>();

  static validateCriticalData<T extends z.ZodSchema>(
    schema: T,
    data: unknown,
    flowName: string,
    isRequired: boolean = true
  ): T["_output"] {
    const startTime = Date.now();
    
    try {
      const result = schema.safeParse(data);
      const validationTime = Date.now() - startTime;

      if (!result.success) {
        const error = new ValidationError(
          `Critical data validation failed for ${flowName}`,
          result.error
        );

        // Log critical validation failure
        console.error(`[CriticalDataValidator] CRITICAL FAILURE in ${flowName}:`, {
          errors: result.error.errors,
          data: JSON.stringify(data, null, 2).substring(0, 300),
          isRequired,
        });

        // Record metrics
        this.recordMetrics(flowName, {
          validationTime,
          schemaSize: 0,
          errorCount: result.error.errors.length,
          validatedFields: [],
        });

        if (isRequired) {
          throw error;
        } else {
          console.warn(`[CriticalDataValidator] Non-critical validation failed for ${flowName}, continuing with fallback`);
          return undefined;
        }
      }

      const validatedFields = extractFieldNames(result.data);
      
      // Record success metrics
      this.recordMetrics(flowName, {
        validationTime,
        schemaSize: validatedFields.length,
        errorCount: 0,
        validatedFields,
      });

      console.debug(`[CriticalDataValidator] ${flowName} validated successfully`, {
        validationTime,
        fieldsCount: validatedFields.length,
      });

      return result.data;
    } catch (error) {
      console.error(`[CriticalDataValidator] Unexpected error in ${flowName}:`, error);
      
      if (isRequired) {
        throw error;
      }
      
      return undefined;
    }
  }

  static getValidationMetrics(flowName: string): ValidationMetrics[] {
    return this.validationMetrics.get(flowName) || [];
  }

  static clearMetrics(flowName?: string): void {
    if (flowName) {
      this.validationMetrics.delete(flowName);
    } else {
      this.validationMetrics.clear();
    }
  }

  private static recordMetrics(flowName: string, metrics: ValidationMetrics): void {
    const existing = this.validationMetrics.get(flowName) || [];
    existing.push(metrics);
    
    // Keep only last 100 metrics per flow
    if (existing.length > 100) {
      existing.splice(0, existing.length - 100);
    }
    
    this.validationMetrics.set(flowName, existing);
  }
}

// ============================================================================
// Enhanced Validation Middleware Factory
// ============================================================================

interface EnhancedValidationConfig<TBody, TQuery, TParams> {
  body?: z.ZodSchema<TBody>;
  query?: z.ZodSchema<TQuery>;
  params?: z.ZodSchema<TParams>;
  skipValidation?: boolean;
  requireAuth?: boolean;
  enableMetrics?: boolean;
  customErrorHandler?: (error: ValidationError) => NextResponse;
}

export function withEnhancedValidation<TBody = any, TQuery = any, TParams = any>(
  config: EnhancedValidationConfig<TBody, TQuery, TParams>
) {
  return <THandler extends Function>(handler: THandler): THandler =>
    (async (request: NextRequest, context?: any) => {
      if (config.skipValidation) {
        return handler(request, context);
      }

      const requestId = crypto.randomUUID();
      const validationResults: Record<string, any> = {};
      const validationContext: ValidationContext = {
        userId: context?.userId,
        ipAddress: request.ip || request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
        requestId,
        timestamp: Date.now(),
      };

      try {
        // Validate request body
        if (config.body) {
          const bodyValidation = await validateRequestBodyEnhanced(
            request,
            config.body,
            validationContext
          );
          
          if (!bodyValidation.success) {
            if (config.customErrorHandler) {
              return config.customErrorHandler(
                new ValidationError(
                  bodyValidation.error || "Body validation failed",
                  undefined,
                  bodyValidation.context,
                  bodyValidation.statusCode
                )
              );
            }
            
            return apiResponse(
              createValidationErrorResponse("body", bodyValidation.error || "Validation failed"),
              bodyValidation.statusCode || HTTP_STATUS.BAD_REQUEST
            );
          }
          
          validationResults.body = bodyValidation.data;
        }

        // Validate query parameters
        if (config.query) {
          const { searchParams } = new URL(request.url);
          const params = Object.fromEntries(searchParams.entries());
          const queryResult = config.query.safeParse(params);
          
          if (!queryResult.success) {
            const errorMessage = queryResult.error.errors
              .map((err) => `${err.path.join(".")}: ${err.message}`)
              .join(", ");
            
            return apiResponse(
              createValidationErrorResponse("query", `Query validation failed: ${errorMessage}`),
              HTTP_STATUS.BAD_REQUEST
            );
          }
          
          validationResults.query = queryResult.data;
        }

        // Validate path parameters
        if (config.params && context?.params) {
          const paramsResult = config.params.safeParse(context.params);
          
          if (!paramsResult.success) {
            const errorMessage = paramsResult.error.errors
              .map((err) => `${err.path.join(".")}: ${err.message}`)
              .join(", ");
            
            return apiResponse(
              createValidationErrorResponse("params", `Path parameters validation failed: ${errorMessage}`),
              HTTP_STATUS.BAD_REQUEST
            );
          }
          
          validationResults.params = paramsResult.data;
        }

        // Attach validated data to request
        (request as any).validated = validationResults;
        (request as any).validationContext = validationContext;

        // Call the original handler
        return handler(request, context);
        
      } catch (error) {
        console.error("[EnhancedValidation] Unexpected validation error:", error);
        
        if (config.customErrorHandler && error instanceof ValidationError) {
          return config.customErrorHandler(error);
        }
        
        return apiResponse(
          createErrorResponse(
            error instanceof Error ? error.message : "Validation error occurred"
          ),
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    }) as THandler;
}

// ============================================================================
// Utility Functions
// ============================================================================

function extractFieldNames(obj: any, prefix: string = ""): string[] {
  if (!obj || typeof obj !== "object") return [];
  
  const fields: string[] = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const fieldName = prefix ? `${prefix}.${key}` : key;
    fields.push(fieldName);
    
    if (value && typeof value === "object" && !Array.isArray(value)) {
      fields.push(...extractFieldNames(value, fieldName));
    }
  }
  
  return fields;
}

export function getValidatedData<T>(request: NextRequest, key: 'body' | 'query' | 'params'): T {
  return (request as any).validated?.[key];
}

export function getValidationContext(request: NextRequest): ValidationContext | undefined {
  return (request as any).validationContext;
}

// ============================================================================
// Validation Health Monitoring
// ============================================================================

export interface ValidationHealthMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  errorRate: number;
  commonErrors: Record<string, number>;
}

export class ValidationHealthMonitor {
  private static metrics: ValidationHealthMetrics = {
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    averageValidationTime: 0,
    errorRate: 0,
    commonErrors: {},
  };

  static recordValidation(success: boolean, validationTime: number, error?: string): void {
    this.metrics.totalValidations++;
    
    if (success) {
      this.metrics.successfulValidations++;
    } else {
      this.metrics.failedValidations++;
      
      if (error) {
        this.metrics.commonErrors[error] = (this.metrics.commonErrors[error] || 0) + 1;
      }
    }

    // Update average validation time
    this.metrics.averageValidationTime = 
      (this.metrics.averageValidationTime * (this.metrics.totalValidations - 1) + validationTime) / 
      this.metrics.totalValidations;

    // Update error rate
    this.metrics.errorRate = this.metrics.failedValidations / this.metrics.totalValidations;
  }

  static getHealthMetrics(): ValidationHealthMetrics {
    return { ...this.metrics };
  }

  static resetMetrics(): void {
    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0,
      errorRate: 0,
      commonErrors: {},
    };
  }
}