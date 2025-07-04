/**
 * STRATEGY INITIALIZATION SERVICE
 *
 * Handles automatic initialization and validation of trading strategy templates
 * Ensures strategy templates are seeded on startup and validates connectivity
 */

import { db } from "@/src/db";
import { strategyTemplates } from "@/src/db/schemas/strategies";
import { getCoreTrading } from "./consolidated/core-trading";

export interface StrategySystemHealth {
  templatesInitialized: boolean;
  templateCount: number;
  databaseConnected: boolean;
  lastInitialization: Date | null;
  errors: string[];
}

export class StrategyInitializationService {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[strategy-initialization-service]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[strategy-initialization-service]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[strategy-initialization-service]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug(
        "[strategy-initialization-service]",
        message,
        context || ""
      ),
  };

  private static instance: StrategyInitializationService;
  private initializationPromise: Promise<void> | null = null;
  private lastInitialization: Date | null = null;
  private errors: string[] = [];

  static getInstance(): StrategyInitializationService {
    if (!StrategyInitializationService.instance) {
      StrategyInitializationService.instance =
        new StrategyInitializationService();
    }
    return StrategyInitializationService.instance;
  }

  /**
   * Initialize strategy templates with error handling and retries
   */
  async initializeStrategies(force = false): Promise<void> {
    // Prevent concurrent initializations
    if (this.initializationPromise && !force) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization(force);
    return this.initializationPromise;
  }

  private async performInitialization(force: boolean): Promise<void> {
    const maxRetries = 3;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        console.info(
          `[Strategy Init] Starting initialization attempt ${attempts + 1}/${maxRetries}`
        );

        // Check if already initialized (unless forced)
        if (!force && (await this.isAlreadyInitialized())) {
          console.info(
            "[Strategy Init] Templates already initialized, skipping"
          );
          this.lastInitialization = new Date();
          this.errors = [];
          return;
        }

        // Perform initialization
        await this.performDatabaseInitialization();

        // Verify initialization success
        await this.verifyInitialization();

        this.lastInitialization = new Date();
        this.errors = [];
        console.info(
          "[Strategy Init] Strategy templates initialized successfully"
        );
        return;
      } catch (error) {
        attempts++;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `[Strategy Init] Attempt ${attempts} failed:`,
          errorMessage
        );

        this.errors.push(`Attempt ${attempts}: ${errorMessage}`);

        if (attempts < maxRetries) {
          // Exponential backoff
          const delay = 2 ** attempts * 1000;
          console.info(`[Strategy Init] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to initialize strategy templates after ${maxRetries} attempts. Errors: ${this.errors.join("; ")}`
    );
  }

  private async isAlreadyInitialized(): Promise<boolean> {
    try {
      const result = await db
        .select()
        .from(strategyTemplates)
        .limit(1)
        .execute();
      return result.length > 0;
    } catch (error) {
      console.error(
        "[Strategy Init] Error checking initialization status:",
        error
      );
      return false;
    }
  }

  private async performDatabaseInitialization(): Promise<void> {
    // Test database connectivity first
    await this.testDatabaseConnectivity();

    // Initialize predefined strategies using core trading service
    const coreTrading = getCoreTrading();
    await coreTrading.initialize();

    console.info("[Strategy Init] Predefined strategies initialized");
  }

  private async testDatabaseConnectivity(): Promise<void> {
    try {
      // Simple connectivity test
      await db.select().from(strategyTemplates).limit(1);
      console.info("[Strategy Init] Database connectivity verified");
    } catch (error) {
      throw new Error(
        `Database connectivity test failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async verifyInitialization(): Promise<void> {
    try {
      const coreTrading = getCoreTrading();
      const strategies = coreTrading.getAvailableStrategies();

      if (strategies.length === 0) {
        throw new Error("No strategies found after initialization");
      }

      // Verify specific templates exist
      const expectedTemplates = [
        "normal",
        "conservative",
        "aggressive",
        "scalping",
        "diamond",
      ];
      const strategyNames = strategies.map((s: any) => s.name || s.strategyId);

      for (const expectedId of expectedTemplates) {
        if (!strategyNames.includes(expectedId)) {
          throw new Error(
            `Required strategy template '${expectedId}' not found`
          );
        }
      }

      console.info(
        `[Strategy Init] Verified ${strategies.length} strategy templates`
      );
    } catch (error) {
      throw new Error(
        `Initialization verification failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get current health status of the strategy system
   */
  async getHealthStatus(): Promise<StrategySystemHealth> {
    try {
      const coreTrading = getCoreTrading();
      const strategies = coreTrading.getAvailableStrategies();
      const databaseConnected = await this.testDatabaseConnection();

      return {
        templatesInitialized: strategies.length > 0,
        templateCount: strategies.length,
        databaseConnected,
        lastInitialization: this.lastInitialization,
        errors: [...this.errors],
      };
    } catch (error) {
      return {
        templatesInitialized: false,
        templateCount: 0,
        databaseConnected: false,
        lastInitialization: this.lastInitialization,
        errors: [
          ...this.errors,
          error instanceof Error ? error.message : "Unknown error",
        ],
      };
    }
  }

  private async testDatabaseConnection(): Promise<boolean> {
    try {
      await db.select().from(strategyTemplates).limit(1);
      return true;
    } catch (error) {
      console.error("[Strategy Init] Database connection test failed:", error);
      return false;
    }
  }

  /**
   * Initialize strategies on startup - safe for concurrent calls
   */
  async initializeOnStartup(): Promise<void> {
    try {
      console.info("[Strategy Init] Initializing strategies on startup...");
      await this.initializeStrategies();
      console.info("[Strategy Init] Startup initialization completed");
    } catch (error) {
      console.error("[Strategy Init] Startup initialization failed:", error);
      // Don't throw on startup - let the app continue and retry later
    }
  }

  /**
   * Force re-initialization (for admin/debugging purposes)
   */
  async forceReinitialize(): Promise<void> {
    console.info("[Strategy Init] Forcing re-initialization...");
    this.initializationPromise = null;
    this.errors = [];
    await this.initializeStrategies(true);
  }
}

// Export singleton instance
export const strategyInitializationService =
  StrategyInitializationService.getInstance();
