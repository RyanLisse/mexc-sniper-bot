/**
 * Shared Console Logger Utility
 *
 * Centralized logger pattern to eliminate redundant logger initialization
 * across multiple files. Provides consistent logging interface.
 */

export interface Logger {
  info: (message: string, context?: any) => void;
  warn: (message: string, context?: any) => void;
  error: (message: string, context?: any, error?: Error) => void;
  debug: (message: string, context?: any) => void;
}

/**
 * Create a namespaced console logger
 */
export function createConsoleLogger(namespace: string): Logger {
  return {
    info: (message: string, context?: any) =>
      console.info(`[${namespace}]`, message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn(`[${namespace}]`, message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(`[${namespace}]`, message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug(`[${namespace}]`, message, context || ""),
  };
}

/**
 * Lazy logger getter mixin for classes
 */
export function withLazyLogger(namespace: string) {
  return {
    _logger: undefined as Logger | undefined,
    get logger(): Logger {
      if (!this._logger) {
        this._logger = createConsoleLogger(namespace);
      }
      return this._logger;
    },
  };
}
