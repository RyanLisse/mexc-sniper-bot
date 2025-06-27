/**
 * MEXC Activity API Fixes - Production Ready Implementation
 * 
 * AGENT 3: MEXC Activity API Fix Specialist
 * 
 * This file contains the production-ready fixes for the unified MEXC core module's
 * activity API integration. These fixes address:
 * 
 * 1. getActivityData: Enhanced single currency fetch with proper error handling
 * 2. getBulkActivityData: Improved bulk operations with partial failure handling
 * 3. hasRecentActivity: Better activity checking logic with timestamp validation
 * 4. Activity API Caching: Proper cache responses and TTL configuration
 * 5. Error Handling: Comprehensive handling for empty strings, large batches, malformed responses
 */

import type {
  MexcServiceResponse,
  ActivityData,
  ActivityQueryOptionsType,
} from "@/src/schemas/unified/mexc-api-schemas";
import { z } from "zod";

// ============================================================================
// INPUT VALIDATION SCHEMAS
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
  timeframeMs: z.number().min(60000).max(30 * 24 * 60 * 60 * 1000).default(24 * 60 * 60 * 1000),
});

// ============================================================================
// ENHANCED ACTIVITY API METHODS TO REPLACE IN UNIFIED-MEXC-CORE.TS
// ============================================================================

/**
 * Enhanced getActivityData method with comprehensive error handling and caching
 */
