/**
 * Advanced Order Manager
 * 
 * Provides sophisticated order management capabilities including:
 * - OCO (One-Cancels-Other) orders
 * - Trailing stop orders
 * - Bracket orders
 * - Position sizing algorithms
 * - Advanced risk controls
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type { 
  ModuleContext, 
  Position, 
  ServiceResponse,
  TradeParameters, 
  TradeResult 
} from "./types";

// ============================================================================
// Advanced Order Types
// ============================================================================

export interface OCOOrderParams {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  stopPrice: number;
  stopLimitPrice?: number;
  timeInForce?: "GTC" | "IOC" | "FOK";
}

export interface TrailingStopParams {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  callbackRate: number; // Percentage for trailing
  activationPrice?: number;
}

export interface BracketOrderParams {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price?: number; // For limit entry
  takeProfitPrice: number;
  stopLossPrice: number;
  timeInForce?: "GTC" | "IOC" | "FOK";
}

export interface PositionSizingConfig {
  riskPerTrade: number; // Percentage of portfolio to risk
  maxPositionSize: number; // Maximum position size in USDT
  volatilityMultiplier: number; // Adjust size based on volatility
  correlationLimit: number; // Limit correlated positions
}

// ============================================================================
// Advanced Order Manager Class
// ============================================================================

export class AdvancedOrderManager {
  private context: ModuleContext;
  private activeOCOOrders = new Map<string, OCOOrderParams>();
  private activeTrailingStops = new Map<string, TrailingStopMonitor>();
  private activeBracketOrders = new Map<string, BracketOrderMonitor>();

  constructor(context: ModuleContext) {
    this.context = context;
  }

  // ============================================================================
  // OCO (One-Cancels-Other) Orders
  // ============================================================================

  /**
   * Place an OCO order
   */
  async placeOCOOrder(params: OCOOrderParams): Promise<ServiceResponse<{
    limitOrderId: string;
    stopOrderId: string;
  }>> {
    try {
      this.context.logger.info("Placing OCO order", {
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        stopPrice: params.stopPrice
      });

      // Validate OCO parameters
      await this.validateOCOParameters(params);

      // Place limit order
      const limitOrderResult = await this.context.mexcService.placeOrder({
        symbol: params.symbol,
        side: params.side,
        type: "LIMIT",
        quantity: params.quantity.toString(),
        price: params.price.toString(),
        timeInForce: params.timeInForce || "GTC"
      });

      if (!limitOrderResult.success) {
        throw new Error(`Failed to place limit order: ${limitOrderResult.error}`);
      }

      // Place stop order
      const stopOrderResult = await this.context.mexcService.placeOrder({
        symbol: params.symbol,
        side: params.side,
        type: "LIMIT", // MEXC uses LIMIT for stop orders
        quantity: params.quantity.toString(),
        price: (params.stopLimitPrice || params.stopPrice).toString(),
        timeInForce: params.timeInForce || "GTC"
      });

      if (!stopOrderResult.success) {
        // Cancel the limit order if stop order fails
        await this.context.mexcService.cancelOrder(
          params.symbol, 
          parseInt(limitOrderResult.data.orderId)
        );
        throw new Error(`Failed to place stop order: ${stopOrderResult.error}`);
      }

      const ocoId = `oco_${Date.now()}`;
      
      // Store OCO order for monitoring
      this.activeOCOOrders.set(ocoId, params);
      
      // Set up monitoring for OCO orders
      this.monitorOCOOrder(ocoId, {
        limitOrderId: limitOrderResult.data.orderId,
        stopOrderId: stopOrderResult.data.orderId,
        symbol: params.symbol
      });

      return {
        success: true,
        data: {
          limitOrderId: limitOrderResult.data.orderId,
          stopOrderId: stopOrderResult.data.orderId
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to place OCO order", {
        error: safeError.message,
        params
      });

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ============================================================================
  // Trailing Stop Orders
  // ============================================================================

  /**
   * Place a trailing stop order
   */
  async placeTrailingStop(params: TrailingStopParams): Promise<ServiceResponse<string>> {
    try {
      this.context.logger.info("Placing trailing stop order", {
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        callbackRate: params.callbackRate
      });

      // Validate parameters
      if (params.callbackRate <= 0 || params.callbackRate > 50) {
        throw new Error("Callback rate must be between 0 and 50%");
      }

      // Get current market price
      const currentPrice = await this.getCurrentPrice(params.symbol);
      if (!currentPrice) {
        throw new Error(`Unable to get current price for ${params.symbol}`);
      }

      const trailingStopId = `trailing_${Date.now()}`;
      
      // Create trailing stop monitor
      const monitor = new TrailingStopMonitor(
        trailingStopId,
        params,
        currentPrice,
        this.context
      );

      this.activeTrailingStops.set(trailingStopId, monitor);
      
      // Start monitoring
      monitor.start();

      return {
        success: true,
        data: trailingStopId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to place trailing stop", {
        error: safeError.message,
        params
      });

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ============================================================================
  // Bracket Orders
  // ============================================================================

  /**
   * Place a bracket order (entry + take profit + stop loss)
   */
  async placeBracketOrder(params: BracketOrderParams): Promise<ServiceResponse<{
    entryOrderId?: string;
    takeProfitOrderId: string;
    stopLossOrderId: string;
  }>> {
    try {
      this.context.logger.info("Placing bracket order", {
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        takeProfitPrice: params.takeProfitPrice,
        stopLossPrice: params.stopLossPrice
      });

      // Validate bracket parameters
      await this.validateBracketParameters(params);

      let entryOrderId: string | undefined;

      // Place entry order if price is specified (limit order)
      if (params.price) {
        const entryResult = await this.context.mexcService.placeOrder({
          symbol: params.symbol,
          side: params.side,
          type: "LIMIT",
          quantity: params.quantity.toString(),
          price: params.price.toString(),
          timeInForce: params.timeInForce || "GTC"
        });

        if (!entryResult.success) {
          throw new Error(`Failed to place entry order: ${entryResult.error}`);
        }

        entryOrderId = entryResult.data.orderId;
      }

      // Place take profit order (opposite side)
      const takeProfitSide = params.side === "BUY" ? "SELL" : "BUY";
      const takeProfitResult = await this.context.mexcService.placeOrder({
        symbol: params.symbol,
        side: takeProfitSide,
        type: "LIMIT",
        quantity: params.quantity.toString(),
        price: params.takeProfitPrice.toString(),
        timeInForce: params.timeInForce || "GTC"
      });

      if (!takeProfitResult.success) {
        // Cancel entry order if it exists
        if (entryOrderId) {
          await this.context.mexcService.cancelOrder(params.symbol, parseInt(entryOrderId));
        }
        throw new Error(`Failed to place take profit order: ${takeProfitResult.error}`);
      }

      // Place stop loss order (opposite side)
      const stopLossResult = await this.context.mexcService.placeOrder({
        symbol: params.symbol,
        side: takeProfitSide,
        type: "LIMIT",
        quantity: params.quantity.toString(),
        price: params.stopLossPrice.toString(),
        timeInForce: params.timeInForce || "GTC"
      });

      if (!stopLossResult.success) {
        // Cancel previous orders
        if (entryOrderId) {
          await this.context.mexcService.cancelOrder(params.symbol, parseInt(entryOrderId));
        }
        await this.context.mexcService.cancelOrder(
          params.symbol, 
          parseInt(takeProfitResult.data.orderId)
        );
        throw new Error(`Failed to place stop loss order: ${stopLossResult.error}`);
      }

      const bracketId = `bracket_${Date.now()}`;
      
      // Set up bracket order monitoring
      const monitor = new BracketOrderMonitor(
        bracketId,
        {
          entryOrderId,
          takeProfitOrderId: takeProfitResult.data.orderId,
          stopLossOrderId: stopLossResult.data.orderId,
          symbol: params.symbol
        },
        this.context
      );

      this.activeBracketOrders.set(bracketId, monitor);
      monitor.start();

      return {
        success: true,
        data: {
          entryOrderId,
          takeProfitOrderId: takeProfitResult.data.orderId,
          stopLossOrderId: stopLossResult.data.orderId
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to place bracket order", {
        error: safeError.message,
        params
      });

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ============================================================================
  // Position Sizing Algorithms
  // ============================================================================

  /**
   * Calculate optimal position size based on risk parameters
   */
  async calculatePositionSize(
    symbol: string,
    entryPrice: number,
    stopLossPrice: number,
    config: PositionSizingConfig
  ): Promise<number> {
    try {
      // Get portfolio value
      const portfolioValue = await this.getPortfolioValue();
      
      // Calculate risk amount (percentage of portfolio)
      const riskAmount = portfolioValue * (config.riskPerTrade / 100);
      
      // Calculate risk per unit
      const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
      
      // Basic position size calculation
      let positionSize = riskAmount / riskPerUnit;
      
      // Apply maximum position size limit
      const maxSizeInUnits = config.maxPositionSize / entryPrice;
      positionSize = Math.min(positionSize, maxSizeInUnits);
      
      // Adjust for volatility
      const volatility = await this.estimateVolatility(symbol);
      const volatilityAdjustment = 1 / (1 + volatility * config.volatilityMultiplier);
      positionSize *= volatilityAdjustment;
      
      // Check correlation limits
      const correlationAdjustment = await this.calculateCorrelationAdjustment(
        symbol, 
        config.correlationLimit
      );
      positionSize *= correlationAdjustment;
      
      // Ensure minimum viable position size
      const minPositionValue = 10; // $10 minimum
      const minUnits = minPositionValue / entryPrice;
      positionSize = Math.max(positionSize, minUnits);
      
      this.context.logger.info("Position size calculated", {
        symbol,
        entryPrice,
        stopLossPrice,
        riskAmount,
        rawPositionSize: riskAmount / riskPerUnit,
        volatilityAdjustment,
        correlationAdjustment,
        finalPositionSize: positionSize
      });
      
      return positionSize;
      
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to calculate position size", {
        error: safeError.message,
        symbol,
        entryPrice,
        stopLossPrice
      });
      
      // Return conservative fallback position size
      return 50 / entryPrice; // $50 worth
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async validateOCOParameters(params: OCOOrderParams): Promise<void> {
    if (params.side === "BUY" && params.stopPrice >= params.price) {
      throw new Error("For BUY OCO orders, stop price must be below limit price");
    }
    
    if (params.side === "SELL" && params.stopPrice <= params.price) {
      throw new Error("For SELL OCO orders, stop price must be above limit price");
    }
    
    if (params.quantity <= 0) {
      throw new Error("Quantity must be positive");
    }
  }

  private async validateBracketParameters(params: BracketOrderParams): Promise<void> {
    if (params.side === "BUY") {
      if (params.takeProfitPrice <= (params.price || 0)) {
        throw new Error("Take profit price must be above entry price for BUY orders");
      }
      if (params.stopLossPrice >= (params.price || Infinity)) {
        throw new Error("Stop loss price must be below entry price for BUY orders");
      }
    } else {
      if (params.takeProfitPrice >= (params.price || Infinity)) {
        throw new Error("Take profit price must be below entry price for SELL orders");
      }
      if (params.stopLossPrice <= (params.price || 0)) {
        throw new Error("Stop loss price must be above entry price for SELL orders");
      }
    }
  }

  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const ticker = await this.context.mexcService.getTicker(symbol);
      if (ticker.success && ticker.data?.price) {
        return parseFloat(ticker.data.price);
      }
      return null;
    } catch (error) {
      this.context.logger.error(`Failed to get current price for ${symbol}`, error);
      return null;
    }
  }

  private async getPortfolioValue(): Promise<number> {
    try {
      const balance = await this.context.mexcService.getAccountBalance();
      if (balance.success && balance.data) {
        // Calculate total portfolio value in USDT
        let totalValue = 0;
        
        for (const asset of balance.data) {
          if (asset.asset === "USDT") {
            totalValue += parseFloat(asset.free) + parseFloat(asset.locked);
          } else {
            // Convert other assets to USDT value
            const ticker = await this.context.mexcService.getTicker(`${asset.asset}USDT`);
            if (ticker.success && ticker.data?.price) {
              const price = parseFloat(ticker.data.price);
              const assetBalance = parseFloat(asset.free) + parseFloat(asset.locked);
              totalValue += assetBalance * price;
            }
          }
        }
        
        return totalValue;
      }
      
      return 1000; // Fallback portfolio value
    } catch (error) {
      this.context.logger.error("Failed to get portfolio value", error);
      return 1000; // Fallback
    }
  }

  private async estimateVolatility(symbol: string): Promise<number> {
    try {
      // Simple volatility estimation based on recent price changes
      // In a real implementation, this would use historical data
      const ticker = await this.context.mexcService.getTicker(symbol);
      if (ticker.success && ticker.data?.priceChangePercent) {
        const priceChange = Math.abs(parseFloat(ticker.data.priceChangePercent));
        return priceChange / 100; // Convert percentage to decimal
      }
      
      return 0.05; // 5% default volatility
    } catch (error) {
      return 0.05; // Fallback volatility
    }
  }

  private async calculateCorrelationAdjustment(
    symbol: string, 
    correlationLimit: number
  ): Promise<number> {
    try {
      // Simplified correlation calculation
      // In a real implementation, this would analyze existing positions
      // and their correlation with the new symbol
      
      // For now, return a conservative adjustment
      return 0.8; // 20% reduction for correlation risk
    } catch (error) {
      return 0.8; // Conservative fallback
    }
  }

  private monitorOCOOrder(
    ocoId: string, 
    orderIds: { limitOrderId: string; stopOrderId: string; symbol: string }
  ): void {
    // Implement OCO monitoring logic
    const checkInterval = 5000; // 5 seconds
    
    const monitor = setInterval(async () => {
      try {
        // Check status of both orders
        const limitStatus = await this.context.mexcService.getOrderStatus(
          orderIds.symbol, 
          parseInt(orderIds.limitOrderId)
        );
        
        const stopStatus = await this.context.mexcService.getOrderStatus(
          orderIds.symbol, 
          parseInt(orderIds.stopOrderId)
        );
        
        // If one order is filled, cancel the other
        if (limitStatus.success && limitStatus.data?.status === "FILLED") {
          await this.context.mexcService.cancelOrder(
            orderIds.symbol, 
            parseInt(orderIds.stopOrderId)
          );
          clearInterval(monitor);
          this.activeOCOOrders.delete(ocoId);
        } else if (stopStatus.success && stopStatus.data?.status === "FILLED") {
          await this.context.mexcService.cancelOrder(
            orderIds.symbol, 
            parseInt(orderIds.limitOrderId)
          );
          clearInterval(monitor);
          this.activeOCOOrders.delete(ocoId);
        }
        
      } catch (error) {
        this.context.logger.error("OCO monitoring error", {
          ocoId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, checkInterval);
  }

  /**
   * Cancel all active advanced orders
   */
  async cancelAllAdvancedOrders(): Promise<ServiceResponse<void>> {
    try {
      // Cancel OCO orders
      for (const [ocoId] of this.activeOCOOrders) {
        // Implementation would cancel associated orders
      }
      
      // Stop trailing stops
      for (const [trailingId, monitor] of this.activeTrailingStops) {
        monitor.stop();
      }
      
      // Cancel bracket orders
      for (const [bracketId, monitor] of this.activeBracketOrders) {
        monitor.stop();
      }
      
      // Clear all active orders
      this.activeOCOOrders.clear();
      this.activeTrailingStops.clear();
      this.activeBracketOrders.clear();
      
      return {
        success: true,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get status of all advanced orders
   */
  getAdvancedOrdersStatus() {
    return {
      activeOCOOrders: this.activeOCOOrders.size,
      activeTrailingStops: this.activeTrailingStops.size,
      activeBracketOrders: this.activeBracketOrders.size,
      totalAdvancedOrders: this.activeOCOOrders.size + 
                          this.activeTrailingStops.size + 
                          this.activeBracketOrders.size
    };
  }
}

// ============================================================================
// Helper Classes for Order Monitoring
// ============================================================================

class TrailingStopMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private highestPrice: number;
  private lowestPrice: number;
  private triggered = false;

  constructor(
    private id: string,
    private params: TrailingStopParams,
    initialPrice: number,
    private context: ModuleContext
  ) {
    this.highestPrice = initialPrice;
    this.lowestPrice = initialPrice;
  }

  start(): void {
    this.intervalId = setInterval(() => this.monitor(), 5000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async monitor(): Promise<void> {
    if (this.triggered) return;

    try {
      // Get current price
      const ticker = await this.context.mexcService.getTicker(this.params.symbol);
      if (!ticker.success || !ticker.data?.price) return;

      const currentPrice = parseFloat(ticker.data.price);

      // Update price extremes
      this.highestPrice = Math.max(this.highestPrice, currentPrice);
      this.lowestPrice = Math.min(this.lowestPrice, currentPrice);

      // Calculate trailing stop price
      let shouldTrigger = false;
      let stopPrice = 0;

      if (this.params.side === "SELL") {
        // For sell orders, trail from the highest price
        stopPrice = this.highestPrice * (1 - this.params.callbackRate / 100);
        shouldTrigger = currentPrice <= stopPrice;
      } else {
        // For buy orders, trail from the lowest price
        stopPrice = this.lowestPrice * (1 + this.params.callbackRate / 100);
        shouldTrigger = currentPrice >= stopPrice;
      }

      if (shouldTrigger) {
        await this.triggerStop(currentPrice);
      }

    } catch (error) {
      this.context.logger.error("Trailing stop monitoring error", {
        id: this.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async triggerStop(currentPrice: number): Promise<void> {
    this.triggered = true;
    this.stop();

    try {
      // Place market order to close position
      const result = await this.context.mexcService.placeOrder({
        symbol: this.params.symbol,
        side: this.params.side,
        type: "MARKET",
        quantity: this.params.quantity.toString()
      });

      this.context.logger.info("Trailing stop triggered", {
        id: this.id,
        symbol: this.params.symbol,
        triggerPrice: currentPrice,
        orderId: result.data?.orderId
      });

    } catch (error) {
      this.context.logger.error("Failed to execute trailing stop", {
        id: this.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

class BracketOrderMonitor {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private id: string,
    private orderIds: {
      entryOrderId?: string;
      takeProfitOrderId: string;
      stopLossOrderId: string;
      symbol: string;
    },
    private context: ModuleContext
  ) {}

  start(): void {
    this.intervalId = setInterval(() => this.monitor(), 5000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async monitor(): Promise<void> {
    try {
      // Check if take profit or stop loss orders are filled
      const tpStatus = await this.context.mexcService.getOrderStatus(
        this.orderIds.symbol,
        parseInt(this.orderIds.takeProfitOrderId)
      );

      const slStatus = await this.context.mexcService.getOrderStatus(
        this.orderIds.symbol,
        parseInt(this.orderIds.stopLossOrderId)
      );

      // If either is filled, cancel the other
      if (tpStatus.success && tpStatus.data?.status === "FILLED") {
        await this.context.mexcService.cancelOrder(
          this.orderIds.symbol,
          parseInt(this.orderIds.stopLossOrderId)
        );
        this.stop();
      } else if (slStatus.success && slStatus.data?.status === "FILLED") {
        await this.context.mexcService.cancelOrder(
          this.orderIds.symbol,
          parseInt(this.orderIds.takeProfitOrderId)
        );
        this.stop();
      }

    } catch (error) {
      this.context.logger.error("Bracket order monitoring error", {
        id: this.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}