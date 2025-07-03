/**
 * Build-Safe Logger
 *
 * A completely standalone logger that doesn't rely on any imports
 * and can be safely bundled by webpack without circular dependencies
 */

export type BuildSafeLogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface BuildSafeLogContext {
  [key: string]: unknown;
}

/**
 * Build-safe logger that always works during webpack bundling
 */
export class BuildSafeLogger {
  private component: string;
  private service: string;

  constructor(component: string, service: string = "mexc-trading-bot") {
    this.component = component || "unknown";
    this.service = service || "mexc-trading-bot";
  }

  private formatMessage(
    level: string,
    message: string,
    context?: BuildSafeLogContext
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr =
      context && Object.keys(context).length > 0
        ? ` ${JSON.stringify(context)}`
        : "";
    return `${timestamp} [${level.toUpperCase()}] ${this.component}: ${message}${contextStr}`;
  }

  debug(message: string, context?: BuildSafeLogContext): void {
    console.debug(this.formatMessage("debug", message, context));
  }

  info(message: string, context?: BuildSafeLogContext): void {
    console.info(this.formatMessage("info", message, context));
  }

  warn(message: string, context?: BuildSafeLogContext): void {
    console.warn(this.formatMessage("warn", message, context));
  }

  error(message: string, context?: BuildSafeLogContext, error?: Error): void {
    const errorContext = {
      ...context,
      error: error?.message,
      stack: error?.stack,
    };
    console.error(this.formatMessage("error", message, errorContext));
  }

  fatal(message: string, context?: BuildSafeLogContext, error?: Error): void {
    this.error(`FATAL: ${message}`, context, error);
  }

  // Compatibility methods for existing code
  trading(operation: string, context: BuildSafeLogContext): void {
    this.info(`Trading: ${operation}`, context);
  }

  pattern(
    patternType: string,
    confidence: number,
    context?: BuildSafeLogContext
  ): void {
    this.info(`Pattern detected: ${patternType}`, { ...context, confidence });
  }

  api(
    endpoint: string,
    method: string,
    responseTime: number,
    context?: BuildSafeLogContext
  ): void {
    this.info(`API call: ${method} ${endpoint}`, { ...context, responseTime });
  }

  agent(
    agentId: string,
    taskType: string,
    context?: BuildSafeLogContext
  ): void {
    this.info(`Agent: ${agentId} - ${taskType}`, {
      ...context,
      agentId,
      taskType,
    });
  }

  performance(
    operation: string,
    duration: number,
    context?: BuildSafeLogContext
  ): void {
    const level = duration > 1000 ? "warn" : "info";
    this[level](`Performance: ${operation} completed in ${duration}ms`, {
      ...context,
      duration,
    });
  }

  cache(
    operation: "hit" | "miss" | "set" | "delete",
    key: string,
    context?: BuildSafeLogContext
  ): void {
    this.debug(`Cache ${operation}: ${key}`, {
      ...context,
      cacheOperation: operation,
      cacheKey: key,
    });
  }

  safety(
    event: string,
    riskScore: number,
    context?: BuildSafeLogContext
  ): void {
    const level = riskScore > 70 ? "warn" : "info";
    this[level](`Safety: ${event}`, {
      ...context,
      riskScore,
      safetyEvent: event,
    });
  }
}

/**
 * Build-safe logger factory
 * Creates loggers that work during webpack bundling without import issues
 */
export function createBuildSafeLogger(
  component: string,
  service?: string
): BuildSafeLogger {
  return new BuildSafeLogger(component, service);
}

/**
 * Default export for compatibility
 */
export default createBuildSafeLogger;
