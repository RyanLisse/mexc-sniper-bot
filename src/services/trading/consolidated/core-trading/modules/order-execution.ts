/**
 * Order Execution Module
 *
 * Handles order execution with retry logic and market price fetching.
 * Extracted from auto-sniping.ts for better modularity.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type {
  ModuleContext,
  ServiceResponse,
  TradeParameters,
} from "../auto-sniping-types";

export class OrderExecutionModule {
  private context: ModuleContext;

  constructor(context: ModuleContext) {
    this.context = context;
  }

  /**
   * Execute order with retry logic
   */
  async executeOrderWithRetry(
    orderParams: TradeParameters,
    maxRetries: number = 3
  ): Promise<ServiceResponse<any>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Convert TradeParameters to the format expected by MEXC service
        const mexcOrderData: any = {
          symbol: orderParams.symbol,
          side: orderParams.side,
          type: orderParams.type,
        };

        // Add optional properties only if they're defined
        if (orderParams.quantity) {
          mexcOrderData.quantity = orderParams.quantity.toString();
        }
        if (orderParams.price) {
          mexcOrderData.price = orderParams.price.toString();
        }
        if (orderParams.timeInForce) {
          mexcOrderData.timeInForce = orderParams.timeInForce;
        }

        // If using quoteOrderQty (for market orders), we need to handle this differently
        if (orderParams.quoteOrderQty && orderParams.type === "MARKET") {
          // For market buy orders with quoteOrderQty, we need to calculate the quantity
          if (orderParams.side === "BUY") {
            // Get current market price to calculate quantity
            const currentPrice = await this.getCurrentMarketPrice(
              orderParams.symbol
            );
            if (!currentPrice) {
              throw new Error(
                `Unable to get current price for ${orderParams.symbol}`
              );
            }
            mexcOrderData.quantity = (
              orderParams.quoteOrderQty / currentPrice
            ).toString();
          } else {
            // For sell orders, quantity should be provided directly
            if (!orderParams.quantity) {
              throw new Error("Quantity required for SELL orders");
            }
            mexcOrderData.quantity = orderParams.quantity.toString();
          }
        }

        const result = await this.context.mexcService.placeOrder(mexcOrderData);

        if (result.success) {
          return {
            success: true,
            data: result.data,
            timestamp: new Date().toISOString(),
          };
        } else {
          throw new Error(result.error || "Order execution failed");
        }
      } catch (error) {
        lastError = toSafeError(error);

        this.context.logger.warn(
          `Order attempt ${attempt}/${maxRetries} failed`,
          {
            symbol: orderParams.symbol,
            error: lastError.message,
          }
        );

        // Don't retry on certain errors
        if (
          lastError.message.includes("insufficient balance") ||
          lastError.message.includes("invalid symbol") ||
          lastError.message.includes("trading disabled") ||
          lastError.message.includes("MARKET_LOT_SIZE") ||
          lastError.message.includes("MIN_NOTIONAL")
        ) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Order execution failed after all retries");
  }

  /**
   * Get current market price for a symbol
   */
  async getCurrentMarketPrice(symbol: string): Promise<number | null> {
    try {
      // Enhanced price fetching with multiple fallback options
      let price: number | null = null;

      // Primary method: Try to get ticker data from MEXC service
      if (
        this.context.mexcService &&
        typeof this.context.mexcService.getTicker === "function"
      ) {
        try {
          const ticker = await this.context.mexcService.getTicker(symbol);
          if (ticker.success && ticker.data) {
            // Try different price fields that might be available
            const priceFields = ["price", "lastPrice", "close", "last"];
            for (const field of priceFields) {
              const fieldValue = (ticker.data as any)[field];
              if (fieldValue) {
                const priceValue = parseFloat(fieldValue);
                if (priceValue > 0) {
                  price = priceValue;
                  break;
                }
              }
            }
          }
        } catch (tickerError) {
          this.context.logger.warn(`Failed to get ticker for ${symbol}`, {
            error:
              tickerError instanceof Error
                ? tickerError.message
                : String(tickerError),
          });
        }
      }

      // Fallback method: Try to get order book data
      if (!price && this.context.mexcService) {
        try {
          const orderBook = await this.context.mexcService.getOrderBook(symbol);
          if (orderBook.success && orderBook.data) {
            const bids = (orderBook.data as any).bids;
            const asks = (orderBook.data as any).asks;
            if (bids && asks && bids.length > 0 && asks.length > 0) {
              const bidPrice = parseFloat(bids[0][0]);
              const askPrice = parseFloat(asks[0][0]);
              if (bidPrice > 0 && askPrice > 0) {
                price = (bidPrice + askPrice) / 2; // Use mid-price
              }
            }
          }
        } catch (orderBookError) {
          this.context.logger.warn(`Failed to get order book for ${symbol}`, {
            error:
              orderBookError instanceof Error
                ? orderBookError.message
                : String(orderBookError),
          });
        }
      }

      // Final fallback: Try websocket service if available
      if (!price && this.context.websocketService) {
        try {
          const wsPrice =
            await this.context.websocketService.getCurrentPrice(symbol);
          if (wsPrice && wsPrice > 0) {
            price = wsPrice;
          }
        } catch (wsError) {
          this.context.logger.warn(
            `Failed to get websocket price for ${symbol}`,
            {
              error:
                wsError instanceof Error ? wsError.message : String(wsError),
            }
          );
        }
      }

      if (price && price > 0) {
        this.context.logger.debug(`Got current price for ${symbol}: ${price}`);
        return price;
      } else {
        this.context.logger.warn(`Unable to get current price for ${symbol}`, {
          symbol,
          priceValue: price,
        });
        return null;
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(
        `Error getting current market price for ${symbol}`,
        safeError
      );
      return null;
    }
  }

  /**
   * Place a market buy order with USD amount
   */
  async placeBuyOrderUSD(
    symbol: string,
    usdAmount: number
  ): Promise<ServiceResponse<any>> {
    try {
      const currentPrice = await this.getCurrentMarketPrice(symbol);
      if (!currentPrice) {
        return {
          success: false,
          error: `Unable to get current price for ${symbol}`,
          timestamp: new Date().toISOString(),
        };
      }

      const quantity = usdAmount / currentPrice;

      const orderParams: TradeParameters = {
        symbol,
        side: "BUY",
        type: "MARKET",
        quantity,
        timeInForce: "IOC",
      };

      return await this.executeOrderWithRetry(orderParams);
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Place a market sell order
   */
  async placeSellOrder(
    symbol: string,
    quantity: number
  ): Promise<ServiceResponse<any>> {
    try {
      const orderParams: TradeParameters = {
        symbol,
        side: "SELL",
        type: "MARKET",
        quantity,
        timeInForce: "IOC",
      };

      return await this.executeOrderWithRetry(orderParams);
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    price: number
  ): Promise<ServiceResponse<any>> {
    try {
      const orderParams: TradeParameters = {
        symbol,
        side,
        type: "LIMIT",
        quantity,
        price,
        timeInForce: "GTC",
      };

      return await this.executeOrderWithRetry(orderParams);
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
