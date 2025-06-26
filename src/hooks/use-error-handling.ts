/**
 * React Hook for Standardized Error Handling
 * 
 * Provides consistent error handling and recovery for React components.
 * Integrates with the standardized error handling system.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { 
  type ErrorSeverity,
  errorHandler,
  RecoveryStrategy, 
  type StandardizedError,
  type StandardizedErrorContext
} from "@/src/lib/standardized-error-handler";
import { createLogger } from "@/src/lib/unified-logger";

const logger = createLogger("use-error-handling", {
  enableStructuredLogging: true,
  enablePerformanceLogging: false,
});

/**
 * Error state interface
 */
interface ErrorState {
  error: Error | null;
  isError: boolean;
  errorCode?: string;
  userMessage?: string;
  severity?: ErrorSeverity;
  recoveryActions?: string[];
  retryable?: boolean;
  isRecovering?: boolean;
}

/**
 * Error handling options
 */
interface UseErrorHandlingOptions {
  context?: Partial<StandardizedErrorContext>;
  enableAutoRecovery?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: StandardizedError) => void;
  onRecovery?: () => void;
}

/**
 * Error handling hook return type
 */
interface UseErrorHandlingReturn {
  // Error state
  errorState: ErrorState;
  
  // Error handling methods
  handleError: (error: unknown, context?: Partial<StandardizedErrorContext>) => void;
  clearError: () => void;
  retryOperation: (operation: () => Promise<void> | void) => Promise<void>;
  
  // Utility methods
  isRetryable: (error: unknown) => boolean;
  getRecoveryActions: (error: unknown) => string[];
  
  // Enhanced async wrapper
  withErrorHandling: <T>(
    operation: () => Promise<T>,
    context?: Partial<StandardizedErrorContext>
  ) => Promise<T | null>;
}

/**
 * Default options
 */
