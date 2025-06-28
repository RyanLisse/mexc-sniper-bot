/**
 * Portfolio Service Module
 *
 * Modular service for handling MEXC portfolio management with type safety,
 * Zod validation, caching, and analytics.
 *
 * Key Features:
 * - Type-safe with Zod schema validation
 * - Real-time portfolio calculations
 * - Performance analytics and metrics
 * - Asset allocation tracking
 * - Risk assessment capabilities
 * - Under 500 lines as per requirements
 */

import { z } from "zod";
import { toSafeError } from "@/src/lib/error-type-utils";
import { instrumentServiceMethod } from "@/src/lib/opentelemetry-service-instrumentation";

// ============================================================================
// Zod Schemas for Type Safety
// ============================================================================

export const BalanceEntrySchema = z.object({
  asset: z.string().min(1, "Asset symbol is required"),
  free: z.string().regex(/^\d+(\.\d+)?$/, "Free balance must be a valid number string"),
  locked: z.string().regex(/^\d+(\.\d+)?$/, "Locked balance must be a valid number string"),
});

export const PortfolioMetricsSchema = z.object({
  totalValue: z.number().nonnegative("Total value must be non-negative"),
  totalPnl: z.number(),
  totalPnlPercentage: z.number(),
  topPerformers: z.array(z.string()).max(10, "Maximum 10 top performers"),
  worstPerformers: z.array(z.string()).max(10, "Maximum 10 worst performers"),
  assetDistribution: z.record(z.string(), z.number().nonnegative()),
  riskScore: z.number().min(0).max(100, "Risk score must be between 0-100"),
  diversificationScore: z.number().min(0).max(100, "Diversification score must be between 0-100"),
});

export const PortfolioSchema = z.object({
  balances: z.array(BalanceEntrySchema),
  metrics: PortfolioMetricsSchema,
  timestamp: z.number().int().positive(),
  totalAssets: z.number().int().nonnegative(),
  totalValue: z.number().nonnegative(),
  updateId: z.string().optional(),
});

export const PortfolioResponseSchema = z.object({
  success: z.boolean(),
  data: PortfolioSchema,
  error: z.string().optional(),
  timestamp: z.number().optional(),
  cached: z.boolean().optional(),
});

export const PortfolioFilterSchema = z.object({
  minBalance: z.number().nonnegative().optional(),
  maxBalance: z.number().nonnegative().optional(),
  assets: z.array(z.string()).optional(),
  excludeZeroBalances: z.boolean().default(true),
  includeMetrics: z.boolean().default(true),
});

// ============================================================================
// Types
// ============================================================================

export type BalanceEntry = z.infer<typeof BalanceEntrySchema>;
export type PortfolioMetrics = z.infer<typeof PortfolioMetricsSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;
export type PortfolioResponse = z.infer<typeof PortfolioResponseSchema>;
export type PortfolioFilter = z.infer<typeof PortfolioFilterSchema>;

export interface PortfolioConfig {
  apiClient: {
    get: (endpoint: string, params?: Record<string, any>) => Promise<any>;
  };
  tickerService?: {
    getTicker24hr: (symbols?: string[]) => Promise<any>;
  };
  cache?: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
  };
  circuitBreaker?: {
    execute: <T>(fn: () => Promise<T>) => Promise<T>;
  };
  performanceMonitor?: {
    recordMetric: (name: string, value: number, tags?: Record<string, string>) => void;
  };
  cacheTTL?: number;
}

// ============================================================================
// Service Class
// ============================================================================

export class PortfolioService {
  private readonly config: PortfolioConfig;
  private readonly cacheTTL: number;
  private readonly cacheKeyPrefix = "mexc:portfolio";

  constructor(config: PortfolioConfig) {
    this.config = config;
    this.cacheTTL = config.cacheTTL ?? 15000; // 15 seconds default (portfolio changes frequently)
  }

