/**
 * Trading Operations Manager
 * Handles all trading execution, multi-phase strategies, and trade management
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { toSafeError } from "@/src/lib/error-type-utils";
import type {
  ModuleContext,
  MultiPhaseConfig,
  MultiPhaseResult,
  Position,
  ServiceResponse,
  TradeParameters,
  TradeResult,
} from "../types";

export class TradingOperationsManager extends BrowserCompatibleEventEmitter {
  private moduleContext: ModuleContext;
  private executionActive = false;
  private pausedState = false;

  constructor(moduleContext: ModuleContext) {
    super();
    this.moduleContext = moduleContext;
  }

  async executeTrade(params: TradeParameters): Promise<TradeResult> {
    const startTime = Date.now();

    try {
      this.moduleContext.logger.info("Executing trade", { params });

      // Validate trade parameters
      this.validateTradeParameters(params);

      // Execute the trade based on paper trading mode
      const result = this.moduleContext.config.enablePaperTrading
        ? await this.executePaperTrade(params)
        : await this.executeRealTrade(params);

      // Calculate execution time
      const executionTime = Date.now() - startTime;

      // Update metrics
      this.emit("tradeExecuted", {
        params,
        result,
        executionTime,
        timestamp: new Date().toISOString(),
      });

      return {
        ...result,
        executionTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = toSafeError(error).message;

      this.moduleContext.logger.error("Trade execution failed", {
        params,
        error: errorMessage,
        executionTime,
      });

      this.emit("tradeExecutionFailed", {
        params,
        error: errorMessage,
        executionTime,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        executionTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async executeMultiPhaseStrategy(
    config: MultiPhaseConfig
  ): Promise<MultiPhaseResult> {
    const startTime = Date.now();

    try {
      this.moduleContext.logger.info("Executing multi-phase strategy", {
        config,
      });

      const results: TradeResult[] = [];
      const errors: string[] = [];

      // Execute each phase
      for (let i = 0; i < config.phases.length; i++) {
        const phase = config.phases[i];

        try {
          // Wait for phase delay if specified
          if (phase.delayMs && i > 0) {
            await new Promise((resolve) => setTimeout(resolve, phase.delayMs));
          }

          // Execute phase
          const phaseResult = await this.executeTrade(phase.tradeParams);
          results.push(phaseResult);

          // Check if phase failed and should stop execution
          if (!phaseResult.success && phase.stopOnFailure) {
            errors.push(`Phase ${i + 1} failed: ${phaseResult.error}`);
            break;
          }

          // Update phase progress
          this.emit("phaseCompleted", {
            phaseIndex: i,
            totalPhases: config.phases.length,
            result: phaseResult,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          const errorMessage = toSafeError(error).message;
          errors.push(`Phase ${i + 1} error: ${errorMessage}`);

          if (phase.stopOnFailure) {
            break;
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const overallSuccess =
        results.length > 0 && results.every((r) => r.success);

      const result: MultiPhaseResult = {
        success: overallSuccess,
        results,
        errors: errors.length > 0 ? errors : undefined,
        executionTime,
        timestamp: new Date().toISOString(),
      };

      this.emit("multiPhaseCompleted", result);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = toSafeError(error).message;

      this.moduleContext.logger.error("Multi-phase strategy execution failed", {
        config,
        error: errorMessage,
      });

      return {
        success: false,
        results: [],
        errors: [errorMessage],
        executionTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async closePosition(
    positionId: string,
    reason: string
  ): Promise<ServiceResponse<void>> {
    try {
      this.moduleContext.logger.info("Closing position", {
        positionId,
        reason,
      });

      // Get position details
      const position = await this.getPosition(positionId);
      if (!position) {
        throw new Error(`Position ${positionId} not found`);
      }

      // Execute close trade
      const closeParams: TradeParameters = {
        symbol: position.symbol,
        side: position.side === "BUY" ? "SELL" : "BUY",
        quantity: position.quantity,
        type: "MARKET",
        reason: `Close position: ${reason}`,
      };

      const result = await this.executeTrade(closeParams);

      if (result.success) {
        this.emit("positionClosed", {
          positionId,
          reason,
          closeResult: result,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      } else {
        throw new Error(`Failed to close position: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      this.moduleContext.logger.error("Position close failed", {
        positionId,
        reason,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async closeAllPositions(
    reason: string = "System shutdown"
  ): Promise<ServiceResponse<void>> {
    try {
      this.moduleContext.logger.info("Closing all positions", { reason });

      const positions = await this.getActivePositions();
      const closePromises = positions.map((position) =>
        this.closePosition(position.id, reason)
      );

      const results = await Promise.allSettled(closePromises);
      const failures = results.filter((r) => r.status === "rejected");

      if (failures.length > 0) {
        const errorMessage = `Failed to close ${failures.length} out of ${positions.length} positions`;
        this.moduleContext.logger.warn(errorMessage, { failures });

        return {
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        };
      }

      this.emit("allPositionsClosed", {
        reason,
        positionCount: positions.length,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = toSafeError(error).message;
      this.moduleContext.logger.error("Close all positions failed", {
        reason,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getActivePositions(): Promise<Position[]> {
    try {
      // Get active positions from position manager
      const activePositions =
        this.moduleContext.positionManager.getActivePositions();
      return Array.from(activePositions.values());
    } catch (error) {
      this.moduleContext.logger.error("Failed to get active positions", {
        error,
      });
      return [];
    }
  }

  async getPosition(positionId: string): Promise<Position | undefined> {
    try {
      const activePositions =
        this.moduleContext.positionManager.getActivePositions();
      return activePositions.get(positionId);
    } catch (error) {
      this.moduleContext.logger.error("Failed to get position", {
        positionId,
        error,
      });
      return undefined;
    }
  }

  async startExecution(): Promise<ServiceResponse<void>> {
    try {
      if (this.executionActive) {
        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      }

      this.executionActive = true;
      this.pausedState = false;

      this.emit("executionStarted", {
        timestamp: new Date().toISOString(),
      });

      this.moduleContext.logger.info("Trading execution started");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: toSafeError(error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async stopExecution(): Promise<ServiceResponse<void>> {
    try {
      this.executionActive = false;
      this.pausedState = false;

      this.emit("executionStopped", {
        timestamp: new Date().toISOString(),
      });

      this.moduleContext.logger.info("Trading execution stopped");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: toSafeError(error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async pauseExecution(): Promise<ServiceResponse<void>> {
    try {
      this.pausedState = true;

      this.emit("executionPaused", {
        timestamp: new Date().toISOString(),
      });

      this.moduleContext.logger.info("Trading execution paused");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: toSafeError(error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async resumeExecution(): Promise<ServiceResponse<void>> {
    try {
      this.pausedState = false;

      this.emit("executionResumed", {
        timestamp: new Date().toISOString(),
      });

      this.moduleContext.logger.info("Trading execution resumed");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: toSafeError(error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private validateTradeParameters(params: TradeParameters): void {
    if (!params.symbol) {
      throw new Error("Symbol is required");
    }

    if (!params.side || (params.side !== "BUY" && params.side !== "SELL")) {
      throw new Error("Valid side (BUY/SELL) is required");
    }

    if (!params.quantity || params.quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }

    if (!params.type) {
      throw new Error("Order type is required");
    }
  }

  private async executePaperTrade(
    params: TradeParameters
  ): Promise<TradeResult> {
    // Simulate paper trade execution
    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate API delay

    return {
      success: true,
      data: {
        orderId: `paper-${Date.now()}`,
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity.toString(),
        price: params.price?.toString() || "0",
        status: "FILLED",
        type: params.type,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async executeRealTrade(
    params: TradeParameters
  ): Promise<TradeResult> {
    try {
      // Execute real trade through MEXC service
      const result = await this.moduleContext.mexcService.executeTrade(params);

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Real trade execution failed: ${toSafeError(error).message}`
      );
    }
  }

  // Getters
  get isExecutionActive(): boolean {
    return this.executionActive;
  }

  get isPaused(): boolean {
    return this.pausedState;
  }

  get canExecute(): boolean {
    return this.executionActive && !this.pausedState;
  }

  async getExecutionReport(): Promise<any> {
    try {
      const activePositions = await this.getActivePositions();

      return {
        executionActive: this.executionActive,
        pausedState: this.pausedState,
        activePositionCount: activePositions.length,
        activePositions: activePositions.map((p) => ({
          id: p.id,
          symbol: p.symbol,
          side: p.side,
          quantity: p.quantity,
          entryPrice: p.entryPrice,
          status: p.status,
          openTime: p.openTime,
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        executionActive: false,
        pausedState: false,
        activePositionCount: 0,
        activePositions: [],
        error: toSafeError(error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
