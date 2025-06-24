/**
 * Structured Logger for MEXC Trading Bot
 *
 * Build-safe structured logging without OpenTelemetry dependencies during compilation
 * Webpack-optimized with static exports for proper bundling
 */

// Build-safe logger implementation inline to avoid import issues during webpack bundling

// Build-safe trace fallback - completely static, no dynamic imports
const NOOP_TRACE = {
  getActiveSpan: () => null,
} as const;

/**
 * Build-safe logger that always works during webpack bundling
 */
class BuildSafeLogger {
  private component: string;
  private service: string;

  constructor(component: string, service: string = "mexc-trading-bot") {
    this.component = component || "unknown";
    this.service = service || "mexc-trading-bot";
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr =
      context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
    return `${timestamp} [${level.toUpperCase()}] ${this.component}: ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    console.debug(this.formatMessage("debug", message, context));
  }

  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage("info", message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage("warn", message, context));
  }

  error(message: string, context?: LogContext, error?: Error): void {
    const errorContext = {
      ...context,
      error: error?.message,
      stack: error?.stack,
    };
    console.error(this.formatMessage("error", message, errorContext));
  }

  fatal(message: string, context?: LogContext, error?: Error): void {
    this.error(`FATAL: ${message}`, context, error);
  }

  // Compatibility methods for existing code
  trading(operation: string, context: LogContext): void {
    this.info(`Trading: ${operation}`, context);
  }

  pattern(patternType: string, confidence: number, context?: LogContext): void {
    this.info(`Pattern detected: ${patternType}`, { ...context, confidence });
  }

  api(endpoint: string, method: string, responseTime: number, context?: LogContext): void {
    this.info(`API call: ${method} ${endpoint}`, { ...context, responseTime });
  }

  agent(agentId: string, taskType: string, context?: LogContext): void {
    this.info(`Agent: ${agentId} - ${taskType}`, { ...context, agentId, taskType });
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    const level = duration > 1000 ? "warn" : "info";
    this[level](`Performance: ${operation} completed in ${duration}ms`, { ...context, duration });
  }

  cache(operation: "hit" | "miss" | "set" | "delete", key: string, context?: LogContext): void {
    this.debug(`Cache ${operation}: ${key}`, {
      ...context,
      cacheOperation: operation,
      cacheKey: key,
    });
  }

  safety(event: string, riskScore: number, context?: LogContext): void {
    const level = riskScore > 70 ? "warn" : "info";
    this[level](`Safety: ${event}`, { ...context, riskScore, safetyEvent: event });
  }
}

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
 * Structured Logger Class - Build-safe implementation
 */
export class StructuredLogger {
  private readonly service: string;
  private readonly component: string;
  private readonly logLevel: LogLevel;

  constructor(service: string, component: string, logLevel: LogLevel = "info") {
    this.service = service;
    this.component = component;
    // Ensure we safely access process.env during build time
    const envLogLevel =
      typeof process !== "undefined" && process.env ? process.env.LOG_LEVEL : undefined;
    this.logLevel = this.parseLogLevel(envLogLevel || logLevel);
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
   * Emit log entry - Build-safe implementation
   */
  private emit(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    // Safely check environment during build time
    const isProduction =
      typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production";

    // Format for console output (development) or structured output (production)
    if (isProduction) {
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
 * Build-safe factory function that handles webpack bundling gracefully
 */
export function createSafeLogger(
  component: string,
  service: string = "mexc-trading-bot"
): StructuredLogger {
  // Validate inputs to ensure build-time safety
  if (typeof component !== "string" || !component) {
    component = "unknown";
  }
  if (typeof service !== "string" || !service) {
    service = "mexc-trading-bot";
  }

  // Always use the main StructuredLogger for consistency
  return new StructuredLogger(service, component);
}

/**
 * Fallback logger for build-time safety
 * Creates a logger-like object that uses console methods when StructuredLogger fails
 */
function createFallbackLogger(component: string, service: string): StructuredLogger {
  // Create a minimal logger-like object that mimics StructuredLogger interface
  const fallbackLogger = {
    debug: (message: string, context?: LogContext) =>
      console.debug(`[${component}] ${message}`, context || {}),
    info: (message: string, context?: LogContext) =>
      console.info(`[${component}] ${message}`, context || {}),
    warn: (message: string, context?: LogContext) =>
      console.warn(`[${component}] ${message}`, context || {}),
    error: (message: string, context?: LogContext, error?: Error) =>
      console.error(`[${component}] ${message}`, context || {}, error || ""),
    fatal: (message: string, context?: LogContext, error?: Error) =>
      console.error(`[${component}] FATAL: ${message}`, context || {}, error || ""),
    trading: (operation: string, context: LogContext) =>
      console.info(`[${component}] Trading: ${operation}`, context),
    pattern: (patternType: string, confidence: number, context?: LogContext) =>
      console.info(`[${component}] Pattern: ${patternType} (${confidence})`, context || {}),
    api: (endpoint: string, method: string, responseTime: number, context?: LogContext) =>
      console.info(`[${component}] API: ${method} ${endpoint} (${responseTime}ms)`, context || {}),
    agent: (agentId: string, taskType: string, context?: LogContext) =>
      console.info(`[${component}] Agent: ${agentId} - ${taskType}`, context || {}),
    performance: (operation: string, duration: number, context?: LogContext) =>
      console.info(`[${component}] Performance: ${operation} (${duration}ms)`, context || {}),
    cache: (operation: "hit" | "miss" | "set" | "delete", key: string, context?: LogContext) =>
      console.debug(`[${component}] Cache ${operation}: ${key}`, context || {}),
    safety: (event: string, riskScore: number, context?: LogContext) =>
      console.warn(`[${component}] Safety: ${event} (risk: ${riskScore})`, context || {}),
  };

  return fallbackLogger as StructuredLogger;
}

/**
 * Default logger instances for common components
 * Using lazy initialization to prevent circular dependencies during build
 */
export const logger = {
  // Core services
  get trading() {
    return createSafeLogger("trading");
  },
  get pattern() {
    return createSafeLogger("pattern-detection");
  },
  get safety() {
    return createSafeLogger("safety");
  },
  get api() {
    return createSafeLogger("api");
  },

  // Infrastructure
  get cache() {
    return createSafeLogger("cache");
  },
  get database() {
    return createSafeLogger("database");
  },
  get websocket() {
    return createSafeLogger("websocket");
  },

  // Agent system
  get agent() {
    return createSafeLogger("agent");
  },
  get coordination() {
    return createSafeLogger("coordination");
  },

  // Monitoring
  get monitoring() {
    return createSafeLogger("monitoring");
  },
  get performance() {
    return createSafeLogger("performance");
  },

  // General purpose
  get system() {
    return createSafeLogger("system");
  },
  get default() {
    return createSafeLogger("default");
  },
};

/**
 * Migration helper for console.log replacement
 */
export function replaceConsoleLog(component: string) {
  const componentLogger = createSafeLogger(component);

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
  const logger = createSafeLogger(component);
  return new PerformanceTimer(operation, logger);
}

// ===========================================
// Build-safe module exports
// ===========================================

// Keep only named exports to ensure webpack compatibility
// The individual exports above are already declared, so no re-exports needed
