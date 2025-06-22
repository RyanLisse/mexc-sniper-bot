/**
 * STRATEGY INITIALIZATION SERVICE
 *
 * Handles automatic initialization and validation of trading strategy templates
 * Ensures strategy templates are seeded on startup and validates connectivity
 */

import { count } from "drizzle-orm";
import { db } from "../db";
import { strategyTemplates } from "../db/schemas/strategies";
import { multiPhaseTradingService } from "./multi-phase-trading-service";

export interface StrategySystemHealth {
  templatesInitialized: boolean;
  templateCount: number;
  databaseConnected: boolean;
  lastInitialization: Date | null;
  errors: string[];
}

export class StrategyInitializationService {
  private static instance: StrategyInitializationService;
  private initializationPromise: Promise<void> | null = null;
  private lastInitialization: Date | null = null;
  private errors: string[] = [];

  static getInstance(): StrategyInitializationService {
    if (!StrategyInitializationService.instance) {
      StrategyInitializationService.instance = new StrategyInitializationService();
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
        console.log(
          `[Strategy Init] Starting initialization attempt ${attempts + 1}/${maxRetries}`
        );

        // Check if already initialized (unless forced)
        if (!force && (await this.isAlreadyInitialized())) {
          console.log("[Strategy Init] Templates already initialized, skipping");
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
        console.log("[Strategy Init] Strategy templates initialized successfully");
        return;
      } catch (error) {
        attempts++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[Strategy Init] Attempt ${attempts} failed:`, errorMessage);

        this.errors.push(`Attempt ${attempts}: ${errorMessage}`);

        if (attempts < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempts) * 1000;
          console.log(`[Strategy Init] Retrying in ${delay}ms...`);
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
      const result = await db.select({ count: count() }).from(strategyTemplates);
      return result[0]?.count > 0;
    } catch (error) {
      console.error("[Strategy Init] Error checking initialization status:", error);
      return false;
    }
  }

  private async performDatabaseInitialization(): Promise<void> {
    // Test database connectivity first
    await this.testDatabaseConnectivity();

    // Initialize predefined strategies
    await multiPhaseTradingService.initializePredefinedStrategies();

    console.log("[Strategy Init] Predefined strategies initialized");
  }

  private async testDatabaseConnectivity(): Promise<void> {
    try {
      // Simple connectivity test
      await db.select().from(strategyTemplates).limit(1);
      console.log("[Strategy Init] Database connectivity verified");
    } catch (error) {
      throw new Error(
        `Database connectivity test failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async verifyInitialization(): Promise<void> {
    try {
      const templates = await multiPhaseTradingService.getStrategyTemplates();

      if (templates.length === 0) {
        throw new Error("No strategy templates found after initialization");
      }

      // Verify specific templates exist
      const expectedTemplates = ["normal", "conservative", "aggressive", "scalping", "diamond"];
      const templateIds = templates.map((t) => t.strategyId);

      for (const expectedId of expectedTemplates) {
        if (!templateIds.includes(expectedId)) {
          throw new Error(`Required strategy template '${expectedId}' not found`);
        }
      }

      console.log(`[Strategy Init] Verified ${templates.length} strategy templates`);
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
      const templates = await multiPhaseTradingService.getStrategyTemplates();
      const databaseConnected = await this.testDatabaseConnection();

      return {
        templatesInitialized: templates.length > 0,
        templateCount: templates.length,
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
        errors: [...this.errors, error instanceof Error ? error.message : "Unknown error"],
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
      console.log("[Strategy Init] Initializing strategies on startup...");
      await this.initializeStrategies();
      console.log("[Strategy Init] Startup initialization completed");
    } catch (error) {
      console.error("[Strategy Init] Startup initialization failed:", error);
      // Don't throw on startup - let the app continue and retry later
    }
  }

  /**
   * Force re-initialization (for admin/debugging purposes)
   */
  async forceReinitialize(): Promise<void> {
    console.log("[Strategy Init] Forcing re-initialization...");
    this.initializationPromise = null;
    this.errors = [];
    await this.initializeStrategies(true);
  }
}

// Export singleton instance
export const strategyInitializationService = StrategyInitializationService.getInstance();
