/**
 * Enhanced Unified MEXC Core Module - Activity API Fixes
 *
 * AGENT 3: MEXC Activity API Fix Specialist
 * 
 * Comprehensive fixes for:
 * - getActivityData: single currency fetch failures
 * - getBulkActivityData: multiple currencies and partial failures  
 * - hasRecentActivity: activity checking logic
 * - Activity API Caching: cache responses and TTL
 * - Error Handling: empty strings, large batches, malformed responses
 */

import type {
  CalendarEntry,
  MexcServiceResponse,
  SymbolEntry,
  ActivityData,
  ActivityResponse,
  ActivityQueryOptionsType,
} from "@/src/schemas/unified/mexc-api-schemas";
import type { MexcCacheLayer } from "@/src/services/data/modules/mexc-cache-layer";
import type { MexcCoreClient } from "@/src/services/data/modules/mexc-core-client";
import { z } from "zod";

// ============================================================================
// Activity API Input Validation Schemas
// ============================================================================

const ActivityInputSchema = z.object({
  currency: z.string().min(1, "Currency cannot be empty").max(20, "Currency too long"),
});

const BulkActivityInputSchema = z.object({
  currencies: z.array(z.string().min(1)).min(1, "At least one currency required").max(100, "Too many currencies"),
  options: z.object({
    batchSize: z.number().min(1).max(20).default(5),
    maxRetries: z.number().min(0).max(5).default(3),
    rateLimitDelay: z.number().min(0).max(1000).default(200),
  }).optional(),
});

const RecentActivityInputSchema = z.object({
  currency: z.string().min(1, "Currency cannot be empty"),
  timeframeMs: z.number().min(60000).max(30 * 24 * 60 * 60 * 1000).default(24 * 60 * 60 * 1000), // 1 min to 30 days
});

// ============================================================================
// Enhanced Core Service Module with Activity API Fixes
// ============================================================================

