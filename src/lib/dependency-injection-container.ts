/**
 * Dependency Injection Container
 *
 * Provides a comprehensive dependency injection system that eliminates tight coupling
 * and improves testability by managing service lifecycles and dependencies.
 *
 * ELIMINATES ARCHITECTURAL ISSUES:
 * - Tight coupling between services (24 files importing ../services/)
 * - Mixed service instantiation patterns
 * - Difficult unit testing due to hard dependencies
 * - Circular dependency issues
 * - No centralized service lifecycle management
 *
 * PROVIDES:
 * - Centralized service registration and resolution
 * - Automatic dependency injection
 * - Service lifecycle management (singleton, transient, scoped)
 * - Interface-based service contracts
 * - Easy mocking for testing
 * - Circular dependency detection
 */

import { EventEmitter } from "events";
import type { BaseService, ServiceDependencies } from "./service-layer-architecture";

// ============================================================================
// Container Types and Interfaces
// ============================================================================

export type ServiceLifetime = "singleton" | "transient" | "scoped";

export interface ServiceDescriptor<T = any> {
  name: string;
  implementation: ServiceConstructor<T>;
  lifetime: ServiceLifetime;
  dependencies: string[];
  interfaces?: string[];
  factory?: ServiceFactory<T>;
}

export interface ServiceConstructor<T = any> {
  new (dependencies: ServiceDependencies): T;
}

export type ServiceFactory<T = any> = (container: DependencyContainer) => T;

export interface ServiceScope {
  id: string;
  services: Map<string, any>;
  disposed: boolean;
}

export interface ContainerConfiguration {
  enableCircularDependencyDetection: boolean;
  enableLifecycleLogging: boolean;
  enablePerformanceTracking: boolean;
  maxDependencyDepth: number;
  scopeTimeout: number;
}

// ============================================================================
// Dependency Container Implementation
// ============================================================================

/**
 * Advanced Dependency Injection Container
 * Manages service registration, resolution, and lifecycle
 */
