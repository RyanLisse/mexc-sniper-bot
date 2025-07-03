/**
 * Environment-Aware Structured Logger for MEXC Trading Bot
 *
 * Provides different logger implementations for client vs server environments
 * Eliminates webpack bundling issues through environment detection
 * Zero client-side dependencies for Node.js modules
 */

// Environment detection utilities
const isServer = typeof window === "undefined";
const isBrowser = typeof window !== "undefined";
const isNode = typeof process !== "undefined" && process.versions?.node;

// Build-safe trace fallback - completely static, no dynamic imports
const _NOOP_TRACE = {
  getActiveSpan: () => null,
} as const;

/**
 * Client-safe logger for browser environments
 * Lightweight implementation with zero Node.js dependencies
 */
class ClientLogger implements ILogger {
  private component: string;
  private service: string;

  constructor(component: string, service: string = "mexc-trading-bot") {
    this.component = component || "unknown";
    this.service = service || "mexc-trading-bot";
  }

  private formatMessage(
    level: string,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr =
      context && Object.keys(context).length > 0
        ? ` ${JSON.stringify(context)}`
        : "";
    return `${timestamp} [${level.toUpperCase()}] ${this.component}: ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (isBrowser && console.debug) {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (isBrowser && console.info) {
      console.info(this.formatMessage("info", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (isBrowser && console.warn) {
      console.warn(this.formatMessage("warn", message, context));
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    const errorContext = {
      ...context,
      error: error?.message,
      stack: error?.stack,
    };
    if (isBrowser && console.error) {
      console.error(this.formatMessage("error", message, errorContext));
    }
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

  api(
    endpoint: string,
    method: string,
    responseTime: number,
    context?: LogContext
  ): void {
    this.info(`API call: ${method} ${endpoint}`, { ...context, responseTime });
  }

  agent(agentId: string, taskType: string, context?: LogContext): void {
    this.info(`Agent: ${agentId} - ${taskType}`, {
      ...context,
      agentId,
      taskType,
    });
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    const level = duration > 1000 ? "warn" : "info";
    this[level](`Performance: ${operation} completed in ${duration}ms`, {
      ...context,
      duration,
    });
  }

  cache(
    operation: "hit" | "miss" | "set" | "delete",
    key: string,
    context?: LogContext
  ): void {
    this.debug(`Cache ${operation}: ${key}`, {
      ...context,
      cacheOperation: operation,
      cacheKey: key,
    });
  }

  safety(event: string, riskScore: number, context?: LogContext): void {
    const level = riskScore > 70 ? "warn" : "info";
    this[level](`Safety: ${event}`, {
      ...context,
      riskScore,
      safetyEvent: event,
    });
  }
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

/**
 * Common logger interface for both client and server implementations
 */
export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext, error?: Error): void;
  fatal(message: string, context?: LogContext, error?: Error): void;
  trading(operation: string, context: LogContext): void;
  pattern(patternType: string, confidence: number, context?: LogContext): void;
  api(
    endpoint: string,
    method: string,
    responseTime: number,
    context?: LogContext
  ): void;
  agent(agentId: string, taskType: string, context?: LogContext): void;
  performance(operation: string, duration: number, context?: LogContext): void;
  cache(
    operation: "hit" | "miss" | "set" | "delete",
    key: string,
    context?: LogContext
  ): void;
  safety(event: string, riskScore: number, context?: LogContext): void;
}

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
 * Server-Side Structured Logger - Full-featured implementation for Node.js
 */
export class StructuredLogger implements ILogger {
  private readonly service: string;
  private readonly component: string;
  private readonly logLevel: LogLevel;

  constructor(service: string, component: string, logLevel: LogLevel = "info") {
    this.service = service;
    this.component = component;
    // Server-side environment variable access
    const envLogLevel =
      isServer && typeof process !== "undefined" && process.env
        ? process.env.LOG_LEVEL
        : undefined;
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
  private createLogEntry(
    level: LogLevel,
    message: string,
    context: LogContext = {}
  ): LogEntry {
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
   * Emit log entry - Server-side implementation with environment detection
   */
  private emit(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    // Server-side environment detection
    const isProduction =
      isServer &&
      typeof process !== "undefined" &&
      process.env &&
      process.env.NODE_ENV === "production";

    // Only emit on server-side to prevent client-side bundling issues
    if (!isServer) return;

    // Format for console output (development) or structured output (production)
    if (isProduction) {
      // JSON output for log aggregation systems
      console.log(JSON.stringify(entry));
    } else {
      // Human-readable format for development
      const timestamp = entry.timestamp;
      const contextStr =
        Object.keys(entry.context).length > 0
          ? JSON.stringify(entry.context, null, 2)
          : "";

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
  pattern(
    patternType: string,
    confidence: number,
    context: LogContext = {}
  ): void {
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
  api(
    endpoint: string,
    method: string,
    responseTime: number,
    context: LogContext = {}
  ): void {
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
  performance(
    operation: string,
    duration: number,
    context: LogContext = {}
  ): void {
    const level = duration > 1000 ? "warn" : "info"; // Warn for operations > 1s
    this.emit(
      this.createLogEntry(
        level,
        `Performance: ${operation} completed in ${duration}ms`,
        {
          ...context,
          operation: "performance",
          duration,
        }
      )
    );
  }

  /**
   * Log cache operations
   */
  cache(
    operation: "hit" | "miss" | "set" | "delete",
    key: string,
    context: LogContext = {}
  ): void {
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
 * Build-safe logger factory - Always returns simple console logger
 * Eliminates webpack bundling issues completely
 */
export function createSafeLogger(
  component: string,
  _service: string = "mexc-trading-bot"
): ILogger {
  // Validate inputs
  if (typeof component !== "string" || !component) {
    component = "unknown";
  }

  // Always return simple console logger to avoid any bundling issues
  return {
    debug: (message: string, context?: LogContext) =>
      console.debug(`[${component}]`, message, context || ""),
    info: (message: string, context?: LogContext) =>
      console.info(`[${component}]`, message, context || ""),
    warn: (message: string, context?: LogContext) =>
      console.warn(`[${component}]`, message, context || ""),
    error: (message: string, context?: LogContext, error?: Error) =>
      console.error(`[${component}]`, message, context || "", error || ""),
    fatal: (message: string, context?: LogContext, error?: Error) =>
      console.error(
        `[${component}] FATAL:`,
        message,
        context || "",
        error || ""
      ),
    trading: (operation: string, context: LogContext) =>
      console.info(`[${component}] Trading:`, operation, context),
    pattern: (patternType: string, confidence: number, context?: LogContext) =>
      console.info(
        `[${component}] Pattern:`,
        patternType,
        `confidence: ${confidence}`,
        context || ""
      ),
    api: (
      endpoint: string,
      method: string,
      responseTime: number,
      context?: LogContext
    ) =>
      console.info(
        `[${component}] API:`,
        method,
        endpoint,
        `${responseTime}ms`,
        context || ""
      ),
    agent: (agentId: string, taskType: string, context?: LogContext) =>
      console.info(`[${component}] Agent:`, agentId, taskType, context || ""),
    performance: (operation: string, duration: number, context?: LogContext) =>
      console.info(
        `[${component}] Performance:`,
        operation,
        `${duration}ms`,
        context || ""
      ),
    cache: (
      operation: "hit" | "miss" | "set" | "delete",
      key: string,
      context?: LogContext
    ) => console.debug(`[${component}] Cache:`, operation, key, context || ""),
    safety: (event: string, riskScore: number, context?: LogContext) =>
      console.warn(
        `[${component}] Safety:`,
        event,
        `risk: ${riskScore}`,
        context || ""
      ),
  } as ILogger;
}

/**
 * Server-only logger creation (for dependency injection)
 * Explicitly creates server-side logger regardless of environment
 */
export function createServerLogger(
  component: string,
  service: string = "mexc-trading-bot"
): StructuredLogger {
  return new StructuredLogger(service, component);
}

/**
 * Client-only logger creation (for dependency injection)
 * Explicitly creates client-side logger regardless of environment
 */
export function createClientLogger(
  component: string,
  service: string = "mexc-trading-bot"
): ClientLogger {
  return new ClientLogger(component, service);
}

/**
 * Fallback logger for build-time safety
 * Creates a logger-like object that uses console methods when StructuredLogger fails
 */
function _createFallbackLogger(
  component: string,
  _service: string
): StructuredLogger {
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
      console.error(
        `[${component}] FATAL: ${message}`,
        context || {},
        error || ""
      ),
    trading: (operation: string, context: LogContext) =>
      console.info(`[${component}] Trading: ${operation}`, context),
    pattern: (patternType: string, confidence: number, context?: LogContext) =>
      console.info(
        `[${component}] Pattern: ${patternType} (${confidence})`,
        context || {}
      ),
    api: (
      endpoint: string,
      method: string,
      responseTime: number,
      context?: LogContext
    ) =>
      console.info(
        `[${component}] API: ${method} ${endpoint} (${responseTime}ms)`,
        context || {}
      ),
    agent: (agentId: string, taskType: string, context?: LogContext) =>
      console.info(
        `[${component}] Agent: ${agentId} - ${taskType}`,
        context || {}
      ),
    performance: (operation: string, duration: number, context?: LogContext) =>
      console.info(
        `[${component}] Performance: ${operation} (${duration}ms)`,
        context || {}
      ),
    cache: (
      operation: "hit" | "miss" | "set" | "delete",
      key: string,
      context?: LogContext
    ) =>
      console.debug(`[${component}] Cache ${operation}: ${key}`, context || {}),
    safety: (event: string, riskScore: number, context?: LogContext) =>
      console.warn(
        `[${component}] Safety: ${event} (risk: ${riskScore})`,
        context || {}
      ),
  };

  return fallbackLogger as StructuredLogger;
}

/**
 * Environment-aware logger instances for common components
 * Using lazy initialization to prevent circular dependencies during build
 */
export const logger = {
  // Core services
  get trading() {
    return {
      info: (message: string, context?: any) =>
        console.info("[trading]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[trading]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[trading]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[trading]", message, context || ""),
    };
  },
  get pattern() {
    return {
      info: (message: string, context?: any) =>
        console.info("[pattern-detection]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[pattern-detection]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error(
          "[pattern-detection]",
          message,
          context || "",
          error || ""
        ),
      debug: (message: string, context?: any) =>
        console.debug("[pattern-detection]", message, context || ""),
    };
  },
  get safety() {
    return {
      info: (message: string, context?: any) =>
        console.info("[safety]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[safety]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[safety]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[safety]", message, context || ""),
    };
  },
  get api() {
    return {
      info: (message: string, context?: any) =>
        console.info("[api]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[api]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[api]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[api]", message, context || ""),
    };
  },

  // Infrastructure
  get cache() {
    return {
      info: (message: string, context?: any) =>
        console.info("[cache]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[cache]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[cache]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[cache]", message, context || ""),
    };
  },
  get database() {
    return {
      info: (message: string, context?: any) =>
        console.info("[database]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[database]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[database]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[database]", message, context || ""),
    };
  },
  get websocket() {
    return {
      info: (message: string, context?: any) =>
        console.info("[websocket]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[websocket]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[websocket]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[websocket]", message, context || ""),
    };
  },

  // Agent system
  get agent() {
    return {
      info: (message: string, context?: any) =>
        console.info("[agent]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[agent]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[agent]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[agent]", message, context || ""),
    };
  },
  get coordination() {
    return {
      info: (message: string, context?: any) =>
        console.info("[coordination]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[coordination]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[coordination]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[coordination]", message, context || ""),
    };
  },

  // Monitoring
  get monitoring() {
    return {
      info: (message: string, context?: any) =>
        console.info("[monitoring]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[monitoring]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[monitoring]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[monitoring]", message, context || ""),
    };
  },
  get performance() {
    return {
      info: (message: string, context?: any) =>
        console.info("[performance]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[performance]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[performance]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[performance]", message, context || ""),
    };
  },

  // General purpose
  get system() {
    return {
      info: (message: string, context?: any) =>
        console.info("[system]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[system]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[system]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[system]", message, context || ""),
    };
  },
  get default() {
    return {
      info: (message: string, context?: any) =>
        console.info("[default]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[default]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[default]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[default]", message, context || ""),
    };
  },
};

/**
 * Server-only logger instances (for explicit server-side usage)
 */
export const serverLogger = {
  get trading() {
    return createServerLogger("trading");
  },
  get pattern() {
    return createServerLogger("pattern-detection");
  },
  get safety() {
    return createServerLogger("safety");
  },
  get api() {
    return createServerLogger("api");
  },
  get cache() {
    return createServerLogger("cache");
  },
  get database() {
    return createServerLogger("database");
  },
  get websocket() {
    return createServerLogger("websocket");
  },
  get agent() {
    return createServerLogger("agent");
  },
  get coordination() {
    return createServerLogger("coordination");
  },
  get monitoring() {
    return createServerLogger("monitoring");
  },
  get performance() {
    return createServerLogger("performance");
  },
  get system() {
    return createServerLogger("system");
  },
  get default() {
    return createServerLogger("default");
  },
};

/**
 * Migration helper for console.log replacement
 */
export function replaceConsoleLog(component: string) {
  const componentLogger = createSafeLogger(component);

  return {
    log: (message: string, context?: LogContext) =>
      componentLogger.info(message, context),
    info: (message: string, context?: LogContext) =>
      componentLogger.info(message, context),
    warn: (message: string, context?: LogContext) =>
      componentLogger.warn(message, context),
    error: (message: string, context?: LogContext, error?: Error) =>
      componentLogger.error(message, context, error),
    debug: (message: string, context?: LogContext) =>
      componentLogger.debug(message, context),
  };
}

/**
 * Performance timing utility
 */
export class PerformanceTimer {
  private startTime: number;
  private operation: string;
  private logger: ILogger;

  constructor(operation: string, logger: ILogger) {
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
export function createTimer(
  operation: string,
  component: string
): PerformanceTimer {
  const logger = createSafeLogger(component);
  return new PerformanceTimer(operation, logger);
}

// ===========================================
// Environment-aware module exports
// ===========================================

// Type exports for dependency injection
export type LoggerInstance = ILogger;
export type ServerLoggerInstance = StructuredLogger;
export type ClientLoggerInstance = ClientLogger;

// Re-export key interfaces and types
export { ClientLogger };

// Environment detection exports (for testing and debugging)
export const loggerEnvironment = {
  isServer,
  isBrowser,
  isNode,
};
