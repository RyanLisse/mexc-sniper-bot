/**
 * Complete Auto-Sniping Service - Refactored
 *
 * Lightweight orchestrator that coordinates specialized sniping modules.
 * Replaces the original monolithic implementation with focused, maintainable modules.
 */

import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/src/db";
import type { SnipeTarget } from "@/src/db/schemas/supabase-auth";
import { snipeTargets } from "@/src/db/schemas/supabase-auth";
import { executionHistory } from "@/src/db/schemas/supabase-trading";

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { toSafeError } from "@/src/lib/error-type-utils";
import { UnifiedMexcServiceV2 } from "../api/unified-mexc-service-v2";
import type { ServiceResponse } from "./consolidated/core-trading/types";
import { type PriceAlert, PriceMonitor } from "./modules/price-monitor";
// Import specialized modules
import {
  type SnipeConfiguration,
  SnipeExecutionEngine,
  type SnipeExecutionResult,
} from "./modules/snipe-execution-engine";

// Re-export types for backward compatibility
export type { SnipeConfiguration, SnipeExecutionResult };
export type AutoSnipeTarget = SnipeTarget & {
  strategy?: string;
};

export interface PatternTrigger {
  id: string;
  symbol: string;
  pattern: string;
  confidence: number;
  timestamp: Date;
  price: number;
  volume: number;
  metadata: Record<string, any>;
}

/**
 * Complete Auto-Sniping Service - Refactored Implementation
 *
 * Coordinates sniping execution, price monitoring, and database management
 * through specialized modules for improved maintainability and testability.
 */
export class CompleteAutoSnipingServiceRefactored extends BrowserCompatibleEventEmitter {
  private mexcService: UnifiedMexcServiceV2;

  // Specialized modules
  private executionEngine: SnipeExecutionEngine;
  private priceMonitor: PriceMonitor;

  // State
  private isInitialized = false;
  private isRunning = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private patternMonitorInterval: NodeJS.Timeout | null = null;

  constructor(config: SnipeConfiguration) {
    super();

    // Initialize MEXC service
    this.mexcService = new UnifiedMexcServiceV2({
      apiKey: process.env.MEXC_API_KEY || "",
      secretKey: process.env.MEXC_SECRET_KEY || "",
    });

    // Initialize specialized modules
    this.executionEngine = new SnipeExecutionEngine(this.mexcService, config);
    this.priceMonitor = new PriceMonitor();

    // Set up event forwarding
    this.setupEventForwarding();
  }

