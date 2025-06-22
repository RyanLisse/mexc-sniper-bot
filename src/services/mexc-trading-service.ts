/**
 * MEXC Trading Service
 *
 * Extracted from unified MEXC service for better modularity and separation of concerns.
 * Handles all trading operations, order management, and portfolio tracking.
 *
 * Features:
 * - Order placement and management
 * - Portfolio tracking and analysis
 * - Trading rule validation
 * - Risk management and safety checks
 * - Order book analysis
 * - Performance monitoring
 */

import type { MexcApiClient } from "./mexc-api-client";
import type { MexcAuthenticationService } from "./mexc-authentication-service";
import type { 
  MexcServiceResponse, 
  OrderParameters, 
  OrderResult, 
  OrderStatus,
  Portfolio,
  BalanceEntry,
  Ticker,
  OrderBook
} from "./mexc-schemas";
import { toSafeError } from "../lib/error-type-utils";

// ============================================================================
// Trading Service Types and Interfaces
// ============================================================================

export interface TradingConfig {
  maxPositionSize: number;
  minOrderValue: number;
  defaultTimeInForce: "GTC" | "IOC" | "FOK";
  enableRiskChecks: boolean;
  maxDailyLoss: number;
  maxOpenOrders: number;
  paperTradingMode: boolean;
}

export interface TradingStats {
  totalOrders: number;
  successfulOrders: number;
  failedOrders: number;
  totalVolume: number;
  totalPnL: number;
  winRate: number;
  averageOrderSize: number;
  largestPosition: number;
  riskScore: number;
}

export interface PositionSizing {
  recommendedQuantity: string;
  maxQuantity: string;
  riskLevel: "low" | "medium" | "high";
  reasoning: string[];
  warnings: string[];
}

export interface TradingOpportunity {
  symbol: string;
  side: "BUY" | "SELL";
  confidence: number;
  expectedReturn: number;
  riskLevel: "low" | "medium" | "high";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  timeframe: string;
  reasoning: string;
}

export interface RiskAssessment {
  overallRiskLevel: "low" | "medium" | "high";
  riskScore: number;
  diversificationScore: number;
  concentrationRisk: "low" | "medium" | "high";
  volatilityRisk: "low" | "medium" | "high";
  recommendations: string[];
  riskFactors: string[];
}

// ============================================================================
// Trading Service Implementation
// ============================================================================

/**
 * Comprehensive trading service for MEXC operations
 * Handles order management, portfolio tracking, and risk assessment
 */
export class MexcTradingService {
  private config: TradingConfig;
  private stats: TradingStats;
  private apiClient?: MexcApiClient;
  private authService?: MexcAuthenticationService;

  constructor(config: Partial<TradingConfig> = {}) {
    this.config = {
      maxPositionSize: config.maxPositionSize || 1000, // USD
      minOrderValue: config.minOrderValue || 10, // USD
      defaultTimeInForce: config.defaultTimeInForce || "GTC",
      enableRiskChecks: config.enableRiskChecks ?? true,
      maxDailyLoss: config.maxDailyLoss || 500, // USD
      maxOpenOrders: config.maxOpenOrders || 10,
      paperTradingMode: config.paperTradingMode ?? false,
    };

    this.stats = {
      totalOrders: 0,
      successfulOrders: 0,
      failedOrders: 0,
      totalVolume: 0,
      totalPnL: 0,
      winRate: 0,
      averageOrderSize: 0,
      largestPosition: 0,
      riskScore: 0,
    };
  }

  // ============================================================================
  // Initialization and Configuration
  // ============================================================================

  /**
   * Initialize with API client and authentication service
   */
  initialize(apiClient: MexcApiClient, authService: MexcAuthenticationService): void {
    this.apiClient = apiClient;
    this.authService = authService;
  }

  /**
   * Update trading configuration
   */
  updateConfig(newConfig: Partial<TradingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): TradingConfig {
    return { ...this.config };
  }

  // ============================================================================
  // Order Management
  // ============================================================================

