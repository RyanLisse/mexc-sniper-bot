/**
 * Validation Module
 *
 * Handles safety checks, pre-trade validation, and parameter validation for auto-sniping.
 * Extracted from auto-sniping.ts for better modularity.
 */

import type { ModuleContext, TradeParameters } from "../auto-sniping-types";

export class ValidationModule {
  private context: ModuleContext;

  constructor(context: ModuleContext) {
    this.context = context;
  }

  /**
   * Perform comprehensive pre-trade validation
   */
  async performPreTradeValidation(params: TradeParameters): Promise<void> {
    // Check safety coordinator
    if (this.context.safetyCoordinator) {
      // Check if safety coordinator has a status method available
      if (
        typeof (this.context.safetyCoordinator as any).getCurrentStatus ===
        "function"
      ) {
        const safetyStatus = (
          this.context.safetyCoordinator as any
        ).getCurrentStatus();
        if (safetyStatus?.overall?.safetyLevel !== "safe") {
          throw new Error(
            `Trading blocked by safety system: ${safetyStatus.overall.safetyLevel}`
          );
        }
      }
      // If no getCurrentStatus method, assume safe to proceed
    }

    // Check module health
    if (!this.context.config) {
      throw new Error("Auto-sniping module configuration is not available");
    }

    // Check position limits
    const maxPositions = this.context.config.maxConcurrentPositions || 10;
    const currentPositions = this.getCurrentPositionCount();

    if (currentPositions >= maxPositions) {
      throw new Error(
        `Maximum concurrent positions reached: ${currentPositions}/${maxPositions}`
      );
    }

    // Validate required parameters
    if (!params.symbol || !params.side || !params.type) {
      throw new Error("Missing required trading parameters");
    }

    if (!params.quoteOrderQty || params.quoteOrderQty <= 0) {
      throw new Error("Invalid position size");
    }

    // Validate confidence score if provided
    if (params.confidenceScore !== undefined) {
      const minConfidence = this.context.config.confidenceThreshold || 0;
      if (params.confidenceScore < minConfidence) {
        throw new Error(
          `Confidence score ${params.confidenceScore} below threshold ${minConfidence}`
        );
      }
    }

    // Check balance requirements
    await this.validateBalanceRequirements(params);
  }

  /**
   * Validate order parameters before execution
   */
  async validateOrderParameters(
    orderParams: TradeParameters,
    currentPrice: number
  ): Promise<void> {
    // Validate symbol format
    if (!orderParams.symbol || typeof orderParams.symbol !== "string") {
      throw new Error("Invalid symbol format");
    }

    // Validate side
    if (!["BUY", "SELL"].includes(orderParams.side)) {
      throw new Error("Invalid order side");
    }

    // Validate order type
    if (!["MARKET", "LIMIT", "STOP_LIMIT"].includes(orderParams.type)) {
      throw new Error("Invalid order type");
    }

    // Validate time in force
    if (
      orderParams.timeInForce &&
      !["GTC", "IOC", "FOK"].includes(orderParams.timeInForce)
    ) {
      throw new Error("Invalid time in force");
    }

    // Validate quote order quantity
    if (orderParams.quoteOrderQty) {
      const minOrderValue = this.getMinOrderValue(orderParams.symbol);
      if (orderParams.quoteOrderQty < minOrderValue) {
        throw new Error(
          `Order value too small. Minimum: ${minOrderValue} USDT`
        );
      }

      const maxOrderValue = this.getMaxOrderValue(orderParams.symbol);
      if (orderParams.quoteOrderQty > maxOrderValue) {
        throw new Error(
          `Order value too large. Maximum: ${maxOrderValue} USDT`
        );
      }
    }

    // Market price sanity check
    if (currentPrice <= 0) {
      throw new Error("Invalid market price");
    }

    // Price deviation check for limit orders
    if (orderParams.type === "LIMIT" && orderParams.price) {
      const priceDeviation =
        Math.abs(orderParams.price - currentPrice) / currentPrice;
      const maxDeviation = 0.1; // 10% max deviation

      if (priceDeviation > maxDeviation) {
        throw new Error(
          `Limit price deviation too high: ${(priceDeviation * 100).toFixed(2)}% > ${maxDeviation * 100}%`
        );
      }
    }
  }

