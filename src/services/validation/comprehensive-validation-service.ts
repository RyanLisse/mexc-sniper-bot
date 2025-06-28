/**
 * Comprehensive Validation Service
 * 
 * Central service for managing all validation across the application.
 * Provides unified validation for API requests, external responses,
 * and critical data flows with comprehensive error handling.
 */

import { z } from "zod";
import {
  validateExternalApiResponse,
  CriticalDataValidator,
  ValidationError,
  type EnhancedValidationResult,
  ValidationHealthMonitor,
} from "@/src/lib/enhanced-validation-middleware";
import {
  validateMexcResponse,
  validateCriticalTradingData,
  safeValidateWithDefault,
  MEXC_API_SCHEMAS,
  CRITICAL_DATA_SCHEMAS,
  type MexcBaseResponse,
  type TradingOrder,
  type AccountBalance,
  type PortfolioSummary,
} from "@/src/schemas/external-api-validation-schemas";
import {
  validateMexcData,
  type MexcServiceResponse,
} from "@/src/schemas/unified/mexc-api-schemas";

// ============================================================================
// Validation Service Configuration
// ============================================================================

interface ValidationConfig {
  enableStrictMode: boolean;
  enableMetrics: boolean;
  enableCaching: boolean;
  maxCacheSize: number;
  logLevel: "debug" | "info" | "warn" | "error";
  failFast: boolean;
}

const DEFAULT_CONFIG: ValidationConfig = {
  enableStrictMode: process.env.NODE_ENV === "production",
  enableMetrics: true,
  enableCaching: true,
  maxCacheSize: 1000,
  logLevel: process.env.NODE_ENV === "development" ? "debug" : "info",
  failFast: process.env.NODE_ENV === "production",
};

// ============================================================================
// Validation Cache
// ============================================================================

interface ValidationCacheEntry {
  result: any;
  timestamp: number;
  schemaHash: string;
}