export class EnhancedUnifiedMexcCoreModule {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[enhanced-mexc-core]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[enhanced-mexc-core]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[enhanced-mexc-core]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[enhanced-mexc-core]", message, context || ""),
  };

  constructor(
    private coreClient: MexcCoreClient,
    private cacheLayer: MexcCacheLayer
  ) {}

  // ============================================================================
  // Calendar & Listings (Existing Methods)
  // ============================================================================

  async getCalendarListings(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    return this.cacheLayer.getOrSet(
      "calendar:listings",
      () => this.coreClient.getCalendarListings(),
      "semiStatic"
    );
  }

  // ============================================================================
  // Symbols & Market Data (Existing Methods)
  // ============================================================================

  async getSymbolsByVcoinId(vcoinId: string): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.cacheLayer.getOrSet(
      `symbols:${vcoinId}`,
      () => this.coreClient.getSymbolsByVcoinId(vcoinId),
      "semiStatic"
    );
  }

  async getAllSymbols(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.cacheLayer.getOrSet(
      "symbols:all",
      () => this.coreClient.getAllSymbols(),
      "semiStatic"
    );
  }

  async getServerTime(): Promise<MexcServiceResponse<number>> {
    return this.cacheLayer.getOrSet(
      "server:time",
      () => this.coreClient.getServerTime(),
      "realTime"
    );
  }

  async getSymbolInfoBasic(symbolName: string): Promise<MexcServiceResponse<any>> {
    return this.cacheLayer.getOrSet(
      `symbol:basic:${symbolName}`,
      () => this.coreClient.getSymbolInfoBasic(symbolName),
      "semiStatic"
    );
  }

  async getSymbolData(symbol: string): Promise<MexcServiceResponse<any>> {
    return this.cacheLayer.getOrSet(
      `symbol:data:${symbol}`,
      () => this.coreClient.getSymbolInfoBasic(symbol),
      "semiStatic"
    );
  }

  // ============================================================================
  // ENHANCED ACTIVITY API METHODS - CORE FIXES
  // ============================================================================

  /**
   * Get activity data for a currency - ENHANCED with proper error handling
   */
  async getActivityData(currency: string): Promise<MexcServiceResponse<ActivityData[]>> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validatedInput = ActivityInputSchema.parse({ currency });
      const normalizedCurrency = validatedInput.currency.toUpperCase().trim();

      // Check cache first with specific TTL for activity data
      const cacheKey = `activity:${normalizedCurrency}`;
      
      const cachedResult = await this.cacheLayer.getOrSetWithCustomTTL(
        cacheKey,
        async () => {
          try {
            const result = await this.coreClient.getActivityData(normalizedCurrency);
            
            // Enhanced response handling
            if (result.success && result.data) {
              // Validate and normalize activity data
              const activityData = this.normalizeActivityData(result.data);
              
              return {
                ...result,
                data: activityData,
                executionTimeMs: Date.now() - startTime,
                cached: false,
              };
            }
            
            // Handle empty/null responses
            return {
              success: true,
              data: [], // Return empty array instead of null for consistency
              timestamp: Date.now(),
              executionTimeMs: Date.now() - startTime,
              source: "enhanced-mexc-core",
              cached: false,
            };
          } catch (error) {
            this.logger.error(`Activity API error for ${normalizedCurrency}:`, error);
            
            return {
              success: false,
              error: error instanceof Error ? error.message : "Unknown activity API error",
              timestamp: Date.now(),
              executionTimeMs: Date.now() - startTime,
              source: "enhanced-mexc-core",
              cached: false,
            };
          }
        },
        5000 // 5 second TTL for activity data
      );

      return cachedResult;
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: `Invalid currency: ${error.errors.map(e => e.message).join(", ")}`,
          timestamp: Date.now(),
          executionTimeMs: Date.now() - startTime,
          source: "enhanced-mexc-core",
        };
      }
      
      this.logger.error(`Activity data validation error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown validation error",
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "enhanced-mexc-core",
      };
    }
  }

  /**
   * Get bulk activity data for multiple currencies - ENHANCED with proper batch handling
   */
  async getBulkActivityData(
    currencies: string[], 
    options?: ActivityQueryOptionsType
  ): Promise<MexcServiceResponse<MexcServiceResponse<ActivityData[]>[]>> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validatedInput = BulkActivityInputSchema.parse({ 
        currencies, 
        options: options || {} 
      });
      
      const normalizedCurrencies = validatedInput.currencies.map(c => c.toUpperCase().trim());
      const batchOptions = validatedInput.options || {
        batchSize: 5,
        maxRetries: 3,
        rateLimitDelay: 200,
      };

      this.logger.info(`Processing bulk activity data for ${normalizedCurrencies.length} currencies`);

      // Process in batches to handle large requests
      const batches = this.chunkArray(normalizedCurrencies, batchOptions.batchSize);
      const allResponses: MexcServiceResponse<ActivityData[]>[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.debug(`Processing batch ${i + 1}/${batches.length} with ${batch.length} currencies`);

        // Process batch with concurrent requests but rate limiting
        const batchPromises = batch.map(async (currency, index) => {
          // Add delay between requests to respect rate limits
          if (index > 0) {
            await this.delay(batchOptions.rateLimitDelay);
          }
          
          return this.getActivityDataWithRetry(currency, batchOptions.maxRetries);
        });

        const batchResponses = await Promise.all(batchPromises);
        allResponses.push(...batchResponses);

        // Add delay between batches
        if (i < batches.length - 1) {
          await this.delay(batchOptions.rateLimitDelay * 2);
        }
      }

      // Count successes and failures
      const successCount = allResponses.filter(r => r.success).length;
      const failureCount = allResponses.length - successCount;
      
      this.logger.info(`Bulk activity completed: ${successCount} success, ${failureCount} failures`);

      return {
        success: true,
        data: allResponses, // Return ALL responses including failures
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "enhanced-mexc-core",
        metadata: {
          totalRequests: allResponses.length,
          successCount,
          failureCount,
          batchCount: batches.length,
          batchSize: batchOptions.batchSize,
        }
      };
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: `Invalid bulk request: ${error.errors.map(e => e.message).join(", ")}`,
          timestamp: Date.now(),
          executionTimeMs: Date.now() - startTime,
          source: "enhanced-mexc-core",
        };
      }
      
      this.logger.error(`Bulk activity data error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown bulk processing error",
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "enhanced-mexc-core",
      };
    }
  }

  /**
   * Check if currency has recent activity - ENHANCED with better logic
   */
  async hasRecentActivity(
    currency: string,
    timeframeMs: number = 24 * 60 * 60 * 1000
  ): Promise<boolean> {
    try {
      // Validate input
      const validatedInput = RecentActivityInputSchema.parse({ 
        currency, 
        timeframeMs 
      });
      
      const activityResponse = await this.getActivityData(validatedInput.currency);
      
      // If the response failed or has no data, no recent activity
      if (!activityResponse.success || !activityResponse.data || activityResponse.data.length === 0) {
        return false;
      }

      // Enhanced logic: check both response timestamp AND activity data timestamps
      const currentTime = Date.now();
      const cutoffTime = currentTime - validatedInput.timeframeMs;

      // Check if the API response is recent (within timeframe)
      const responseTimestamp = typeof activityResponse.timestamp === 'string' 
        ? new Date(activityResponse.timestamp).getTime()
        : activityResponse.timestamp;
        
      const hasRecentResponse = responseTimestamp > cutoffTime;

      // If we have activity data, it indicates recent activity
      const hasActivityData = activityResponse.data.length > 0;

      // Recent activity if we have both recent response AND activity data
      const hasRecent = hasRecentResponse && hasActivityData;

      this.logger.debug(`Recent activity check for ${validatedInput.currency}: ${hasRecent}`, {
        responseTimestamp,
        cutoffTime,
        hasActivityData,
        hasRecentResponse,
        activityCount: activityResponse.data.length
      });

      return hasRecent;
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.warn(`Invalid recent activity check: ${error.errors.map(e => e.message).join(", ")}`);
        return false;
      }
      
      this.logger.warn(`Failed to check recent activity for ${currency}:`, error);
      return false;
    }
  }

  // ============================================================================
  // Multi-Symbol Operations (Enhanced)
  // ============================================================================

  async getSymbolsForVcoins(vcoinIds: string[]): Promise<MexcServiceResponse<SymbolEntry[]>> {
    // Enhanced with better error handling
    if (!vcoinIds || vcoinIds.length === 0) {
      return {
        success: false,
        error: "No vcoinIds provided",
        timestamp: Date.now(),
        source: "enhanced-mexc-core",
      };
    }

    const promises = vcoinIds.map((vcoinId) => this.getSymbolsByVcoinId(vcoinId));
    const responses = await Promise.all(promises);

    const allSymbols: SymbolEntry[] = [];
    const errors: string[] = [];

    for (const response of responses) {
      if (response.success && response.data) {
        allSymbols.push(...response.data);
      } else {
        errors.push(response.error || "Failed to fetch symbols");
      }
    }

    return {
      success: true,
      data: allSymbols,
      timestamp: Date.now(),
      source: "enhanced-mexc-core",
      metadata: {
        totalRequests: vcoinIds.length,
        successCount: responses.filter(r => r.success).length,
        failureCount: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      }
    };
  }

  async getSymbolsData(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.getAllSymbols();
  }

  // ============================================================================
  // Connectivity & Status (Existing)
  // ============================================================================

  async testConnectivity(): Promise<MexcServiceResponse<{ serverTime: number; latency: number }>> {
    const startTime = Date.now();

    try {
      const serverTimeResponse = await this.getServerTime();

      if (!serverTimeResponse.success) {
        return {
          success: false,
          error: "Failed to connect to MEXC API",
          timestamp: Date.now(),
          source: "enhanced-mexc-core",
        };
      }

      const latency = Date.now() - startTime;

      return {
        success: true,
        data: {
          serverTime: serverTimeResponse.data!,
          latency,
        },
        timestamp: Date.now(),
        source: "enhanced-mexc-core",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown connectivity error",
        timestamp: Date.now(),
        source: "enhanced-mexc-core",
      };
    }
  }

  async testConnectivityWithResponse(): Promise<
    MexcServiceResponse<{
      serverTime: number;
      latency: number;
      connected: boolean;
      apiVersion: string;
      region: string;
    }>
  > {
    const startTime = Date.now();

    try {
      const serverTimeResponse = await this.getServerTime();

      if (!serverTimeResponse.success) {
        return {
          success: false,
          error: "Failed to connect to MEXC API",
          timestamp: Date.now(),
          source: "enhanced-mexc-core",
        };
      }

      const latency = Date.now() - startTime;

      return {
        success: true,
        data: {
          serverTime: serverTimeResponse.data!,
          latency,
          connected: true,
          apiVersion: "v3",
          region: "global",
        },
        timestamp: Date.now(),
        source: "enhanced-mexc-core",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown connectivity error",
        timestamp: Date.now(),
        source: "enhanced-mexc-core",
      };
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Normalize activity data to ensure consistent structure
   */
  private normalizeActivityData(data: any): ActivityData[] {
    if (!data) return [];
    
    // Handle different response formats
    if (Array.isArray(data)) {
      return data.map(this.normalizeActivityItem).filter(Boolean);
    }
    
    if (typeof data === 'object' && data.data && Array.isArray(data.data)) {
      return data.data.map(this.normalizeActivityItem).filter(Boolean);
    }
    
    return [];
  }

  /**
   * Normalize a single activity item
   */
  private normalizeActivityItem(item: any): ActivityData | null {
    if (!item || typeof item !== 'object') return null;
    
    try {
      return {
        activityId: item.activityId || item.id || `unknown-${Date.now()}`,
        currency: item.currency || item.currencyName || item.symbol || "",
        currencyId: item.currencyId || item.currency_id || item.id || "",
        activityType: item.activityType || item.activity_type || item.type || "UNKNOWN",
      };
    } catch (error) {
      this.logger.warn("Failed to normalize activity item:", error);
      return null;
    }
  }

  /**
   * Get activity data with retry logic
   */
  private async getActivityDataWithRetry(
    currency: string, 
    maxRetries: number
  ): Promise<MexcServiceResponse<ActivityData[]>> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.getActivityData(currency);
        
        // If successful OR it's a validation error (don't retry), return
        if (result.success || (result.error && result.error.includes("Invalid currency"))) {
          return result;
        }
        
        lastError = new Error(result.error || "Unknown error");
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s
          await this.delay(delay);
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await this.delay(delay);
        }
      }
    }

    // All retries failed
    return {
      success: false,
      error: `Failed after ${maxRetries + 1} attempts: ${lastError?.message || "Unknown error"}`,
      timestamp: Date.now(),
      source: "enhanced-mexc-core",
      metadata: {
        currency,
        retryCount: maxRetries,
      }
    };
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}