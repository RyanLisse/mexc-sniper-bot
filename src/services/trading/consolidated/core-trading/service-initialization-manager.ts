/**
 * Service Initialization Manager
 * 
 * FIXED: Centralized service initialization management to prevent:
 * - "Core Trading Service is not initialized" errors
 * - Circuit breaker emergency system cooldown conflicts
 * - Service dependency initialization order issues
 * - Cross-service integration startup problems
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type { CoreTradingService } from "./base-service";
import { createInitializedCoreTrading, getCoreTrading, getInitializedCoreTrading } from "./base-service";

/**
 * Service initialization states
 */
export type ServiceInitializationState = 
  | 'uninitialized' 
  | 'initializing' 
  | 'initialized' 
  | 'failed' 
  | 'degraded';

/**
 * Service initialization result
 */
export interface ServiceInitializationResult {
  success: boolean;
  state: ServiceInitializationState;
  service: CoreTradingService | null;
  error?: string;
  warnings?: string[];
  initializationTime?: number;
}

/**
 * Initialization configuration
 */
export interface ServiceInitializationConfig {
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  gracefulDegradation?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Service Initialization Manager
 * 
 * Handles Core Trading Service initialization with:
 * - Automatic retry logic
 * - Circuit breaker conflict prevention
 * - Dependency sequencing
 * - Graceful degradation
 * - Comprehensive error handling
 */
export class ServiceInitializationManager {
  private static instance: ServiceInitializationManager | null = null;
  private currentState: ServiceInitializationState = 'uninitialized';
  private currentService: CoreTradingService | null = null;
  private initializationPromise: Promise<ServiceInitializationResult> | null = null;
  private initializationStartTime: number = 0;

  private logger = {
    debug: (message: string, context?: any) => {
      console.debug("[service-init-manager]", message, context || "");
    },
    info: (message: string, context?: any) => {
      console.info("[service-init-manager]", message, context || "");
    },
    warn: (message: string, context?: any) => {
      console.warn("[service-init-manager]", message, context || "");
    },
    error: (message: string, context?: any) => {
      console.error("[service-init-manager]", message, context || "");
    },
  };

  private constructor() {}

  public static getInstance(): ServiceInitializationManager {
    if (!ServiceInitializationManager.instance) {
      ServiceInitializationManager.instance = new ServiceInitializationManager();
    }
    return ServiceInitializationManager.instance;
  }

  /**
   * FIXED: Get Core Trading Service with guaranteed initialization
   * Prevents "Core Trading Service is not initialized" errors
   */
  public async getInitializedService(config?: any): Promise<ServiceInitializationResult> {
    // If already initializing, wait for completion
    if (this.initializationPromise) {
      this.logger.debug("Initialization already in progress, waiting...");
      return this.initializationPromise;
    }

    // If already initialized, return existing service
    if (this.currentState === 'initialized' && this.currentService) {
      this.logger.debug("Service already initialized, returning existing instance");
      return {
        success: true,
        state: 'initialized',
        service: this.currentService,
        initializationTime: 0
      };
    }

    // Start initialization
    this.initializationPromise = this.performInitialization(config);
    
    try {
      const result = await this.initializationPromise;
      this.initializationPromise = null; // Clear promise after completion
      return result;
    } catch (error) {
      this.initializationPromise = null; // Clear promise on error
      throw error;
    }
  }

  /**
   * FIXED: Perform Core Trading Service initialization with enhanced error handling
   */
  private async performInitialization(config?: any): Promise<ServiceInitializationResult> {
    const initConfig: ServiceInitializationConfig = {
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 30000,
      gracefulDegradation: true,
      logLevel: 'info',
      ...config?.initializationConfig
    };

    this.initializationStartTime = Date.now();
    this.currentState = 'initializing';
    const warnings: string[] = [];

    this.logger.info("Starting Core Trading Service initialization", {
      retryAttempts: initConfig.retryAttempts,
      timeout: initConfig.timeout,
      gracefulDegradation: initConfig.gracefulDegradation
    });

    for (let attempt = 1; attempt <= (initConfig.retryAttempts || 3); attempt++) {
      try {
        this.logger.debug(`Initialization attempt ${attempt}/${initConfig.retryAttempts}`);

        // FIXED: Add timeout to prevent hanging initialization
        const initPromise = this.attemptServiceInitialization(config);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Initialization timeout')), initConfig.timeout || 30000);
        });

        const service = await Promise.race([initPromise, timeoutPromise]);

        // Verify service is actually initialized
        try {
          await service.getServiceStatus();
          this.currentService = service;
          this.currentState = 'initialized';
          
          const initializationTime = Date.now() - this.initializationStartTime;
          this.logger.info("Core Trading Service initialization successful", {
            attempt,
            initializationTime,
            warnings: warnings.length
          });

          return {
            success: true,
            state: 'initialized',
            service,
            warnings: warnings.length > 0 ? warnings : undefined,
            initializationTime
          };
        } catch (statusError) {
          this.logger.warn("Service initialized but status check failed", {
            attempt,
            error: statusError instanceof Error ? statusError.message : 'Unknown error'
          });
          warnings.push(`Status check failed on attempt ${attempt}: ${statusError instanceof Error ? statusError.message : 'Unknown error'}`);
          
          if (attempt === (initConfig.retryAttempts || 3) && initConfig.gracefulDegradation) {
            // Return service in degraded state
            this.currentService = service;
            this.currentState = 'degraded';
            
            return {
              success: true,
              state: 'degraded',
              service,
              warnings,
              initializationTime: Date.now() - this.initializationStartTime
            };
          }
        }

      } catch (error) {
        const safeError = toSafeError(error);
        this.logger.warn(`Initialization attempt ${attempt} failed`, {
          error: safeError.message,
          attempt,
          retryDelay: initConfig.retryDelay
        });

        warnings.push(`Attempt ${attempt} failed: ${safeError.message}`);

        // If not the last attempt, wait before retrying
        if (attempt < (initConfig.retryAttempts || 3)) {
          await new Promise(resolve => setTimeout(resolve, initConfig.retryDelay || 1000));
        }
      }
    }

