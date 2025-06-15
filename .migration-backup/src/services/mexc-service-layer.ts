import { 
  UnifiedMexcClient, 
  getUnifiedMexcClient,
  type UnifiedMexcResponse,
  type CalendarEntry,
  type SymbolEntry,
  type BalanceEntry,
  type ExchangeSymbol,
  type Ticker,
  type OrderResult,
  type OrderParameters,
  type UnifiedMexcConfig
} from "./unified-mexc-client";
import { circuitBreakerRegistry } from "./circuit-breaker";

// ============================================================================
// Service Layer Configuration
// ============================================================================

export interface MexcServiceConfig {
  apiKey?: string;
  secretKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableCircuitBreaker?: boolean;
  enableLogging?: boolean;
  enableMetrics?: boolean;
}

// ============================================================================
// Service Response Types
// ============================================================================

export interface ServiceResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: string;
  cached?: boolean;
  executionTimeMs?: number;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthCheckResult {
  healthy: boolean;
  connectivity: boolean;
  authentication: boolean;
  latencyMs: number;
  circuitBreakerState: string;
  lastError?: string;
  timestamp: string;
}

// ============================================================================
// Performance Metrics
// ============================================================================

interface OperationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  lastRequestTime: number;
  cacheHitRate: number;
}

class MetricsCollector {
  private metrics = new Map<string, OperationMetrics>();

  recordRequest(operation: string, success: boolean, latencyMs: number, cached = false): void {
    const current = this.metrics.get(operation) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatencyMs: 0,
      lastRequestTime: 0,
      cacheHitRate: 0,
    };

    current.totalRequests++;
    current.lastRequestTime = Date.now();

    if (success) {
      current.successfulRequests++;
    } else {
      current.failedRequests++;
    }

    // Update average latency (exponential moving average)
    const alpha = 0.1;
    current.averageLatencyMs = current.averageLatencyMs === 0 
      ? latencyMs 
      : alpha * latencyMs + (1 - alpha) * current.averageLatencyMs;

    // Update cache hit rate
    if (cached) {
      const cacheHits = current.totalRequests * current.cacheHitRate + 1;
      current.cacheHitRate = cacheHits / current.totalRequests;
    } else if (current.totalRequests > 1) {
      const cacheHits = (current.totalRequests - 1) * current.cacheHitRate;
      current.cacheHitRate = cacheHits / current.totalRequests;
    }

    this.metrics.set(operation, current);
  }

  getMetrics(operation?: string): Record<string, OperationMetrics> {
    if (operation) {
      const metric = this.metrics.get(operation);
      return metric ? { [operation]: metric } : {};
    }

    return Object.fromEntries(this.metrics.entries());
  }

  resetMetrics(): void {
    this.metrics.clear();
  }
}

// ============================================================================
// Main MEXC Service Layer
// ============================================================================

