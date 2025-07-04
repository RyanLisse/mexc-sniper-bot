/**
 * Market Data Module
 *
 * Handles market data operations, price fetching, and market validation for auto-sniping.
 * Extracted from auto-sniping.ts for better modularity.
 */

import type { ModuleContext } from "../auto-sniping-types";

export class MarketDataModule {
  private context: ModuleContext;

  constructor(context: ModuleContext) {
    this.context = context;
  }

  /**
   * Get current market price for a symbol with multiple fallback options
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

      // Fallback: Try getCurrentPrice method if available
      if (
        !price &&
        this.context.mexcService &&
        typeof this.context.mexcService.getCurrentPrice === "function"
      ) {
        try {
          const priceResult =
            await this.context.mexcService.getCurrentPrice(symbol);
          if (typeof priceResult === "number" && priceResult > 0) {
            price = priceResult;
          }
        } catch (priceError) {
          this.context.logger.warn(
            `Failed to get current price for ${symbol}`,
            {
              error:
                priceError instanceof Error
                  ? priceError.message
                  : String(priceError),
            }
          );
        }
      }

      // Additional fallback: Try order book data
      if (
        !price &&
        this.context.mexcService &&
        typeof this.context.mexcService.getOrderBook === "function"
      ) {
        try {
          const orderBook = await this.context.mexcService.getOrderBook(
            symbol,
            5
          );
          if (orderBook.success && orderBook.data) {
            const { bids, asks } = orderBook.data;
            if (bids && bids.length > 0 && asks && asks.length > 0) {
              const bidPrice = parseFloat(bids[0][0]);
              const askPrice = parseFloat(asks[0][0]);
              if (bidPrice > 0 && askPrice > 0) {
                price = (bidPrice + askPrice) / 2; // Mid-price
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

      if (price && price > 0) {
        this.context.logger.debug(`Got current price for ${symbol}: ${price}`);
        return price;
      }

      this.context.logger.error(
        `Unable to get current price for ${symbol} from any source`
      );
      return null;
    } catch (error) {
      const safeError =
        error instanceof Error ? error : new Error(String(error));
      this.context.logger.error(
        `Critical error getting current price for ${symbol}`,
        safeError
      );
      return null;
    }
  }

  /**
   * Get multiple market prices in batch
   */
  async getBatchMarketPrices(symbols: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    // Process symbols in parallel but with some throttling
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchPromises = batch.map(async (symbol) => {
        const price = await this.getCurrentMarketPrice(symbol);
        if (price !== null) {
          prices.set(symbol, price);
        }
      });

      await Promise.all(batchPromises);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return prices;
  }

  /**
   * Get market data summary for a symbol
   */
  async getMarketDataSummary(symbol: string): Promise<{
    price: number | null;
    volume24h: number | null;
    change24h: number | null;
    high24h: number | null;
    low24h: number | null;
  }> {
    try {
      const result = {
        price: null as number | null,
        volume24h: null as number | null,
        change24h: null as number | null,
        high24h: null as number | null,
        low24h: null as number | null,
      };

      // Try to get comprehensive ticker data
      if (
        this.context.mexcService &&
        typeof this.context.mexcService.getTicker === "function"
      ) {
        const ticker = await this.context.mexcService.getTicker(symbol);
        if (ticker.success && ticker.data) {
          const data = ticker.data as any;

          // Extract price
          const priceFields = ["price", "lastPrice", "close", "last"];
          for (const field of priceFields) {
            if (data[field]) {
              const priceValue = parseFloat(data[field]);
              if (priceValue > 0) {
                result.price = priceValue;
                break;
              }
            }
          }

          // Extract volume
          const volumeFields = ["volume", "baseVolume", "quoteVolume"];
          for (const field of volumeFields) {
            if (data[field]) {
              const volumeValue = parseFloat(data[field]);
              if (volumeValue > 0) {
                result.volume24h = volumeValue;
                break;
              }
            }
          }

          // Extract price change
          const changeFields = ["priceChange", "change", "priceChangePercent"];
          for (const field of changeFields) {
            if (data[field]) {
              const changeValue = parseFloat(data[field]);
              result.change24h = changeValue;
              break;
            }
          }

          // Extract high/low
          if (data.highPrice) {
            result.high24h = parseFloat(data.highPrice);
          }
          if (data.lowPrice) {
            result.low24h = parseFloat(data.lowPrice);
          }
        }
      }

      return result;
    } catch (error) {
      this.context.logger.error(
        `Failed to get market data summary for ${symbol}`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );

      return {
        price: null,
        volume24h: null,
        change24h: null,
        high24h: null,
        low24h: null,
      };
    }
  }

