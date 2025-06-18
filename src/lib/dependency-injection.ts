/**
 * Simple Dependency Injection Container
 * Provides loose coupling between services and improved testability
 */

export type ServiceIdentifier<T = unknown> = string | symbol | { new (...args: unknown[]): T };
export type Factory<T = unknown> = () => T | Promise<T>;
export type Constructor<T = unknown> = new (...args: unknown[]) => T;

export enum ServiceLifetime {
  SINGLETON = "singleton",
  TRANSIENT = "transient",
  SCOPED = "scoped",
}

export interface ServiceRegistration<T = unknown> {
  identifier: ServiceIdentifier<T>;
  factory: Factory<T>;
  lifetime: ServiceLifetime;
  instance?: T;
  dependencies?: ServiceIdentifier[];
}

export interface DIContainerOptions {
  enableCircularDependencyDetection?: boolean;
  maxResolutionDepth?: number;
}

/**
 * Dependency Injection Container with lifecycle management
 */
export class DIContainer {
  private services = new Map<ServiceIdentifier, ServiceRegistration>();
  private resolutionStack: ServiceIdentifier[] = [];
  private scopes = new Map<string, Map<ServiceIdentifier, unknown>>();
  private readonly options: Required<DIContainerOptions>;

  constructor(options: DIContainerOptions = {}) {
    this.options = {
      enableCircularDependencyDetection: options.enableCircularDependencyDetection ?? true,
      maxResolutionDepth: options.maxResolutionDepth ?? 50,
    };
  }

  /**
   * Register a service with the container
   */
  register<T>(
    identifier: ServiceIdentifier<T>,
    factory: Factory<T>,
    lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
    dependencies: ServiceIdentifier[] = []
  ): this {
    this.services.set(identifier, {
      identifier,
      factory,
      lifetime,
      dependencies,
    });
    return this;
  }

  /**
   * Register a singleton service
   */
  registerSingleton<T>(
    identifier: ServiceIdentifier<T>,
    factory: Factory<T>,
    dependencies: ServiceIdentifier[] = []
  ): this {
    return this.register(identifier, factory, ServiceLifetime.SINGLETON, dependencies);
  }

  /**
   * Register a transient service
   */
  registerTransient<T>(
    identifier: ServiceIdentifier<T>,
    factory: Factory<T>,
    dependencies: ServiceIdentifier[] = []
  ): this {
    return this.register(identifier, factory, ServiceLifetime.TRANSIENT, dependencies);
  }

  /**
   * Register a scoped service
   */
  registerScoped<T>(
    identifier: ServiceIdentifier<T>,
    factory: Factory<T>,
    dependencies: ServiceIdentifier[] = []
  ): this {
    return this.register(identifier, factory, ServiceLifetime.SCOPED, dependencies);
  }

  /**
   * Register a class constructor
   */
  registerClass<T>(
    constructor: Constructor<T>,
    lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
    dependencies: ServiceIdentifier[] = []
  ): this {
    return this.register(
      constructor,
      () => new constructor(...dependencies.map((dep) => this.resolve(dep))),
      lifetime,
      dependencies
    );
  }

  /**
   * Register an instance directly
   */
  registerInstance<T>(identifier: ServiceIdentifier<T>, instance: T): this {
    const registration: ServiceRegistration<T> = {
      identifier,
      factory: () => instance,
      lifetime: ServiceLifetime.SINGLETON,
      instance,
    };
    this.services.set(identifier, registration);
    return this;
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(identifier: ServiceIdentifier<T>, scopeId?: string): T {
    if (this.options.enableCircularDependencyDetection) {
      if (this.resolutionStack.includes(identifier)) {
        throw new Error(
          `Circular dependency detected: ${this.resolutionStack
            .concat(identifier)
            .map(String)
            .join(" -> ")}`
        );
      }

      if (this.resolutionStack.length >= this.options.maxResolutionDepth) {
        throw new Error(
          `Maximum resolution depth exceeded (${this.options.maxResolutionDepth}). Possible circular dependency.`
        );
      }
    }

    const registration = this.services.get(identifier);
    if (!registration) {
      throw new Error(`Service not registered: ${String(identifier)}`);
    }

    this.resolutionStack.push(identifier);

    try {
      return this.createInstance(registration, scopeId);
    } finally {
      this.resolutionStack.pop();
    }
  }

  /**
   * Create service instance based on lifetime
   */
  private createInstance<T>(registration: ServiceRegistration<T>, scopeId?: string): T {
    switch (registration.lifetime) {
      case ServiceLifetime.SINGLETON:
        if (!registration.instance) {
          registration.instance = registration.factory();
        }
        return registration.instance as T;

      case ServiceLifetime.SCOPED:
        if (!scopeId) {
          throw new Error(`Scope ID required for scoped service: ${String(registration.identifier)}`);
        }
        return this.getScopedInstance(registration, scopeId);

      case ServiceLifetime.TRANSIENT:
        return registration.factory() as T;

      default:
        throw new Error(`Unknown service lifetime: ${registration.lifetime}`);
    }
  }

  /**
   * Get or create scoped instance
   */
  private getScopedInstance<T>(registration: ServiceRegistration<T>, scopeId: string): T {
    let scope = this.scopes.get(scopeId);
    if (!scope) {
      scope = new Map();
      this.scopes.set(scopeId, scope);
    }

    const existingInstance = scope.get(registration.identifier);
    if (existingInstance) {
      return existingInstance as T;
    }

    const newInstance = registration.factory();
    scope.set(registration.identifier, newInstance);
    return newInstance as T;
  }

  /**
   * Check if a service is registered
   */
  isRegistered<T>(identifier: ServiceIdentifier<T>): boolean {
    return this.services.has(identifier);
  }

  /**
   * Create a new scope
   */
  createScope(scopeId: string): DIScope {
    return new DIScope(this, scopeId);
  }

  /**
   * Dispose of a scope and all its instances
   */
  disposeScope(scopeId: string): void {
    const scope = this.scopes.get(scopeId);
    if (scope) {
      // Call dispose on any disposable instances
      for (const instance of scope.values()) {
        if (instance && typeof instance === "object" && "dispose" in instance) {
          try {
            (instance as { dispose(): void }).dispose();
          } catch (error) {
            console.warn("Error disposing service instance:", error);
          }
        }
      }
      this.scopes.delete(scopeId);
    }
  }

  /**
   * Get all registered service identifiers
   */
  getRegisteredServices(): ServiceIdentifier[] {
    return Array.from(this.services.keys());
  }

  /**
   * Clear all registrations and instances
   */
  clear(): void {
    // Dispose all scopes
    for (const scopeId of this.scopes.keys()) {
      this.disposeScope(scopeId);
    }

    // Dispose singleton instances
    for (const registration of this.services.values()) {
      if (registration.instance && typeof registration.instance === "object" && "dispose" in registration.instance) {
        try {
          (registration.instance as { dispose(): void }).dispose();
        } catch (error) {
          console.warn("Error disposing singleton instance:", error);
        }
      }
    }

    this.services.clear();
    this.scopes.clear();
    this.resolutionStack.length = 0;
  }

  /**
   * Create a child container that inherits parent registrations
   */
  createChild(): DIContainer {
    const child = new DIContainer(this.options);
    
    // Copy parent registrations (not instances)
    for (const [identifier, registration] of this.services.entries()) {
      child.services.set(identifier, {
        ...registration,
        instance: undefined, // Child containers get fresh instances
      });
    }
    
    return child;
  }
}

/**
 * Scoped DI container for request-scoped services
 */
export class DIScope {
  constructor(
    private container: DIContainer,
    private scopeId: string
  ) {}

