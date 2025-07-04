/**
 * Batch Validation Module
 *
 * Handles data validation, deduplication, and integrity checks for batch operations.
 * Extracted from batch-database-service.ts for better modularity.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db, executeWithRetry, monitoredQuery } from "@/src/db";
import { snipeTargets } from "@/src/db/schema";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { SnipeTargetRow } from "@/src/types/database-types";

interface SnipeTargetCheck {
  userId: string;
  symbolName: string;
  vcoinId?: string;
}

interface ValidationResult<T> {
  valid: T[];
  invalid: T[];
  errors: Array<{ item: T; error: string }>;
}

export class BatchValidationModule {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[batch-validation-module]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[batch-validation-module]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[batch-validation-module]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[batch-validation-module]", message, context || ""),
  };

  /**
   * Batch check for snipe target duplicates
   */
  async batchCheckSnipeTargetDuplicates(
    targets: SnipeTargetCheck[]
  ): Promise<SnipeTargetCheck[]> {
    if (targets.length === 0) return [];

    const startTime = performance.now();

    try {
      const userIds = [...new Set(targets.map((t) => t.userId))];
      const symbols = [...new Set(targets.map((t) => t.symbolName))];

      // Single query to find existing targets
      const existingTargets = await monitoredQuery(
        "batch_check_snipe_target_duplicates",
        async () => {
          return await executeWithRetry(async () => {
            return await db
              .select({
                userId: snipeTargets.userId,
                symbolName: snipeTargets.symbolName,
              })
              .from(snipeTargets)
              .where(
                and(
                  inArray(snipeTargets.userId, userIds),
                  inArray(snipeTargets.symbolName, symbols),
                  eq(snipeTargets.status, "pending")
                )
              );
          });
        },
        {
          operationType: "select",
          tableName: "snipe_targets",
          query:
            "SELECT userId, symbolName FROM snipe_targets WHERE userId IN (...) AND symbolName IN (...) AND status = pending",
          parameters: [...userIds, ...symbols],
        }
      );

      // Create lookup set for O(1) duplicate checking
      const existingCombinations = new Set(
        existingTargets.map(
          (target: SnipeTargetRow) => `${target.userId}:${target.symbolName}`
        )
      );

      // Filter out duplicates
      const nonDuplicates = targets.filter((target) => {
        const combination = `${target.userId}:${target.symbolName}`;
        return !existingCombinations.has(combination);
      });

      const checkTime = performance.now() - startTime;
      this.logger.debug("Duplicate checking completed", {
        totalTargets: targets.length,
        existingTargets: existingTargets.length,
        nonDuplicates: nonDuplicates.length,
        duplicatesFiltered: targets.length - nonDuplicates.length,
        checkTimeMs: Math.round(checkTime),
      });

      return nonDuplicates;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Duplicate checking failed", {
        targetCount: targets.length,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Validate a batch of records against a schema or validation function
   */
  async validateBatch<T>(
    items: T[],
    validator: (item: T) => Promise<boolean> | boolean,
    options: {
      stopOnFirstError?: boolean;
      maxConcurrent?: number;
    } = {}
  ): Promise<ValidationResult<T>> {
    if (items.length === 0) {
      return { valid: [], invalid: [], errors: [] };
    }

    const { stopOnFirstError = false, maxConcurrent = 10 } = options;
    const startTime = performance.now();

    this.logger.info("Starting batch validation", {
      itemCount: items.length,
      stopOnFirstError,
      maxConcurrent,
    });

    const result: ValidationResult<T> = {
      valid: [],
      invalid: [],
      errors: [],
    };

    try {
      // Process items in chunks to control concurrency
      const chunks = this.chunkArray(items, maxConcurrent);

      for (const chunk of chunks) {
        const validationPromises = chunk.map(async (item) => {
          try {
            const isValid = await validator(item);
            return { item, isValid, error: null };
          } catch (error) {
            const safeError = toSafeError(error);
            return { item, isValid: false, error: safeError.message };
          }
        });

        const chunkResults = await Promise.all(validationPromises);

        for (const { item, isValid, error } of chunkResults) {
          if (isValid) {
            result.valid.push(item);
          } else {
            result.invalid.push(item);
            if (error) {
              result.errors.push({ item, error });
            }

            if (stopOnFirstError) {
              this.logger.warn("Validation stopped on first error", {
                processedCount: result.valid.length + result.invalid.length,
                totalCount: items.length,
                error,
              });
              return result;
            }
          }
        }
      }

      const validationTime = performance.now() - startTime;
      this.logger.info("Batch validation completed", {
        totalItems: items.length,
        validItems: result.valid.length,
        invalidItems: result.invalid.length,
        errors: result.errors.length,
        validationTimeMs: Math.round(validationTime),
      });

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Batch validation failed", {
        itemCount: items.length,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Check for duplicate records based on specific fields
   */
  async checkDuplicatesInBatch<T>(
    items: T[],
    keyExtractor: (item: T) => string,
    options: {
      allowDuplicates?: boolean;
      reportDuplicates?: boolean;
    } = {}
  ): Promise<{
    unique: T[];
    duplicates: T[];
    duplicateGroups: Record<string, T[]>;
  }> {
    const { allowDuplicates = false, reportDuplicates = true } = options;
    const startTime = performance.now();

    this.logger.info("Checking for duplicates in batch", {
      itemCount: items.length,
      allowDuplicates,
      reportDuplicates,
    });

    const seen = new Map<string, T>();
    const duplicates: T[] = [];
    const duplicateGroups: Record<string, T[]> = {};

    for (const item of items) {
      const key = keyExtractor(item);

      if (seen.has(key)) {
        duplicates.push(item);

        if (reportDuplicates) {
          if (!duplicateGroups[key]) {
            duplicateGroups[key] = [seen.get(key)!];
          }
          duplicateGroups[key].push(item);
        }
      } else {
        seen.set(key, item);
      }
    }

    const unique = Array.from(seen.values());
    const checkTime = performance.now() - startTime;

    this.logger.debug("Duplicate check completed", {
      totalItems: items.length,
      uniqueItems: unique.length,
      duplicateItems: duplicates.length,
      duplicateGroups: Object.keys(duplicateGroups).length,
      checkTimeMs: Math.round(checkTime),
    });

    if (duplicates.length > 0 && reportDuplicates) {
      this.logger.warn("Duplicates found in batch", {
        duplicateCount: duplicates.length,
        duplicateKeys: Object.keys(duplicateGroups),
      });
    }

    return {
      unique: allowDuplicates ? items : unique,
      duplicates,
      duplicateGroups,
    };
  }

  /**
   * Validate data types and required fields
   */
  validateDataTypes<T extends Record<string, any>>(
    items: T[],
    schema: Record<
      string,
      {
        type: string;
        required?: boolean;
        min?: number;
        max?: number;
        pattern?: RegExp;
      }
    >
  ): ValidationResult<T> {
    const result: ValidationResult<T> = {
      valid: [],
      invalid: [],
      errors: [],
    };

    for (const item of items) {
      const errors: string[] = [];

      for (const [field, rules] of Object.entries(schema)) {
        const value = item[field];

        // Check required fields
        if (rules.required && (value === undefined || value === null)) {
          errors.push(`Required field '${field}' is missing`);
          continue;
        }

        // Skip validation if field is not required and missing
        if (!rules.required && (value === undefined || value === null)) {
          continue;
        }

        // Type validation
        if (rules.type === "string" && typeof value !== "string") {
          errors.push(`Field '${field}' must be a string`);
        } else if (rules.type === "number" && typeof value !== "number") {
          errors.push(`Field '${field}' must be a number`);
        } else if (rules.type === "boolean" && typeof value !== "boolean") {
          errors.push(`Field '${field}' must be a boolean`);
        } else if (rules.type === "date" && !(value instanceof Date)) {
          errors.push(`Field '${field}' must be a Date`);
        }

        // Range validation for numbers
        if (rules.type === "number" && typeof value === "number") {
          if (rules.min !== undefined && value < rules.min) {
            errors.push(`Field '${field}' must be >= ${rules.min}`);
          }
          if (rules.max !== undefined && value > rules.max) {
            errors.push(`Field '${field}' must be <= ${rules.max}`);
          }
        }

        // Pattern validation for strings
        if (
          rules.type === "string" &&
          typeof value === "string" &&
          rules.pattern
        ) {
          if (!rules.pattern.test(value)) {
            errors.push(`Field '${field}' does not match required pattern`);
          }
        }
      }

      if (errors.length === 0) {
        result.valid.push(item);
      } else {
        result.invalid.push(item);
        result.errors.push({ item, error: errors.join("; ") });
      }
    }

    return result;
  }

  /**
   * Sanitize data by removing invalid characters and normalizing values
   */
  sanitizeBatch<T extends Record<string, any>>(
    items: T[],
    sanitizers: Record<string, (value: any) => any>
  ): T[] {
    const startTime = performance.now();

    this.logger.info("Sanitizing batch data", {
      itemCount: items.length,
      sanitizers: Object.keys(sanitizers),
    });

    const sanitized = items.map((item) => {
      const cleanItem = { ...item };

      for (const [field, sanitizer] of Object.entries(sanitizers)) {
        if (cleanItem[field] !== undefined && cleanItem[field] !== null) {
          try {
            cleanItem[field] = sanitizer(cleanItem[field]);
          } catch (error) {
            this.logger.warn("Sanitization failed for field", {
              field,
              originalValue: cleanItem[field],
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      }

      return cleanItem;
    });

    const sanitizeTime = performance.now() - startTime;
    this.logger.debug("Batch sanitization completed", {
      itemCount: items.length,
      sanitizeTimeMs: Math.round(sanitizeTime),
    });

    return sanitized;
  }

  // Helper methods
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
