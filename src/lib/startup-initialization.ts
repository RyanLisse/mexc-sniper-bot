/**
 * STARTUP INITIALIZATION
 *
 * Handles all system initialization tasks that should run when the application starts
 * Ensures critical systems are properly initialized before handling requests
 */

import { calendarPatternBridgeService } from "../services/data/pattern-detection/calendar-pattern-bridge-service";
import { patternToDatabaseBridge } from "../services/data/pattern-detection/pattern-to-database-bridge";
import { PatternMonitoringService } from "../services/notification/pattern-monitoring-service";
import { environmentValidation } from "../services/risk/enhanced-environment-validation";
import { getCoreTrading } from "../services/trading/consolidated/core-trading/base-service";
import { strategyInitializationService } from "../services/trading/strategy-initialization-service";

interface StartupResult {
  success: boolean;
  initialized: string[];
  failed: string[];
  errors: Record<string, string>;
  duration: number;
}

export class StartupInitializer {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[startup-initialization]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[startup-initialization]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[startup-initialization]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[startup-initialization]", message, context || ""),
  };

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

    console.info("[Startup] Beginning system initialization...");

    // Validate environment configuration first
    try {
      console.info("[Startup] Validating environment configuration...");
      const _envValidation = environmentValidation.validateEnvironment();
      const healthSummary = environmentValidation.getHealthSummary();

      if (healthSummary.status === "critical") {
        const errorMessage = `Critical environment issues: ${healthSummary.criticalMissing.join(", ")}`;
        failed.push("environment-validation");
        errors["environment-validation"] = errorMessage;
        console.error("[Startup] ❌ Environment validation failed:", errorMessage);
        console.error("[Startup] 💡 Run: bun run scripts/environment-setup.ts --check");
      } else {
        initialized.push("environment-validation");
        const score = Math.round((healthSummary.configured / healthSummary.total) * 100);
        console.info(
          `[Startup] ✅ Environment validated (${healthSummary.status}, score: ${score}/100)`
        );

        if (healthSummary.status === "warning") {
          console.warn(
            `[Startup] ⚠️ Environment warnings: Missing ${healthSummary.missing}, Invalid ${healthSummary.invalid}`
          );
          console.warn(
            "[Startup] 💡 Consider running: bun run scripts/environment-setup.ts --template"
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failed.push("environment-validation");
      errors["environment-validation"] = errorMessage;
      console.error("[Startup] ❌ Environment validation failed:", errorMessage);
    }

    // Initialize strategy templates
    try {
      console.info("[Startup] Initializing strategy templates...");
      await strategyInitializationService.initializeOnStartup();
      initialized.push("strategy-templates");
      console.info("[Startup] ✅ Strategy templates initialized");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failed.push("strategy-templates");
      errors["strategy-templates"] = errorMessage;
      console.error("[Startup] ❌ Strategy template initialization failed:", errorMessage);
    }

    // Initialize auto-sniping system if enabled
    try {
      console.info("[Startup] Initializing auto-sniping system...");
      const coreTrading = getCoreTrading();

      // Initialize the core trading service if not already initialized
      try {
        const initResult = await coreTrading.initialize();
        if (initResult.success) {
          initialized.push("auto-sniping-system");
          console.info("[Startup] ✅ Auto-sniping system initialized successfully");
        } else {
          throw new Error(initResult.error || "Failed to initialize core trading service");
        }
      } catch (initError) {
        // If already initialized, that's okay
        if (initError instanceof Error && initError.message.includes("already initialized")) {
          initialized.push("auto-sniping-system");
          console.info("[Startup] ✅ Auto-sniping system already initialized");
        } else {
          throw initError;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failed.push("auto-sniping-system");
      errors["auto-sniping-system"] = errorMessage;
      console.error("[Startup] ❌ Auto-sniping system initialization failed:", errorMessage);
    }

    // Initialize Pattern-To-Database Bridge Service for automatic target creation
    try {
      console.info("[Startup] Initializing Pattern-To-Database Bridge Service...");

      // Start listening for pattern detection events from EnhancedPatternDetectionCore
      await patternToDatabaseBridge.startListening();

      initialized.push("pattern-to-database-bridge");
      console.info(
        "[Startup] ✅ Pattern-To-Database Bridge Service initialized and listening for events"
      );
      console.info(
        "[Startup] 🔗 Auto-target creation enabled: Enhanced Pattern Detection → Database → Auto-Execution"
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failed.push("pattern-to-database-bridge");
      errors["pattern-to-database-bridge"] = errorMessage;
      console.error("[Startup] ❌ Pattern-To-Database Bridge initialization failed:", errorMessage);
    }

    // Initialize Calendar-Pattern Bridge Service for automated calendar monitoring
    try {
      console.info("[Startup] Initializing Calendar-Pattern Bridge Service...");

      // Start calendar monitoring with 15-minute intervals
      calendarPatternBridgeService.startMonitoring(15);

      initialized.push("calendar-pattern-bridge");
      console.info("[Startup] ✅ Calendar-Pattern Bridge Service initialized and monitoring");
      console.info(
        "[Startup] 📅 Auto-discovery enabled: Calendar Monitoring → Pattern Detection → Target Creation"
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failed.push("calendar-pattern-bridge");
      errors["calendar-pattern-bridge"] = errorMessage;
      console.error("[Startup] ❌ Calendar-Pattern Bridge initialization failed:", errorMessage);
    }

    // Initialize Pattern Monitoring Service for real-time pattern tracking
    try {
      console.info("[Startup] Initializing Pattern Monitoring Service...");

      // Start real-time pattern monitoring
      const patternMonitor = PatternMonitoringService.getInstance();
      await patternMonitor.startMonitoring();

      initialized.push("pattern-monitoring");
      console.info("[Startup] ✅ Pattern Monitoring Service initialized and tracking");
      console.info(
        "[Startup] 📊 Real-time monitoring enabled: Pattern Detection Events → Statistics → Alerts"
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failed.push("pattern-monitoring");
      errors["pattern-monitoring"] = errorMessage;
      console.error("[Startup] ❌ Pattern Monitoring Service initialization failed:", errorMessage);
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

    console.info(
      `[Startup] Initialization ${success ? "completed successfully" : "completed with errors"} in ${duration}ms`
    );
    if (initialized.length > 0) {
      console.info(`[Startup] ✅ Initialized: ${initialized.join(", ")}`);
    }
    if (failed.length > 0) {
      console.info(`[Startup] ❌ Failed: ${failed.join(", ")}`);
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
    console.info("[Startup] Forcing re-initialization...");
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
    console.info("[API] Startup not complete, initializing...");
    const result = await startupInitializer.initialize();
    if (!result.success) {
      console.warn("[API] Startup initialization had errors, but continuing...");
    }
  }
}
