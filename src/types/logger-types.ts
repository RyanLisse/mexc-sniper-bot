/**
 * Logger Type Definitions
 * 
 * Standardized logger types to replace 'any' context parameters across the codebase.
 * Provides type safety for logging operations while maintaining flexibility.
 */

// ============================================================================
// Logger Context Types
// ============================================================================

/**
 * Supported primitive types for logging context
 */
type LoggerPrimitive = string | number | boolean | null | undefined;

/**
 * Logger context value - supports nested objects and arrays
 */
export type LoggerContextValue = 
  | LoggerPrimitive
  | LoggerContextValue[]
  | { [key: string]: LoggerContextValue };

/**
 * Main logger context interface - replaces 'any' in logger methods
 */
export interface LoggerContext {
  [key: string]: LoggerContextValue;
}

/**
 * Structured logger interface with proper typing
 */
export interface TypedLogger {
  info: (message: string, context?: LoggerContext) => void;
  warn: (message: string, context?: LoggerContext) => void;
  error: (message: string, context?: LoggerContext) => void;
  debug: (message: string, context?: LoggerContext) => void;
}

/**
 * Error logging context with additional error details
 */
export interface ErrorLoggerContext extends LoggerContext {
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string | number;
  };
  userId?: string;
  operation?: string;
  correlationId?: string;
}

/**
 * Performance logging context for timing operations
 */
export interface PerformanceLoggerContext extends LoggerContext {
  duration?: number;
  operation?: string;
  success?: boolean;
  metadata?: Record<string, LoggerContextValue>;
}

/**
 * API request logging context
 */
export interface ApiLoggerContext extends LoggerContext {
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  requestId?: string;
  userId?: string;
}