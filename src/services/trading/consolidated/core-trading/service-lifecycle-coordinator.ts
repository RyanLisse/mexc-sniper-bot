/**
 * Service Lifecycle Coordinator
 * 
 * FIXED: Centralized coordination for service lifecycle management to prevent:
 * - Service dependency initialization order issues
 * - Cross-service integration startup problems
 * - Circuit breaker emergency system cooldown conflicts
 * - Cascading service failures
 */

import { EventEmitter } from "node:events";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { CoreTradingService } from "./base-service";
import { ServiceInitializationManager } from "./service-initialization-manager";

/**
 * Service lifecycle states
 */
export type ServiceLifecycleState = 
  | 'stopped'
  | 'starting' 
  | 'running'
  | 'degraded'
  | 'stopping'
  | 'failed';

/**
 * Service dependency definition
 */
export interface ServiceDependency {
  name: string;
  required: boolean;
  healthCheck: () => Promise<boolean>;
  initialize: () => Promise<void>;
  shutdown: () => Promise<void>;
}

/**
 * Service lifecycle event types
 */
export interface ServiceLifecycleEvents {
  'state-changed': [ServiceLifecycleState, ServiceLifecycleState];
  'service-started': [string];
  'service-failed': [string, Error];
  'service-degraded': [string, string];
  'all-services-ready': [];
  'emergency-shutdown': [string];
}

/**
 * Service coordination configuration
 */
export interface ServiceCoordinationConfig {
  startupTimeout: number;
  shutdownTimeout: number;
  healthCheckInterval: number;
  maxRetries: number;
  retryDelay: number;
  enableAutoRecovery: boolean;
  enableEmergencyShutdown: boolean;
}

/**
 * Service Lifecycle Coordinator
 * 
 * Manages the complete lifecycle of Core Trading Service and its dependencies:
 * - Coordinated startup sequencing
 * - Health monitoring
 * - Graceful shutdown
 * - Emergency response
 * - Auto-recovery
 */
export class ServiceLifecycleCoordinator extends EventEmitter<ServiceLifecycleEvents> {
  private static instance: ServiceLifecycleCoordinator | null = null;
  
  private state: ServiceLifecycleState = 'stopped';
  private dependencies: Map<string, ServiceDependency> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private initializationManager: ServiceInitializationManager;
  private coreService: CoreTradingService | null = null;
  
  private config: ServiceCoordinationConfig = {
    startupTimeout: 60000, // 60 seconds
    shutdownTimeout: 30000, // 30 seconds
    healthCheckInterval: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    enableAutoRecovery: true,
    enableEmergencyShutdown: true,
  };

  private logger = {
    info: (message: string, context?: any) => {
      console.info("[service-lifecycle]", message, context || "");
    },
    warn: (message: string, context?: any) => {
      console.warn("[service-lifecycle]", message, context || "");
    },
    error: (message: string, context?: any) => {
      console.error("[service-lifecycle]", message, context || "");
    },
    debug: (message: string, context?: any) => {
      console.debug("[service-lifecycle]", message, context || "");
    },
  };

  private constructor(config?: Partial<ServiceCoordinationConfig>) {
    super();
    this.config = { ...this.config, ...config };
    this.initializationManager = ServiceInitializationManager.getInstance();
    this.setupDefaultDependencies();
  }

  public static getInstance(config?: Partial<ServiceCoordinationConfig>): ServiceLifecycleCoordinator {
    if (!ServiceLifecycleCoordinator.instance) {
      ServiceLifecycleCoordinator.instance = new ServiceLifecycleCoordinator(config);
    }
    return ServiceLifecycleCoordinator.instance;
  }

  /**
   * FIXED: Setup default service dependencies with proper initialization order
   */
  private setupDefaultDependencies(): void {
    // Core Trading Service dependency
    this.registerDependency({
      name: 'core-trading-service',
      required: true,
      healthCheck: async () => {
        try {
          if (!this.coreService) return false;
          const status = await this.coreService.getServiceStatus();
          return status.isHealthy;
        } catch {
          return false;
        }
      },
      initialize: async () => {
        this.logger.info("Initializing Core Trading Service...");
        const result = await this.initializationManager.getInitializedService();
        if (!result.success || !result.service) {
          throw new Error(`Core Trading Service initialization failed: ${result.error}`);
        }
        this.coreService = result.service;
        this.logger.info("Core Trading Service initialized successfully");
      },
      shutdown: async () => {
        if (this.coreService) {
          this.logger.info("Shutting down Core Trading Service...");
          await this.coreService.shutdown();
          this.coreService = null;
          this.logger.info("Core Trading Service shut down successfully");
        }
      }
    });

    // Safety coordinator dependency (conditional)
    this.registerDependency({
      name: 'safety-coordinator',
      required: false, // Optional dependency
      healthCheck: async () => {
        try {
          if (!this.coreService) return false;
          const status = await this.coreService.getServiceStatus();
          // Safety coordinator health is included in service status
          return !status.circuitBreakerOpen;
        } catch {
          return false;
        }
      },
      initialize: async () => {
        // Safety coordinator is initialized as part of Core Trading Service
        this.logger.debug("Safety coordinator initialization handled by Core Trading Service");
      },
      shutdown: async () => {
        // Safety coordinator shutdown is handled by Core Trading Service
        this.logger.debug("Safety coordinator shutdown handled by Core Trading Service");
      }
    });
  }

