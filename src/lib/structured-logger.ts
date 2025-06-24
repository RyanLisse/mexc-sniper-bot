/**
 * Structured Logger for MEXC Trading Bot
 *
 * Build-safe structured logging without OpenTelemetry dependencies during compilation
 */

// Build-safe trace fallback - no dynamic imports during build
const trace = {
  getActiveSpan: () => null,
};

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

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
  memoryUsage?: number;
  responseTime?: number;

  // Error context
  errorCode?: string;
  errorType?: string;
  stackTrace?: string;

  // Additional context
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  traceId?: string;
  spanId?: string;
  service: string;
  component: string;
}

/**
 * Structured Logger Class
 */
export class StructuredLogger {
  private service: string;
  private component: string;
  private logLevel: LogLevel;

  constructor(service: string, component: string, logLevel: LogLevel = "info") {
    this.service = service;
    this.component = component;
    this.logLevel = this.parseLogLevel(process.env.LOG_LEVEL || logLevel);
  }

  /**
   * Parse log level from string
   */
  private parseLogLevel(level: string): LogLevel {
    const normalizedLevel = level.toLowerCase() as LogLevel;
    const validLevels: LogLevel[] = ["debug", "info", "warn", "error", "fatal"];
    return validLevels.includes(normalizedLevel) ? normalizedLevel : "info";
  }

  /**
   * Check if log level should be emitted
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4,
    };
    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Create structured log entry
   */
  private createLogEntry(level: LogLevel, message: string, context: LogContext = {}): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        service: context.service || this.service,
        component: context.component || this.component,
      },
      traceId: undefined,
      spanId: undefined,
      service: this.service,
      component: this.component,
    };
  }

  /**
   * Emit log entry
   */
  private emit(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    // Format for console output (development) or structured output (production)
    if (process.env.NODE_ENV === "production") {
      // JSON output for log aggregation systems
      console.log(JSON.stringify(entry));
    } else {
      // Human-readable format for development
      const timestamp = entry.timestamp;
      const contextStr =
        Object.keys(entry.context).length > 0 ? JSON.stringify(entry.context, null, 2) : "";

      console.log(
        `${timestamp} [${entry.level.toUpperCase()}] ${entry.component}: ${entry.message}`
      );
      if (contextStr) {
        console.log(`Context: ${contextStr}`);
      }
    }
  }

  /**
   * Debug logging
   */
  debug(message: string, context?: LogContext): void {
    this.emit(this.createLogEntry("debug", message, context));
  }

  /**
   * Info logging
   */
  info(message: string, context?: LogContext): void {
    this.emit(this.createLogEntry("info", message, context));
  }

  /**
   * Warning logging
   */
  warn(message: string, context?: LogContext): void {
    this.emit(this.createLogEntry("warn", message, context));
  }

  /**
   * Error logging
   */
  error(message: string, context?: LogContext, error?: Error): void {
    const errorContext: LogContext = {
      ...context,
      errorType: error?.constructor.name,
      errorCode: (error as any)?.code,
      stackTrace: error?.stack,
    };

    this.emit(this.createLogEntry("error", message, errorContext));
  }

  /**
   * Fatal logging
   */
  fatal(message: string, context?: LogContext, error?: Error): void {
    this.error(message, context, error);
    // In production, you might want to trigger alerts or notifications
  }

  /**
   * Trading-specific logging methods
   */

  /**
   * Log trading operations
   */
  trading(operation: string, context: LogContext): void {
    this.info(`Trading: ${operation}`, {
      ...context,
      operation: "trading",
      operationType: operation,
    });
  }

  /**
   * Log pattern detection
   */
  pattern(patternType: string, confidence: number, context: LogContext = {}): void {
    this.info(`Pattern detected: ${patternType}`, {
      ...context,
      patternType,
      confidence,
      operation: "pattern_detection",
    });
  }

  /**
   * Log API calls
   */
  api(endpoint: string, method: string, responseTime: number, context: LogContext = {}): void {
    this.info(`API call: ${method} ${endpoint}`, {
      ...context,
      endpoint,
      method,
      responseTime,
      operation: "api_call",
    });
  }

  /**
   * Log agent operations
   */
  agent(agentId: string, taskType: string, context: LogContext = {}): void {
    this.info(`Agent: ${agentId} - ${taskType}`, {
      ...context,
      agentId,
      taskType,
      operation: "agent_task",
    });
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, context: LogContext = {}): void {
    const level = duration > 1000 ? "warn" : "info"; // Warn for operations > 1s
    this.emit(
      this.createLogEntry(level, `Performance: ${operation} completed in ${duration}ms`, {
        ...context,
        operation: "performance",
        duration,
      })
    );
  }

  /**
   * Log cache operations
   */
  cache(operation: "hit" | "miss" | "set" | "delete", key: string, context: LogContext = {}): void {
    this.debug(`Cache ${operation}: ${key}`, {
      ...context,
      cacheOperation: operation,
      cacheKey: key,
      operation: "cache",
    });
  }

  /**
   * Log safety events
   */
  safety(event: string, riskScore: number, context: LogContext = {}): void {
    const level = riskScore > 70 ? "warn" : "info";
    this.emit(
      this.createLogEntry(level, `Safety: ${event}`, {
        ...context,
        riskScore,
        operation: "safety",
        safetyEvent: event,
      })
    );
  }
}

/**
 * Create logger instance for a specific component
 */
export function createLogger(component: string, service = "mexc-trading-bot"): StructuredLogger {
  return new StructuredLogger(service, component);
}

/**
 * Default logger instances for common components
 */
export const logger = {
  // Core services
  trading: createLogger("trading"),
  pattern: createLogger("pattern-detection"),
  safety: createLogger("safety"),
  api: createLogger("api"),

  // Infrastructure
  cache: createLogger("cache"),
  database: createLogger("database"),
  websocket: createLogger("websocket"),

  // Agent system
  agent: createLogger("agent"),
  coordination: createLogger("coordination"),

  // Monitoring
  monitoring: createLogger("monitoring"),
  performance: createLogger("performance"),

  // General purpose
  system: createLogger("system"),
  default: createLogger("default"),
};

/**
 * Migration helper for console.log replacement
 */
export function replaceConsoleLog(component: string) {
  const componentLogger = createLogger(component);

  return {
    log: (message: string, context?: LogContext) => componentLogger.info(message, context),
    info: (message: string, context?: LogContext) => componentLogger.info(message, context),
    warn: (message: string, context?: LogContext) => componentLogger.warn(message, context),
    error: (message: string, context?: LogContext, error?: Error) =>
      componentLogger.error(message, context, error),
    debug: (message: string, context?: LogContext) => componentLogger.debug(message, context),
  };
}

/**
 * Performance timing utility
 */
export class PerformanceTimer {
  private startTime: number;
  private operation: string;
  private logger: StructuredLogger;

  constructor(operation: string, logger: StructuredLogger) {
    this.operation = operation;
    this.logger = logger;
    this.startTime = Date.now();
  }

  end(context?: LogContext): number {
    const duration = Date.now() - this.startTime;
    this.logger.performance(this.operation, duration, context);
    return duration;
  }
}

/**
 * Create performance timer
 */
export function createTimer(operation: string, component: string): PerformanceTimer {
  const logger = createLogger(component);
  return new PerformanceTimer(operation, logger);
}
