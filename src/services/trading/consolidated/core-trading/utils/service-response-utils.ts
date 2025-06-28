/**
 * Service Response Utilities
 * 
 * Eliminates redundant ServiceResponse patterns and error handling throughout the codebase.
 * Provides standardized methods for creating success/error responses with consistent structure.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type { ServiceResponse } from "../types";

export class ServiceResponseUtils {
  /**
   * Create a success response with optional data
   */
  static success<T = void>(data?: T): ServiceResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create an error response from an error object or string
   */
  static error<T = void>(error: Error | string): ServiceResponse<T> {
    const errorMessage = error instanceof Error ? error.message : error;
    return {
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute an async function and wrap the result in a ServiceResponse
   * Handles error catching and conversion automatically
   */
  static async executeWithResponse<T>(
    operation: () => Promise<T>,
    errorContext?: string
  ): Promise<ServiceResponse<T>> {
    try {
      const result = await operation();
      return this.success(result);
    } catch (error) {
      const safeError = toSafeError(error);
      const errorMessage = errorContext 
        ? `${errorContext}: ${safeError.message}`
        : safeError.message;
      return this.error(errorMessage);
    }
  }

  /**
   * Execute a sync function and wrap the result in a ServiceResponse
   * Handles error catching and conversion automatically
   */
  static executeSync<T>(
    operation: () => T,
    errorContext?: string
  ): ServiceResponse<T> {
    try {
      const result = operation();
      return this.success(result);
    } catch (error) {
      const safeError = toSafeError(error);
      const errorMessage = errorContext 
        ? `${errorContext}: ${safeError.message}`
        : safeError.message;
      return this.error(errorMessage);
    }
  }

  /**
   * Wrap a conditional check in a ServiceResponse
   * Returns error if condition is false, success if true
   */
  static validateCondition(
    condition: boolean,
    errorMessage: string
  ): ServiceResponse<void> {
    if (condition) {
      return this.success();
    }
    return this.error(errorMessage);
  }

  /**
   * Convert an existing result to ServiceResponse format
   * Useful for adapting legacy code patterns
   */
  static fromResult<T>(
    result: { success: boolean; data?: T; error?: string }
  ): ServiceResponse<T> {
    if (result.success) {
      return this.success(result.data);
    }
    return this.error(result.error || "Operation failed");
  }
}