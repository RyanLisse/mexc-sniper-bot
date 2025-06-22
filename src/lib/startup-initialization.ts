/**
 * STARTUP INITIALIZATION
 * 
 * Handles all system initialization tasks that should run when the application starts
 * Ensures critical systems are properly initialized before handling requests
 */

import { strategyInitializationService } from "../services/strategy-initialization-service";

interface StartupResult {
  success: boolean;
  initialized: string[];
  failed: string[];
  errors: Record<string, string>;
  duration: number;
}

export class StartupInitializer {
  private static instance: StartupInitializer;
  private isInitialized = false;
  private initializationPromise: Promise<StartupResult> | null = null;

  static getInstance(): StartupInitializer {
    if (!StartupInitializer.instance) {
      StartupInitializer.instance = new StartupInitializer();
    }
    return StartupInitializer.instance;
  }

  /**
   * Initialize all critical systems on startup
   */
  async initialize(): Promise<StartupResult> {
    // Prevent concurrent initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Return early if already initialized
    if (this.isInitialized) {
      return {
        success: true,
        initialized: ['already-initialized'],
        failed: [],
        errors: {},
        duration: 0
      };
    }

    this.initializationPromise = this.performStartupInitialization();
    return this.initializationPromise;
  }

  private async performStartupInitialization(): Promise<StartupResult> {
    const startTime = Date.now();
    const initialized: string[] = [];
    const failed: string[] = [];
    const errors: Record<string, string> = {};

    console.log("[Startup] Beginning system initialization...");

    // Initialize strategy templates
    try {
      console.log("[Startup] Initializing strategy templates...");
      await strategyInitializationService.initializeOnStartup();
      initialized.push('strategy-templates');
      console.log("[Startup] ✅ Strategy templates initialized");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      failed.push('strategy-templates');
      errors['strategy-templates'] = errorMessage;
      console.error("[Startup] ❌ Strategy template initialization failed:", errorMessage);
    }

    // Add other critical system initializations here as needed
    // Example: Cache warming, API validations, etc.

    const duration = Date.now() - startTime;
    const success = failed.length === 0;

    this.isInitialized = success;

    const result: StartupResult = {
      success,
      initialized,
      failed,
      errors,
      duration
    };

    console.log(`[Startup] Initialization ${success ? 'completed successfully' : 'completed with errors'} in ${duration}ms`);
    if (initialized.length > 0) {
      console.log(`[Startup] ✅ Initialized: ${initialized.join(', ')}`);
    }
    if (failed.length > 0) {
      console.log(`[Startup] ❌ Failed: ${failed.join(', ')}`);
    }

    return result;
  }

  /**
   * Check if startup initialization has completed successfully
   */
  isStartupComplete(): boolean {
    return this.isInitialized;
  }

  /**
   * Force re-initialization (for debugging or admin purposes)
   */
  async forceReinitialize(): Promise<StartupResult> {
    console.log("[Startup] Forcing re-initialization...");
    this.isInitialized = false;
    this.initializationPromise = null;
    return this.initialize();
  }

  /**
   * Get initialization status without triggering initialization
   */
  getInitializationStatus(): {
    isInitialized: boolean;
    isInProgress: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      isInProgress: this.initializationPromise !== null && !this.isInitialized
    };
  }
}

// Export singleton instance
export const startupInitializer = StartupInitializer.getInstance();

/**
 * Utility function to ensure startup initialization in API routes
 * Call this in API routes that depend on initialized systems
 */
export async function ensureStartupInitialization(): Promise<void> {
  if (!startupInitializer.isStartupComplete()) {
    console.log("[API] Startup not complete, initializing...");
    const result = await startupInitializer.initialize();
    if (!result.success) {
      console.warn("[API] Startup initialization had errors, but continuing...");
    }
  }
}