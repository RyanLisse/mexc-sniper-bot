import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";
/**
 * Shared Logger Utilities - Pattern Detection
 *
 * Centralized logging utilities to eliminate redundant logger code across all
 * pattern detection modules. Optimized for production performance.
 *
 * OPTIMIZATION: Replaces 5 identical logger implementations across modules
 */

export interface PatternLogger {
  info: (message: string, context?: any) => void;
  warn: (message: string, context?: any) => void;
  error: (message: string, context?: any, error?: Error) => void;
  debug: (message: string, context?: any) => void;
}

/**
 * Environment-aware logging levels
 * Production: Reduced logging, Performance optimized
 * Development: Full logging for debugging
 */
const LOG_LEVEL = process.env.NODE_ENV === "production" ? "info" : "debug";
const ENABLE_CONTEXT_LOGGING = process.env.NODE_ENV !== "production";

/**
 * Create optimized logger for pattern detection modules
 *
 * PERFORMANCE: Eliminates redundant logger code and provides
 * conditional logging based on environment
 */
export function createPatternLogger(moduleName: string): PatternLogger {
  const prefix = `[${moduleName}]`;

  return {
    info: (message: string, context?: any) => {
      console.info(
        prefix,
        message,
        ENABLE_CONTEXT_LOGGING ? context || "" : ""
      );
    },

    warn: (message: string, context?: any) => {
      console.warn(
        prefix,
        message,
        ENABLE_CONTEXT_LOGGING ? context || "" : ""
      );
    },

    error: (message: string, context?: any, error?: Error) => {
      console.error(
        prefix,
        message,
        ENABLE_CONTEXT_LOGGING ? context || "" : "",
        ENABLE_CONTEXT_LOGGING ? error || "" : ""
      );
    },

    debug: (message: string, context?: any) => {
      if (LOG_LEVEL === "debug") {
        console.debug(
          prefix,
          message,
          ENABLE_CONTEXT_LOGGING ? context || "" : ""
        );
      }
    },
  };
}

/**
 * Optimized confidence score validation
 *
 * PERFORMANCE: Shared validation logic to eliminate code duplication
 */
export function validateConfidenceScore(score: number): boolean {
  return (
    typeof score === "number" &&
    !Number.isNaN(score) &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 100
  );
}

/**
 * Optimized error context creation
 *
 * PERFORMANCE: Standardized error context to reduce object creation overhead
 */
export function createErrorContext(
  operation: string,
  identifier?: string,
  additionalContext?: Record<string, any>
): Record<string, any> {
  const context: Record<string, any> = { operation };

  if (identifier) context.identifier = identifier;
  if (ENABLE_CONTEXT_LOGGING && additionalContext) {
    Object.assign(context, additionalContext);
  }

  return context;
}
