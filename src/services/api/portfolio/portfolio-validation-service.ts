/**
 * Portfolio Validation Service
 *
 * Handles validation and testing functionality for portfolio operations.
 * Extracted from unified-mexc-portfolio.ts for modularity.
 *
 * Features:
 * - Balance retrieval testing
 * - Price fetching validation
 * - Service connectivity testing
 * - Portfolio data validation
 */

import type {
  BalanceEntry,
  MexcServiceResponse,
} from "../../data/modules/mexc-api-types";
import type { MexcCacheLayer } from "../../data/modules/mexc-cache-layer";
import type { MexcCoreClient } from "../../data/modules/mexc-core-client";
import type { PortfolioPriceCalculationService } from "./price-calculation-service";

export interface ValidationResult {
  success: boolean;
  message: string;
  details?: unknown;
  timing?: number;
}

export interface BalanceRetrievalTest {
  success: boolean;
  balanceCount: number;
  significantBalances: number;
  totalValue: number;
  executionTime: number;
  errors?: string[];
}

export class PortfolioValidationService {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[portfolio-validation]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[portfolio-validation]", message, context || ""),
    error: (message: string, context?: unknown) =>
      console.error("[portfolio-validation]", message, context || ""),
    debug: (message: string, context?: unknown) =>
      console.debug("[portfolio-validation]", message, context || ""),
  };

  constructor(
    private coreClient: MexcCoreClient,
    private cacheLayer: MexcCacheLayer,
    private priceCalculationService: PortfolioPriceCalculationService
  ) {}

  /**
   * Test balance retrieval functionality
   */
  async testBalanceRetrieval(): Promise<BalanceRetrievalTest> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      this.logger.info("Starting balance retrieval test");

      // Test account balance endpoint
      const balanceResponse = await this.coreClient.makeRequest(
        "GET",
        "/api/v3/account",
        {},
        true // requires authentication
      );

      if (!balanceResponse.success) {
        errors.push(`Balance API call failed: ${balanceResponse.error}`);
        return {
          success: false,
          balanceCount: 0,
          significantBalances: 0,
          totalValue: 0,
          executionTime: Date.now() - startTime,
          errors,
        };
      }

      const accountData = balanceResponse.data;
      if (!accountData || !Array.isArray(accountData.balances)) {
        errors.push("Invalid account data structure");
        return {
          success: false,
          balanceCount: 0,
          significantBalances: 0,
          totalValue: 0,
          executionTime: Date.now() - startTime,
          errors,
        };
      }

      const balances = accountData.balances as BalanceEntry[];
      const significantBalances = balances.filter(
        (balance) =>
          parseFloat(balance.free) + parseFloat(balance.locked) > 0.001
      );

      // Test total value calculation
      let totalValue = 0;
      try {
        totalValue =
          await this.priceCalculationService.calculateTotalValue(balances);
      } catch (error) {
        errors.push(
          `Total value calculation failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }

      const executionTime = Date.now() - startTime;

      this.logger.info("Balance retrieval test completed", {
        balanceCount: balances.length,
        significantBalances: significantBalances.length,
        totalValue,
        executionTime,
        errorsCount: errors.length,
      });

      return {
        success: errors.length === 0,
        balanceCount: balances.length,
        significantBalances: significantBalances.length,
        totalValue,
        executionTime,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(`Test execution failed: ${errorMessage}`);

      this.logger.error("Balance retrieval test failed", { error });

      return {
        success: false,
        balanceCount: 0,
        significantBalances: 0,
        totalValue: 0,
        executionTime: Date.now() - startTime,
        errors,
      };
    }
  }

  /**
   * Validate price fetching functionality
   */
  async validatePriceFetching(): Promise<{
    success: boolean;
    results: Array<{
      asset: string;
      success: boolean;
      price?: number;
      error?: string;
    }>;
    overallTiming: number;
  }> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting price fetching validation");

      const validationResult =
        await this.priceCalculationService.validatePriceFetching();

      const overallTiming = Date.now() - startTime;

      this.logger.info("Price fetching validation completed", {
        success: validationResult.success,
        overallTiming,
        resultsCount: validationResult.results.length,
      });

      return {
        ...validationResult,
        overallTiming,
      };
    } catch (error) {
      this.logger.error("Price fetching validation failed", { error });

      return {
        success: false,
        results: [],
        overallTiming: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate cache functionality
   */
  async validateCache(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      this.logger.debug("Testing cache functionality");

      const testKey = "portfolio-validation-test";
      const testValue = { test: true, timestamp: Date.now() };

      // Test cache write
      await this.cacheLayer.set(testKey, testValue, 10);

      // Test cache read
      const cachedValue = await this.cacheLayer.get(testKey);

      if (!cachedValue || typeof cachedValue !== "object") {
        return {
          success: false,
          message: "Cache read/write validation failed",
          timing: Date.now() - startTime,
        };
      }

      // Test cache delete
      await this.cacheLayer.delete(testKey);

      const deletedValue = await this.cacheLayer.get(testKey);
      if (deletedValue !== null) {
        return {
          success: false,
          message: "Cache delete validation failed",
          timing: Date.now() - startTime,
        };
      }

      const timing = Date.now() - startTime;

      this.logger.info("Cache validation successful", { timing });

      return {
        success: true,
        message: "Cache functionality validated successfully",
        timing,
      };
    } catch (error) {
      this.logger.error("Cache validation failed", { error });

      return {
        success: false,
        message: `Cache validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timing: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate API connectivity
   */
  async validateApiConnectivity(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      this.logger.debug("Testing API connectivity");

      // Test public endpoint (no auth required)
      const publicResponse = await this.coreClient.makeRequest(
        "GET",
        "/api/v3/ping",
        {}
      );

      if (!publicResponse.success) {
        return {
          success: false,
          message: `Public API connectivity failed: ${publicResponse.error}`,
          timing: Date.now() - startTime,
        };
      }

      // Test authenticated endpoint
      const authResponse = await this.coreClient.makeRequest(
        "GET",
        "/api/v3/account",
        {},
        true
      );

      if (!authResponse.success) {
        return {
          success: false,
          message: `Authenticated API connectivity failed: ${authResponse.error}`,
          timing: Date.now() - startTime,
        };
      }

      const timing = Date.now() - startTime;

      this.logger.info("API connectivity validation successful", { timing });

      return {
        success: true,
        message: "API connectivity validated successfully",
        timing,
        details: {
          publicEndpoint: "OK",
          authenticatedEndpoint: "OK",
        },
      };
    } catch (error) {
      this.logger.error("API connectivity validation failed", { error });

      return {
        success: false,
        message: `API connectivity error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timing: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate balance data structure
   */
  validateBalanceData(data: unknown): {
    valid: boolean;
    errors: string[];
    balanceCount?: number;
  } {
    const errors: string[] = [];

    if (!data || typeof data !== "object") {
      errors.push("Data is not an object");
      return { valid: false, errors };
    }

    const accountData = data as Record<string, unknown>;

    if (!accountData.balances || !Array.isArray(accountData.balances)) {
      errors.push("Balances field is missing or not an array");
      return { valid: false, errors };
    }

    const balances = accountData.balances;

    // Validate each balance entry
    for (let i = 0; i < balances.length; i++) {
      const balance = balances[i];

      if (!balance || typeof balance !== "object") {
        errors.push(`Balance entry ${i} is not an object`);
        continue;
      }

      const balanceEntry = balance as Record<string, unknown>;

      if (typeof balanceEntry.asset !== "string") {
        errors.push(`Balance entry ${i} missing or invalid asset field`);
      }

      if (typeof balanceEntry.free !== "string") {
        errors.push(`Balance entry ${i} missing or invalid free field`);
      }

      if (typeof balanceEntry.locked !== "string") {
        errors.push(`Balance entry ${i} missing or invalid locked field`);
      }

      // Validate numeric string values
      if (balanceEntry.free && isNaN(parseFloat(balanceEntry.free as string))) {
        errors.push(`Balance entry ${i} free field is not a valid number`);
      }

      if (
        balanceEntry.locked &&
        isNaN(parseFloat(balanceEntry.locked as string))
      ) {
        errors.push(`Balance entry ${i} locked field is not a valid number`);
      }
    }

    this.logger.debug("Balance data validation completed", {
      valid: errors.length === 0,
      balanceCount: balances.length,
      errorsCount: errors.length,
    });

    return {
      valid: errors.length === 0,
      errors,
      balanceCount: balances.length,
    };
  }

  /**
   * Run comprehensive portfolio validation
   */
  async runComprehensiveValidation(): Promise<{
    success: boolean;
    results: {
      apiConnectivity: ValidationResult;
      cacheValidation: ValidationResult;
      balanceRetrieval: BalanceRetrievalTest;
      priceFetching: Awaited<ReturnType<typeof this.validatePriceFetching>>;
    };
    overallTiming: number;
  }> {
    const startTime = Date.now();

    this.logger.info("Starting comprehensive portfolio validation");

    try {
      // Run all validations in parallel where possible
      const [
        apiConnectivity,
        cacheValidation,
        balanceRetrieval,
        priceFetching,
      ] = await Promise.all([
        this.validateApiConnectivity(),
        this.validateCache(),
        this.testBalanceRetrieval(),
        this.validatePriceFetching(),
      ]);

      const overallTiming = Date.now() - startTime;
      const success =
        apiConnectivity.success &&
        cacheValidation.success &&
        balanceRetrieval.success &&
        priceFetching.success;

      this.logger.info("Comprehensive validation completed", {
        success,
        overallTiming,
      });

      return {
        success,
        results: {
          apiConnectivity,
          cacheValidation,
          balanceRetrieval,
          priceFetching,
        },
        overallTiming,
      };
    } catch (error) {
      this.logger.error("Comprehensive validation failed", { error });

      return {
        success: false,
        results: {
          apiConnectivity: {
            success: false,
            message: "Validation failed to complete",
            timing: 0,
          },
          cacheValidation: {
            success: false,
            message: "Validation failed to complete",
            timing: 0,
          },
          balanceRetrieval: {
            success: false,
            balanceCount: 0,
            significantBalances: 0,
            totalValue: 0,
            executionTime: 0,
          },
          priceFetching: {
            success: false,
            results: [],
            overallTiming: 0,
          },
        },
        overallTiming: Date.now() - startTime,
      };
    }
  }
}