const defaultOptions: UseErrorHandlingOptions = {
  enableAutoRecovery: false,
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Custom hook for standardized error handling
 */
export function useErrorHandling(
  options: UseErrorHandlingOptions = {}
): UseErrorHandlingReturn {
  const config = { ...defaultOptions, ...options };
  const retryCountRef = useRef(0);
  const pendingOperationRef = useRef<(() => Promise<void> | void) | null>(null);

  // Error state
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isError: false,
  });

  // Handle error with standardized processing
  const handleError = useCallback((
    error: unknown,
    context?: Partial<StandardizedErrorContext>
  ) => {
    const mergedContext = {
      ...config.context,
      ...context,
      operation: context?.operation || config.context?.operation || "component.operation",
      additionalData: {
        ...config.context?.additionalData,
        ...context?.additionalData,
        hookUsage: true,
        retryCount: retryCountRef.current,
      },
    };

    const standardizedError = errorHandler.processError(error, mergedContext);
    const { error: processedError, metadata } = standardizedError;

    // Get recovery actions
    const recoveryActions = errorHandler.getRecoveryActions(error);

    // Update error state
    setErrorState({
      error: processedError,
      isError: true,
      errorCode: metadata.errorCode,
      userMessage: metadata.userMessage,
      severity: metadata.severity,
      recoveryActions,
      retryable: metadata.retryable && config.enableRetry,
      isRecovering: false,
    });

    // Call custom error handler
    if (config.onError) {
      config.onError(standardizedError);
    }

    // Log error
    logger.error("Error handled by hook", {
      errorCode: metadata.errorCode,
      severity: metadata.severity,
      retryable: metadata.retryable,
      operation: mergedContext.operation,
    }, processedError);
  }, [config]);

  // Clear error state
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isError: false,
    });
    retryCountRef.current = 0;
    pendingOperationRef.current = null;

    if (config.onRecovery) {
      config.onRecovery();
    }
  }, [config]);

  // Retry operation with exponential backoff
  const retryOperation = useCallback(async (
    operation: () => Promise<void> | void
  ) => {
    if (!config.enableRetry || retryCountRef.current >= (config.maxRetries || 3)) {
      logger.warn("Retry attempted but not allowed or max retries exceeded", {
        retryCount: retryCountRef.current,
        maxRetries: config.maxRetries,
        enableRetry: config.enableRetry,
      });
      return;
    }

    setErrorState(prev => ({ ...prev, isRecovering: true }));
    retryCountRef.current++;

    try {
      // Wait with exponential backoff
      const delay = (config.retryDelay || 1000) * 2 ** (retryCountRef.current - 1);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Execute operation
      await operation();

      // Success - clear error
      logger.info("Retry operation succeeded", {
        retryCount: retryCountRef.current,
        delay,
      });

      clearError();
    } catch (error) {
      logger.warn("Retry operation failed", {
        retryCount: retryCountRef.current,
        maxRetries: config.maxRetries,
        error: error instanceof Error ? error.message : String(error),
      });

      if (retryCountRef.current >= (config.maxRetries || 3)) {
        handleError(new Error("Max retries exceeded"), {
          operation: "retry.max_exceeded",
          additionalData: { 
            originalError: error,
            retryCount: retryCountRef.current,
          },
        });
      } else {
        // Update error state with retry info
        setErrorState(prev => ({
          ...prev,
          isRecovering: false,
        }));
      }
    }
  }, [config, handleError, clearError]);

  // Check if error is retryable
  const isRetryable = useCallback((error: unknown): boolean => {
    return errorHandler.isRetryable(error);
  }, []);

  // Get recovery actions for an error
  const getRecoveryActions = useCallback((error: unknown): string[] => {
    return errorHandler.getRecoveryActions(error);
  }, []);

  // Enhanced async wrapper with error handling
  const withErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: Partial<StandardizedErrorContext>
  ): Promise<T | null> => {
    try {
      const result = await operation();
      
      // Clear any previous errors on success
      if (errorState.isError) {
        clearError();
      }
      
      return result;
    } catch (error) {
      handleError(error, context);
      return null;
    }
  }, [errorState.isError, clearError, handleError]);

  // Auto-recovery effect
  useEffect(() => {
    if (config.enableAutoRecovery && 
        errorState.isError && 
        errorState.retryable && 
        pendingOperationRef.current) {
      
      const autoRetryDelay = 2000; // 2 seconds for auto-recovery
      const timer = setTimeout(() => {
        if (pendingOperationRef.current) {
          retryOperation(pendingOperationRef.current);
        }
      }, autoRetryDelay);

      return () => clearTimeout(timer);
    }
  }, [config.enableAutoRecovery, errorState, retryOperation]);

  return {
    errorState,
    handleError,
    clearError,
    retryOperation,
    isRetryable,
    getRecoveryActions,
    withErrorHandling,
  };
}

/**
 * Specialized hooks for common use cases
 */

/**
 * Hook for API call error handling
 */
export function useApiErrorHandling(options: UseErrorHandlingOptions = {}) {
  return useErrorHandling({
    ...options,
    context: {
      ...options.context,
      operation: "api.call",
    },
    enableRetry: true,
    maxRetries: 3,
  });
}

/**
 * Hook for form submission error handling
 */
export function useFormErrorHandling(options: UseErrorHandlingOptions = {}) {
  return useErrorHandling({
    ...options,
    context: {
      ...options.context,
      operation: "form.submit",
    },
    enableRetry: false, // Forms typically shouldn't auto-retry
    enableAutoRecovery: false,
  });
}

/**
 * Hook for data loading error handling
 */
export function useDataLoadingErrorHandling(options: UseErrorHandlingOptions = {}) {
  return useErrorHandling({
    ...options,
    context: {
      ...options.context,
      operation: "data.load",
    },
    enableRetry: true,
    enableAutoRecovery: true,
    maxRetries: 3,
  });
}

/**
 * Hook for file upload error handling
 */
export function useFileUploadErrorHandling(options: UseErrorHandlingOptions = {}) {
  return useErrorHandling({
    ...options,
    context: {
      ...options.context,
      operation: "file.upload",
    },
    enableRetry: true,
    maxRetries: 2, // Fewer retries for uploads
    retryDelay: 2000,
  });
}

/**
 * Error display state hook - UI components available in error-boundary.tsx
 */
export function useErrorDisplay() {
  const { errorState, clearError } = useErrorHandling();
  return { errorState, clearError };
}