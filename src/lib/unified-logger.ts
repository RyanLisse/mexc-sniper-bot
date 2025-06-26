/**
 * Unified Logger System
 *
 * Replaces 429+ console.log statements across the codebase with a consistent,
 * type-safe logging system that supports structured logging and proper interfaces.
 *
 * Features:
 * - Type-safe log contexts and metadata
 * - Structured logging with consistent formatting
 * - Log level filtering and environment-based configuration
 * - Performance optimized for production use
 * - Memory-efficient with circular buffer for recent logs
 */

// ============================================================================
// Type Definitions for Type Safety
// ============================================================================

export interface LogContext {
  // Trading context
  symbol?: string;
  side?: "BUY" | "SELL";
  quantity?: number | string;
  price?: number | string;
  patternType?: string;
  confidence?: number;
  riskScore?: number;

  // Agent context
  agentId?: string;
  agentType?: string;
  taskType?: string;

  // System context
  service?: string;
  operation?: string;
  component?: string;

  // Performance context
  duration?: number;
  responseTime?: number;

  // API context
  method?: string;
  endpoint?: string;
  statusCode?: number;

  // General context
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface LogMetadata {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  context?: LogContext;
  error?: Error;
  performance?: {
    memoryUsage: number;
    duration: number;
  };
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerConfig {
  level: LogLevel;
  enableStructuredLogging: boolean;
  enablePerformanceLogging: boolean;
  maxRecentLogs: number;
  enableConsoleOutput: boolean;
  environment: "development" | "production" | "test";
}

// ============================================================================
// Logger Implementation
// ============================================================================

import type { ILogger } from "./structured-logger";

export class UnifiedLogger implements ILogger {
  private config: LoggerConfig;
  private recentLogs: LogMetadata[] = [];
  private component: string;
  private startTime = Date.now();

  constructor(component: string, config?: Partial<LoggerConfig>) {
    this.component = component;
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || "info",
      enableStructuredLogging: process.env.NODE_ENV === "production",
      enablePerformanceLogging: process.env.ENABLE_PERFORMANCE_LOGGING === "true",
      maxRecentLogs: 1000,
      enableConsoleOutput: true,
      environment: (process.env.NODE_ENV as any) || "development",
      ...config,
    };
  }

  /**
   * Debug level logging - detailed information for troubleshooting
   */
  debug(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog("debug")) {
      this.log("debug", message, context, error);
    }
  }

  /**
   * Info level logging - general information about application flow
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog("info")) {
      this.log("info", message, context);
    }
  }

  /**
   * Warning level logging - potentially harmful situations
   */
  warn(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog("warn")) {
      this.log("warn", message, context, error);
    }
  }

  /**
   * Error level logging - error events that might still allow the application to continue
   */
  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog("error")) {
      this.log("error", message, context, error);
    }
  }

  /**
   * Performance logging for optimization tracking
   */
  performance(operation: string, duration: number, context?: LogContext): void {
    if (this.config.enablePerformanceLogging) {
      const memoryUsage = process.memoryUsage().heapUsed;
      const level = duration > 1000 ? "warn" : "info";

      this.log(level, `Performance: ${operation} completed in ${duration}ms`, {
        ...context,
        operation,
        duration,
        performance: {
          memoryUsage,
          duration,
        },
      });
    }
  }

  /**
   * Trading-specific logging with specialized context
   */
  trading(operation: string, context: LogContext): void {
    this.info(`Trading: ${operation}`, {
      ...context,
      operation: "trading",
    });
  }

  /**
   * API-specific logging with request tracking
   */
  api(endpoint: string, method: string, responseTime: number, context?: LogContext): void {
    const level = responseTime > 1000 ? "warn" : "info";
    this.log(level, `API: ${method} ${endpoint}`, {
      ...context,
      operation: "api",
      method,
      endpoint,
      responseTime,
    });
  }

  /**
   * Database operation logging
   */
  database(operation: string, table?: string, context?: LogContext): void {
    this.info(`Database: ${operation}`, {
      ...context,
      operation: "database",
      table,
      dbOperation: operation,
    });
  }

  /**
   * Fatal level logging - critical errors that cause application shutdown
   */
  fatal(message: string, context?: LogContext, error?: Error): void {
    this.log("error", `FATAL: ${message}`, context, error);
  }

  /**
   * Pattern detection logging
   */
  pattern(patternType: string, confidence: number, context?: LogContext): void {
    this.info(`Pattern detected: ${patternType}`, {
      ...context,
      patternType,
      confidence,
      operation: "pattern-detection",
    });
  }

  /**
   * Agent activity logging
   */
  agent(agentId: string, taskType: string, context?: LogContext): void {
    this.info(`Agent ${agentId}: ${taskType}`, {
      ...context,
      agentId,
      taskType,
      operation: "agent",
    });
  }

  /**
   * Cache operation logging
   */
  cache(operation: "hit" | "miss" | "set" | "delete", key: string, context?: LogContext): void {
    this.debug(`Cache ${operation}: ${key}`, {
      ...context,
      cacheOperation: operation,
      cacheKey: key,
      operation: "cache",
    });
  }

  /**
   * Safety system logging
   */
  safety(event: string, riskScore: number, context?: LogContext): void {
    const level = riskScore > 70 ? "warn" : "info";
    this.log(level, `Safety: ${event}`, {
      ...context,
      riskScore,
      safetyEvent: event,
      operation: "safety",
    });
  }

  /**
   * Get recent logs for debugging and monitoring
   */
  getRecentLogs(count?: number): LogMetadata[] {
    const requestedCount = count || 100;
    return this.recentLogs.slice(-requestedCount);
  }

  /**
   * Clear recent logs to free memory
   */
  clearRecentLogs(): void {
    this.recentLogs = [];
  }

  /**
   * Get logger statistics
   */
  getStats(): {
    component: string;
    recentLogCount: number;
    uptime: string;
    config: LoggerConfig;
  } {
    return {
      component: this.component,
      recentLogCount: this.recentLogs.length,
      uptime: `${Date.now() - this.startTime}ms`,
      config: this.config,
    };
  }

  // ============================================================================
  // Private Implementation
  // ============================================================================

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    return levels[level] >= levels[this.config.level];
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const timestamp = new Date().toISOString();

    const logMetadata: LogMetadata = {
      timestamp,
      level,
      component: this.component,
      message,
      context,
      error,
    };

    // Store in recent logs with memory management
    this.recentLogs.push(logMetadata);
    if (this.recentLogs.length > this.config.maxRecentLogs) {
      this.recentLogs = this.recentLogs.slice(-this.config.maxRecentLogs);
    }

    // Output to console if enabled
    if (this.config.enableConsoleOutput) {
      this.outputToConsole(logMetadata);
    }
  }

  private outputToConsole(log: LogMetadata): void {
    const { timestamp, level, component, message, context, error } = log;

    if (this.config.enableStructuredLogging) {
      // Structured logging for production
      const structuredLog = {
        timestamp,
        level,
        component,
        message,
        ...(context && { context }),
        ...(error && {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }),
      };

      console[level === "debug" ? "debug" : level](JSON.stringify(structuredLog));
    } else {
      // Human-readable logging for development
      const prefix = `[${timestamp}] [${level.toUpperCase()}] [${component}]`;
      const contextStr = context ? ` ${JSON.stringify(context)}` : "";
      const errorStr = error ? ` ERROR: ${error.message}` : "";

      console[level === "debug" ? "debug" : level](`${prefix} ${message}${contextStr}${errorStr}`);
    }
  }
}