  /**
   * Validate risk parameters
   */
  validateRiskParameters(params: TradeParameters): {
    isValid: boolean;
    issues: string[];
  } {
    const validation = {
      isValid: true,
      issues: [] as string[],
    };

    // Check stop-loss percentage
    if (params.stopLossPercent !== undefined) {
      if (params.stopLossPercent < 0 || params.stopLossPercent > 50) {
        validation.isValid = false;
        validation.issues.push(
          "Stop-loss percentage must be between 0% and 50%"
        );
      }
    }

    // Check take-profit percentage
    if (params.takeProfitPercent !== undefined) {
      if (params.takeProfitPercent < 0 || params.takeProfitPercent > 500) {
        validation.isValid = false;
        validation.issues.push(
          "Take-profit percentage must be between 0% and 500%"
        );
      }
    }

    // Check risk-reward ratio
    if (params.stopLossPercent && params.takeProfitPercent) {
      const riskRewardRatio = params.takeProfitPercent / params.stopLossPercent;
      const minRiskReward = 1.5; // Minimum 1:1.5 risk-reward

      if (riskRewardRatio < minRiskReward) {
        validation.issues.push(
          `Poor risk-reward ratio: 1:${riskRewardRatio.toFixed(2)} < 1:${minRiskReward}`
        );
        // Don't mark as invalid, just warn
      }
    }

    // Check position size relative to account
    if (params.quoteOrderQty) {
      const _maxPositionPercent =
        this.context.config.maxPositionSizePercent || 10;
      // This would need account balance info to validate properly
      // For now, just check against a reasonable absolute maximum
      const absoluteMaxPosition = 10000; // USDT

      if (params.quoteOrderQty > absoluteMaxPosition) {
        validation.isValid = false;
        validation.issues.push(
          `Position size too large: ${params.quoteOrderQty} > ${absoluteMaxPosition} USDT`
        );
      }
    }

    return validation;
  }