  async initialize(): Promise<ServiceResponse<void>> {
    try {
      if (this.isInitialized) {
        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      }

      // Validate MEXC credentials
      const credentialsValid = await this.validateMexcCredentials();
      if (!credentialsValid.success) {
        return credentialsValid;
      }

      // Initialize modules
      await this.priceMonitor.initialize();

      this.isInitialized = true;
      this.emit("initialized");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async start(): Promise<ServiceResponse<void>> {
    try {
      if (!this.isInitialized) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return initResult;
        }
      }

      if (this.isRunning) {
        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      }

      // Start processing pending targets
      this.processingInterval = setInterval(() => {
        this.processPendingTargets().catch((error) => {
          this.emit("processingError", { error: toSafeError(error).message });
        });
      }, 5000); // Process every 5 seconds

      // Start pattern monitoring
      await this.startPatternMonitoring();

      this.isRunning = true;
      this.emit("started");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async stop(): Promise<ServiceResponse<void>> {
    try {
      if (!this.isRunning) {
        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      }

      // Stop processing
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }

      // Stop pattern monitoring
      if (this.patternMonitorInterval) {
        clearInterval(this.patternMonitorInterval);
        this.patternMonitorInterval = null;
      }

      // Shutdown modules
      await this.priceMonitor.shutdown();

      this.isRunning = false;
      this.emit("stopped");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Main execution methods (delegated to SnipeExecutionEngine)
  async executePatternSnipe(
    symbol: string,
    pattern: string,
    confidence: number,
    price: number,
    quantity?: number
  ): Promise<SnipeExecutionResult> {
    try {
      const result = await this.executionEngine.executePatternSnipe(
        symbol,
        pattern,
        confidence,
        price,
        quantity
      );

      // Store in database
      await this.storeExecutionResult(result, "pattern");

      return result;
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      return {
        success: false,
        snipeId: `error-${Date.now()}`,
        executionTime: 0,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  async executeManualSnipe(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    targetPrice: number,
    orderType: "MARKET" | "LIMIT" = "LIMIT",
    options?: {
      stopLoss?: number;
      takeProfit?: number;
      strategy?: string;
    }
  ): Promise<SnipeExecutionResult> {
    try {
      const result = await this.executionEngine.executeManualSnipe(
        symbol,
        side,
        quantity,
        targetPrice,
        orderType,
        options
      );

      // Store in database
      await this.storeExecutionResult(result, "manual");

      return result;
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      return {
        success: false,
        snipeId: `error-${Date.now()}`,
        executionTime: 0,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  // Database management methods
  async processPendingTargets(): Promise<
    ServiceResponse<{ processed: number; executed: number }>
  > {
    try {
      // Get pending targets from database
      const pendingTargets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(
            eq(snipeTargets.status, "pending"),
            or(
              isNull(snipeTargets.expiresAt),
              lt(new Date(), snipeTargets.expiresAt)
            )
          )
        )
        .limit(10); // Process in batches

      if (pendingTargets.length === 0) {
        return {
          success: true,
          data: { processed: 0, executed: 0 },
          timestamp: new Date().toISOString(),
        };
      }

      let executedCount = 0;

      for (const target of pendingTargets) {
        try {
          // Check if target should be executed based on current market conditions
          const shouldExecute = await this.shouldExecuteTarget(target);

          if (shouldExecute) {
            const result = await this.executionEngine.executeSnipe({
              id: target.id,
              symbol: target.symbol,
              side: target.side as "BUY" | "SELL",
              targetPrice: parseFloat(target.targetPrice),
              quantity: parseFloat(target.quantity),
              orderType: target.orderType as "MARKET" | "LIMIT",
              stopLoss: target.stopLoss
                ? parseFloat(target.stopLoss)
                : undefined,
              takeProfit: target.takeProfit
                ? parseFloat(target.takeProfit)
                : undefined,
              strategy: target.strategy || undefined,
              createdAt: target.createdAt,
              expiresAt: target.expiresAt || undefined,
              status: target.status as any,
            });

            // Update target status in database
            await db
              .update(snipeTargets)
              .set({
                status: result.success ? "executed" : "failed",
                executedAt: new Date(),
                executionResult: JSON.stringify(result),
              })
              .where(eq(snipeTargets.id, target.id));

            if (result.success) {
              executedCount++;
            }
          }
        } catch (error) {
          console.error(`Error processing target ${target.id}:`, error);

          // Mark target as failed
          await db
            .update(snipeTargets)
            .set({
              status: "failed",
              executedAt: new Date(),
              executionResult: JSON.stringify({
                error: toSafeError(error).message,
              }),
            })
            .where(eq(snipeTargets.id, target.id));
        }
      }

      return {
        success: true,
        data: { processed: pendingTargets.length, executed: executedCount },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Configuration management
  async updateConfig(
    newConfig: Partial<SnipeConfiguration>
  ): Promise<ServiceResponse<void>> {
    try {
      this.executionEngine.updateConfig(newConfig);

      this.emit("configUpdated", newConfig);

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Price monitoring integration
  createPriceAlert(
    symbol: string,
    targetPrice: number,
    direction: "above" | "below"
  ): string {
    return this.priceMonitor.createPriceAlert(symbol, targetPrice, direction);
  }

  removePriceAlert(alertId: string): boolean {
    return this.priceMonitor.removeAlert(alertId);
  }

  getCurrentPrice(symbol: string): number | null {
    return this.priceMonitor.getCurrentPrice(symbol);
  }

  // Status and monitoring methods
  getStatus(): {
    initialized: boolean;
    running: boolean;
    executionStatus: any;
    priceMonitoring: boolean;
    activeAlerts: number;
  } {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      executionStatus: this.executionEngine.getExecutionStatus(),
      priceMonitoring: this.priceMonitor.monitoring,
      activeAlerts: this.priceMonitor.getAlertCount(),
    };
  }

  async getDatabaseStats(): Promise<{
    pendingTargets: number;
    executedTargets: number;
    failedTargets: number;
    totalExecutions: number;
  }> {
    try {
      const [pending, executed, failed, totalExecutions] = await Promise.all([
        db
          .select()
          .from(snipeTargets)
          .where(eq(snipeTargets.status, "pending")),
        db
          .select()
          .from(snipeTargets)
          .where(eq(snipeTargets.status, "executed")),
        db.select().from(snipeTargets).where(eq(snipeTargets.status, "failed")),
        db.select().from(executionHistory),
      ]);

      return {
        pendingTargets: pending.length,
        executedTargets: executed.length,
        failedTargets: failed.length,
        totalExecutions: totalExecutions.length,
      };
    } catch (_error) {
      return {
        pendingTargets: 0,
        executedTargets: 0,
        failedTargets: 0,
        totalExecutions: 0,
      };
    }
  }

  // Private helper methods
  private async validateMexcCredentials(): Promise<ServiceResponse<void>> {
    try {
      const apiKey = process.env.MEXC_API_KEY;
      const secretKey = process.env.MEXC_SECRET_KEY;

      if (!apiKey || !secretKey) {
        return {
          success: false,
          error: "MEXC API credentials not configured",
          timestamp: new Date().toISOString(),
        };
      }

      // Test API connection
      await this.mexcService.getAccountBalance();

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      return {
        success: false,
        error: `MEXC API validation failed: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async shouldExecuteTarget(target: any): Promise<boolean> {
    try {
      // Get current market price
      const currentPrice = this.priceMonitor.getCurrentPrice(target.symbol);
      if (!currentPrice) return false;

      const targetPrice = parseFloat(target.targetPrice);

      // Simple execution logic based on order type and side
      if (target.orderType === "MARKET") {
        return true; // Always execute market orders
      }

      if (target.side === "BUY") {
        return currentPrice <= targetPrice; // Buy when price is at or below target
      } else {
        return currentPrice >= targetPrice; // Sell when price is at or above target
      }
    } catch (error) {
      console.error("Error checking execution conditions:", error);
      return false;
    }
  }

  private async startPatternMonitoring(): Promise<void> {
    this.patternMonitorInterval = setInterval(async () => {
      try {
        // Check for pattern triggers (simplified implementation)
        const patterns = await this.detectPatterns();

        for (const pattern of patterns) {
          this.emit("pattern_detected", pattern);
        }
      } catch (error) {
        console.error("Pattern monitoring error:", error);
      }
    }, 10000); // Check every 10 seconds
  }

  private async detectPatterns(): Promise<PatternTrigger[]> {
    // Simplified pattern detection
    // In a real implementation, this would integrate with pattern detection services
    return [];
  }

  private async storeExecutionResult(
    result: SnipeExecutionResult,
    type: string
  ): Promise<void> {
    try {
      await db.insert(executionHistory).values({
        id: result.snipeId,
        type,
        success: result.success,
        executionTime: result.executionTime,
        error: result.error || null,
        result: JSON.stringify(result),
        createdAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to store execution result:", error);
    }
  }

  // Event forwarding setup
  private setupEventForwarding(): void {
    // Forward events from execution engine
    this.executionEngine.on("snipeExecuted", (data) => {
      this.emit("snipeExecuted", data);
    });

    this.executionEngine.on("snipeExecutionFailed", (data) => {
      this.emit("snipeExecutionFailed", data);
    });

    this.executionEngine.on("configUpdated", (config) => {
      this.emit("configUpdated", config);
    });

    // Forward events from price monitor
    this.priceMonitor.on("priceAlert", (alert: PriceAlert) => {
      this.emit("price_alert", alert);
    });

    this.priceMonitor.on("priceUpdate", (data) => {
      this.emit("priceUpdate", data);
    });

    this.priceMonitor.on("monitoringError", (data) => {
      this.emit("monitoringError", data);
    });
  }

  // Utility methods
  async healthCheck(): Promise<boolean> {
    try {
      const status = this.getStatus();
      return status.initialized && status.running;
    } catch {
      return false;
    }
  }

  async generateReport(): Promise<any> {
    try {
      const [status, dbStats] = await Promise.all([
        this.getStatus(),
        this.getDatabaseStats(),
      ]);

      return {
        timestamp: new Date().toISOString(),
        reportType: "auto-sniping-report",
        status,
        databaseStats: dbStats,
        priceMonitoring: {
          subscribedSymbols: this.priceMonitor.getSubscribedSymbols(),
          activeAlerts: this.priceMonitor.getActiveAlerts().length,
          marketSummary: this.priceMonitor.getMarketSummary(),
        },
        executionEngine: this.executionEngine.getExecutionStatus(),
      };
    } catch (error) {
      throw new Error(
        `Failed to generate report: ${toSafeError(error).message}`
      );
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
  }
}
