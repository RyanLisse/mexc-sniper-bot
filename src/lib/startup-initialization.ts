/**
import { createSafeLogger } from './structured-logger';
 * STARTUP INITIALIZATION
 *
 * Handles all system initialization tasks that should run when the application starts
 * Ensures critical systems are properly initialized before handling requests
 */

import { calendarPatternBridgeService } from "../services/calendar-pattern-bridge-service";
import { environmentValidation } from "../services/enhanced-environment-validation";
import { OptimizedAutoSnipingCore } from "../services/optimized-auto-sniping-core";
import { patternTargetBridgeService } from "../services/pattern-target-bridge-service";
import { strategyInitializationService } from "../services/strategy-initialization-service";

interface StartupResult {
  success: boolean;
  initialized: string[];
  failed: string[];
  errors: Record<string, string>;
  duration: number;
}

export class StartupInitializer {
  private logger = createSafeLogger("startup-initialization");

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
        initialized: ["already-initialized"],
        failed: [],
        errors: {},
        duration: 0,
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

    logger.info("[Startup] Beginning system initialization...");

    // Validate environment configuration first
    try {
      logger.info("[Startup] Validating environment configuration...");
      const envValidation = environmentValidation.validateEnvironment();
      const healthSummary = environmentValidation.getHealthSummary();

      if (healthSummary.status === "critical") {
        const errorMessage = `Critical environment issues: ${healthSummary.issues.join(", ")}`;
        failed.push("environment-validation");
        errors["environment-validation"] = errorMessage;
        logger.error("[Startup] ❌ Environment validation failed:", errorMessage);
        logger.error("[Startup] 💡 Run: bun run scripts/environment-setup.ts --check");
      } else {
        initialized.push("environment-validation");
        logger.info(
          `[Startup] ✅ Environment validated (${healthSummary.status}, score: ${healthSummary.score}/100)`
        );

        if (healthSummary.status === "warning") {
          logger.warn(`[Startup] ⚠️ Environment warnings: ${healthSummary.issues.join(", ")}`);
          logger.warn(
            "[Startup] 💡 Consider running: bun run scripts/environment-setup.ts --template"
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failed.push("environment-validation");
      errors["environment-validation"] = errorMessage;
      logger.error("[Startup] ❌ Environment validation failed:", errorMessage);
    }

    // Initialize strategy templates
    try {
      logger.info("[Startup] Initializing strategy templates...");
      await strategyInitializationService.initializeOnStartup();
      initialized.push("strategy-templates");
      logger.info("[Startup] ✅ Strategy templates initialized");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failed.push("strategy-templates");
      errors["strategy-templates"] = errorMessage;
      logger.error("[Startup] ❌ Strategy template initialization failed:", errorMessage);
    }

    // Initialize auto-sniping system if enabled
    try {
      logger.info("[Startup] Initializing auto-sniping system...");
      const autoSnipingService = OptimizedAutoSnipingCore.getInstance();

      // Check if auto-sniping should be auto-started
      const autoSnipingConfig = await autoSnipingService.getConfig();
      if (autoSnipingConfig.enabled) {
        logger.info("[Startup] Auto-sniping is enabled, preparing for automatic activation...");
        // Don't start execution immediately - let the UI component handle it after status check
        initialized.push("auto-sniping-system");
        logger.info("[Startup] ✅ Auto-sniping system ready for activation");
      } else {
        initialized.push("auto-sniping-system");
        logger.info("[Startup] ✅ Auto-sniping system initialized (disabled)");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failed.push("auto-sniping-system");
      errors["auto-sniping-system"] = errorMessage;
      logger.error("[Startup] ❌ Auto-sniping system initialization failed:", errorMessage);
    }

    // Initialize Pattern-Target Bridge Service for automatic target creation
    try {
      logger.info("[Startup] Initializing Pattern-Target Bridge Service...");

      // Start listening for pattern detection events with system user
      patternTargetBridgeService.startListening("system");

      initialized.push("pattern-target-bridge");
      logger.info(
        "[Startup] ✅ Pattern-Target Bridge Service initialized and listening for events"
      );
      logger.info(
        "[Startup] 🔗 Auto-target creation enabled: Pattern Detection → Snipe Targets → Auto-Execution"
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failed.push("pattern-target-bridge");
      errors["pattern-target-bridge"] = errorMessage;
      logger.error("[Startup] ❌ Pattern-Target Bridge initialization failed:", errorMessage);
    }

    // Initialize Calendar-Pattern Bridge Service for automated calendar monitoring
    try {
      logger.info("[Startup] Initializing Calendar-Pattern Bridge Service...");

      // Start calendar monitoring with 15-minute intervals
      calendarPatternBridgeService.startMonitoring(15);

      initialized.push("calendar-pattern-bridge");
      logger.info("[Startup] ✅ Calendar-Pattern Bridge Service initialized and monitoring");
      logger.info(
        "[Startup] 📅 Auto-discovery enabled: Calendar Monitoring → Pattern Detection → Target Creation"
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failed.push("calendar-pattern-bridge");
      errors["calendar-pattern-bridge"] = errorMessage;
      logger.error("[Startup] ❌ Calendar-Pattern Bridge initialization failed:", errorMessage);
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
      duration,
    };

    logger.info(
      `[Startup] Initialization ${success ? "completed successfully" : "completed with errors"} in ${duration}ms`
    );
    if (initialized.length > 0) {
      logger.info(`[Startup] ✅ Initialized: ${initialized.join(", ")}`);
    }
    if (failed.length > 0) {
      logger.info(`[Startup] ❌ Failed: ${failed.join(", ")}`);
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
    logger.info("[Startup] Forcing re-initialization...");
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
      isInProgress: this.initializationPromise !== null && !this.isInitialized,
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
    logger.info("[API] Startup not complete, initializing...");
    const result = await startupInitializer.initialize();
    if (!result.success) {
      logger.warn("[API] Startup initialization had errors, but continuing...");
    }
  }
}