  /**
   * Register a service dependency
   */
  public registerDependency(dependency: ServiceDependency): void {
    this.dependencies.set(dependency.name, dependency);
    this.logger.debug(`Registered dependency: ${dependency.name}`, { required: dependency.required });
  }

  /**
   * Unregister a service dependency
   */
  public unregisterDependency(name: string): void {
    this.dependencies.delete(name);
    this.clearHealthCheck(name);
    this.logger.debug(`Unregistered dependency: ${name}`);
  }

  /**
   * FIXED: Start all services with coordinated sequencing
   */
  public async startServices(coreServiceConfig?: any): Promise<void> {
    if (this.state === 'running') {
      this.logger.debug("Services already running");
      return;
    }

    if (this.state === 'starting') {
      this.logger.warn("Services already starting, waiting for completion...");
      return this.waitForState('running');
    }

    this.setState('starting');
    this.logger.info("Starting service lifecycle coordination...", {
      dependencies: Array.from(this.dependencies.keys()),
      timeout: this.config.startupTimeout
    });

    try {
      // FIXED: Start services in dependency order with timeout
      const startupPromise = this.performCoordinatedStartup(coreServiceConfig);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Service startup timeout')), this.config.startupTimeout);
      });

      await Promise.race([startupPromise, timeoutPromise]);

      this.setState('running');
      this.startHealthMonitoring();
      this.emit('all-services-ready');
      
      this.logger.info("All services started successfully");

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Service startup failed", { error: safeError.message });
      this.setState('failed');
      
      // Attempt cleanup
      await this.stopServices().catch(cleanupError => {
        this.logger.error("Cleanup after startup failure also failed", { 
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
        });
      });
      
