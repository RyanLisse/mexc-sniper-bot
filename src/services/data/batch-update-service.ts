/**
 * Batch Update Service
 *
 * Provides efficient batch update operations for database entities.
 * Extracted from batch-database-service.ts for better modularity.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, executeWithRetry } from "@/src/db";
import { patternEmbeddings, snipeTargets } from "@/src/db/schema";
import { toSafeError } from "@/src/lib/error-type-utils";

// ============================================================================
// Types and Schemas
// ============================================================================

const BatchUpdateOptionsSchema = z.object({
  chunkSize: z.number().min(1).max(500).default(100),
  validateData: z.boolean().default(true),
  allowPartialUpdates: z.boolean().default(true),
});

type BatchUpdateOptions = z.infer<typeof BatchUpdateOptionsSchema>;

interface SnipeTargetUpdate {
  id: string;
  targetPrice?: number;
  confidence?: number;
  isActive?: boolean;
  updatedAt?: Date;
}

interface PatternEmbeddingUpdate {
  patternId: string;
  confidence?: number;
  embedding?: string;
  patternData?: string;
  updatedAt?: Date;
}

export class BatchUpdateService {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[batch-update-service]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[batch-update-service]", message, context || ""),
    error: (message: string, context?: unknown) =>
      console.error("[batch-update-service]", message, context || ""),
    debug: (message: string, context?: unknown) =>
      console.debug("[batch-update-service]", message, context || ""),
  };

  /**
   * Batch update snipe targets
   */
  async batchUpdateSnipeTargets(
    updates: SnipeTargetUpdate[],
    options: Partial<BatchUpdateOptions> = {}
  ): Promise<{
    success: boolean;
    updated: number;
    errors: string[];
    notFound: string[];
  }> {
    const opts = BatchUpdateOptionsSchema.parse(options);
    const errors: string[] = [];
    const notFound: string[] = [];
    let totalUpdated = 0;

    try {
      // Validate data if requested
      if (opts.validateData) {
        const validationResult = this.validateSnipeTargetUpdates(updates);
        if (!validationResult.isValid) {
          return {
            success: false,
            updated: 0,
            errors: validationResult.errors,
            notFound: [],
          };
        }
      }

      // Check which targets exist
      const targetIds = updates.map(u => u.id);
      const existingTargets = await db
        .select({ id: snipeTargets.id })
        .from(snipeTargets)
        .where(inArray(snipeTargets.id, targetIds));

      const existingIds = new Set(existingTargets.map(t => t.id));
      const validUpdates = updates.filter(u => existingIds.has(u.id));
      
      // Track not found targets
      updates.forEach(u => {
        if (!existingIds.has(u.id)) {
          notFound.push(u.id);
        }
      });

      if (notFound.length > 0) {
        this.logger.warn(`${notFound.length} targets not found for update`, { notFound });
      }

      // Process valid updates in chunks
      const chunks = this.chunkArray(validUpdates, opts.chunkSize);
      this.logger.info(`Processing ${validUpdates.length} target updates in ${chunks.length} chunks`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        this.logger.debug(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} items)`);

        try {
          const result = await this.updateSnipeTargetChunk(chunk);
          totalUpdated += result.updated;
          
          if (result.errors.length > 0) {
            errors.push(...result.errors);
          }
        } catch (error) {
          const safeError = toSafeError(error);
          const errorMsg = `Chunk ${i + 1} failed: ${safeError.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg, { chunkIndex: i, chunkSize: chunk.length });
        }
      }

      const success = errors.length === 0;
      this.logger.info("Batch update snipe targets completed", {
        success,
        totalUpdated,
        notFoundCount: notFound.length,
        errorCount: errors.length,
      });

      return {
        success,
        updated: totalUpdated,
        errors,
        notFound,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Batch update snipe targets failed", { error: safeError.message });
      
      return {
        success: false,
        updated: totalUpdated,
        errors: [safeError.message],
        notFound,
      };
    }
  }

  /**
   * Batch update pattern embeddings
   */
  async batchUpdatePatternEmbeddings(
    updates: PatternEmbeddingUpdate[],
    options: Partial<BatchUpdateOptions> = {}
  ): Promise<{
    success: boolean;
    updated: number;
    errors: string[];
    notFound: string[];
  }> {
    const opts = BatchUpdateOptionsSchema.parse(options);
    const errors: string[] = [];
    const notFound: string[] = [];
    let totalUpdated = 0;

    try {
      // Validate data if requested
      if (opts.validateData) {
        const validationResult = this.validatePatternEmbeddingUpdates(updates);
        if (!validationResult.isValid) {
          return {
            success: false,
            updated: 0,
            errors: validationResult.errors,
            notFound: [],
          };
        }
      }

      // Check which patterns exist
      const patternIds = updates.map(u => u.patternId);
      const existingPatterns = await db
        .select({ patternId: patternEmbeddings.patternId })
        .from(patternEmbeddings)
        .where(inArray(patternEmbeddings.patternId, patternIds));

      const existingIds = new Set(existingPatterns.map(p => p.patternId));
      const validUpdates = updates.filter(u => existingIds.has(u.patternId));
      
      // Track not found patterns
      updates.forEach(u => {
        if (!existingIds.has(u.patternId)) {
          notFound.push(u.patternId);
        }
      });

      if (notFound.length > 0) {
        this.logger.warn(`${notFound.length} patterns not found for update`, { notFound });
      }

      // Process valid updates in chunks
      const chunks = this.chunkArray(validUpdates, opts.chunkSize);
      this.logger.info(`Processing ${validUpdates.length} pattern updates in ${chunks.length} chunks`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        this.logger.debug(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} items)`);

        try {
          const result = await this.updatePatternEmbeddingChunk(chunk);
          totalUpdated += result.updated;
          
          if (result.errors.length > 0) {
            errors.push(...result.errors);
          }
        } catch (error) {
          const safeError = toSafeError(error);
          const errorMsg = `Chunk ${i + 1} failed: ${safeError.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg, { chunkIndex: i, chunkSize: chunk.length });
        }
      }

      const success = errors.length === 0;
      this.logger.info("Batch update pattern embeddings completed", {
        success,
        totalUpdated,
        notFoundCount: notFound.length,
        errorCount: errors.length,
      });

      return {
        success,
        updated: totalUpdated,
        errors,
        notFound,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Batch update pattern embeddings failed", { error: safeError.message });
      
      return {
        success: false,
        updated: totalUpdated,
        errors: [safeError.message],
        notFound,
      };
    }
  }

  /**
   * Batch activate/deactivate snipe targets
   */
  async batchToggleSnipeTargets(
    targetIds: string[],
    isActive: boolean,
    options: Partial<BatchUpdateOptions> = {}
  ): Promise<{
    success: boolean;
    updated: number;
    errors: string[];
  }> {
    const opts = BatchUpdateOptionsSchema.parse(options);
    const errors: string[] = [];
    let totalUpdated = 0;

    try {
      const chunks = this.chunkArray(targetIds, opts.chunkSize);
      this.logger.info(`Toggling ${targetIds.length} targets to ${isActive ? 'active' : 'inactive'} in ${chunks.length} chunks`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        this.logger.debug(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} items)`);

        try {
          const result = await executeWithRetry(
            () => db
              .update(snipeTargets)
              .set({ 
                isActive, 
                updatedAt: new Date() 
              })
              .where(inArray(snipeTargets.id, chunk)),
            3,
            1000
          );

          const updated = result.changes || 0;
          totalUpdated += updated;
          
          this.logger.debug(`Chunk ${i + 1} updated ${updated} targets`);
        } catch (error) {
          const safeError = toSafeError(error);
          const errorMsg = `Chunk ${i + 1} failed: ${safeError.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg, { chunkIndex: i, chunkSize: chunk.length });
        }
      }

      const success = errors.length === 0;
      this.logger.info("Batch toggle snipe targets completed", {
        success,
        totalUpdated,
        isActive,
        errorCount: errors.length,
      });

      return {
        success,
        updated: totalUpdated,
        errors,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Batch toggle snipe targets failed", { error: safeError.message });
      
      return {
        success: false,
        updated: totalUpdated,
        errors: [safeError.message],
      };
    }
  }

  /**
   * Update a chunk of snipe targets
   */
  private async updateSnipeTargetChunk(
    chunk: SnipeTargetUpdate[]
  ): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    for (const update of chunk) {
      try {
        // Build update object dynamically
        const updateData: any = {
          updatedAt: update.updatedAt || new Date(),
        };

        if (update.targetPrice !== undefined) {
          updateData.targetPrice = update.targetPrice;
        }
        if (update.confidence !== undefined) {
          updateData.confidence = update.confidence;
        }
        if (update.isActive !== undefined) {
          updateData.isActive = update.isActive;
        }

        const result = await executeWithRetry(
          () => db
            .update(snipeTargets)
            .set(updateData)
            .where(eq(snipeTargets.id, update.id)),
          3,
          1000
        );

        if (result.changes && result.changes > 0) {
          updated++;
        }
      } catch (error) {
        const safeError = toSafeError(error);
        errors.push(`Failed to update target ${update.id}: ${safeError.message}`);
      }
    }

    return { updated, errors };
  }

  /**
   * Update a chunk of pattern embeddings
   */
  private async updatePatternEmbeddingChunk(
    chunk: PatternEmbeddingUpdate[]
  ): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    for (const update of chunk) {
      try {
        // Build update object dynamically
        const updateData: any = {
          updatedAt: update.updatedAt || new Date(),
        };

        if (update.confidence !== undefined) {
          updateData.confidence = update.confidence;
        }
        if (update.embedding !== undefined) {
          updateData.embedding = update.embedding;
        }
        if (update.patternData !== undefined) {
          updateData.patternData = update.patternData;
        }

        const result = await executeWithRetry(
          () => db
            .update(patternEmbeddings)
            .set(updateData)
            .where(eq(patternEmbeddings.patternId, update.patternId)),
          3,
          1000
        );

        if (result.changes && result.changes > 0) {
          updated++;
        }
      } catch (error) {
        const safeError = toSafeError(error);
        errors.push(`Failed to update pattern ${update.patternId}: ${safeError.message}`);
      }
    }

    return { updated, errors };
  }

  /**
   * Validate snipe target updates
   */
  private validateSnipeTargetUpdates(updates: SnipeTargetUpdate[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      
      if (!update.id || typeof update.id !== "string") {
        errors.push(`Item ${i}: Invalid id`);
      }
      
      if (update.targetPrice !== undefined && (typeof update.targetPrice !== "number" || update.targetPrice <= 0)) {
        errors.push(`Item ${i}: Invalid targetPrice (must be positive number)`);
      }
      
      if (update.confidence !== undefined && (typeof update.confidence !== "number" || update.confidence < 0 || update.confidence > 100)) {
        errors.push(`Item ${i}: Invalid confidence (must be 0-100)`);
      }
      
      if (update.isActive !== undefined && typeof update.isActive !== "boolean") {
        errors.push(`Item ${i}: Invalid isActive (must be boolean)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate pattern embedding updates
   */
  private validatePatternEmbeddingUpdates(updates: PatternEmbeddingUpdate[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      
      if (!update.patternId || typeof update.patternId !== "string") {
        errors.push(`Item ${i}: Invalid patternId`);
      }
      
      if (update.confidence !== undefined && (typeof update.confidence !== "number" || update.confidence < 0 || update.confidence > 100)) {
        errors.push(`Item ${i}: Invalid confidence (must be 0-100)`);
      }
      
      if (update.embedding !== undefined && typeof update.embedding !== "string") {
        errors.push(`Item ${i}: Invalid embedding (must be string)`);
      }
      
      if (update.patternData !== undefined && typeof update.patternData !== "string") {
        errors.push(`Item ${i}: Invalid patternData (must be string)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Split array into chunks of specified size
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}