  /**
   * Place a new order with comprehensive validation
   */
  async placeOrder(params: OrderParameters): Promise<MexcServiceResponse<OrderResult>> {
    if (!this.apiClient) {
      return {
        success: false,
        error: "Trading service not initialized - API client missing",
        timestamp: new Date().toISOString(),
      };
    }

    if (!this.authService?.getStatus().isValid) {
      return {
        success: false,
        error: "Invalid authentication - cannot place orders",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // Paper trading mode
      if (this.config.paperTradingMode) {
        return this.simulateOrderPlacement(params);
      }

      // Pre-order validation
      const validation = await this.validateOrderParameters(params);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Order validation failed: ${validation.errors.join(", ")}`,
          timestamp: new Date().toISOString(),
        };
      }

      // Risk checks
      if (this.config.enableRiskChecks) {
        const riskCheck = await this.performRiskCheck(params);
        if (!riskCheck.approved) {
          return {
            success: false,
            error: `Risk check failed: ${riskCheck.reason}`,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // Place the order
      const response = await this.apiClient.placeOrder(params);
      
      // Update statistics
      this.updateOrderStats(response);

      return response;
    } catch (error) {
      const safeError = toSafeError(error);
      this.stats.failedOrders++;
      
      return {
        success: false,
        error: `Failed to place order: ${safeError.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Cancel an existing order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<MexcServiceResponse<any>> {
    if (!this.apiClient) {
      return {
        success: false,
        error: "Trading service not initialized",
        timestamp: new Date().toISOString(),
      };
    }

    if (this.config.paperTradingMode) {
      return {
        success: true,
        data: { orderId, symbol, status: "CANCELED" },
        timestamp: new Date().toISOString(),
      };
    }

    return this.apiClient.cancelOrder(symbol, orderId);
  }

  /**
   * Get order status
   */
  async getOrderStatus(symbol: string, orderId: string): Promise<MexcServiceResponse<OrderStatus>> {
    if (!this.apiClient) {
      return {
        success: false,
        error: "Trading service not initialized",
        timestamp: new Date().toISOString(),
      };
    }

    return this.apiClient.getOrderStatus(symbol, orderId);
  }

  /**
   * Get all open orders
   */
  async getOpenOrders(symbol?: string): Promise<MexcServiceResponse<OrderStatus[]>> {
    if (!this.apiClient) {
      return {
        success: false,
        error: "Trading service not initialized",
        timestamp: new Date().toISOString(),
      };
    }

    if (this.config.paperTradingMode) {
      return {
        success: true,
        data: [], // Paper trading has no persistent orders
        timestamp: new Date().toISOString(),
      };
    }

    return this.apiClient.getOpenOrders(symbol);
  }

  // ============================================================================
  // Portfolio Management
  // ============================================================================

  /**
   * Get current portfolio with enhanced analysis
   */
  async getPortfolio(): Promise<MexcServiceResponse<Portfolio & { riskAssessment: RiskAssessment }>> {
    if (!this.apiClient) {
      return {
        success: false,
        error: "Trading service not initialized",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // Get account balances
      const balancesResponse = await this.apiClient.get<{ balances: BalanceEntry[] }>("/api/v3/account");
      
      if (!balancesResponse.success || !balancesResponse.data?.balances) {
        return {
          success: false,
          error: "Failed to fetch account balances",
          timestamp: new Date().toISOString(),
        };
      }

      // Get current prices for portfolio valuation
      const tickersResponse = await this.apiClient.get<Ticker[]>("/api/v3/ticker/24hr");
      const tickers = Array.isArray(tickersResponse.data) ? tickersResponse.data : [];

      // Calculate portfolio metrics
      const portfolio = this.calculatePortfolioMetrics(balancesResponse.data.balances, tickers);
      const riskAssessment = this.assessPortfolioRisk(portfolio);

      return {
        success: true,
        data: { ...portfolio, riskAssessment },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: `Failed to get portfolio: ${safeError.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Calculate position sizing recommendations
   */
  async calculatePositionSize(
    symbol: string,
    side: "BUY" | "SELL",
    riskPercentage: number = 2
  ): Promise<MexcServiceResponse<PositionSizing>> {
    try {
      // Get current portfolio
      const portfolioResponse = await this.getPortfolio();
      if (!portfolioResponse.success || !portfolioResponse.data) {
        return {
          success: false,
          error: "Failed to get portfolio for position sizing",
          timestamp: new Date().toISOString(),
        };
      }

      const portfolio = portfolioResponse.data;
      const totalValue = portfolio.totalUsdtValue;
      const riskAmount = totalValue * (riskPercentage / 100);

      // Get current price
      const tickerResponse = await this.apiClient!.get<Ticker>("/api/v3/ticker/24hr", { symbol });
      if (!tickerResponse.success || !tickerResponse.data) {
        return {
          success: false,
          error: "Failed to get current price for position sizing",
          timestamp: new Date().toISOString(),
        };
      }

      const currentPrice = Number.parseFloat(tickerResponse.data.lastPrice);
      const maxQuantity = Math.min(riskAmount / currentPrice, this.config.maxPositionSize / currentPrice);
      const recommendedQuantity = maxQuantity * 0.8; // Conservative sizing

      const reasoning: string[] = [
        `Portfolio value: $${totalValue.toFixed(2)}`,
        `Risk amount (${riskPercentage}%): $${riskAmount.toFixed(2)}`,
        `Current price: $${currentPrice.toFixed(4)}`,
        `Max position size: ${maxQuantity.toFixed(6)} ${symbol}`,
      ];

      const warnings: string[] = [];
      let riskLevel: "low" | "medium" | "high" = "low";

      if (riskAmount > this.config.maxPositionSize) {
        warnings.push("Position size exceeds maximum allowed");
        riskLevel = "high";
      }

      if (riskPercentage > 5) {
        warnings.push("Risk percentage is high (>5%)");
        riskLevel = riskLevel === "high" ? "high" : "medium";
      }

      return {
        success: true,
        data: {
          recommendedQuantity: recommendedQuantity.toFixed(6),
          maxQuantity: maxQuantity.toFixed(6),
          riskLevel,
          reasoning,
          warnings,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: `Failed to calculate position size: ${safeError.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Market Analysis
  // ============================================================================

  /**
   * Get order book analysis
   */
  async getOrderBookAnalysis(symbol: string): Promise<MexcServiceResponse<{
    orderBook: OrderBook;
    spread: number;
    spreadPercentage: number;
    liquidityScore: number;
    marketDepth: { bids: number; asks: number };
    recommendation: "buy" | "sell" | "hold";
  }>> {
    if (!this.apiClient) {
      return {
        success: false,
        error: "Trading service not initialized",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const orderBook = await this.apiClient.getOrderBook(symbol, 50);
      
      if (!orderBook || !orderBook.bids || !orderBook.asks) {
        return {
          success: false,
          error: "Invalid order book data",
          timestamp: new Date().toISOString(),
        };
      }

      const bestBid = Number.parseFloat(orderBook.bids[0]?.price || "0");
      const bestAsk = Number.parseFloat(orderBook.asks[0]?.price || "0");
      const spread = bestAsk - bestBid;
      const spreadPercentage = (spread / bestAsk) * 100;

      // Calculate liquidity score (based on order book depth)
      const bidVolume = orderBook.bids.reduce((sum, bid) => sum + Number.parseFloat(bid.quantity), 0);
      const askVolume = orderBook.asks.reduce((sum, ask) => sum + Number.parseFloat(ask.quantity), 0);
      const liquidityScore = Math.min((bidVolume + askVolume) / 10000, 100); // Normalized to 0-100

      // Simple recommendation based on order book imbalance
      const imbalance = bidVolume / (bidVolume + askVolume);
      let recommendation: "buy" | "sell" | "hold" = "hold";
      
      if (imbalance > 0.6) {
        recommendation = "buy"; // More bids than asks
      } else if (imbalance < 0.4) {
        recommendation = "sell"; // More asks than bids
      }

      return {
        success: true,
        data: {
          orderBook,
          spread,
          spreadPercentage,
          liquidityScore,
          marketDepth: { bids: bidVolume, asks: askVolume },
          recommendation,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: `Failed to analyze order book: ${safeError.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  /**
   * Get trading statistics
   */
  getStats(): TradingStats {
    return { ...this.stats };
  }

  /**
   * Reset trading statistics
   */
  resetStats(): void {
    this.stats = {
      totalOrders: 0,
      successfulOrders: 0,
      failedOrders: 0,
      totalVolume: 0,
      totalPnL: 0,
      winRate: 0,
      averageOrderSize: 0,
      largestPosition: 0,
      riskScore: 0,
    };
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<{
    healthy: boolean;
    tradingEnabled: boolean;
    authStatus: boolean;
    riskLevel: "low" | "medium" | "high";
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check authentication
    const authStatus = this.authService?.getStatus().isValid ?? false;
    if (!authStatus) {
      issues.push("Authentication not valid");
      recommendations.push("Check API credentials");
    }

    // Check API client
    if (!this.apiClient) {
      issues.push("API client not initialized");
      recommendations.push("Initialize trading service with API client");
    }

    // Check risk levels
    let riskLevel: "low" | "medium" | "high" = "low";
    if (this.stats.winRate < 0.4 && this.stats.totalOrders > 10) {
      riskLevel = "high";
      issues.push("Low win rate detected");
      recommendations.push("Review trading strategy");
    }

    if (this.stats.totalPnL < -this.config.maxDailyLoss) {
      riskLevel = "high";
      issues.push("Daily loss limit exceeded");
      recommendations.push("Stop trading and review positions");
    }

    const tradingEnabled = authStatus && !!this.apiClient && riskLevel !== "high";
    const healthy = tradingEnabled && issues.length === 0;

    return {
      healthy,
      tradingEnabled,
      authStatus,
      riskLevel,
      issues,
      recommendations,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validate order parameters
   */
  private async validateOrderParameters(params: OrderParameters): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic parameter validation
    if (!params.symbol) errors.push("Symbol is required");
    if (!params.side) errors.push("Side is required");
    if (!params.quantity) errors.push("Quantity is required");

    const quantity = Number.parseFloat(params.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      errors.push("Quantity must be a positive number");
    }

    if (params.type === "LIMIT" && !params.price) {
      errors.push("Price is required for limit orders");
    }

    if (params.price) {
      const price = Number.parseFloat(params.price);
      if (isNaN(price) || price <= 0) {
        errors.push("Price must be a positive number");
      }

      // Check minimum order value
      const orderValue = quantity * price;
      if (orderValue < this.config.minOrderValue) {
        errors.push(`Order value $${orderValue.toFixed(2)} is below minimum $${this.config.minOrderValue}`);
      }

      // Check maximum position size
      if (orderValue > this.config.maxPositionSize) {
        warnings.push(`Order value $${orderValue.toFixed(2)} exceeds recommended maximum $${this.config.maxPositionSize}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Perform risk assessment for order
   */
  private async performRiskCheck(params: OrderParameters): Promise<{
    approved: boolean;
    reason?: string;
    riskScore: number;
  }> {
    try {
      // Check open orders limit
      const openOrdersResponse = await this.getOpenOrders();
      if (openOrdersResponse.success && openOrdersResponse.data) {
        if (openOrdersResponse.data.length >= this.config.maxOpenOrders) {
          return {
            approved: false,
            reason: `Maximum open orders limit reached (${this.config.maxOpenOrders})`,
            riskScore: 100,
          };
        }
      }

      // Calculate risk score (simplified)
      let riskScore = 0;
      
      if (params.price) {
        const orderValue = Number.parseFloat(params.quantity) * Number.parseFloat(params.price);
        riskScore += (orderValue / this.config.maxPositionSize) * 50;
      }

      if (this.stats.totalPnL < 0) {
        riskScore += Math.abs(this.stats.totalPnL / this.config.maxDailyLoss) * 30;
      }

      const approved = riskScore < 80; // Risk threshold

      return {
        approved,
        reason: approved ? undefined : `Risk score too high: ${riskScore.toFixed(1)}`,
        riskScore,
      };
    } catch (error) {
      return {
        approved: false,
        reason: "Risk check failed due to error",
        riskScore: 100,
      };
    }
  }

  /**
   * Simulate order placement for paper trading
   */
  private simulateOrderPlacement(params: OrderParameters): MexcServiceResponse<OrderResult> {
    const orderId = `PAPER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const orderResult: OrderResult = {
      success: true,
      orderId,
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      price: params.price,
      status: "FILLED", // Paper orders always fill immediately
      timestamp: new Date().toISOString(),
    };

    // Update paper trading stats
    this.stats.totalOrders++;
    this.stats.successfulOrders++;
    
    if (params.price) {
      const orderValue = Number.parseFloat(params.quantity) * Number.parseFloat(params.price);
      this.stats.totalVolume += orderValue;
      this.stats.averageOrderSize = this.stats.totalVolume / this.stats.totalOrders;
    }

    return {
      success: true,
      data: orderResult,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update order statistics
   */
  private updateOrderStats(response: MexcServiceResponse<OrderResult>): void {
    this.stats.totalOrders++;
    
    if (response.success) {
      this.stats.successfulOrders++;
      
      if (response.data?.quantity && response.data?.price) {
        const orderValue = Number.parseFloat(response.data.quantity) * Number.parseFloat(response.data.price);
        this.stats.totalVolume += orderValue;
        this.stats.averageOrderSize = this.stats.totalVolume / this.stats.totalOrders;
        
        if (orderValue > this.stats.largestPosition) {
          this.stats.largestPosition = orderValue;
        }
      }
    } else {
      this.stats.failedOrders++;
    }

    // Update win rate
    this.stats.winRate = this.stats.successfulOrders / this.stats.totalOrders;
  }

  /**
   * Calculate portfolio metrics from balances and prices
   */
  private calculatePortfolioMetrics(balances: BalanceEntry[], tickers: Ticker[]): Portfolio {
    const priceMap = new Map<string, number>();
    for (const ticker of tickers) {
      if (ticker.symbol && ticker.lastPrice) {
        priceMap.set(ticker.symbol, Number.parseFloat(ticker.lastPrice));
      }
    }

    let totalUsdtValue = 0;
    const allocation: Record<string, number> = {};
    const processedBalances: BalanceEntry[] = [];

    for (const balance of balances) {
      const total = Number.parseFloat(balance.free) + Number.parseFloat(balance.locked);
      if (total > 0) {
        let usdtValue = 0;
        
        if (balance.asset === "USDT") {
          usdtValue = total;
        } else {
          const price = priceMap.get(`${balance.asset}USDT`);
          if (price) {
            usdtValue = total * price;
          }
        }

        totalUsdtValue += usdtValue;
        allocation[balance.asset] = usdtValue;
        
        processedBalances.push({
          ...balance,
          total,
          usdtValue,
        });
      }
    }

    // Convert allocation to percentages
    for (const asset in allocation) {
      if (totalUsdtValue > 0) {
        allocation[asset] = (allocation[asset] / totalUsdtValue) * 100;
      }
    }

    // Calculate 24h performance (simplified)
    let performance24hChange = 0;
    let performance24hChangePercent = 0;

    return {
      totalValue: totalUsdtValue,
      totalValueBTC: 0, // Would need BTC price
      totalUsdtValue: totalUsdtValue,
      balances: processedBalances,
      allocation,
      performance24h: {
        change: performance24hChange,
        changePercent: performance24hChangePercent,
      },
    };
  }

  /**
   * Assess portfolio risk
   */
  private assessPortfolioRisk(portfolio: Portfolio): RiskAssessment {
    const { balances, totalUsdtValue, allocation } = portfolio;

    // Calculate diversification
    const activeAssets = balances.filter(b => b.total > 0).length;
    const diversificationScore = Math.min(activeAssets * 10, 100);

    // Calculate concentration risk
    const maxAllocation = Math.max(...Object.values(allocation));
    const concentrationRisk: "low" | "medium" | "high" = 
      maxAllocation > 50 ? "high" : maxAllocation > 25 ? "medium" : "low";

    // Calculate volatility risk (simplified)
    const volatilityRisk: "low" | "medium" | "high" = 
      Math.abs(portfolio.performance24h?.changePercent || 0) > 10 ? "high" :
      Math.abs(portfolio.performance24h?.changePercent || 0) > 5 ? "medium" : "low";

    // Generate recommendations
    const recommendations: string[] = [];
    if (concentrationRisk === "high") {
      recommendations.push("Consider diversifying holdings");
    }
    if (activeAssets < 3) {
      recommendations.push("Increase portfolio diversification");
    }
    if (totalUsdtValue < 100) {
      recommendations.push("Consider increasing overall position size");
    }

    // Calculate overall risk score
    let riskScore = 50; // Base score
    if (concentrationRisk === "high") riskScore += 20;
    if (volatilityRisk === "high") riskScore += 15;
    if (activeAssets < 3) riskScore += 10;
    riskScore = Math.min(riskScore, 100);

    const overallRiskLevel: "low" | "medium" | "high" = 
      riskScore > 70 ? "high" : riskScore > 40 ? "medium" : "low";

    return {
      overallRiskLevel,
      riskScore,
      diversificationScore,
      concentrationRisk,
      volatilityRisk,
      recommendations,
      riskFactors: [
        ...(concentrationRisk === "high" ? ["High concentration risk"] : []),
        ...(volatilityRisk === "high" ? ["High volatility"] : []),
        ...(activeAssets < 3 ? ["Low diversification"] : []),
      ],
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create trading service with MEXC-optimized defaults
 */
export function createMexcTradingService(config?: Partial<TradingConfig>): MexcTradingService {
  const defaultConfig: Partial<TradingConfig> = {
    maxPositionSize: 1000,
    minOrderValue: 10,
    defaultTimeInForce: "GTC",
    enableRiskChecks: true,
    maxDailyLoss: 500,
    maxOpenOrders: 10,
    paperTradingMode: false,
  };

  return new MexcTradingService({ ...defaultConfig, ...config });
}

// ============================================================================
// Global Instance Management
// ============================================================================

let globalTradingService: MexcTradingService | null = null;

/**
 * Get or create the global trading service
 */
export function getGlobalTradingService(): MexcTradingService {
  if (!globalTradingService) {
    globalTradingService = createMexcTradingService();
  }
  return globalTradingService;
}

/**
 * Reset the global trading service
 */
export function resetGlobalTradingService(): void {
  globalTradingService = null;
}