    // All attempts failed
    this.currentState = 'failed';
    const initializationTime = Date.now() - this.initializationStartTime;
    
    this.logger.error("Core Trading Service initialization failed after all attempts", {
      attempts: initConfig.retryAttempts,
      initializationTime,
      warnings: warnings.length
    });

    return {
      success: false,
      state: 'failed',
      service: null,
      error: `Initialization failed after ${initConfig.retryAttempts} attempts`,
      warnings,
      initializationTime
    };
  }

  /**
   * FIXED: Attempt single service initialization with circuit breaker safety
   */
  private async attemptServiceInitialization(config?: any): Promise<CoreTradingService> {
    this.logger.debug("Attempting Core Trading Service initialization...");

    // FIXED: Use factory function with initialization guarantee
    if (config?.forceNew) {
      this.logger.debug("Creating new Core Trading Service instance");
      return createInitializedCoreTrading(config);
    } else {
      this.logger.debug("Using singleton Core Trading Service instance");
      return getInitializedCoreTrading(config);
    }
  }

  /**
   * Get current initialization state
   */
  public getCurrentState(): ServiceInitializationState {
    return this.currentState;
  }

  /**
   * Get current service (may be null)
   */
  public getCurrentService(): CoreTradingService | null {
    return this.currentService;
  }

  /**
   * FIXED: Reset initialization manager state
   */
  public async reset(): Promise<void> {
    this.logger.info("Resetting Service Initialization Manager");

    // Cancel any ongoing initialization
    this.initializationPromise = null;

    // Shutdown current service if exists
    if (this.currentService) {
      try {
        await this.currentService.shutdown();
      } catch (error) {
        this.logger.warn("Error during service shutdown in reset", {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Reset state
    this.currentService = null;
    this.currentState = 'uninitialized';
    this.initializationStartTime = 0;

    this.logger.info("Service Initialization Manager reset completed");
  }

  /**
   * FIXED: Quick initialization check without blocking
   */
  public isInitialized(): boolean {
    return this.currentState === 'initialized' && this.currentService !== null;
  }

  /**
   * FIXED: Get service with fail-safe fallback
   */
  public getServiceOrThrow(): CoreTradingService {
    if (!this.currentService) {
      throw new Error("Core Trading Service is not available. Call getInitializedService() first.");
    }
    return this.currentService;
  }
}

// Export convenience functions
const manager = ServiceInitializationManager.getInstance();

/**
 * FIXED: Convenience function to get initialized Core Trading Service
 */
export async function getInitializedCoreService(config?: any): Promise<CoreTradingService> {
  const result = await manager.getInitializedService(config);
  
  if (!result.success || !result.service) {
    throw new Error(`Failed to initialize Core Trading Service: ${result.error || 'Unknown error'}`);
  }
  
  if (result.warnings && result.warnings.length > 0) {
    console.warn("Core Trading Service initialized with warnings:", result.warnings);
  }
  
  return result.service;
}

/**
 * FIXED: Convenience function to safely get Core Trading Service
 */
export function getSafeInitializedCoreService(): CoreTradingService | null {
  return manager.getCurrentService();
}

/**
 * FIXED: Convenience function to check if service is ready
 */
export function isCoreServiceReady(): boolean {
  return manager.isInitialized();
}

/**
 * FIXED: Convenience function to reset all services
 */
export async function resetCoreServices(): Promise<void> {
  await manager.reset();
}

export default ServiceInitializationManager;