  /**
   * Validate market conditions for trading
   */
  async validateMarketConditions(
    symbol: string,
    params: TradeParameters
  ): Promise<{
    isValid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const validation = {
      isValid: true,
      issues: [] as string[],
      warnings: [] as string[],
    };

    try {
      // Check if market is open/active
      const isActive = await this.isMarketActive(symbol);
      if (!isActive) {
        validation.isValid = false;
        validation.issues.push(`Market for ${symbol} is not active`);
      }

      // Check volatility
      const volatility = await this.getMarketVolatility(symbol);
      if (volatility !== null) {
        const maxVolatility = this.context.config.maxVolatilityPercent || 15;

        if (volatility > maxVolatility) {
          validation.warnings.push(
            `High market volatility: ${volatility.toFixed(2)}% > ${maxVolatility}%`
          );
        }
      }

      // Check liquidity
      const liquidity = await this.checkLiquidity(symbol, params);
      if (!liquidity.sufficient) {
        validation.isValid = false;
        validation.issues.push(
          liquidity.reason || "Insufficient market liquidity"
        );
      }

      // Check spread
      const spread = await this.getSpreadPercentage(symbol);
      if (spread !== null) {
        const maxSpread = this.context.config.maxSpreadPercent || 2;

        if (spread > maxSpread) {
          validation.isValid = false;
          validation.issues.push(
            `Bid-ask spread too wide: ${spread.toFixed(2)}% > ${maxSpread}%`
          );
        }
      }
    } catch (error) {
      validation.isValid = false;
      validation.issues.push(
        `Market validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return validation;
  }

  /**
   * Validate configuration settings
   */
  validateConfiguration(): {
    isValid: boolean;
    issues: string[];
  } {
    const validation = {
      isValid: true,
      issues: [] as string[],
    };

    const config = this.context.config;

    if (!config) {
      validation.isValid = false;
      validation.issues.push("Configuration is not available");
      return validation;
    }

    // Check required configuration values
    if (typeof config.autoSnipingEnabled !== "boolean") {
      validation.isValid = false;
      validation.issues.push("autoSnipingEnabled must be a boolean");
    }

    if (
      typeof config.confidenceThreshold !== "number" ||
      config.confidenceThreshold < 0 ||
      config.confidenceThreshold > 100
    ) {
      validation.isValid = false;
      validation.issues.push(
        "confidenceThreshold must be a number between 0 and 100"
      );
    }

    if (
      typeof config.snipeCheckInterval !== "number" ||
      config.snipeCheckInterval < 1000
    ) {
      validation.isValid = false;
      validation.issues.push("snipeCheckInterval must be at least 1000ms");
    }

    // Check optional but important configurations
    if (config.maxConcurrentPositions !== undefined) {
      if (
        typeof config.maxConcurrentPositions !== "number" ||
        config.maxConcurrentPositions < 1 ||
        config.maxConcurrentPositions > 100
      ) {
        validation.issues.push(
          "maxConcurrentPositions should be between 1 and 100"
        );
      }
    }

    return validation;
  }

  // Helper methods
  private getCurrentPositionCount(): number {
    // This would need to be provided by the position manager
    // For now, return 0 as placeholder
    return 0;
  }

  private async validateBalanceRequirements(
    params: TradeParameters
  ): Promise<void> {
    // This would need to check actual account balance
    // For now, just validate the order size is reasonable
    if (params.quoteOrderQty && params.quoteOrderQty > 100000) {
      throw new Error("Order size exceeds reasonable limits");
    }
  }

  private getMinOrderValue(_symbol: string): number {
    // This could be configurable per symbol
    return 5; // USDT minimum
  }

  private getMaxOrderValue(_symbol: string): number {
    // This could be configurable per symbol or account
    return 50000; // USDT maximum
  }

  private async isMarketActive(symbol: string): Promise<boolean> {
    try {
      if (
        this.context.mexcService &&
        typeof this.context.mexcService.getTicker === "function"
      ) {
        const ticker = await this.context.mexcService.getTicker(symbol);
        return ticker.success && ticker.data;
      }
      return true; // Assume active if we can't check
    } catch (error) {
      this.context.logger.warn(
        `Could not verify if market ${symbol} is active`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return true; // Assume active on error
    }
  }

  private async getMarketVolatility(symbol: string): Promise<number | null> {
    try {
      if (
        this.context.mexcService &&
        typeof this.context.mexcService.getTicker === "function"
      ) {
        const ticker = await this.context.mexcService.getTicker(symbol);
        if (ticker.success && ticker.data) {
          const data = ticker.data as any;
          if (data.priceChangePercent) {
            return Math.abs(parseFloat(data.priceChangePercent));
          }
        }
      }
      return null;
    } catch (_error) {
      return null;
    }
  }

  private async checkLiquidity(
    symbol: string,
    params: TradeParameters
  ): Promise<{ sufficient: boolean; reason?: string }> {
    try {
      if (
        !this.context.mexcService ||
        typeof this.context.mexcService.getOrderBook !== "function"
      ) {
        return { sufficient: true }; // Can't check, assume sufficient
      }

      const orderBook = await this.context.mexcService.getOrderBook(symbol, 20);

      if (!orderBook.success || !orderBook.data) {
        return { sufficient: false, reason: "Unable to get order book data" };
      }

      const { bids, asks } = orderBook.data;
      const orders = params.side === "BUY" ? asks : bids;

      if (!orders || orders.length === 0) {
        return { sufficient: false, reason: "No liquidity on desired side" };
      }

      // Check if there's enough liquidity for the order
      if (params.quoteOrderQty && params.side === "BUY") {
        let totalLiquidity = 0;
        for (const [priceStr, quantityStr] of orders) {
          const price = parseFloat(priceStr);
          const quantity = parseFloat(quantityStr);
          totalLiquidity += price * quantity;

          if (totalLiquidity >= params.quoteOrderQty) {
            return { sufficient: true };
          }
        }

        return {
          sufficient: false,
          reason: `Insufficient liquidity: ${totalLiquidity} < ${params.quoteOrderQty} USDT`,
        };
      }

      return { sufficient: true };
    } catch (_error) {
      return { sufficient: true }; // Assume sufficient on error
    }
  }

  private async getSpreadPercentage(symbol: string): Promise<number | null> {
    try {
      if (
        !this.context.mexcService ||
        typeof this.context.mexcService.getOrderBook !== "function"
      ) {
        return null;
      }

      const orderBook = await this.context.mexcService.getOrderBook(symbol, 1);

      if (!orderBook.success || !orderBook.data) {
        return null;
      }

      const { bids, asks } = orderBook.data;

      if (!bids || !asks || bids.length === 0 || asks.length === 0) {
        return null;
      }

      const bestBid = parseFloat(bids[0][0]);
      const bestAsk = parseFloat(asks[0][0]);
      const spread = bestAsk - bestBid;
      const midPrice = (bestBid + bestAsk) / 2;

      return (spread / midPrice) * 100;
    } catch (_error) {
      return null;
    }
  }
}