      throw error;
    }
  }

  /**
   * FIXED: Perform coordinated service startup
   */
  private async performCoordinatedStartup(coreServiceConfig?: any): Promise<void> {
    const requiredDependencies = Array.from(this.dependencies.values()).filter(dep => dep.required);
    const optionalDependencies = Array.from(this.dependencies.values()).filter(dep => !dep.required);

    // Start required dependencies first
    for (const dependency of requiredDependencies) {
      await this.startSingleService(dependency);
    }

    // Start optional dependencies (failures are non-fatal)
    for (const dependency of optionalDependencies) {
      try {
        await this.startSingleService(dependency);
      } catch (error) {
        this.logger.warn(`Optional dependency ${dependency.name} failed to start`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        this.emit('service-degraded', dependency.name, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * FIXED: Start a single service with retry logic
   */
  private async startSingleService(dependency: ServiceDependency): Promise<void> {
    this.logger.debug(`Starting service: ${dependency.name}`);

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        await dependency.initialize();
        
        // Verify service health
        const isHealthy = await dependency.healthCheck();
        if (!isHealthy) {
          throw new Error(`Service ${dependency.name} failed health check after initialization`);
        }

        this.logger.debug(`Service ${dependency.name} started successfully`, { attempt });
        this.emit('service-started', dependency.name);
        return;

      } catch (error) {
        const safeError = toSafeError(error);
        this.logger.warn(`Service ${dependency.name} start attempt ${attempt} failed`, {
          error: safeError.message,
          attempt,
          maxRetries: this.config.maxRetries
        });

        if (attempt === this.config.maxRetries) {
          this.emit('service-failed', dependency.name, safeError);
          throw new Error(`Service ${dependency.name} failed to start after ${this.config.maxRetries} attempts: ${safeError.message}`);
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }
  }

  /**
   * FIXED: Stop all services with graceful shutdown
   */
  public async stopServices(): Promise<void> {
    if (this.state === 'stopped') {
      this.logger.debug("Services already stopped");
      return;
    }

    if (this.state === 'stopping') {
      this.logger.warn("Services already stopping, waiting for completion...");
      return this.waitForState('stopped');
    }

    this.setState('stopping');
    this.logger.info("Stopping service lifecycle coordination...");

    try {
      // Stop health monitoring first
      this.stopHealthMonitoring();

      // Shutdown services in reverse dependency order
      const dependencies = Array.from(this.dependencies.values()).reverse();
      
      for (const dependency of dependencies) {
        try {
          this.logger.debug(`Stopping service: ${dependency.name}`);
          await dependency.shutdown();
          this.logger.debug(`Service ${dependency.name} stopped successfully`);
        } catch (error) {
          this.logger.warn(`Error stopping service ${dependency.name}`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Reset initialization manager
      await this.initializationManager.reset();

      this.setState('stopped');
      this.logger.info("All services stopped successfully");

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Service shutdown failed", { error: safeError.message });
      this.setState('failed');
      throw error;
    }
  }

  /**
   * FIXED: Emergency shutdown for critical failures
   */
  public async emergencyShutdown(reason: string): Promise<void> {
    this.logger.error(`Emergency shutdown triggered: ${reason}`);
    this.emit('emergency-shutdown', reason);

    try {
      // Force immediate shutdown without graceful cleanup
      this.stopHealthMonitoring();
      
      // Emergency stop core service
      if (this.coreService) {
        try {
          await this.coreService.shutdown();
        } catch (error) {
          this.logger.error("Emergency shutdown of core service failed", {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      await this.initializationManager.reset();
      this.setState('stopped');
      
    } catch (error) {
      this.logger.error("Emergency shutdown failed", {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.setState('failed');
    }
  }

  /**
   * Get Core Trading Service (throws if not available)
   */
  public getCoreService(): CoreTradingService {
    if (!this.coreService) {
      throw new Error("Core Trading Service is not available. Start services first.");
    }
    return this.coreService;
  }

  /**
   * Get current lifecycle state
   */
  public getState(): ServiceLifecycleState {
    return this.state;
  }

  /**
   * Check if services are running
   */
  public isRunning(): boolean {
    return this.state === 'running';
  }

  /**
   * FIXED: Start health monitoring for all services
   */
  private startHealthMonitoring(): void {
    if (!this.config.healthCheckInterval) return;

    for (const [name, dependency] of this.dependencies) {
      const interval = setInterval(async () => {
        try {
          const isHealthy = await dependency.healthCheck();
          if (!isHealthy) {
            this.logger.warn(`Health check failed for service: ${name}`);
            
            if (this.config.enableAutoRecovery && dependency.required) {
              this.logger.info(`Attempting auto-recovery for service: ${name}`);
              try {
                await this.startSingleService(dependency);
                this.logger.info(`Auto-recovery successful for service: ${name}`);
              } catch (error) {
                this.logger.error(`Auto-recovery failed for service: ${name}`, {
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
                
                if (this.config.enableEmergencyShutdown) {
                  await this.emergencyShutdown(`Critical service ${name} failed and auto-recovery failed`);
                }
              }
            }
          }
        } catch (error) {
          this.logger.error(`Health check error for service: ${name}`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }, this.config.healthCheckInterval);

      this.healthCheckIntervals.set(name, interval);
    }

    this.logger.debug("Health monitoring started", {
      services: Array.from(this.dependencies.keys()),
      interval: this.config.healthCheckInterval
    });
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    for (const [name, interval] of this.healthCheckIntervals) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
    this.logger.debug("Health monitoring stopped");
  }

  /**
   * Clear health check for specific service
   */
  private clearHealthCheck(name: string): void {
    const interval = this.healthCheckIntervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(name);
    }
  }

  /**
   * Set lifecycle state and emit event
   */
  private setState(newState: ServiceLifecycleState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('state-changed', newState, oldState);
    this.logger.debug(`State changed: ${oldState} -> ${newState}`);
  }

  /**
   * Wait for specific state
   */
  private async waitForState(targetState: ServiceLifecycleState, timeout = 30000): Promise<void> {
    if (this.state === targetState) return;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeListener('state-changed', stateChangeHandler);
        reject(new Error(`Timeout waiting for state ${targetState}`));
      }, timeout);

      const stateChangeHandler = (newState: ServiceLifecycleState) => {
        if (newState === targetState) {
          clearTimeout(timeoutId);
          this.removeListener('state-changed', stateChangeHandler);
          resolve();
        }
      };

      this.on('state-changed', stateChangeHandler);
    });
  }
}

// Export convenience functions
const coordinator = ServiceLifecycleCoordinator.getInstance();

/**
 * FIXED: Convenience function to start all services
 */
export async function startCoreServices(config?: any): Promise<CoreTradingService> {
  await coordinator.startServices(config);
  return coordinator.getCoreService();
}

/**
 * FIXED: Convenience function to stop all services
 */
export async function stopCoreServices(): Promise<void> {
  await coordinator.stopServices();
}

/**
 * FIXED: Convenience function to get current Core Trading Service
 */
export function getCurrentCoreService(): CoreTradingService | null {
  try {
    return coordinator.getCoreService();
  } catch {
    return null;
  }
}

/**
 * FIXED: Convenience function to check if services are ready
 */
export function areCoreServicesReady(): boolean {
  return coordinator.isRunning();
}

export default ServiceLifecycleCoordinator;