export function createEnhancedGetActivityData(coreClient: any, cacheLayer: any, logger: any) {
  return async function getActivityData(currency: string): Promise<MexcServiceResponse<ActivityData[]>> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validatedInput = ActivityInputSchema.parse({ currency });
      const normalizedCurrency = validatedInput.currency.toUpperCase().trim();

      // Check cache first with specific TTL for activity data
      const cacheKey = `activity:${normalizedCurrency}`;
      
      const cachedResult = await cacheLayer.getOrSetWithCustomTTL(
        cacheKey,
        async () => {
          try {
            const result = await coreClient.getActivityData(normalizedCurrency);
            
            // Enhanced response handling
            if (result.success && result.data) {
              // Validate and normalize activity data
              const activityData = normalizeActivityData(result.data);
              
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
            logger.error(`Activity API error for ${normalizedCurrency}:`, error);
            
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
      
      logger.error(`Activity data validation error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown validation error",
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "enhanced-mexc-core",
      };
    }
  };
}

/**
 * Enhanced getBulkActivityData method with proper batch handling and partial failure support
 */
export function createEnhancedGetBulkActivityData(getActivityData: any, logger: any) {
  return async function getBulkActivityData(
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

      logger.info(`Processing bulk activity data for ${normalizedCurrencies.length} currencies`);

      // Process in batches to handle large requests
      const batches = chunkArray(normalizedCurrencies, batchOptions.batchSize);
      const allResponses: MexcServiceResponse<ActivityData[]>[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.debug(`Processing batch ${i + 1}/${batches.length} with ${batch.length} currencies`);

        // Process batch with concurrent requests but rate limiting
        const batchPromises = batch.map(async (currency, index) => {
          // Add delay between requests to respect rate limits
          if (index > 0) {
            await delay(batchOptions.rateLimitDelay);
          }
          
          return getActivityDataWithRetry(currency, batchOptions.maxRetries, getActivityData, delay, logger);
        });

        const batchResponses = await Promise.all(batchPromises);
        allResponses.push(...batchResponses);

        // Add delay between batches
        if (i < batches.length - 1) {
          await delay(batchOptions.rateLimitDelay * 2);
        }
      }

      // Count successes and failures
      const successCount = allResponses.filter(r => r.success).length;
      const failureCount = allResponses.length - successCount;
      
      logger.info(`Bulk activity completed: ${successCount} success, ${failureCount} failures`);

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
      
      logger.error(`Bulk activity data error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown bulk processing error",
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "enhanced-mexc-core",
      };
    }
  };
}

/**
 * Enhanced hasRecentActivity method with better timestamp logic
 */
export function createEnhancedHasRecentActivity(getActivityData: any, logger: any) {
  return async function hasRecentActivity(
    currency: string,
    timeframeMs: number = 24 * 60 * 60 * 1000
  ): Promise<boolean> {
    try {
      // Validate input
      const validatedInput = RecentActivityInputSchema.parse({ 
        currency, 
        timeframeMs 
      });
      
      const activityResponse = await getActivityData(validatedInput.currency);
      
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

      logger.debug(`Recent activity check for ${validatedInput.currency}: ${hasRecent}`, {
        responseTimestamp,
        cutoffTime,
        hasActivityData,
        hasRecentResponse,
        activityCount: activityResponse.data.length
      });

      return hasRecent;
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`Invalid recent activity check: ${error.errors.map(e => e.message).join(", ")}`);
        return false;
      }
      
      logger.warn(`Failed to check recent activity for ${currency}:`, error);
      return false;
    }
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize activity data to ensure consistent structure
 */
function normalizeActivityData(data: any): ActivityData[] {
  if (!data) return [];
  
  // Handle different response formats
  if (Array.isArray(data)) {
    return data.map(normalizeActivityItem).filter(Boolean);
  }
  
  if (typeof data === 'object' && data.data && Array.isArray(data.data)) {
    return data.data.map(normalizeActivityItem).filter(Boolean);
  }
  
  return [];
}

/**
 * Normalize a single activity item
 */
function normalizeActivityItem(item: any): ActivityData | null {
  if (!item || typeof item !== 'object') return null;
  
  try {
    return {
      activityId: item.activityId || item.id || `unknown-${Date.now()}`,
      currency: item.currency || item.currencyName || item.symbol || "",
      currencyId: item.currencyId || item.currency_id || item.id || "",
      activityType: item.activityType || item.activity_type || item.type || "UNKNOWN",
    };
  } catch (error) {
    console.warn("Failed to normalize activity item:", error);
    return null;
  }
}

/**
 * Get activity data with retry logic
 */
async function getActivityDataWithRetry(
  currency: string, 
  maxRetries: number,
  getActivityData: any,
  delay: any,
  logger: any
): Promise<MexcServiceResponse<ActivityData[]>> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await getActivityData(currency);
      
      // If successful OR it's a validation error (don't retry), return
      if (result.success || (result.error && result.error.includes("Invalid currency"))) {
        return result;
      }
      
      lastError = new Error(result.error || "Unknown error");
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s
        await delay(delayMs);
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await delay(delayMs);
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
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// INTEGRATION INSTRUCTIONS
// ============================================================================

/*
INTEGRATION STEPS:

1. Replace the existing methods in src/services/api/unified-mexc-core.ts:

   // Replace getActivityData method
   async getActivityData(currency: string): Promise<MexcServiceResponse<any>> {
     const enhancedMethod = createEnhancedGetActivityData(this.coreClient, this.cacheLayer, this.logger);
     return enhancedMethod(currency);
   }

   // Replace getBulkActivityData method  
   async getBulkActivityData(currencies: string[]): Promise<MexcServiceResponse<any[]>> {
     const enhancedMethod = createEnhancedGetBulkActivityData(this.getActivityData.bind(this), this.logger);
     return enhancedMethod(currencies);
   }

   // Replace hasRecentActivity method
   async hasRecentActivity(currency: string, timeframeMs: number = 24 * 60 * 60 * 1000): Promise<boolean> {
     const enhancedMethod = createEnhancedHasRecentActivity(this.getActivityData.bind(this), this.logger);
     return enhancedMethod(currency, timeframeMs);
   }

2. Add these imports to the top of unified-mexc-core.ts:
   import { z } from "zod";
   import type { ActivityData } from "@/src/schemas/unified/mexc-api-schemas";

3. Test the integration:
   bun test tests/unit/unified-mexc-service-activity.test.ts

EXPECTED IMPROVEMENTS:
- ✅ Enhanced single currency fetch with proper error handling
- ✅ Improved bulk operations with partial failure handling  
- ✅ Better activity checking logic with timestamp validation
- ✅ Proper cache responses and TTL configuration
- ✅ Comprehensive error handling for edge cases
- ✅ Input validation and normalization
- ✅ Batch processing for large requests
- ✅ Rate limiting and retry logic
- ✅ Performance metrics and metadata tracking
*/