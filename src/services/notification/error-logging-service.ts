/**
 * Enhanced Centralized Error Logging Service
 *
 * This service provides centralized error logging with support for
 * structured logging, error recovery, fallback mechanisms, and
 * integration with external monitoring services.
 */

import { ApplicationError } from "@/src/lib/errors";

export interface ErrorLogEntry {
  id?: string;
  timestamp: Date;
  level: "error" | "warn" | "info" | "debug";
  message: string;
  errorCode?: string;
  errorName?: string;
  stack?: string;
  context?: Record<string, unknown>;
  userId?: string;
  requestId?: string;
  component?: string;
  operation?: string;
  url?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  environment?: string;
  service?: string;
  performance?: {
    startTime?: number;
    duration?: number;
    memoryUsage?: number;
  };
  recovery?: {
    attempted: boolean;
    strategies: string[];
    successful: boolean;
    fallbackUsed: boolean;
  };
}

export interface ErrorLogFilter {
  level?: "error" | "warn" | "info" | "debug";
  userId?: string;
  errorCode?: string;
  component?: string;
  operation?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface LoggingStrategy {
  name: string;
  enabled: boolean;
  priority: number;
  execute: (entries: ErrorLogEntry[]) => Promise<void>;
  fallback?: (entries: ErrorLogEntry[]) => Promise<void>;
  timeout: number;
}

/**
 * Enhanced error logging service with recovery and fallback mechanisms
 */
export class ErrorLoggingService {
  private static instance: ErrorLoggingService;
  private buffer: ErrorLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly maxBufferSize = 100;
  private readonly flushIntervalMs = 5000;
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private fallbackBuffer: ErrorLogEntry[] = [];

  // Enhanced logger with structured output
  private getStructuredLogger() {
    return {
      info: (message: string, context?: any) => {
        const logEntry = this.createStructuredLogEntry("info", message, context);
        this.outputStructuredLog(logEntry);
      },
      warn: (message: string, context?: any) => {
        const logEntry = this.createStructuredLogEntry("warn", message, context);
        this.outputStructuredLog(logEntry);
      },
      error: (message: string, context?: any) => {
        const logEntry = this.createStructuredLogEntry("error", message, context);
        this.outputStructuredLog(logEntry);
      },
      debug: (message: string, context?: any) => {
        const logEntry = this.createStructuredLogEntry("debug", message, context);
        this.outputStructuredLog(logEntry);
      },
    };
  }