export class MexcServiceLayer {
  private client: UnifiedMexcClient;
  private config: Required<MexcServiceConfig>;
  private circuitBreaker = circuitBreakerRegistry.getBreaker("mexc-service-layer");
  private metrics = new MetricsCollector();
  private lastHealthCheck: HealthCheckResult | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: MexcServiceConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.MEXC_API_KEY || "",
      secretKey: config.secretKey || process.env.MEXC_SECRET_KEY || "",
      baseUrl: config.baseUrl || process.env.MEXC_BASE_URL || "https://api.mexc.com",
      timeout: config.timeout || 10000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      enableCircuitBreaker: config.enableCircuitBreaker ?? true,
      enableLogging: config.enableLogging ?? true,
      enableMetrics: config.enableMetrics ?? true,
    };

    // Initialize unified client with service config
    const clientConfig: UnifiedMexcConfig = {
      apiKey: this.config.apiKey,
      secretKey: this.config.secretKey,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
    };

    this.client = getUnifiedMexcClient(clientConfig);

    if (this.config.enableLogging) {
      console.log("[MexcServiceLayer] Initialized with config:", {
        hasApiKey: Boolean(this.config.apiKey),
        hasSecretKey: Boolean(this.config.secretKey),
        baseUrl: this.config.baseUrl,
        timeout: this.config.timeout,
        enableCircuitBreaker: this.config.enableCircuitBreaker,
        enableMetrics: this.config.enableMetrics,
      });
    }

    // Start periodic health checks
    this.startHealthChecks();
  }

  // ============================================================================
  // Core Service Methods
  // ============================================================================

  private async executeWithMetrics<T>(
    operation: string,
    fn: () => Promise<UnifiedMexcResponse<T>>
  ): Promise<ServiceResponse<T>> {
    const startTime = performance.now();
    const operationId = `${operation}_${Date.now()}`;

    try {
      if (this.config.enableLogging) {
        console.log(`[MexcServiceLayer] Starting ${operation} (${operationId})`);
      }

      const response = await fn();
      const executionTimeMs = Math.round(performance.now() - startTime);

      // Record metrics
      if (this.config.enableMetrics) {
        this.metrics.recordRequest(operation, response.success, executionTimeMs, response.cached);
      }

      const serviceResponse: ServiceResponse<T> = {
        success: response.success,
        data: response.data,
        error: response.error,
        timestamp: response.timestamp,
        cached: response.cached,
        executionTimeMs,
        requestId: response.requestId,
        metadata: {
          operation,
          operationId,
          circuitBreakerState: this.circuitBreaker.getState(),
        },
      };

      if (this.config.enableLogging) {
        console.log(`[MexcServiceLayer] Completed ${operation} (${operationId}) in ${executionTimeMs}ms - Success: ${response.success}`);
      }

      return serviceResponse;
    } catch (error) {
      const executionTimeMs = Math.round(performance.now() - startTime);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Record failed metrics
      if (this.config.enableMetrics) {
        this.metrics.recordRequest(operation, false, executionTimeMs);
      }

      if (this.config.enableLogging) {
        console.error(`[MexcServiceLayer] Failed ${operation} (${operationId}) in ${executionTimeMs}ms:`, errorMessage);
      }

      return {
        success: false,
        data: null as T,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        executionTimeMs,
        metadata: {
          operation,
          operationId,
          circuitBreakerState: this.circuitBreaker.getState(),
        },
      };
    }
  }

  // ============================================================================
  // Market Data Services
  // ============================================================================

  /**
   * Get new coin calendar listings with enhanced error handling and retry logic
   */
  async getCalendarListings(): Promise<ServiceResponse<CalendarEntry[]>> {
    return this.executeWithMetrics("getCalendarListings", async () => {
      return await this.client.getCalendarListings();
    });
  }

  /**
   * Get symbols data with optional vcoin filtering
   */
  async getSymbolsData(vcoinId?: string): Promise<ServiceResponse<SymbolEntry[]>> {
    return this.executeWithMetrics("getSymbolsData", async () => {
      return await this.client.getSymbolsV2(vcoinId);
    });
  }

  /**
   * Get symbols for multiple vcoin IDs
   */
  async getSymbolsForVcoins(vcoinIds: string[]): Promise<ServiceResponse<SymbolEntry[]>> {
    return this.executeWithMetrics("getSymbolsForVcoins", async () => {
      const allSymbolsResponse = await this.client.getSymbolsV2();
      
      if (!allSymbolsResponse.success) {
        return allSymbolsResponse;
      }

      // Filter symbols by vcoin IDs
      const filteredSymbols = allSymbolsResponse.data.filter(symbol => 
        vcoinIds.includes(symbol.cd)
      );

      return {
        ...allSymbolsResponse,
        data: filteredSymbols,
      };
    });
  }

  /**
   * Get exchange trading information
   */
  async getExchangeInfo(): Promise<ServiceResponse<ExchangeSymbol[]>> {
    return this.executeWithMetrics("getExchangeInfo", async () => {
      return await this.client.getExchangeInfo();
    });
  }

  /**
   * Get 24hr ticker data for specific symbol or all symbols
   */
  async getTickerData(symbol?: string): Promise<ServiceResponse<Ticker[]>> {
    return this.executeWithMetrics("getTickerData", async () => {
      return await this.client.get24hrTicker(symbol);
    });
  }

  /**
   * Get server time with automatic fallback to local time
   */
  async getServerTime(): Promise<ServiceResponse<number>> {
    return this.executeWithMetrics("getServerTime", async () => {
      const serverTime = await this.client.getServerTime();
      return {
        success: true,
        data: serverTime,
        timestamp: new Date().toISOString(),
      };
    });
  }

  // ============================================================================
  // Account Services (Authenticated)
  // ============================================================================

  /**
   * Get account information with automatic credential validation
   */
  async getAccountInfo(): Promise<ServiceResponse<Record<string, unknown>>> {
    return this.executeWithMetrics("getAccountInfo", async () => {
      return await this.client.getAccountInfo();
    });
  }

  /**
   * Get account balances with USDT conversion
   */
  async getAccountBalances(): Promise<ServiceResponse<{ balances: BalanceEntry[]; totalUsdtValue: number; lastUpdated: string }>> {
    return this.executeWithMetrics("getAccountBalances", async () => {
      return await this.client.getAccountBalances();
    });
  }

  /**
   * Get balance for a specific asset
   */
  async getAssetBalance(asset: string): Promise<ServiceResponse<{ free: string; locked: string } | null>> {
    return this.executeWithMetrics("getAssetBalance", async () => {
      const balance = await this.client.getAssetBalance(asset);
      return {
        success: balance !== null,
        data: balance,
        timestamp: new Date().toISOString(),
      };
    });
  }

  // ============================================================================
  // Trading Services (Authenticated)
  // ============================================================================

  /**
   * Place trading order with comprehensive validation and monitoring
   */
  async placeOrder(params: OrderParameters): Promise<ServiceResponse<OrderResult>> {
    return this.executeWithMetrics("placeOrder", async () => {
      // Pre-flight validation
      if (!this.client.hasCredentials()) {
        return {
          success: false,
          data: {
            success: false,
            symbol: params.symbol,
            side: params.side,
            quantity: params.quantity,
            price: params.price,
            error: "MEXC API credentials not configured",
            timestamp: new Date().toISOString(),
          },
          error: "MEXC API credentials not configured",
          timestamp: new Date().toISOString(),
        };
      }

      // Validate order parameters
      const validation = this.client.validateOrderParameters(params);
      if (!validation.valid) {
        const errorMessage = `Order validation failed: ${validation.errors.join(", ")}`;
        return {
          success: false,
          data: {
            success: false,
            symbol: params.symbol,
            side: params.side,
            quantity: params.quantity,
            price: params.price,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          },
          error: errorMessage,
          timestamp: new Date().toISOString(),
        };
      }

      // Check account balance before placing order (for safety)
      try {
        const baseAsset = params.side === "BUY" ? "USDT" : params.symbol.replace(/USDT$/, "");
        const balanceCheck = await this.client.getAssetBalance(baseAsset);
        
        if (!balanceCheck) {
          const errorMessage = `Unable to verify ${baseAsset} balance before placing order`;
          return {
            success: false,
            data: {
              success: false,
              symbol: params.symbol,
              side: params.side,
              quantity: params.quantity,
              price: params.price,
              error: errorMessage,
              timestamp: new Date().toISOString(),
            },
            error: errorMessage,
            timestamp: new Date().toISOString(),
          };
        }

        const availableBalance = Number.parseFloat(balanceCheck.free);
        const requiredAmount = params.side === "BUY" 
          ? Number.parseFloat(params.quantity) * (params.price ? Number.parseFloat(params.price) : 1)
          : Number.parseFloat(params.quantity);

        if (availableBalance < requiredAmount) {
          const errorMessage = `Insufficient ${baseAsset} balance. Available: ${balanceCheck.free}, Required: ${requiredAmount.toFixed(8)}`;
          return {
            success: false,
            data: {
              success: false,
              symbol: params.symbol,
              side: params.side,
              quantity: params.quantity,
              price: params.price,
              error: errorMessage,
              timestamp: new Date().toISOString(),
            },
            error: errorMessage,
            timestamp: new Date().toISOString(),
          };
        }

        if (this.config.enableLogging) {
          console.log(`[MexcServiceLayer] Balance check passed: ${baseAsset} balance: ${balanceCheck.free}`);
        }
      } catch (balanceError) {
        if (this.config.enableLogging) {
          console.warn("[MexcServiceLayer] Balance check failed, proceeding with order:", balanceError);
        }
        // Continue with order placement even if balance check fails
      }

      // Place the order
      return await this.client.placeOrder(params);
    });
  }

  /**
   * Place market buy order with quote quantity
   */
  async placeMarketBuyOrder(symbol: string, quoteOrderQty: number): Promise<ServiceResponse<OrderResult>> {
    const params: OrderParameters = {
      symbol,
      side: "BUY",
      type: "MARKET",
      quantity: "0", // Will be ignored for market buy with quoteOrderQty
      quoteOrderQty: quoteOrderQty.toString(),
      timeInForce: "IOC", // Immediate or Cancel for safety
    };

    return this.placeOrder(params);
  }

  /**
   * Place market sell order
   */
  async placeMarketSellOrder(symbol: string, quantity: number): Promise<ServiceResponse<OrderResult>> {
    const params: OrderParameters = {
      symbol,
      side: "SELL",
      type: "MARKET",
      quantity: quantity.toString(),
      timeInForce: "IOC", // Immediate or Cancel for safety
    };

    return this.placeOrder(params);
  }

  /**
   * Place limit order
   */
  async placeLimitOrder(
    symbol: string, 
    side: "BUY" | "SELL", 
    quantity: number, 
    price: number,
    timeInForce: "GTC" | "IOC" | "FOK" = "GTC"
  ): Promise<ServiceResponse<OrderResult>> {
    const params: OrderParameters = {
      symbol,
      side,
      type: "LIMIT",
      quantity: quantity.toString(),
      price: price.toString(),
      timeInForce,
    };

    return this.placeOrder(params);
  }

  // ============================================================================
  // Pattern Detection Services
  // ============================================================================

  /**
   * Detect ready state patterns (sts:2, st:2, tt:4)
   */
  async detectReadyStatePatterns(vcoinIds?: string[]): Promise<ServiceResponse<{
    totalSymbols: number;
    readyStateSymbols: SymbolEntry[];
    readyStateCount: number;
    analysisTimestamp: string;
  }>> {
    return this.executeWithMetrics("detectReadyStatePatterns", async () => {
      let symbolsData: SymbolEntry[];

      if (vcoinIds && vcoinIds.length > 0) {
        // Get symbols for specific vcoin IDs
        const symbolsResponse = await this.getSymbolsForVcoins(vcoinIds);
        if (!symbolsResponse.success) {
          return {
            success: false,
            data: {
              totalSymbols: 0,
              readyStateSymbols: [],
              readyStateCount: 0,
              analysisTimestamp: new Date().toISOString(),
            },
            error: symbolsResponse.error,
            timestamp: new Date().toISOString(),
          };
        }
        symbolsData = symbolsResponse.data;
      } else {
        // Get all symbols
        const symbolsResponse = await this.getSymbolsData();
        if (!symbolsResponse.success) {
          return {
            success: false,
            data: {
              totalSymbols: 0,
              readyStateSymbols: [],
              readyStateCount: 0,
              analysisTimestamp: new Date().toISOString(),
            },
            error: symbolsResponse.error,
            timestamp: new Date().toISOString(),
          };
        }
        symbolsData = symbolsResponse.data;
      }

      // Filter for ready state pattern: sts:2, st:2, tt:4
      const readyStateSymbols = symbolsData.filter(symbol => 
        symbol.sts === 2 && symbol.st === 2 && symbol.tt === 4
      );

      if (this.config.enableLogging) {
        console.log(`[MexcServiceLayer] Pattern detection: ${readyStateSymbols.length}/${symbolsData.length} symbols in ready state`);
      }

      return {
        success: true,
        data: {
          totalSymbols: symbolsData.length,
          readyStateSymbols,
          readyStateCount: readyStateSymbols.length,
          analysisTimestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * Get comprehensive market overview
   */
  async getMarketOverview(): Promise<ServiceResponse<{
    calendarCount: number;
    totalSymbols: number;
    readyStateCount: number;
    exchangeSymbolsCount: number;
    serverTime: number;
    lastUpdated: string;
  }>> {
    return this.executeWithMetrics("getMarketOverview", async () => {
      const [calendar, symbols, exchangeInfo, serverTime] = await Promise.allSettled([
        this.getCalendarListings(),
        this.getSymbolsData(),
        this.getExchangeInfo(),
        this.getServerTime(),
      ]);

      const calendarCount = calendar.status === "fulfilled" && calendar.value.success 
        ? calendar.value.data.length : 0;

      const symbolsData = symbols.status === "fulfilled" && symbols.value.success 
        ? symbols.value.data : [];
      
      const readyStateCount = symbolsData.filter(symbol => 
        symbol.sts === 2 && symbol.st === 2 && symbol.tt === 4
      ).length;

      const exchangeSymbolsCount = exchangeInfo.status === "fulfilled" && exchangeInfo.value.success
        ? exchangeInfo.value.data.length : 0;

      const currentServerTime = serverTime.status === "fulfilled" && serverTime.value.success
        ? serverTime.value.data : Date.now();

      return {
        success: true,
        data: {
          calendarCount,
          totalSymbols: symbolsData.length,
          readyStateCount,
          exchangeSymbolsCount,
          serverTime: currentServerTime,
          lastUpdated: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    });
  }

  // ============================================================================
  // Health and Monitoring Services
  // ============================================================================

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    
    try {
      // Test basic connectivity
      const connectivityTest = await this.client.testConnectivity();
      
      // Test authentication (if credentials are available)
      let authenticationTest = true;
      if (this.client.hasCredentials()) {
        try {
          const accountResponse = await this.client.getAccountInfo();
          authenticationTest = accountResponse.success;
        } catch {
          authenticationTest = false;
        }
      }

      const latencyMs = Math.round(performance.now() - startTime);
      const circuitBreakerState = this.circuitBreaker.getState();

      const result: HealthCheckResult = {
        healthy: connectivityTest && (authenticationTest || !this.client.hasCredentials()),
        connectivity: connectivityTest,
        authentication: authenticationTest,
        latencyMs,
        circuitBreakerState,
        timestamp: new Date().toISOString(),
      };

      this.lastHealthCheck = result;
      
      if (this.config.enableLogging) {
        console.log(`[MexcServiceLayer] Health check completed: ${result.healthy ? "HEALTHY" : "UNHEALTHY"} (${latencyMs}ms)`);
      }

      return result;
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      const result: HealthCheckResult = {
        healthy: false,
        connectivity: false,
        authentication: false,
        latencyMs,
        circuitBreakerState: this.circuitBreaker.getState(),
        lastError: errorMessage,
        timestamp: new Date().toISOString(),
      };

      this.lastHealthCheck = result;

      if (this.config.enableLogging) {
        console.error(`[MexcServiceLayer] Health check failed in ${latencyMs}ms:`, errorMessage);
      }

      return result;
    }
  }

  /**
   * Get the last health check result
   */
  getLastHealthCheck(): HealthCheckResult | null {
    return this.lastHealthCheck;
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Perform initial health check
    this.performHealthCheck().catch(error => {
      if (this.config.enableLogging) {
        console.error("[MexcServiceLayer] Initial health check failed:", error);
      }
    });

    // Schedule periodic health checks (every 5 minutes)
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        if (this.config.enableLogging) {
          console.error("[MexcServiceLayer] Periodic health check failed:", error);
        }
      });
    }, 300000); // 5 minutes
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // ============================================================================
  // Utility and Management Methods
  // ============================================================================

  /**
   * Get performance metrics for all operations
   */
  getMetrics(operation?: string): Record<string, OperationMetrics> {
    return this.metrics.getMetrics(operation);
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics.resetMetrics();
    if (this.config.enableLogging) {
      console.log("[MexcServiceLayer] Metrics reset");
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.client.clearCache();
    if (this.config.enableLogging) {
      console.log("[MexcServiceLayer] Cache cleared");
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return this.client.getCacheStats();
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<MexcServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update client configuration if relevant properties changed
    const clientConfigKeys = ['apiKey', 'secretKey', 'baseUrl', 'timeout', 'maxRetries', 'retryDelay'];
    const clientConfigUpdates: Partial<UnifiedMexcConfig> = {};
    
    for (const key of clientConfigKeys) {
      if (key in newConfig) {
        (clientConfigUpdates as any)[key] = (newConfig as any)[key];
      }
    }

    if (Object.keys(clientConfigUpdates).length > 0) {
      this.client.updateConfig(clientConfigUpdates);
    }

    if (this.config.enableLogging) {
      console.log("[MexcServiceLayer] Configuration updated");
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<MexcServiceConfig> {
    return { ...this.config };
  }

  /**
   * Check if service has valid credentials
   */
  hasCredentials(): boolean {
    return this.client.hasCredentials();
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): {
    state: string;
    isHealthy: boolean;
    stats: any;
  } {
    return {
      state: this.circuitBreaker.getState(),
      isHealthy: this.circuitBreaker.isHealthy(),
      stats: this.circuitBreaker.getStats(),
    };
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    if (this.config.enableLogging) {
      console.log("[MexcServiceLayer] Circuit breaker reset");
    }
  }

  /**
   * Cleanup resources and stop background processes
   */
  dispose(): void {
    this.stopHealthChecks();
    if (this.config.enableLogging) {
      console.log("[MexcServiceLayer] Disposed");
    }
  }
}

// ============================================================================
// Global Service Instance and Factory
// ============================================================================

let globalMexcService: MexcServiceLayer | null = null;

export function getMexcService(config?: MexcServiceConfig): MexcServiceLayer {
  if (!globalMexcService) {
    globalMexcService = new MexcServiceLayer(config);
  } else if (config) {
    globalMexcService.updateConfig(config);
  }
  return globalMexcService;
}

export function resetMexcService(): void {
  if (globalMexcService) {
    globalMexcService.dispose();
    globalMexcService = null;
  }
}

// Default export for convenience
export default MexcServiceLayer;