  /**
   * Validate if market conditions are suitable for trading
   */
  async validateMarketConditions(symbol: string): Promise<{
    isValid: boolean;
    issues: string[];
    volatility?: number;
    volume?: number;
  }> {
    const validation = {
      isValid: true,
      issues: [] as string[],
      volatility: undefined as number | undefined,
      volume: undefined as number | undefined,
    };

    try {
      const marketData = await this.getMarketDataSummary(symbol);

      // Check if we have basic price data
      if (!marketData.price) {
        validation.isValid = false;
        validation.issues.push("Unable to get current market price");
        return validation;
      }

      // Check volume
      if (marketData.volume24h !== null) {
        validation.volume = marketData.volume24h;

        // Minimum volume threshold (this could be configurable)
        const minVolume = 100000; // USDT
        if (marketData.volume24h < minVolume) {
          validation.isValid = false;
          validation.issues.push(
            `Low trading volume: ${marketData.volume24h} < ${minVolume}`
          );
        }
      }

      // Check volatility
      if (marketData.change24h !== null) {
        validation.volatility = Math.abs(marketData.change24h);

        // Maximum volatility threshold (this could be configurable)
        const maxVolatility = 20; // 20% change
        if (validation.volatility > maxVolatility) {
          validation.issues.push(
            `High volatility: ${validation.volatility}% > ${maxVolatility}%`
          );
          // Don't mark as invalid for high volatility, just warn
        }
      }

      // Check for extreme price movements
      if (marketData.high24h && marketData.low24h && marketData.price) {
        const priceRange = marketData.high24h - marketData.low24h;
        const currentPosition =
          (marketData.price - marketData.low24h) / priceRange;

        // Warn if price is at extreme positions
        if (currentPosition > 0.95) {
          validation.issues.push("Price is near 24h high - caution advised");
        } else if (currentPosition < 0.05) {
          validation.issues.push("Price is near 24h low - caution advised");
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
   * Check if symbol is actively trading
   */
  async isSymbolActive(symbol: string): Promise<boolean> {
    try {
      const price = await this.getCurrentMarketPrice(symbol);
      return price !== null && price > 0;
    } catch (error) {
      this.context.logger.warn(`Failed to check if ${symbol} is active`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get order book depth for price impact analysis
   */
  async getOrderBookDepth(
    symbol: string,
    limit: number = 20
  ): Promise<{
    bids: Array<[string, string]>;
    asks: Array<[string, string]>;
    spread: number;
    midPrice: number;
  } | null> {
    try {
      if (
        !this.context.mexcService ||
        typeof this.context.mexcService.getOrderBook !== "function"
      ) {
        return null;
      }

      const orderBook = await this.context.mexcService.getOrderBook(
        symbol,
        limit
      );

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

      return {
        bids,
        asks,
        spread,
        midPrice,
      };
    } catch (error) {
      this.context.logger.error(
        `Failed to get order book depth for ${symbol}`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return null;
    }
  }

  /**
   * Calculate potential price impact for an order
   */
  async calculatePriceImpact(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number
  ): Promise<{
    priceImpact: number;
    averagePrice: number;
    worstPrice: number;
  } | null> {
    try {
      const orderBook = await this.getOrderBookDepth(symbol, 50);

      if (!orderBook) {
        return null;
      }

      const orders = side === "BUY" ? orderBook.asks : orderBook.bids;
      let remainingQuantity = quantity;
      let totalCost = 0;
      let worstPrice = 0;

      for (const [priceStr, quantityStr] of orders) {
        const price = parseFloat(priceStr);
        const availableQuantity = parseFloat(quantityStr);

        const quantityToFill = Math.min(remainingQuantity, availableQuantity);
        totalCost += quantityToFill * price;
        worstPrice = price;

        remainingQuantity -= quantityToFill;

        if (remainingQuantity <= 0) {
          break;
        }
      }

      if (remainingQuantity > 0) {
        // Not enough liquidity
        return null;
      }

      const averagePrice = totalCost / quantity;
      const priceImpact =
        Math.abs((averagePrice - orderBook.midPrice) / orderBook.midPrice) *
        100;

      return {
        priceImpact,
        averagePrice,
        worstPrice,
      };
    } catch (error) {
      this.context.logger.error(
        `Failed to calculate price impact for ${symbol}`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return null;
    }
  }
}
