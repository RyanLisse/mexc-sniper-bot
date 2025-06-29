/**
 * MEXC Trading Service Adapter
 * Adapts the existing MEXC trading service to match the domain interface
 */

import type { TradingService } from "@/src/application/interfaces/trading-repository";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { UnifiedMexcServiceV2 } from "@/src/services/api/unified-mexc-service-v2";
import type { TradingOrderData } from "@/src/services/api/unified-mexc-trading";
import type { ComprehensiveSafetyCoordinator } from "@/src/services/risk/comprehensive-safety-coordinator";
import type { LoggerContext } from "@/src/types/logger-types";

export class MexcTradingServiceAdapter implements TradingService {
  constructor(
    private readonly mexcService: UnifiedMexcServiceV2,
    private readonly safetyCoordinator?: ComprehensiveSafetyCoordinator,
    private readonly logger: {
      info: (message: string, context?: LoggerContext) => void;
      warn: (message: string, context?: LoggerContext) => void;
      error: (message: string, context?: LoggerContext) => void;
      debug: (message: string, context?: LoggerContext) => void;
    } = console
  ) {}

  async executeTrade(params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT" | "STOP_LIMIT";
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: "GTC" | "IOC" | "FOK";
    isAutoSnipe?: boolean;
    confidenceScore?: number;
    paperTrade?: boolean;
  }): Promise<{
    success: boolean;
    data?: {
      orderId: string;
      clientOrderId?: string;
      symbol: string;
      side: string;
      type: string;
      quantity: string;
      price: string;
      status: string;
      executedQty: string;
      timestamp: string;
    };
    error?: string;
    executionTime?: number;
  }> {
    const startTime = Date.now();

    try {
      this.logger.info("Executing trade through MEXC service", {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        isAutoSnipe: params.isAutoSnipe,
        paperTrade: params.paperTrade,
      });

      // Check safety coordinator if available
      if (this.safetyCoordinator) {
        const safetyStatus = this.safetyCoordinator.getStatus();
        if (safetyStatus.overall.safetyLevel !== "safe") {
          return {
            success: false,
            error: `Trading blocked by safety system: ${safetyStatus.overall.safetyLevel}`,
            executionTime: Date.now() - startTime,
          };
        }
      }

      // Handle paper trading
      if (params.paperTrade) {
        return await this.executePaperTrade(params, startTime);
      }

      // Prepare MEXC API parameters
      const mexcParams = this.prepareMexcParams(params);

      // Execute trade through MEXC service
      const result = await this.mexcService.placeOrder(mexcParams);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || "Trade execution failed",
          executionTime: Date.now() - startTime,
        };
      }

      // Transform MEXC response to domain format
      const transformedResult = this.transformMexcResponse(result.data, startTime);

      this.logger.info("Trade executed successfully", {
        orderId: transformedResult.data?.orderId,
        symbol: params.symbol,
        executedQty: transformedResult.data?.executedQty,
        executionTime: transformedResult.executionTime,
      });

      return transformedResult;
    } catch (error) {
      const safeError = toSafeError(error);

      this.logger.error("Trade execution failed", {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        error: safeError.message,
        executionTime: Date.now() - startTime,
      });

      return {
        success: false,
        error: safeError.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      // Get ticker price from MEXC service
      const result = await this.mexcService.getTicker(symbol);

      if (!result.success || !result.data) {
        throw new Error(result.error || `Failed to get price for ${symbol}`);
      }

      return parseFloat(result.data.lastPrice);
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to get current price", {
        symbol,
        error: safeError.message,
      });
      throw safeError;
    }
  }

  async canTrade(symbol: string): Promise<boolean> {
    try {
      // Check if symbol exists and is tradeable
      const symbolInfo = await this.mexcService.getSymbolInfoBasic(symbol);

      if (!symbolInfo.success || !symbolInfo.data) {
        return false;
      }

      // Check if symbol is in trading status
      return (symbolInfo.data as any)?.status === "TRADING";
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.warn("Failed to check trading status", {
        symbol,
        error: safeError.message,
      });
      return false;
    }
  }

  private prepareMexcParams(params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT" | "STOP_LIMIT";
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: "GTC" | "IOC" | "FOK";
    isAutoSnipe?: boolean;
  }): TradingOrderData {
    // Determine the quantity to use
    const quantity = params.quantity 
      ? params.quantity.toString() 
      : params.quoteOrderQty 
        ? params.quoteOrderQty.toString() 
        : "0";

    const mexcParams: TradingOrderData = {
      symbol: params.symbol,
      side: params.side,
      type: params.type as "LIMIT" | "MARKET", // Map to supported types
      quantity,
      timeInForce: params.timeInForce || "IOC",
    };

    // Add price for limit orders
    if (params.price && (params.type === "LIMIT" || params.type === "STOP_LIMIT")) {
      mexcParams.price = params.price.toString();
    }

    return mexcParams;
  }

  private transformMexcResponse(mexcData: Record<string, unknown>, startTime: number): {
    success: boolean;
    data: {
      orderId: string;
      clientOrderId?: string;
      symbol: string;
      side: string;
      type: string;
      quantity: string;
      price: string;
      status: string;
      executedQty: string;
      timestamp: string;
    };
    executionTime: number;
  } {
    return {
      success: true,
      data: {
        orderId: String(mexcData.orderId || mexcData.id || ""),
        clientOrderId: mexcData.clientOrderId ? String(mexcData.clientOrderId) : undefined,
        symbol: String(mexcData.symbol || ""),
        side: String(mexcData.side || ""),
        type: String(mexcData.type || ""),
        quantity: String(mexcData.origQty || mexcData.quantity || "0"),
        price: String(mexcData.price || "0"),
        status: String(mexcData.status || ""),
        executedQty: String(mexcData.executedQty || "0"),
        timestamp: new Date(Number(mexcData.transactTime) || Date.now()).toISOString(),
      },
      executionTime: Date.now() - startTime,
    };
  }

  private async executePaperTrade(params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT" | "STOP_LIMIT";
    quantity?: number;
    quoteOrderQty?: number;
  }, startTime: number): Promise<{
    success: boolean;
    data: {
      orderId: string;
      clientOrderId: string;
      symbol: string;
      side: string;
      type: string;
      quantity: string;
      price: string;
      status: string;
      executedQty: string;
      timestamp: string;
    };
    executionTime: number;
  }> {
    // Simulate trade execution for paper trading
    const simulatedPrice = await this.getCurrentPrice(params.symbol);
    const quantity = params.quantity || params.quoteOrderQty! / simulatedPrice;

    return {
      success: true,
      data: {
        orderId: `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        clientOrderId: `paper-client-${Date.now()}`,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: quantity.toString(),
        price: simulatedPrice.toString(),
        status: "FILLED",
        executedQty: quantity.toString(),
        timestamp: new Date().toISOString(),
      },
      executionTime: Date.now() - startTime,
    };
  }

  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      // Test connection with a simple API call
      const result = await this.mexcService.getServerTime();
      return result.success;
    } catch (_error) {
      return false;
    }
  }

  // Get trading limits for a symbol
  async getTradingLimits(symbol: string): Promise<{
    minQuantity: number;
    maxQuantity: number;
    stepSize: number;
    minNotional: number;
  } | null> {
    try {
      const symbolInfo = await this.mexcService.getSymbolInfoBasic(symbol);

      if (!symbolInfo.success || !symbolInfo.data) {
        return null;
      }

      const filters = (symbolInfo.data as any)?.filters || [];
      const lotSizeFilter = filters.find((f: any) => f.filterType === "LOT_SIZE");
      const notionalFilter = filters.find((f: any) => f.filterType === "MIN_NOTIONAL");

      return {
        minQuantity: parseFloat(lotSizeFilter?.minQty || "0"),
        maxQuantity: parseFloat(lotSizeFilter?.maxQty || "1000000"),
        stepSize: parseFloat(lotSizeFilter?.stepSize || "1"),
        minNotional: parseFloat(notionalFilter?.minNotional || "1"),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.warn("Failed to get trading limits", {
        symbol,
        error: safeError.message,
      });
      return null;
    }
  }
}