class ValidationCache {
  private cache = new Map<string, ValidationCacheEntry>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  set(key: string, result: any, schemaHash: string): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.2));
      toRemove.forEach(([key]) => this.cache.delete(key));
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      schemaHash,
    });
  }

  get(key: string, schemaHash: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if schema has changed
    if (entry.schemaHash !== schemaHash) {
      this.cache.delete(key);
      return null;
    }

    // Check if entry is too old (5 minutes)
    if (Date.now() - entry.timestamp > 5 * 60 * 1000) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Main Validation Service
// ============================================================================

export class ComprehensiveValidationService {
  private config: ValidationConfig;
  private cache: ValidationCache;
  private logger: {
    debug: (message: string, context?: any) => void;
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any) => void;
  };

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new ValidationCache(this.config.maxCacheSize);
    
    this.logger = {
      debug: (message: string, context?: any) => {
        if (this.config.logLevel === "debug") {
          console.debug(`[ValidationService] ${message}`, context || "");
        }
      },
      info: (message: string, context?: any) => {
        if (["debug", "info"].includes(this.config.logLevel)) {
          console.info(`[ValidationService] ${message}`, context || "");
        }
      },
      warn: (message: string, context?: any) => {
        if (["debug", "info", "warn"].includes(this.config.logLevel)) {
          console.warn(`[ValidationService] ${message}`, context || "");
        }
      },
      error: (message: string, context?: any) => {
        console.error(`[ValidationService] ${message}`, context || "");
      },
    };
  }

  // ============================================================================
  // MEXC API Response Validation
  // ============================================================================

  async validateMexcApiResponse<T>(
    apiEndpoint: string,
    response: unknown,
    expectedSchema: keyof typeof MEXC_API_SCHEMAS
  ): Promise<EnhancedValidationResult<T>> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Validating MEXC API response for ${apiEndpoint}`);
      
      const schema = MEXC_API_SCHEMAS[expectedSchema];
      const cacheKey = `mexc:${apiEndpoint}:${JSON.stringify(response).substring(0, 100)}`;
      const schemaHash = this.getSchemaHash(schema);
      
      // Check cache if enabled
      if (this.config.enableCaching) {
        const cached = this.cache.get(cacheKey, schemaHash);
        if (cached) {
          this.logger.debug(`Cache hit for MEXC API ${apiEndpoint}`);
          return cached;
        }
      }
      
      const validationResult = validateMexcResponse(schema, response, apiEndpoint);
      const validationTime = Date.now() - startTime;
      
      if (this.config.enableMetrics) {
        ValidationHealthMonitor.recordValidation(validationResult.success, validationTime, validationResult.error);
      }
      
      const result: EnhancedValidationResult<T> = {
        success: validationResult.success,
        data: validationResult.success ? validationResult.data : undefined,
        error: validationResult.error,
        statusCode: validationResult.success ? 200 : 502,
        metrics: {
          validationTime,
          schemaSize: 0,
          errorCount: validationResult.success ? 0 : 1,
          validatedFields: validationResult.success ? Object.keys(validationResult.data || {}) : [],
        },
      };
      
      // Cache successful results
      if (this.config.enableCaching && validationResult.success) {
        this.cache.set(cacheKey, result, schemaHash);
      }
      
      this.logger.debug(`MEXC API validation for ${apiEndpoint} completed`, {
        success: validationResult.success,
        validationTime,
      });
      
      return result;
    } catch (error) {
      const validationTime = Date.now() - startTime;
      
      if (this.config.enableMetrics) {
        ValidationHealthMonitor.recordValidation(false, validationTime, error instanceof Error ? error.message : "Unknown error");
      }
      
      this.logger.error(`MEXC API validation failed for ${apiEndpoint}`, error);
      
      return {
        success: false,
        error: `MEXC API validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        statusCode: 500,
        metrics: {
          validationTime,
          schemaSize: 0,
          errorCount: 1,
          validatedFields: [],
        },
      };
    }
  }

  // ============================================================================
  // Critical Data Flow Validation
  // ============================================================================

  validateCriticalTradingOrder(orderData: unknown): TradingOrder {
    this.logger.debug("Validating critical trading order data");
    
    try {
      const validated = CriticalDataValidator.validateCriticalData(
        CRITICAL_DATA_SCHEMAS.tradingOrder,
        orderData,
        "trading-order",
        true // Required
      );
      
      this.logger.info("Trading order validation successful", {
        symbol: validated.symbol,
        side: validated.side,
        type: validated.type,
      });
      
      return validated;
    } catch (error) {
      this.logger.error("Critical trading order validation failed", error);
      throw error;
    }
  }

  validateCriticalAccountBalance(balanceData: unknown): AccountBalance {
    this.logger.debug("Validating critical account balance data");
    
    try {
      const validated = CriticalDataValidator.validateCriticalData(
        CRITICAL_DATA_SCHEMAS.accountBalance,
        balanceData,
        "account-balance",
        true // Required
      );
      
      this.logger.debug("Account balance validation successful", {
        asset: validated.asset,
        total: validated.total,
      });
      
      return validated;
    } catch (error) {
      this.logger.error("Critical account balance validation failed", error);
      throw error;
    }
  }

  validateCriticalPortfolio(portfolioData: unknown): PortfolioSummary {
    this.logger.debug("Validating critical portfolio data");
    
    try {
      const validated = CriticalDataValidator.validateCriticalData(
        CRITICAL_DATA_SCHEMAS.portfolioSummary,
        portfolioData,
        "portfolio-summary",
        true // Required
      );
      
      this.logger.info("Portfolio validation successful", {
        totalValue: validated.totalValue,
        balancesCount: validated.balances.length,
      });
      
      return validated;
    } catch (error) {
      this.logger.error("Critical portfolio validation failed", error);
      throw error;
    }
  }

  // ============================================================================
  // Safe Validation with Fallbacks
  // ============================================================================

  safeValidateMarketData(marketData: unknown, fallback: any = null): any {
    this.logger.debug("Safe validation of market data");
    
    try {
      return safeValidateWithDefault(
        CRITICAL_DATA_SCHEMAS.marketData,
        marketData,
        fallback
      );
    } catch (error) {
      this.logger.warn("Market data validation failed, using fallback", error);
      return fallback;
    }
  }

  safeValidateRiskParameters(riskData: unknown, fallback: any = {
    maxPositionSize: 1000,
    stopLossPercentage: 5,
    takeProfitPercentage: 15,
    riskLevel: "medium" as const,
  }): any {
    this.logger.debug("Safe validation of risk parameters");
    
    try {
      return safeValidateWithDefault(
        CRITICAL_DATA_SCHEMAS.riskParameters,
        riskData,
        fallback
      );
    } catch (error) {
      this.logger.warn("Risk parameters validation failed, using fallback", error);
      return fallback;
    }
  }

  // ============================================================================
  // Batch Validation
  // ============================================================================

  async validateBatch<T>(
    items: unknown[],
    schema: z.ZodSchema<T>,
    options: {
      continueOnError?: boolean;
      maxParallel?: number;
    } = {}
  ): Promise<{
    successful: T[];
    failed: { index: number; error: string; data: unknown }[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      successRate: number;
    };
  }> {
    const { continueOnError = true, maxParallel = 10 } = options;
    const successful: T[] = [];
    const failed: { index: number; error: string; data: unknown }[] = [];
    
    this.logger.debug(`Starting batch validation of ${items.length} items`);
    
    // Process in chunks to control parallelism
    const chunks = this.chunkArray(items, maxParallel);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (item, chunkIndex) => {
        const globalIndex = chunks.indexOf(chunk) * maxParallel + chunkIndex;
        
        try {
          const result = schema.parse(item);
          successful.push(result);
          return { success: true, index: globalIndex };
        } catch (error) {
          const errorMessage = error instanceof z.ZodError 
            ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
            : error instanceof Error ? error.message : 'Unknown error';
          
          failed.push({
            index: globalIndex,
            error: errorMessage,
            data: item,
          });
          
          return { success: false, index: globalIndex };
        }
      });
      
      await Promise.all(promises);
      
      // Stop on first error if failFast is enabled
      if (!continueOnError && failed.length > 0) {
        this.logger.warn(`Batch validation stopped at first error (item ${failed[0].index})`);
        break;
      }
    }
    
    const summary = {
      total: items.length,
      successful: successful.length,
      failed: failed.length,
      successRate: (successful.length / items.length) * 100,
    };
    
    this.logger.info("Batch validation completed", summary);
    
    return { successful, failed, summary };
  }

  // ============================================================================
  // Service Management
  // ============================================================================

  getHealthMetrics() {
    return {
      validationHealth: ValidationHealthMonitor.getHealthMetrics(),
      cacheStats: {
        size: this.cache.size(),
        maxSize: this.config.maxCacheSize,
        hitRate: 0, // Would need to track hits/misses for this
      },
      config: this.config,
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.logger.info("Validation cache cleared");
  }

  resetMetrics(): void {
    ValidationHealthMonitor.resetMetrics();
    CriticalDataValidator.clearMetrics();
    this.logger.info("Validation metrics reset");
  }

  updateConfig(newConfig: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info("Validation configuration updated", newConfig);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getSchemaHash(schema: z.ZodSchema): string {
    // Simple hash based on schema structure
    return btoa(JSON.stringify(schema._def)).substring(0, 16);
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let validationServiceInstance: ComprehensiveValidationService | null = null;

export function getValidationService(config?: Partial<ValidationConfig>): ComprehensiveValidationService {
  if (!validationServiceInstance) {
    validationServiceInstance = new ComprehensiveValidationService(config);
  }
  return validationServiceInstance;
}

export function resetValidationService(): void {
  validationServiceInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function validateMexcResponse<T>(
  endpoint: string,
  response: unknown,
  schema: keyof typeof MEXC_API_SCHEMAS
): Promise<EnhancedValidationResult<T>> {
  const service = getValidationService();
  return service.validateMexcApiResponse<T>(endpoint, response, schema);
}

export function validateTradingOrder(orderData: unknown): TradingOrder {
  const service = getValidationService();
  return service.validateCriticalTradingOrder(orderData);
}

export function validateAccountBalance(balanceData: unknown): AccountBalance {
  const service = getValidationService();
  return service.validateCriticalAccountBalance(balanceData);
}

export function validatePortfolio(portfolioData: unknown): PortfolioSummary {
  const service = getValidationService();
  return service.validateCriticalPortfolio(portfolioData);
}

// ============================================================================
// Type Exports
// ============================================================================

export type { ValidationConfig, EnhancedValidationResult };
export { ValidationError, CriticalDataValidator, ValidationHealthMonitor };