  resolve<T>(identifier: ServiceIdentifier<T>): T {
    return this.container.resolve(identifier, this.scopeId);
  }

  dispose(): void {
    this.container.disposeScope(this.scopeId);
  }
}

/**
 * Service identifiers (symbols) for type safety
 */
export const ServiceIdentifiers = {
  // Agent services
  MEXC_API_AGENT: Symbol("MexcApiAgent"),
  PATTERN_DISCOVERY_AGENT: Symbol("PatternDiscoveryAgent"),
  CALENDAR_AGENT: Symbol("CalendarAgent"),
  SYMBOL_ANALYSIS_AGENT: Symbol("SymbolAnalysisAgent"),
  STRATEGY_AGENT: Symbol("StrategyAgent"),
  
  // Trading services
  MEXC_SERVICE: Symbol("MexcService"),
  TRADING_STRATEGY_MANAGER: Symbol("TradingStrategyManager"),
  MULTI_PHASE_EXECUTOR: Symbol("MultiPhaseExecutor"),
  
  // Data services
  DATA_FETCHER: Symbol("DataFetcher"),
  WEBSOCKET_CLIENT: Symbol("WebSocketClient"),
  
  // Infrastructure services
  ERROR_HANDLER: Symbol("ErrorHandler"),
  CACHE_MANAGER: Symbol("CacheManager"),
  METRICS_MANAGER: Symbol("MetricsManager"),
  
  // Database services
  DATABASE_CONNECTION: Symbol("DatabaseConnection"),
  USER_CREDENTIALS_SERVICE: Symbol("UserCredentialsService"),
  
  // Coordination services
  AGENT_REGISTRY: Symbol("AgentRegistry"),
  WORKFLOW_ENGINE: Symbol("WorkflowEngine"),
  PERFORMANCE_COLLECTOR: Symbol("PerformanceCollector"),
  ORCHESTRATOR: Symbol("Orchestrator"),
} as const;

/**
 * Global DI container instance
 */
export const globalContainer = new DIContainer({
  enableCircularDependencyDetection: true,
  maxResolutionDepth: 50,
});

/**
 * Decorator for automatic dependency injection (if using TypeScript decorators)
 */
export function Injectable<T extends Constructor>(dependencies: ServiceIdentifier[] = []) {
  return function (target: T): T {
    // Store dependency metadata
    (target as unknown as { __dependencies: ServiceIdentifier[] }).__dependencies = dependencies;
    return target;
  };
}

/**
 * Helper function to register a service with automatic dependency resolution
 */
export function registerService<T>(
  container: DIContainer,
  constructor: Constructor<T>,
  identifier?: ServiceIdentifier<T>,
  lifetime: ServiceLifetime = ServiceLifetime.SINGLETON
): void {
  const serviceId = identifier || constructor;
  const dependencies = (constructor as unknown as { __dependencies?: ServiceIdentifier[] }).__dependencies || [];
  
  container.registerClass(serviceId, lifetime, dependencies);
}

/**
 * Configuration helper for setting up common services
 */
export function configureServices(container: DIContainer = globalContainer): DIContainer {
  // This would be called during application startup to register all services
  // For now, just return the container
  return container;
}