  private createStructuredLogEntry(level: string, message: string, context?: any) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: "error-logging-service",
      component: "ErrorLoggingService",
      context: context || {},
      environment: process.env.NODE_ENV || "development",
      pid: process.pid,
      memory: process.memoryUsage(),
    };
  }

  private outputStructuredLog(logEntry: any) {
    if (process.env.NODE_ENV === "development") {
      const logMethod =
        logEntry.level === "error"
          ? console.error
          : logEntry.level === "warn"
            ? console.warn
            : logEntry.level === "debug"
              ? console.debug
              : console.info;

      logMethod("[STRUCTURED-LOG]", JSON.stringify(logEntry, null, 2));
    } else {
      // Production logging - single line JSON
      console.log(JSON.stringify(logEntry));
    }
  }

  private constructor() {
    // Start buffer flush interval with error recovery
    this.startFlushInterval();
    this.initializeLoggingStrategies();
    this.setupGracefulShutdown();
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
   * Enhanced error logging with recovery tracking
   */
  async logError(
    error: Error | ApplicationError,
    context?: Record<string, unknown>,
    recoveryInfo?: {
      attempted: boolean;
      strategies: string[];
      successful: boolean;
      fallbackUsed: boolean;
    }
  ): Promise<void> {
    const entry: ErrorLogEntry = {
      timestamp: new Date(),
      level: "error",
      message: error.message,
      errorName: error.name,
      stack: error.stack,
      context,
      component: (context?.component as string) || "unknown",
      operation: (context?.operation as string) || "unknown",
      service: "mexc-sniper-bot",
      environment: process.env.NODE_ENV || "development",
      recovery: recoveryInfo,
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

    // Add performance metrics if available
    if (context?.performance) {
      entry.performance = context.performance as any;
    }

    // Add request context if available
    this.enhanceWithRequestContext(entry);

    await this.log(entry);
  }

  /**
   * Enhanced warning logging
   */
  async logWarning(
    message: string,
    context?: Record<string, unknown>,
    component?: string,
    operation?: string
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: "warn",
      message,
      context,
      component: component || (context?.component as string) || "unknown",
      operation: operation || (context?.operation as string) || "unknown",
      service: "mexc-sniper-bot",
      environment: process.env.NODE_ENV || "development",
    });
  }

  /**
   * Enhanced info logging
   */
  async logInfo(
    message: string,
    context?: Record<string, unknown>,
    component?: string,
    operation?: string
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      level: "info",
      message,
      context,
      component: component || (context?.component as string) || "unknown",
      operation: operation || (context?.operation as string) || "unknown",
      service: "mexc-sniper-bot",
      environment: process.env.NODE_ENV || "development",
    });
  }

  /**
   * Debug logging for development
   */
  async logDebug(
    message: string,
    context?: Record<string, unknown>,
    component?: string,
    operation?: string
  ): Promise<void> {
    if (process.env.NODE_ENV === "development" || process.env.DEBUG === "true") {
      await this.log({
        timestamp: new Date(),
        level: "debug",
        message,
        context,
        component: component || (context?.component as string) || "unknown",
        operation: operation || (context?.operation as string) || "unknown",
        service: "mexc-sniper-bot",
        environment: process.env.NODE_ENV || "development",
      });
    }
  }

  /**
   * Enhanced log entry processing with fallbacks
   */
  private async log(entry: ErrorLogEntry): Promise<void> {
    try {
      // Add to buffer
      this.buffer.push(entry);

      // Flush if buffer is full
      if (this.buffer.length >= this.maxBufferSize) {
        await this.flush();
      }

      // Also log to console with structured format
      this.outputToConsole(entry);
    } catch (error) {
      // If logging fails, add to fallback buffer
      this.fallbackBuffer.push(entry);
      this.getStructuredLogger().error("Failed to process log entry", {
        operation: "log",
        error: error instanceof Error ? error.message : "Unknown error",
        entryLevel: entry.level,
        fallbackBufferSize: this.fallbackBuffer.length,
      });
    }
  }

  private outputToConsole(entry: ErrorLogEntry): void {
    if (process.env.NODE_ENV === "development") {
      const logMethod =
        entry.level === "error"
          ? console.error
          : entry.level === "warn"
            ? console.warn
            : entry.level === "debug"
              ? console.debug
              : console.info;

      logMethod(`[${entry.level.toUpperCase()}] ${entry.component}::${entry.operation}`, {
        message: entry.message,
        timestamp: entry.timestamp.toISOString(),
        context: entry.context,
        performance: entry.performance,
        recovery: entry.recovery,
      });
    }
  }

  /**
   * Enhanced flush with multiple strategies and fallbacks
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0 && this.fallbackBuffer.length === 0) {
      return;
    }

    // Combine main buffer and fallback buffer
    const entriesToFlush = [...this.buffer, ...this.fallbackBuffer];
    this.buffer = [];
    this.fallbackBuffer = [];

    const logger = this.getStructuredLogger();

    try {
      // Execute logging strategies with circuit breaker pattern
      await this.executeLoggingStrategies(entriesToFlush);

      logger.info("Successfully flushed log entries", {
        operation: "flush",
        entryCount: entriesToFlush.length,
        strategies: this.getActiveStrategies().map((s) => s.name),
      });
    } catch (error) {
      // If flush fails, implement recovery strategies
      await this.handleFlushFailure(entriesToFlush, error);
    }
  }

  private async executeLoggingStrategies(entries: ErrorLogEntry[]): Promise<void> {
    const strategies = this.getActiveStrategies();
    const results: Array<{ strategy: string; success: boolean; error?: any }> = [];

    for (const strategy of strategies) {
      const circuitBreaker = this.getCircuitBreaker(strategy.name);

      if (circuitBreaker.state === "OPEN") {
        // Circuit breaker is open, try fallback if available
        if (strategy.fallback) {
          try {
            await this.executeWithTimeout(strategy.fallback(entries), strategy.timeout);
            results.push({ strategy: `${strategy.name}-fallback`, success: true });
          } catch (fallbackError) {
            results.push({
              strategy: `${strategy.name}-fallback`,
              success: false,
              error: fallbackError,
            });
          }
        }
        continue;
      }

      try {
        await this.executeWithTimeout(strategy.execute(entries), strategy.timeout);
        circuitBreaker.recordSuccess();
        results.push({ strategy: strategy.name, success: true });
      } catch (error) {
        circuitBreaker.recordFailure();
        results.push({ strategy: strategy.name, success: false, error });

        // Try fallback if main strategy fails
        if (strategy.fallback) {
          try {
            await this.executeWithTimeout(strategy.fallback(entries), strategy.timeout);
            results.push({ strategy: `${strategy.name}-fallback`, success: true });
          } catch (fallbackError) {
            results.push({
              strategy: `${strategy.name}-fallback`,
              success: false,
              error: fallbackError,
            });
          }
        }
      }
    }

    // Check if at least one strategy succeeded
    const hasSuccess = results.some((r) => r.success);
    if (!hasSuccess) {
      throw new Error(`All logging strategies failed: ${JSON.stringify(results)}`);
    }
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Operation timeout")), timeout)
      ),
    ]);
  }

  private async handleFlushFailure(entries: ErrorLogEntry[], error: unknown): Promise<void> {
    const logger = this.getStructuredLogger();

    // Add entries back to fallback buffer
    this.fallbackBuffer.unshift(...entries);

    // Limit fallback buffer size to prevent memory issues
    if (this.fallbackBuffer.length > this.maxBufferSize * 2) {
      const droppedEntries = this.fallbackBuffer.splice(this.maxBufferSize);
      logger.warn("Dropped log entries due to buffer overflow", {
        operation: "handleFlushFailure",
        droppedCount: droppedEntries.length,
        bufferSize: this.fallbackBuffer.length,
      });
    }

    logger.error("Failed to flush error logs", {
      operation: "handleFlushFailure",
      error: error instanceof Error ? error.message : "Unknown error",
      entryCount: entries.length,
      fallbackBufferSize: this.fallbackBuffer.length,
    });
  }

  /**
   * Initialize logging strategies with fallbacks
   */
  private initializeLoggingStrategies(): void {
    this.loggingStrategies = [
      {
        name: "database",
        enabled: true,
        priority: 1,
        execute: this.storeInDatabase.bind(this),
        fallback: this.storeInLocalFile.bind(this),
        timeout: 5000,
      },
      {
        name: "monitoring",
        enabled: process.env.NODE_ENV === "production",
        priority: 2,
        execute: this.sendToMonitoringService.bind(this),
        fallback: this.sendToWebhook.bind(this),
        timeout: 3000,
      },
      {
        name: "console",
        enabled: true,
        priority: 3,
        execute: this.logToConsole.bind(this),
        timeout: 1000,
      },
    ];
  }

  private loggingStrategies: LoggingStrategy[] = [];

  private getActiveStrategies(): LoggingStrategy[] {
    return this.loggingStrategies.filter((s) => s.enabled).sort((a, b) => a.priority - b.priority);
  }

  private getCircuitBreaker(strategyName: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(strategyName)) {
      this.circuitBreakers.set(strategyName, new LoggingCircuitBreaker());
    }
    return this.circuitBreakers.get(strategyName)!;
  }

  private enhanceWithRequestContext(entry: ErrorLogEntry): void {
    if (typeof window === "undefined") {
      // Server-side context
      entry.context = {
        ...entry.context,
        environment: process.env.NODE_ENV,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      };
    } else {
      // Client-side context
      entry.url = window.location.href;
      entry.userAgent = navigator.userAgent;
      entry.context = {
        ...entry.context,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        screen: {
          width: screen.width,
          height: screen.height,
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
  }

  /**
   * Start the flush interval for buffered logging
   */
  startFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(async () => {
      try {
        await this.flush();
      } catch (error) {
        this.getStructuredLogger().error("Flush interval error", {
          operation: "startFlushInterval",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.flushIntervalMs);
  }

  /**
   * Setup graceful shutdown handling
   */
  setupGracefulShutdown(): void {
    const cleanup = async () => {
      try {
        const logger = this.getStructuredLogger();
        logger.info("Graceful shutdown initiated", {
          operation: "setupGracefulShutdown",
          bufferSize: this.buffer.length,
          fallbackBufferSize: this.fallbackBuffer.length,
        });

        if (this.flushInterval) {
          clearInterval(this.flushInterval);
        }

        // Final flush of remaining entries
        await this.flush();
      } catch (error) {
        console.error("Error during graceful shutdown:", error);
      }
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    process.on("beforeExit", cleanup);
  }

  // Rest of the logging strategy implementations would continue here...
  // This shows the enhanced architecture pattern
}

interface CircuitBreakerState {
  state: "OPEN" | "CLOSED" | "HALF_OPEN";
  failures: number;
  lastFailureTime: number;
  threshold: number;
  timeout: number;

  recordSuccess(): void;
  recordFailure(): void;
}

/**
 * Circuit breaker implementation for logging strategies
 */
class LoggingCircuitBreaker implements CircuitBreakerState {
  state: "OPEN" | "CLOSED" | "HALF_OPEN" = "CLOSED";
  failures = 0;
  lastFailureTime = 0;
  threshold = 5;
  timeout = 60000;

  recordSuccess(): void {
    this.failures = 0;
    this.state = "CLOSED";
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = "OPEN";
    }
  }

  isOpen(): boolean {
    if (this.state === "OPEN") {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "HALF_OPEN";
        return false;
      }
      return true;
    }
    return false;
  }
}

// Add missing logging strategy implementations to ErrorLoggingService
declare module "./error-logging-service" {
  interface ErrorLoggingService {
    storeInDatabase(entries: ErrorLogEntry[]): Promise<void>;
    storeInLocalFile(entries: ErrorLogEntry[]): Promise<void>;
    sendToMonitoringService(entries: ErrorLogEntry[]): Promise<void>;
    sendToWebhook(entries: ErrorLogEntry[]): Promise<void>;
    logToConsole(entries: ErrorLogEntry[]): Promise<void>;
    startFlushInterval(): void;
    setupGracefulShutdown(): void;
  }
}

// Extend ErrorLoggingService with missing methods
Object.assign(ErrorLoggingService.prototype, {
  /**
   * Store log entries in database with error recovery
   */
  async storeInDatabase(entries: ErrorLogEntry[]): Promise<void> {
    // Use internal structured logging

    try {
      // Import database service dynamically to avoid circular dependencies
      const { BatchDatabaseService } = await import("@/src/services/data/batch-database-service");
      const batchDatabaseService = new BatchDatabaseService();

      const dbEntries = entries.map((entry) => ({
        id: entry.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
        error_code: entry.errorCode,
        error_name: entry.errorName,
        stack: entry.stack,
        context: JSON.stringify(entry.context || {}),
        user_id: entry.userId,
        request_id: entry.requestId,
        component: entry.component,
        operation: entry.operation,
        environment: entry.environment,
        service: entry.service,
        performance_data: JSON.stringify(entry.performance || {}),
        recovery_data: JSON.stringify(entry.recovery || {}),
      }));

      await batchDatabaseService.batchInsert("error_logs", dbEntries);

      console.info("[ErrorLoggingService] Successfully stored log entries in database", {
        operation: "storeInDatabase",
        entryCount: entries.length,
      });
    } catch (error) {
      console.error("[ErrorLoggingService] Failed to store entries in database", {
        operation: "storeInDatabase",
        error: error instanceof Error ? error.message : "Unknown error",
        entryCount: entries.length,
      });
      throw error;
    }
  },

  /**
   * Store log entries in local file as fallback
   */
  async storeInLocalFile(entries: ErrorLogEntry[]): Promise<void> {
    // Use internal structured logging

    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      const logDir = path.join(process.cwd(), "logs");
      const logFile = path.join(
        logDir,
        `error-logs-${new Date().toISOString().split("T")[0]}.json`
      );

      // Ensure log directory exists
      try {
        await fs.access(logDir);
      } catch {
        await fs.mkdir(logDir, { recursive: true });
      }

      // Read existing entries if file exists
      let existingEntries: ErrorLogEntry[] = [];
      try {
        const existingData = await fs.readFile(logFile, "utf-8");
        existingEntries = JSON.parse(existingData);
      } catch {
        // File doesn't exist or is invalid, start fresh
      }

      // Append new entries
      const allEntries = [...existingEntries, ...entries];

      // Write back to file
      await fs.writeFile(logFile, JSON.stringify(allEntries, null, 2));

      console.info("[ErrorLoggingService] Successfully stored log entries in local file", {
        operation: "storeInLocalFile",
        entryCount: entries.length,
        filePath: logFile,
      });
    } catch (error) {
      console.error("[ErrorLoggingService] Failed to store entries in local file", {
        operation: "storeInLocalFile",
        error: error instanceof Error ? error.message : "Unknown error",
        entryCount: entries.length,
      });
      throw error;
    }
  },

  /**
   * Send log entries to monitoring service
   */
  async sendToMonitoringService(entries: ErrorLogEntry[]): Promise<void> {

    try {
      // Mock implementation - replace with actual monitoring service
      const monitoringEndpoint = process.env.MONITORING_ENDPOINT;

      if (!monitoringEndpoint) {
        throw new Error("MONITORING_ENDPOINT not configured");
      }

      const response = await fetch(monitoringEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MONITORING_API_KEY}`,
        },
        body: JSON.stringify({
          service: "mexc-sniper-bot",
          environment: process.env.NODE_ENV,
          entries: entries,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Monitoring service responded with ${response.status}: ${response.statusText}`
        );
      }

      console.info("[ErrorLoggingService] Successfully sent log entries to monitoring service", {
        operation: "sendToMonitoringService",
        entryCount: entries.length,
        endpoint: monitoringEndpoint,
      });
    } catch (error) {
      console.error("[ErrorLoggingService] Failed to send entries to monitoring service", {
        operation: "sendToMonitoringService",
        error: error instanceof Error ? error.message : "Unknown error",
        entryCount: entries.length,
      });
      throw error;
    }
  },

  /**
   * Send log entries to webhook as fallback
   */
  async sendToWebhook(entries: ErrorLogEntry[]): Promise<void> {

    try {
      const webhookUrl = process.env.ERROR_WEBHOOK_URL;

      if (!webhookUrl) {
        throw new Error("ERROR_WEBHOOK_URL not configured");
      }

      const payload = {
        text: `🚨 Error Log Alert - ${entries.length} entries`,
        attachments: entries.slice(0, 5).map((entry) => ({
          color: entry.level === "error" ? "danger" : entry.level === "warn" ? "warning" : "good",
          title: `${entry.level.toUpperCase()}: ${entry.component}::${entry.operation}`,
          text: entry.message,
          fields: [
            { title: "Timestamp", value: entry.timestamp.toISOString(), short: true },
            { title: "Error Code", value: entry.errorCode || "N/A", short: true },
            { title: "User ID", value: entry.userId || "N/A", short: true },
            { title: "Request ID", value: entry.requestId || "N/A", short: true },
          ],
        })),
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook responded with ${response.status}: ${response.statusText}`);
      }

      console.info("[ErrorLoggingService] Successfully sent log entries to webhook", {
        operation: "sendToWebhook",
        entryCount: entries.length,
        webhookUrl: webhookUrl.substring(0, 50) + "...",
      });
    } catch (error) {
      console.error("[ErrorLoggingService] Failed to send entries to webhook", {
        operation: "sendToWebhook",
        error: error instanceof Error ? error.message : "Unknown error",
        entryCount: entries.length,
      });
      throw error;
    }
  },

  /**
   * Log entries to console with structured formatting
   */
  async logToConsole(entries: ErrorLogEntry[]): Promise<void> {

    try {
      entries.forEach((entry) => {
        const logData = {
          timestamp: entry.timestamp.toISOString(),
          level: entry.level.toUpperCase(),
          component: entry.component,
          operation: entry.operation,
          message: entry.message,
          context: entry.context,
          performance: entry.performance,
          recovery: entry.recovery,
        };

        const logMethod =
          entry.level === "error"
            ? console.error
            : entry.level === "warn"
              ? console.warn
              : entry.level === "debug"
                ? console.debug
                : console.info;

        logMethod("[STRUCTURED-LOG]", JSON.stringify(logData, null, 2));
      });

      console.info("[ErrorLoggingService] Successfully logged entries to console", {
        operation: "logToConsole",
        entryCount: entries.length,
      });
    } catch (error) {
      // Fallback to basic console.error if structured logging fails
      console.error("Failed to log entries to console:", error);
      throw error;
    }
  },

  /**
   * Start the flush interval for buffered logging
   */
  startFlushInterval(): void {
    // Note: This method is called on prototype, so 'this' refers to the service instance
    const self = this as any; // Cast to access private properties
    
    if (self.flushInterval) {
      clearInterval(self.flushInterval);
    }

    self.flushInterval = setInterval(async () => {
      try {
        await self.flush();
      } catch (error) {
        console.error("[ErrorLoggingService] Flush interval error", {
          operation: "startFlushInterval",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }, self.flushIntervalMs);
  },

  /**
   * Setup graceful shutdown to flush remaining logs
   */
  setupGracefulShutdown(): void {
    const self = this as any; // Cast to access private properties
    
    const gracefulShutdown = async () => {
      try {
        console.info("[ErrorLoggingService] Graceful shutdown initiated, flushing remaining logs", {
          operation: "setupGracefulShutdown",
          bufferSize: self.buffer?.length || 0,
          fallbackBufferSize: self.fallbackBuffer?.length || 0,
        });

        if (self.flushInterval) {
          clearInterval(self.flushInterval);
        }

        await self.flush();

        console.info("[ErrorLoggingService] Successfully flushed all logs during shutdown", {
          operation: "setupGracefulShutdown",
        });
      } catch (error) {
        console.error("Failed to flush logs during shutdown:", error);
      }
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
    process.on("beforeExit", gracefulShutdown);
  },
});

// Update circuit breaker creation to use the new implementation
(ErrorLoggingService.prototype as any).getCircuitBreaker = function (
  strategyName: string
): CircuitBreakerState {
  const self = this as any;
  if (!self.circuitBreakers.has(strategyName)) {
    self.circuitBreakers.set(strategyName, new LoggingCircuitBreaker());
  }
  return self.circuitBreakers.get(strategyName)!;
};

/**
 * Singleton instance for global access
 */
export const errorLogger = ErrorLoggingService.getInstance();