export class DependencyContainer extends EventEmitter {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[dependency-injection-container]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[dependency-injection-container]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[dependency-injection-container]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[dependency-injection-container]", message, context || ""),
  };

  private services = new Map<string, ServiceDescriptor>();
  private singletonInstances = new Map<string, any>();
  private scopes = new Map<string, ServiceScope>();
  private resolutionStack: string[] = [];
  private configuration: ContainerConfiguration;

  constructor(config?: Partial<ContainerConfiguration>) {
    super();
    this.configuration = {
      enableCircularDependencyDetection: true,
      enableLifecycleLogging: false,
      enablePerformanceTracking: false,
      maxDependencyDepth: 10,
      scopeTimeout: 300000, // 5 minutes
      ...config,
    };
  }

  // ============================================================================
  // Service Registration
  // ============================================================================

  /**
   * Register a service with the container
   */
  register<T>(descriptor: ServiceDescriptor<T>): this {
    if (this.services.has(descriptor.name)) {
      throw new Error(`Service '${descriptor.name}' is already registered`);
    }

    this.services.set(descriptor.name, descriptor);

    if (this.configuration.enableLifecycleLogging) {
      console.info(`📝 Registered service: ${descriptor.name} (${descriptor.lifetime})`);
    }

    this.emit("serviceRegistered", descriptor);
    return this;
  }

  /**
   * Register a singleton service
   */
  registerSingleton<T>(
    name: string,
    implementation: ServiceConstructor<T> | ServiceFactory<T>,
    dependencies: string[] = [],
    interfaces: string[] = []
  ): this {
    return this.register({
      name,
      implementation: implementation as ServiceConstructor<T>,
      factory:
        typeof implementation === "function" && implementation.length === 1
          ? (implementation as ServiceFactory<T>)
          : undefined,
      lifetime: "singleton",
      dependencies,
      interfaces,
    });
  }

  /**
   * Register a transient service
   */
  registerTransient<T>(
    name: string,
    implementation: ServiceConstructor<T> | ServiceFactory<T>,
    dependencies: string[] = [],
    interfaces: string[] = []
  ): this {
    return this.register({
      name,
      implementation: implementation as ServiceConstructor<T>,
      factory:
        typeof implementation === "function" && implementation.length === 1
          ? (implementation as ServiceFactory<T>)
          : undefined,
      lifetime: "transient",
      dependencies,
      interfaces,
    });
  }

  /**
   * Register a scoped service
   */
  registerScoped<T>(
    name: string,
    implementation: ServiceConstructor<T> | ServiceFactory<T>,
    dependencies: string[] = [],
    interfaces: string[] = []
  ): this {
    return this.register({
      name,
      implementation: implementation as ServiceConstructor<T>,
      factory:
        typeof implementation === "function" && implementation.length === 1
          ? (implementation as ServiceFactory<T>)
          : undefined,
      lifetime: "scoped",
      dependencies,
      interfaces,
    });
  }

  /**
   * Register an instance as a singleton
   */
  registerInstance<T>(name: string, instance: T, interfaces: string[] = []): this {
    this.singletonInstances.set(name, instance);
    this.services.set(name, {
      name,
      implementation: class {} as any,
      lifetime: "singleton",
      dependencies: [],
      interfaces,
    });
    return this;
  }

  // ============================================================================
  // Service Resolution
  // ============================================================================

  /**
   * Resolve a service by name
   */
  resolve<T>(name: string, scopeId?: string): T {
    const startTime = this.configuration.enablePerformanceTracking ? Date.now() : 0;

    try {
      const instance = this.internalResolve<T>(name, scopeId);

      if (this.configuration.enablePerformanceTracking) {
        const duration = Date.now() - startTime;
        console.info(`⚡ Resolved '${name}' in ${duration}ms`);
      }

      return instance;
    } catch (error) {
      if (this.configuration.enableLifecycleLogging) {
        console.error(`❌ Failed to resolve service '${name}':`, error);
      }
      throw error;
    } finally {
      this.resolutionStack = [];
    }
  }

  /**
   * Resolve a service by interface
   */
  resolveByInterface<T>(interfaceName: string, scopeId?: string): T {
    const serviceDescriptor = Array.from(this.services.values()).find((descriptor) =>
      descriptor.interfaces?.includes(interfaceName)
    );

    if (!serviceDescriptor) {
      throw new Error(`No service implements interface '${interfaceName}'`);
    }

    return this.resolve<T>(serviceDescriptor.name, scopeId);
  }

  /**
   * Resolve all services implementing an interface
   */
  resolveAll<T>(interfaceName: string, scopeId?: string): T[] {
    const serviceDescriptors = Array.from(this.services.values()).filter((descriptor) =>
      descriptor.interfaces?.includes(interfaceName)
    );

    return serviceDescriptors.map((descriptor) => this.resolve<T>(descriptor.name, scopeId));
  }

  /**
   * Check if a service is registered
   */
  isRegistered(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Internal service resolution with circular dependency detection
   */
  private internalResolve<T>(name: string, scopeId?: string): T {
    // Check for circular dependencies
    if (this.configuration.enableCircularDependencyDetection) {
      if (this.resolutionStack.includes(name)) {
        const cycle = [...this.resolutionStack, name].join(" -> ");
        throw new Error(`Circular dependency detected: ${cycle}`);
      }

      if (this.resolutionStack.length >= this.configuration.maxDependencyDepth) {
        throw new Error(
          `Maximum dependency depth exceeded (${this.configuration.maxDependencyDepth})`
        );
      }
    }

    this.resolutionStack.push(name);

    const descriptor = this.services.get(name);
    if (!descriptor) {
      throw new Error(`Service '${name}' is not registered`);
    }

    try {
      switch (descriptor.lifetime) {
        case "singleton":
          return this.resolveSingleton<T>(descriptor);
        case "transient":
          return this.resolveTransient<T>(descriptor);
        case "scoped":
          return this.resolveScoped<T>(descriptor, scopeId);
        default:
          throw new Error(`Unknown service lifetime: ${descriptor.lifetime}`);
      }
    } finally {
      this.resolutionStack.pop();
    }
  }

  /**
   * Resolve singleton service
   */
  private resolveSingleton<T>(descriptor: ServiceDescriptor): T {
    if (this.singletonInstances.has(descriptor.name)) {
      return this.singletonInstances.get(descriptor.name);
    }

    const instance = this.createInstance<T>(descriptor);
    this.singletonInstances.set(descriptor.name, instance);

    if (this.configuration.enableLifecycleLogging) {
      console.info(`🏗️ Created singleton: ${descriptor.name}`);
    }

    this.emit("singletonCreated", descriptor.name, instance);
    return instance;
  }

  /**
   * Resolve transient service
   */
  private resolveTransient<T>(descriptor: ServiceDescriptor): T {
    const instance = this.createInstance<T>(descriptor);

    if (this.configuration.enableLifecycleLogging) {
      console.info(`🔄 Created transient: ${descriptor.name}`);
    }

    this.emit("transientCreated", descriptor.name, instance);
    return instance;
  }

  /**
   * Resolve scoped service
   */
  private resolveScoped<T>(descriptor: ServiceDescriptor, scopeId?: string): T {
    if (!scopeId) {
      throw new Error(`Scope ID is required for scoped service '${descriptor.name}'`);
    }

    let scope = this.scopes.get(scopeId);
    if (!scope) {
      scope = this.createScope(scopeId);
    }

    if (scope.services.has(descriptor.name)) {
      return scope.services.get(descriptor.name);
    }

    const instance = this.createInstance<T>(descriptor);
    scope.services.set(descriptor.name, instance);

    if (this.configuration.enableLifecycleLogging) {
      console.info(`🎯 Created scoped: ${descriptor.name} (scope: ${scopeId})`);
    }

    this.emit("scopedCreated", descriptor.name, instance, scopeId);
    return instance;
  }

  /**
   * Create service instance with dependency injection
   */
  private createInstance<T>(descriptor: ServiceDescriptor): T {
    // Resolve dependencies
    const dependencies: ServiceDependencies = {};
    for (const depName of descriptor.dependencies) {
      dependencies[depName] = this.internalResolve(depName);
    }

    // Create instance using factory or constructor
    if (descriptor.factory) {
      return descriptor.factory(this);
    }
    return new descriptor.implementation(dependencies);
  }

  // ============================================================================
  // Scope Management
  // ============================================================================

  /**
   * Create a new scope
   */
  createScope(scopeId: string): ServiceScope {
    if (this.scopes.has(scopeId)) {
      throw new Error(`Scope '${scopeId}' already exists`);
    }

    const scope: ServiceScope = {
      id: scopeId,
      services: new Map(),
      disposed: false,
    };

    this.scopes.set(scopeId, scope);

    // Auto-dispose scope after timeout
    setTimeout(() => {
      this.disposeScope(scopeId);
    }, this.configuration.scopeTimeout);

    if (this.configuration.enableLifecycleLogging) {
      console.info(`📦 Created scope: ${scopeId}`);
    }

    this.emit("scopeCreated", scopeId);
    return scope;
  }

  /**
   * Dispose a scope and its services
   */
  disposeScope(scopeId: string): void {
    const scope = this.scopes.get(scopeId);
    if (!scope || scope.disposed) {
      return;
    }

    // Dispose all scoped services
    for (const [serviceName, service] of scope.services) {
      if (service && typeof service.cleanup === "function") {
        try {
          service.cleanup();
        } catch (error) {
          console.error(`Error disposing service '${serviceName}' in scope '${scopeId}':`, error);
        }
      }
    }

    scope.disposed = true;
    scope.services.clear();
    this.scopes.delete(scopeId);

    if (this.configuration.enableLifecycleLogging) {
      console.info(`🗑️ Disposed scope: ${scopeId}`);
    }

    this.emit("scopeDisposed", scopeId);
  }

  // ============================================================================
  // Container Management
  // ============================================================================

  /**
   * Initialize all singleton services
   */
  async initializeAll(): Promise<void> {
    const singletonDescriptors = Array.from(this.services.values()).filter(
      (descriptor) => descriptor.lifetime === "singleton"
    );

    for (const descriptor of singletonDescriptors) {
      try {
        const instance = this.resolve(descriptor.name);

        if (instance && typeof (instance as any).initialize === "function") {
          await (instance as any).initialize();
        }

        if (this.configuration.enableLifecycleLogging) {
          console.info(`✅ Initialized: ${descriptor.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize '${descriptor.name}':`, error);
        throw error;
      }
    }

    this.emit("containerInitialized");
  }

  /**
   * Get container health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    services: Array<{ name: string; healthy: boolean; error?: string }>;
  }> {
    const serviceStatuses: Array<{ name: string; healthy: boolean; error?: string }> = [];
    let allHealthy = true;

    for (const [name, instance] of this.singletonInstances) {
      try {
        if (instance && typeof instance.isHealthy === "function") {
          const healthy = await instance.isHealthy();
          serviceStatuses.push({ name, healthy });
          if (!healthy) allHealthy = false;
        } else {
          serviceStatuses.push({ name, healthy: true });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        serviceStatuses.push({ name, healthy: false, error: errorMessage });
        allHealthy = false;
      }
    }

    return { healthy: allHealthy, services: serviceStatuses };
  }

  /**
   * Dispose the container and all services
   */
  async dispose(): Promise<void> {
    // Dispose all scopes
    for (const scopeId of this.scopes.keys()) {
      this.disposeScope(scopeId);
    }

    // Dispose singleton services
    for (const [name, instance] of this.singletonInstances) {
      if (instance && typeof instance.cleanup === "function") {
        try {
          await instance.cleanup();
          if (this.configuration.enableLifecycleLogging) {
            console.info(`🧹 Cleaned up: ${name}`);
          }
        } catch (error) {
          console.error(`Error cleaning up service '${name}':`, error);
        }
      }
    }

    this.singletonInstances.clear();
    this.services.clear();
    this.removeAllListeners();

    this.emit("containerDisposed");
  }

  /**
   * Get container statistics
   */
  getStatistics(): {
    registeredServices: number;
    singletonInstances: number;
    activeScopes: number;
    totalScopedServices: number;
  } {
    let totalScopedServices = 0;
    for (const scope of this.scopes.values()) {
      totalScopedServices += scope.services.size;
    }

    return {
      registeredServices: this.services.size,
      singletonInstances: this.singletonInstances.size,
      activeScopes: this.scopes.size,
      totalScopedServices,
    };
  }

  /**
   * Get dependency graph for debugging
   */
  getDependencyGraph(): {
    nodes: Array<{ id: string; lifetime: ServiceLifetime }>;
    edges: Array<{ from: string; to: string }>;
  } {
    const nodes: Array<{ id: string; lifetime: ServiceLifetime }> = [];
    const edges: Array<{ from: string; to: string }> = [];

    for (const descriptor of this.services.values()) {
      nodes.push({ id: descriptor.name, lifetime: descriptor.lifetime });

      for (const dependency of descriptor.dependencies) {
        edges.push({ from: descriptor.name, to: dependency });
      }
    }

    return { nodes, edges };
  }
}

// ============================================================================
// Service Module Registration Helpers
// ============================================================================

/**
 * Register trading services module
 */
export function registerTradingServices(container: DependencyContainer): void {
  // Register all trading-related services with their dependencies
  container.registerSingleton(
    "OrderExecutionService",
    class MockOrderExecutionService {
      async initialize() {
        /* implementation */
      }
      async isHealthy() {
        return true;
      }
      getStatus() {
        return {
          name: "OrderExecution",
          status: "healthy" as const,
          lastChecked: new Date(),
          dependencies: [],
        };
      }
      async cleanup() {
        /* cleanup */
      }
      async executeOrder() {
        /* implementation */
      }
      async cancelOrder() {
        /* implementation */
      }
      async getOrderStatus() {
        /* implementation */
      }
    },
    ["MexcIntegrationService", "RiskManagementService"],
    ["OrderExecutionService"]
  );

  // Add more trading services...
}

/**
 * Register infrastructure services module
 */
export function registerInfrastructureServices(container: DependencyContainer): void {
  container.registerSingleton(
    "MexcIntegrationService",
    class MockMexcIntegrationService {
      async initialize() {
        /* implementation */
      }
      async isHealthy() {
        return true;
      }
      getStatus() {
        return {
          name: "MexcIntegration",
          status: "healthy" as const,
          lastChecked: new Date(),
          dependencies: [],
        };
      }
      async cleanup() {
        /* cleanup */
      }
      async getMarketData() {
        /* implementation */
      }
      async placeOrder() {
        /* implementation */
      }
      async getAccountInfo() {
        /* implementation */
      }
    },
    ["CacheService"],
    ["MexcIntegrationService"]
  );

  // Add more infrastructure services...
}

/**
 * Register safety services module
 */
export function registerSafetyServices(container: DependencyContainer): void {
  container.registerSingleton(
    "SafetyCoordinatorService",
    class MockSafetyCoordinatorService {
      async initialize() {
        /* implementation */
      }
      async isHealthy() {
        return true;
      }
      getStatus() {
        return {
          name: "SafetyCoordinator",
          status: "healthy" as const,
          lastChecked: new Date(),
          dependencies: [],
        };
      }
      async cleanup() {
        /* cleanup */
      }
      async checkSystemSafety() {
        /* implementation */
      }
      async enforceEmergencyStop() {
        /* implementation */
      }
      async getActiveViolations() {
        /* implementation */
      }
    },
    ["SystemMonitoringService", "EmergencySystemService"],
    ["SafetyCoordinatorService"]
  );

  // Add more safety services...
}

// ============================================================================
// Global Container Factory
// ============================================================================

let globalContainer: DependencyContainer | null = null;

/**
 * Get or create the global dependency container
 */
export function getContainer(): DependencyContainer {
  if (!globalContainer) {
    globalContainer = createContainer();
  }
  return globalContainer;
}

/**
 * Create a new dependency container with default configuration
 */
export function createContainer(config?: Partial<ContainerConfiguration>): DependencyContainer {
  const container = new DependencyContainer(config);

  // Register core services
  registerTradingServices(container);
  registerInfrastructureServices(container);
  registerSafetyServices(container);

  return container;
}

/**
 * Reset the global container (useful for testing)
 */
export function resetContainer(): void {
  if (globalContainer) {
    globalContainer.dispose();
    globalContainer = null;
  }
}

// ============================================================================
// Decorators for Service Registration
// ============================================================================

/**
 * Service decorator for automatic registration
 */
export function Service(options: {
  name?: string;
  lifetime?: ServiceLifetime;
  dependencies?: string[];
  interfaces?: string[];
}) {
  return <T extends new (...args: any[]) => any>(constructor: T) => {
    const serviceName = options.name || constructor.name;
    const container = getContainer();

    if (options.lifetime === "transient") {
      container.registerTransient(
        serviceName,
        constructor as any,
        options.dependencies || [],
        options.interfaces || []
      );
    } else if (options.lifetime === "scoped") {
      container.registerScoped(
        serviceName,
        constructor as any,
        options.dependencies || [],
        options.interfaces || []
      );
    } else {
      container.registerSingleton(
        serviceName,
        constructor as any,
        options.dependencies || [],
        options.interfaces || []
      );
    }

    return constructor;
  };
}

/**
 * Injectable dependency decorator
 */
export function Inject(serviceName: string) {
  return (target: any, propertyKey: string | symbol) => {
    // Store metadata for dependency injection
    if (!target.constructor._dependencies) {
      target.constructor._dependencies = [];
    }
    target.constructor._dependencies.push({ property: propertyKey, service: serviceName });
  };
}

// ============================================================================
// Example Service Implementation
// ============================================================================

/**
 * Example of how to create a service using the new architecture
 */
@Service({
  name: "ExampleTradingService",
  lifetime: "singleton",
  dependencies: ["MexcIntegrationService", "RiskManagementService"],
  interfaces: ["TradingService"],
})
export class ExampleTradingService implements BaseService {
  private mexcService: any;
  private riskService: any;

  async initialize(dependencies: ServiceDependencies): Promise<void> {
    this.mexcService = (dependencies as any).MexcIntegrationService;
    this.riskService = (dependencies as any).RiskManagementService;
    console.info("ExampleTradingService initialized");
  }

  async isHealthy(): Promise<boolean> {
    return this.mexcService && this.riskService;
  }

  getStatus() {
    return {
      name: "ExampleTradingService",
      status: "healthy" as const,
      lastChecked: new Date(),
      dependencies: ["MexcIntegrationService", "RiskManagementService"],
      metrics: {
        operationsPerformed: 42,
        lastOperation: new Date(),
      },
    };
  }

  async cleanup(): Promise<void> {
    console.info("ExampleTradingService cleaned up");
  }

  // Service-specific methods
  async executeTrade(symbol: string, quantity: number): Promise<any> {
    // Check risk first
    const riskAssessment = await this.riskService.assessRisk({
      type: "buy",
      symbol,
      quantity,
    });

    if (riskAssessment.recommendation === "abort") {
      throw new Error("Trade rejected by risk management");
    }

    // Execute through MEXC service
    return await this.mexcService.placeOrder({
      symbol,
      side: "buy",
      type: "market",
      quantity,
    });
  }
}
