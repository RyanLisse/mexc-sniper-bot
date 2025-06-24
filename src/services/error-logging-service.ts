/**
 * Centralized Error Logging Service
 *
 * This service provides centralized error logging with support for
 * different log levels, structured logging, and integration with
 * external monitoring services.
 */

import { ApplicationError } from "../lib/errors";
import { createSafeLogger } from "../lib/structured-logger";

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
  private _logger?: ReturnType<typeof createSafeLogger>;
  private getLogger() {
    if (!this._logger) {
      this._logger = createSafeLogger("error-logging-service");
    }
    return this._logger;
  }

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
      this.getLogger().error("Failed to flush error logs:", error);
    }
  }

  /**
   * Send logs to external monitoring service
   */
  private async sendToMonitoringService(entries: ErrorLogEntry[]): Promise<void> {
    // TODO: Implement integration with monitoring service
    // Example: Sentry, LogRocket, DataDog, etc.

    // For now, just log count
    this.getLogger().info(`Would send ${entries.length} error logs to monitoring service`);
  }

  /**
   * Store error logs in database
   */
  private async storeInDatabase(entries: ErrorLogEntry[]): Promise<void> {
    try {
      // Import database connection
      const { db } = await import("../db");
      const { errorLogs } = await import("../db/schema");

      // Convert entries to database format
      const dbEntries = entries.map((entry) => ({
        level: entry.level,
        message: entry.message,
        error_code: entry.code,
        stack_trace: entry.stack,
        user_id: entry.userId,
        session_id: entry.sessionId,
        metadata: JSON.stringify(entry.metadata || {}),
        context: JSON.stringify(entry.context || {}),
        timestamp: entry.timestamp,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      // Insert entries in batches for better performance
      const batchSize = 100;
      for (let i = 0; i < dbEntries.length; i += batchSize) {
        const batch = dbEntries.slice(i, i + batchSize);
        await db.insert(errorLogs).values(batch);
      }

      logger.info(`Successfully stored ${entries.length} error logs in database`);
    } catch (error) {
      logger.error("Failed to store error logs in database:", {
        error: error instanceof Error ? error.message : "Unknown error",
        entryCount: entries.length,
      });
      // Don't throw - logging to database shouldn't break the application
    }
  }

  /**
   * Start automatic buffer flush
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch((error) => {
        logger.error("Error during automatic flush:", error);
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
    try {
      const { db } = await import("../db");
      const { errorLogs } = await import("../db/schema");
      const { and, eq, gte, lte, like, desc } = await import("drizzle-orm");

      // Build query conditions
      const conditions = [];

      if (filter.level) {
        conditions.push(eq(errorLogs.level, filter.level));
      }

      if (filter.code) {
        conditions.push(eq(errorLogs.error_code, filter.code));
      }

      if (filter.userId) {
        conditions.push(eq(errorLogs.user_id, filter.userId));
      }

      if (filter.sessionId) {
        conditions.push(eq(errorLogs.session_id, filter.sessionId));
      }

      if (filter.message) {
        conditions.push(like(errorLogs.message, `%${filter.message}%`));
      }

      if (filter.startTime) {
        conditions.push(gte(errorLogs.timestamp, filter.startTime));
      }

      if (filter.endTime) {
        conditions.push(lte(errorLogs.timestamp, filter.endTime));
      }

      // Execute query
      const query = db.select().from(errorLogs);

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      const results = await query.orderBy(desc(errorLogs.timestamp)).limit(filter.limit || 100);

      // Convert database results to ErrorLogEntry format
      return results.map((row) => ({
        id: row.id?.toString(),
        level: row.level as "error" | "warn" | "info",
        message: row.message,
        code: row.error_code,
        stack: row.stack_trace,
        userId: row.user_id,
        sessionId: row.session_id,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        context: row.context ? JSON.parse(row.context) : {},
        timestamp: row.timestamp,
        component: "error-logging-service",
        severity: row.level === "error" ? "high" : "medium",
      }));
    } catch (error) {
      logger.error("Failed to query error logs:", {
        error: error instanceof Error ? error.message : "Unknown error",
        filter,
      });
      return [];
    }
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
    try {
      const { db } = await import("../db");
      const { errorLogs } = await import("../db/schema");
      const { count, sql, gte } = await import("drizzle-orm");

      const endDate = end || new Date();
      const startDate = start || new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

      // Get total count
      const totalResult = await db
        .select({ count: count() })
        .from(errorLogs)
        .where(gte(errorLogs.timestamp, startDate));

      const total = totalResult[0]?.count || 0;

      // Get counts by level
      const levelResults = await db
        .select({
          level: errorLogs.level,
          count: count(),
        })
        .from(errorLogs)
        .where(gte(errorLogs.timestamp, startDate))
        .groupBy(errorLogs.level);

      const byLevel = levelResults.reduce(
        (acc, row) => {
          acc[row.level] = row.count;
          return acc;
        },
        {} as Record<string, number>
      );

      // Get counts by error code
      const codeResults = await db
        .select({
          code: errorLogs.error_code,
          count: count(),
        })
        .from(errorLogs)
        .where(gte(errorLogs.timestamp, startDate))
        .groupBy(errorLogs.error_code);

      const byCode = codeResults.reduce(
        (acc, row) => {
          if (row.code) {
            acc[row.code] = row.count;
          }
          return acc;
        },
        {} as Record<string, number>
      );

      // Get counts by hour (simplified)
      const byHour: Record<string, number> = {};
      for (let i = 0; i < 24; i++) {
        const hourStart = new Date(startDate.getTime() + i * 60 * 60 * 1000);
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

        const hourResult = await db
          .select({ count: count() })
          .from(errorLogs)
          .where(
            sql`${errorLogs.timestamp} >= ${hourStart} AND ${errorLogs.timestamp} < ${hourEnd}`
          );

        byHour[hourStart.getHours().toString()] = hourResult[0]?.count || 0;
      }

      return { total, byLevel, byCode, byHour };
    } catch (error) {
      logger.error("Failed to calculate error statistics:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        total: 0,
        byLevel: {},
        byCode: {},
        byHour: {},
      };
    }
  }

  /**
   * Clear old error logs
   */
  async clearOldLogs(daysToKeep = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { db } = await import("../db");
      const { errorLogs } = await import("../db/schema");
      const { lt, count } = await import("drizzle-orm");

      // First, count how many logs will be deleted
      const countResult = await db
        .select({ count: count() })
        .from(errorLogs)
        .where(lt(errorLogs.timestamp, cutoffDate));

      const logsToDelete = countResult[0]?.count || 0;

      if (logsToDelete === 0) {
        logger.info("No old error logs to clean up");
        return 0;
      }

      // Delete old logs
      await db.delete(errorLogs).where(lt(errorLogs.timestamp, cutoffDate));

      logger.info(
        `Successfully deleted ${logsToDelete} error logs older than ${cutoffDate.toISOString()}`
      );
      return logsToDelete;
    } catch (error) {
      logger.error("Failed to clean up old error logs:", {
        error: error instanceof Error ? error.message : "Unknown error",
        daysToKeep,
      });
      return 0;
    }
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
    logger.error("Failed to log error:", logError);
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
