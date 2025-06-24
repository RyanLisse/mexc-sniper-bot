/**
 * Simple Logger Dependency Injection Utilities
 *
 * Provides basic console-based logging without complex dependencies
 */

interface SimpleLogger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, context?: any, error?: Error): void;
  fatal(message: string, context?: any, error?: Error): void;
}

function createSimpleLogger(component: string): SimpleLogger {
  return {
    debug: (message: string, context?: any) =>
      console.debug(`[${component}]`, message, context || ""),
    info: (message: string, context?: any) =>
      console.info(`[${component}]`, message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn(`[${component}]`, message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(`[${component}]`, message, context || "", error || ""),
    fatal: (message: string, context?: any, error?: Error) =>
      console.error(`[${component}] FATAL:`, message, context || "", error || ""),
  };
}

/**
 * Logger injection interface for services
 */
export interface LoggerInjectable {
  setLogger(logger: SimpleLogger): void;
  getLogger(): SimpleLogger;
}

/**
 * Base class for services with logger injection support
 */
export abstract class BaseService implements LoggerInjectable {
  protected logger: SimpleLogger;

  constructor(componentName: string, logger?: SimpleLogger) {
    this.logger = logger || createSimpleLogger(componentName);
  }

  setLogger(logger: SimpleLogger): void {
    this.logger = logger;
  }

  getLogger(): SimpleLogger {
    return this.logger;
  }
}

/**
 * Logger factory for dependency injection
 */
export class LoggerFactory {
  private static instance: LoggerFactory;

  static getInstance(): LoggerFactory {
    if (!LoggerFactory.instance) {
      LoggerFactory.instance = new LoggerFactory();
    }
    return LoggerFactory.instance;
  }

  /**
   * Create logger for service dependency injection
   */
  createLogger(componentName: string): SimpleLogger {
    return createSimpleLogger(componentName);
  }

  /**
   * Create logger with service name derived from class name
   */
  createLoggerForClass(serviceClass: any): SimpleLogger {
    const componentName = serviceClass.constructor?.name || serviceClass.name || "unknown-service";
    const kebabCaseName = componentName
      .replace(/([A-Z])/g, "-$1")
      .toLowerCase()
      .replace(/^-/, "");

    return this.createLogger(kebabCaseName);
  }
}

/**
 * Dependency injection container for loggers
 */
export class LoggerContainer {
  private static loggers = new Map<string, SimpleLogger>();

  /**
   * Register a logger instance
   */
  static register(key: string, logger: SimpleLogger): void {
    LoggerContainer.loggers.set(key, logger);
  }

  /**
   * Get a registered logger instance
   */
  static get(key: string): SimpleLogger | undefined {
    return LoggerContainer.loggers.get(key);
  }

  /**
   * Get or create logger for component
   */
  static getOrCreate(componentName: string): SimpleLogger {
    const existing = LoggerContainer.get(componentName);
    if (existing) {
      return existing;
    }

    const logger = LoggerFactory.getInstance().createLogger(componentName);
    LoggerContainer.register(componentName, logger);
    return logger;
  }

  /**
   * Clear all registered loggers
   */
  static clear(): void {
    LoggerContainer.loggers.clear();
  }
}

/**
 * Decorator for automatic logger injection
 */
export function InjectLogger(componentName?: string) {
  return <T extends { new (...args: any[]): {} }>(constructor: T) => {
    const name =
      componentName ||
      constructor.name
        .replace(/([A-Z])/g, "-$1")
        .toLowerCase()
        .replace(/^-/, "");

    return class extends constructor {
      protected logger: SimpleLogger;

      constructor(...args: any[]) {
        super(...args);
        this.logger = LoggerContainer.getOrCreate(name);
      }
    };
  };
}

/**
 * Utility function to inject logger into existing service instances
 */
export function injectLogger(service: any, componentName: string): void {
  if (service && typeof service.setLogger === "function") {
    const logger = LoggerContainer.getOrCreate(componentName);
    service.setLogger(logger);
  }
}

/**
 * Create service with logger injection
 */
export function createServiceWithLogger<T>(
  ServiceClass: new (...args: any[]) => T,
  componentName: string,
  ...args: any[]
): T {
  const logger = LoggerContainer.getOrCreate(componentName);

  // If service supports logger injection, pass it in constructor
  if (ServiceClass.prototype.setLogger) {
    const service = new ServiceClass(...args);
    (service as any).setLogger(logger);
    return service;
  }

  // Otherwise try to pass as first argument
  return new ServiceClass(logger, ...args);
}