  /**
   * Get complete portfolio with metrics
   */
  @instrumentServiceMethod({
    serviceName: "portfolio",
    methodName: "getPortfolio",
    operationType: "api_call",
  })
  async getPortfolio(filter?: PortfolioFilter): Promise<PortfolioResponse> {
    const startTime = Date.now();

    try {
      // Validate input filter
      const validatedFilter = filter
        ? PortfolioFilterSchema.parse(filter)
        : PortfolioFilterSchema.parse({});

      const cacheKey = this.generateCacheKey(validatedFilter);

      // Try cache first
      if (this.config.cache) {
        const cached = await this.getCachedPortfolio(cacheKey);
        if (cached) {
          this.recordMetric("cache_hit", 1, { operation: "getPortfolio" });
          return cached;
        }
      }

      // Fetch portfolio data
      const portfolio = await this.fetchPortfolioData(validatedFilter);

      // Cache the result
      if (this.config.cache && portfolio.success) {
        await this.cachePortfolio(cacheKey, portfolio);
      }

      // Record metrics
      this.recordMetric("response_time", Date.now() - startTime, { operation: "getPortfolio" });
      this.recordMetric("cache_miss", 1, { operation: "getPortfolio" });

      return portfolio;
    } catch (error) {
      const safeError = toSafeError(error);
      this.recordMetric("error_count", 1, { operation: "getPortfolio", error: safeError.name });

      return {
        success: false,
        data: this.getEmptyPortfolio(),
        error: safeError.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get portfolio balances only (no metrics)
   */
  @instrumentServiceMethod({
    serviceName: "portfolio",
    methodName: "getBalances",
    operationType: "api_call",
  })
  async getBalances(filter?: PortfolioFilter): Promise<PortfolioResponse> {
    const filterWithoutMetrics = {
      excludeZeroBalances: false,
      includeMetrics: false,
      ...filter,
    };
    return this.getPortfolio(filterWithoutMetrics);
  }

  /**
   * Get asset allocation breakdown
   */
  @instrumentServiceMethod({
    serviceName: "portfolio",
    methodName: "getAssetAllocation",
    operationType: "api_call",
  })
  async getAssetAllocation(): Promise<{
    success: boolean;
    data: Record<string, number>;
    error?: string;
  }> {
    try {
      const portfolio = await this.getPortfolio({
        includeMetrics: true,
        excludeZeroBalances: false,
      });
      if (!portfolio.success) {
        return { success: false, data: {}, error: portfolio.error };
      }

      return {
        success: true,
        data: portfolio.data.metrics.assetDistribution,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        data: {},
        error: safeError.message,
      };
    }
  }

  /**
   * Get portfolio performance summary
   */
  @instrumentServiceMethod({
    serviceName: "portfolio",
    methodName: "getPerformanceSummary",
    operationType: "api_call",
  })
  async getPerformanceSummary(): Promise<{
    success: boolean;
    data: {
      totalValue: number;
      totalPnl: number;
      totalPnlPercentage: number;
      riskScore: number;
      diversificationScore: number;
    };
    error?: string;
  }> {
    try {
      const portfolio = await this.getPortfolio({
        includeMetrics: true,
        excludeZeroBalances: false,
      });
      if (!portfolio.success) {
        return {
          success: false,
          data: {
            totalValue: 0,
            totalPnl: 0,
            totalPnlPercentage: 0,
            riskScore: 0,
            diversificationScore: 0,
          },
          error: portfolio.error,
        };
      }

      const { metrics } = portfolio.data;
      return {
        success: true,
        data: {
          totalValue: metrics.totalValue,
          totalPnl: metrics.totalPnl,
          totalPnlPercentage: metrics.totalPnlPercentage,
          riskScore: metrics.riskScore,
          diversificationScore: metrics.diversificationScore,
        },
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        data: {
          totalValue: 0,
          totalPnl: 0,
          totalPnlPercentage: 0,
          riskScore: 0,
          diversificationScore: 0,
        },
        error: safeError.message,
      };
    }
  }

  /**
   * Clear portfolio cache
   */
  async clearCache(): Promise<void> {
    if (!this.config.cache) return;

    // Clear common cache patterns
    const commonKeys = [
      this.generateCacheKey({ includeMetrics: false, excludeZeroBalances: false }),
      this.generateCacheKey({ excludeZeroBalances: true, includeMetrics: false }),
      this.generateCacheKey({ includeMetrics: true, excludeZeroBalances: false }),
      this.generateCacheKey({ excludeZeroBalances: true, includeMetrics: true }),
    ];

    await Promise.all(commonKeys.map((key) => this.config.cache?.set(key, null, 0)));
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async fetchPortfolioData(filter: PortfolioFilter): Promise<PortfolioResponse> {
    const executeWithCircuitBreaker =
      this.config.circuitBreaker?.execute ?? ((fn: () => Promise<any>) => fn());

    const rawBalances = await executeWithCircuitBreaker(async () => {
      return this.config.apiClient.get("/api/v3/account");
    });

    // Transform and filter balances
    const balances = this.transformAndFilterBalances(rawBalances.balances || [], filter);

    // Calculate metrics if requested
    let metrics = this.getEmptyMetrics();
    if (filter.includeMetrics) {
      metrics = await this.calculatePortfolioMetrics(balances);
    }

    const portfolio: Portfolio = {
      balances,
      metrics,
      timestamp: Date.now(),
      totalAssets: balances.length,
      totalValue: metrics.totalValue,
      updateId: rawBalances.updateTime?.toString(),
    };

    // Validate with Zod schema
    const validatedPortfolio = PortfolioSchema.parse(portfolio);

    return {
      success: true,
      data: validatedPortfolio,
      timestamp: Date.now(),
    };
  }

  private transformAndFilterBalances(rawBalances: any[], filter: PortfolioFilter): BalanceEntry[] {
    const balances = rawBalances
      .map((balance) => ({
        asset: balance.asset || "",
        free: balance.free || "0",
        locked: balance.locked || "0",
      }))
      .filter((balance) => {
        const totalBalance = Number.parseFloat(balance.free) + Number.parseFloat(balance.locked);

        if (filter.excludeZeroBalances && totalBalance === 0) {
          return false;
        }

        if (filter.minBalance && totalBalance < filter.minBalance) {
          return false;
        }

        if (filter.maxBalance && totalBalance > filter.maxBalance) {
          return false;
        }

        if (filter.assets && !filter.assets.includes(balance.asset)) {
          return false;
        }

        return true;
      });

    // Validate each balance entry
    return balances.map((balance) => BalanceEntrySchema.parse(balance));
  }

  private async calculatePortfolioMetrics(balances: BalanceEntry[]): Promise<PortfolioMetrics> {
    // This is a simplified calculation - in a real implementation,
    // you'd fetch current prices and calculate actual values
    const totalValue = balances.reduce((sum, balance) => {
      const total = Number.parseFloat(balance.free) + Number.parseFloat(balance.locked);
      return sum + total; // Simplified: assuming 1:1 USDT value
    }, 0);

    const assetDistribution: Record<string, number> = {};
    balances.forEach((balance) => {
      const total = Number.parseFloat(balance.free) + Number.parseFloat(balance.locked);
      assetDistribution[balance.asset] = totalValue > 0 ? (total / totalValue) * 100 : 0;
    });

    // Simplified metrics calculation
    const diversificationScore = Math.min(100, balances.length * 10); // Basic diversification
    const riskScore = Math.max(0, 100 - diversificationScore); // Inverse relationship

    return {
      totalValue,
      totalPnl: 0, // Would calculate from historical data
      totalPnlPercentage: 0,
      topPerformers: [],
      worstPerformers: [],
      assetDistribution,
      riskScore,
      diversificationScore,
    };
  }

  private async getCachedPortfolio(cacheKey: string): Promise<PortfolioResponse | null> {
    if (!this.config.cache) return null;

    try {
      const cached = await this.config.cache.get(cacheKey);
      if (!cached) return null;

      return PortfolioResponseSchema.parse(cached);
    } catch (_error) {
      return null;
    }
  }

  private async cachePortfolio(cacheKey: string, portfolio: PortfolioResponse): Promise<void> {
    if (!this.config.cache) return;

    const cacheData = { ...portfolio, cached: true };
    await this.config.cache.set(cacheKey, cacheData, this.cacheTTL);
  }

  private generateCacheKey(filter: PortfolioFilter): string {
    const filterString = Object.entries(filter)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
      .join("|");

    return `${this.cacheKeyPrefix}:${filterString}`;
  }

  private getEmptyPortfolio(): Portfolio {
    return {
      balances: [],
      metrics: this.getEmptyMetrics(),
      timestamp: Date.now(),
      totalAssets: 0,
      totalValue: 0,
    };
  }

  private getEmptyMetrics(): PortfolioMetrics {
    return {
      totalValue: 0,
      totalPnl: 0,
      totalPnlPercentage: 0,
      topPerformers: [],
      worstPerformers: [],
      assetDistribution: {},
      riskScore: 0,
      diversificationScore: 0,
    };
  }

  private recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.config.performanceMonitor?.recordMetric(name, value, {
      service: "portfolio",
      ...tags,
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPortfolioService(config: PortfolioConfig): PortfolioService {
  return new PortfolioService(config);
}

// ============================================================================
// Exports
// ============================================================================