// ============================================================================
// Logger Factory and Convenience Functions
// ============================================================================

/**
 * Create a logger instance for a specific component
 */
export function createLogger(component: string, config?: Partial<LoggerConfig>): UnifiedLogger {
  return new UnifiedLogger(component, config);
}

/**
 * Create a logger with simplified interface (backward compatibility)
 */
export function createSimpleLogger(component: string): {
  info: (message: string, context?: any) => void;
  warn: (message: string, context?: any) => void;
  error: (message: string, context?: any, error?: Error) => void;
  debug: (message: string, context?: any) => void;
} {
  const logger = new UnifiedLogger(component);

  return {
    info: (message: string, context?: any) => logger.info(message, context),
    warn: (message: string, context?: any) => logger.warn(message, context),
    error: (message: string, context?: any, error?: Error) => logger.error(message, context, error),
    debug: (message: string, context?: any) => logger.debug(message, context),
  };
}

/**
 * Performance measurement utility
 */
export function createPerformanceLogger(component: string): {
  startTimer: (operation: string) => () => void;
  measureAsync: <T>(operation: string, fn: () => Promise<T>, context?: LogContext) => Promise<T>;
} {
  const logger = new UnifiedLogger(component, { enablePerformanceLogging: true });

  return {
    startTimer: (operation: string) => {
      const startTime = Date.now();
      return () => logger.performance(operation, startTime);
    },

    measureAsync: async <T>(
      operation: string,
      fn: () => Promise<T>,
      context?: LogContext
    ): Promise<T> => {
      const startTime = Date.now();
      try {
        const result = await fn();
        logger.performance(operation, startTime, { ...context, success: true });
        return result;
      } catch (error) {
        logger.performance(operation, startTime, {
          ...context,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}

// ============================================================================
// Global Logger Registry for Centralized Management
// ============================================================================

class LoggerRegistry {
  private loggers = new Map<string, UnifiedLogger>();

  getLogger(component: string, config?: Partial<LoggerConfig>): UnifiedLogger {
    if (!this.loggers.has(component)) {
      this.loggers.set(component, new UnifiedLogger(component, config));
    }
    return this.loggers.get(component)!;
  }

  getAllLoggers(): UnifiedLogger[] {
    return Array.from(this.loggers.values());
  }

  getGlobalStats(): {
    totalLoggers: number;
    totalRecentLogs: number;
    components: string[];
  } {
    const allLoggers = this.getAllLoggers();
    return {
      totalLoggers: allLoggers.length,
      totalRecentLogs: allLoggers.reduce((sum, logger) => sum + logger.getRecentLogs().length, 0),
      components: Array.from(this.loggers.keys()),
    };
  }

  clearAllLogs(): void {
    for (const logger of this.loggers.values()) {
      logger.clearRecentLogs();
    }
  }
}

export const loggerRegistry = new LoggerRegistry();

/**
 * Get a logger instance from the global registry
 */
export function getLogger(component: string, config?: Partial<LoggerConfig>): UnifiedLogger {
  return loggerRegistry.getLogger(component, config);
}

// ============================================================================
// Export Default for Easy Import
// ============================================================================

export default {
  createLogger,
  createSimpleLogger,
  createPerformanceLogger,
  getLogger,
  loggerRegistry,
  UnifiedLogger,
};
