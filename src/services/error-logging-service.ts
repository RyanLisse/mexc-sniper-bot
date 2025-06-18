/**
 * Centralized Error Logging Service
 *
 * This service provides centralized error logging with support for
 * different log levels, structured logging, and integration with
 * external monitoring services.
 */

import { ApplicationError } from "../lib/errors";

export interface ErrorLogEntry {
  id?: string;
  timestamp: Date;
  level: "error" | "warn" | "info";
  message: string;
  errorCode?: string;
  errorName?: string;
  stack?: string;
  context?: Record<string, unknown>;
  userId?: string;
  requestId?: string;
  url?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
}

export interface ErrorLogFilter {
  level?: "error" | "warn" | "info";
  userId?: string;
  errorCode?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/**
 * Error logging service for centralized error tracking
 */
export class ErrorLoggingService {
  private static instance: ErrorLoggingService;
  private buffer: ErrorLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly maxBufferSize = 100;
  private readonly flushIntervalMs = 5000;

  private constructor() {
    // Start buffer flush interval
    this.startFlushInterval();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ErrorLoggingService {
    if (!ErrorLoggingService.instance) {
      ErrorLoggingService.instance = new ErrorLoggingService();
    }
    return ErrorLoggingService.instance;
  }

  /**
   * Log an error
   */
  async logError(
    error: Error | ApplicationError,
    context?: Record<string, unknown>
  ): Promise<void> {
    const entry: ErrorLogEntry = {
      timestamp: new Date(),
      level: "error",
      message: error.message,
      errorName: error.name,
      stack: error.stack,
      context,
    };

    // Add ApplicationError specific fields
    if (error instanceof ApplicationError) {
      entry.errorCode = error.code;
      entry.context = {
        ...entry.context,
        ...error.context,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
      };
    }

    // Add request context if available
    if (typeof window === "undefined") {
      // Server-side context
      entry.context = {
        ...entry.context,
        environment: process.env.NODE_ENV,
        nodeVersion: process.version,
      };
    } else {
      // Client-side context
      entry.url = window.location.href;
      entry.userAgent = navigator.userAgent;
    }

    await this.log(entry);
  }

  /**
   * Log a warning
   */
  async logWarning(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: "warn",
      message,
      context,
    });
  }

  /**
   * Log an info message
   */
  async logInfo(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: "info",
      message,
      context,
    });
  }

  /**
   * Log entry to buffer
   */
  private async log(entry: ErrorLogEntry): Promise<void> {
    // Add to buffer
    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush();
    }

    // Also log to console in development
    if (process.env.NODE_ENV === "development") {
      const logMethod =
        entry.level === "error"
          ? console.error
          : entry.level === "warn"
            ? console.warn
            : console.log;

      logMethod(`[${entry.level.toUpperCase()}] ${entry.message}`, {
        ...entry.context,
        timestamp: entry.timestamp.toISOString(),
      });
    }
  }

  /**
   * Flush buffer to persistent storage
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const entriesToFlush = [...this.buffer];
    this.buffer = [];

    try {
      // In production, send to monitoring service
      if (process.env.NODE_ENV === "production") {
        await this.sendToMonitoringService(entriesToFlush);
      }

      // Store critical errors in database
      const criticalErrors = entriesToFlush.filter((entry) => entry.level === "error");

      if (criticalErrors.length > 0) {
        await this.storeInDatabase(criticalErrors);
      }
    } catch (error) {
      // If flush fails, add entries back to buffer
      this.buffer.unshift(...entriesToFlush);
      console.error("Failed to flush error logs:", error);
    }
  }

  /**
   * Send logs to external monitoring service
   */
  private async sendToMonitoringService(entries: ErrorLogEntry[]): Promise<void> {
    // TODO: Implement integration with monitoring service
    // Example: Sentry, LogRocket, DataDog, etc.

    // For now, just log count
    console.log(`Would send ${entries.length} error logs to monitoring service`);
  }

  /**
   * Store error logs in database
   */
  private async storeInDatabase(entries: ErrorLogEntry[]): Promise<void> {
    // TODO: Create error_logs table and store entries
    // For now, just log count
    console.log(`Would store ${entries.length} error logs in database`);
  }

  /**
   * Start automatic buffer flush
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch((error) => {
        console.error("Error during automatic flush:", error);
      });
    }, this.flushIntervalMs);
  }

  /**
   * Stop automatic buffer flush
   */
  stopFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Query error logs
   */
  async queryLogs(filter: ErrorLogFilter): Promise<ErrorLogEntry[]> {
    // TODO: Implement database query
    console.log("Would query error logs with filter:", filter);
    return [];
  }

  /**
   * Get error statistics
   */
  async getErrorStats(
    _startDate: Date,
    _endDate: Date
  ): Promise<{
    total: number;
    byLevel: Record<string, number>;
    byCode: Record<string, number>;
    byHour: Record<string, number>;
  }> {
    // TODO: Implement statistics calculation
    return {
      total: 0,
      byLevel: {},
      byCode: {},
      byHour: {},
    };
  }

  /**
   * Clear old error logs
   */
  async clearOldLogs(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // TODO: Implement database cleanup
    console.log(`Would delete error logs older than ${cutoffDate.toISOString()}`);
    return 0;
  }
}

/**
 * Global error logger instance
 */
export const errorLogger = ErrorLoggingService.getInstance();

/**
 * Express/Next.js error logging middleware
 */
export function errorLoggingMiddleware(error: Error, req: any, _res: any, next: any): void {
  const context = {
    url: req.url,
    method: req.method,
    headers: req.headers,
    query: req.query,
    body: req.body,
    ip: req.ip || req.connection?.remoteAddress,
    userId: req.user?.id,
  };

  errorLogger.logError(error, context).catch((logError) => {
    console.error("Failed to log error:", logError);
  });

  next(error);
}

/**
 * Client-side error logging
 */
export function setupClientErrorLogging(): void {
  if (typeof window === "undefined") {
    return;
  }

  // Log unhandled errors
  window.addEventListener("error", (event) => {
    const error = new Error(event.message);
    error.stack = `${event.filename}:${event.lineno}:${event.colno}`;

    errorLogger.logError(error, {
      type: "unhandled_error",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Log unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const error = new Error(event.reason?.message || "Unhandled promise rejection");

    if (event.reason?.stack) {
      error.stack = event.reason.stack;
    }

    errorLogger.logError(error, {
      type: "unhandled_rejection",
      reason: event.reason,
    });
  });
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)?.push(value);
  }

  getMetrics(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      avg: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }

  clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();
