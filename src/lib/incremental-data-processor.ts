/**
import { createLogger } from './structured-logger';
 * Incremental Data Processing Service for MEXC Sniper Bot
 *
 * Phase 2 Implementation: Incremental Data Processing & Delta Updates
 *
 * This service optimizes data processing by:
 * - Tracking data changes with timestamps and checksums
 * - Processing only delta updates instead of full datasets
 * - Intelligent batching for bulk operations
 * - Cache-aware query optimization
 * - Conflict resolution for concurrent updates
 */

import crypto from "node:crypto";
import { type EnhancedUnifiedCacheSystem, getEnhancedUnifiedCache } from "./enhanced-unified-cache";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface DataSnapshot<T = any> {
  id: string;
  data: T;
  checksum: string;
  timestamp: number;
  version: number;
  metadata?: {
    source?: string;
    type?: string;
    size?: number;
    dependencies?: string[];
  };
}

export interface DeltaUpdate<T = any> {
  id: string;
  previousChecksum: string;
  newChecksum: string;
  changes: Partial<T>;
  timestamp: number;
  operation: "create" | "update" | "delete";
  conflictResolution?: "merge" | "overwrite" | "skip";
}

export interface ProcessingBatch<T = any> {
  batchId: string;
  items: T[];
  batchSize: number;
  processingStartTime: number;
  estimatedCompletionTime?: number;
  priority: "critical" | "high" | "medium" | "low";
}

export interface IncrementalProcessorConfig {
  enableDeltaProcessing: boolean;
  enableBatchOptimization: boolean;
  enableConflictResolution: boolean;
  maxBatchSize: number;
  batchTimeout: number; // milliseconds
  checksumAlgorithm: "md5" | "sha256";
  enableMetrics: boolean;
  cacheIntegration: boolean;
}

export interface ProcessingMetrics {
  totalProcessed: number;
  deltaUpdates: number;
  fullUpdates: number;
  batchesProcessed: number;
  avgBatchSize: number;
  avgProcessingTime: number;
  conflictsResolved: number;
  cacheHits: number;
  cacheMisses: number;
  dataEfficiency: number; // Percentage of data that was incremental vs full
}

// ============================================================================
// Incremental Data Processor Implementation
// ============================================================================

export class IncrementalDataProcessor {
  private logger = createLogger("incremental-data-processor");

  private cache: EnhancedUnifiedCacheSystem;
  private config: IncrementalProcessorConfig;
  private metrics: ProcessingMetrics;
  private snapshots = new Map<string, DataSnapshot>();
  private pendingBatches = new Map<string, ProcessingBatch>();
  private batchTimeout?: NodeJS.Timeout;

  constructor(config: Partial<IncrementalProcessorConfig> = {}) {
    this.cache = getEnhancedUnifiedCache();

    this.config = {
      enableDeltaProcessing: true,
      enableBatchOptimization: true,
      enableConflictResolution: true,
      maxBatchSize: 50,
      batchTimeout: 5000, // 5 seconds
      checksumAlgorithm: "sha256",
      enableMetrics: true,
      cacheIntegration: true,
      ...config,
    };

    this.metrics = {
      totalProcessed: 0,
      deltaUpdates: 0,
      fullUpdates: 0,
      batchesProcessed: 0,
      avgBatchSize: 0,
      avgProcessingTime: 0,
      conflictsResolved: 0,
      cacheHits: 0,
      cacheMisses: 0,
      dataEfficiency: 0,
    };
  }

  // ============================================================================
  // Core Processing Methods
  // ============================================================================

  async processData<T>(
    id: string,
    newData: T,
    options: {
      type?: string;
      source?: string;
      priority?: "critical" | "high" | "medium" | "low";
      forceFullUpdate?: boolean;
    } = {}
  ): Promise<DeltaUpdate<T> | null> {
    const startTime = Date.now();

    try {
      // Get existing snapshot
      const existingSnapshot = await this.getSnapshot<T>(id);
      const newChecksum = this.calculateChecksum(newData);

      // Check if data has actually changed
      if (
        existingSnapshot &&
        existingSnapshot.checksum === newChecksum &&
        !options.forceFullUpdate
      ) {
        logger.info(`[IncrementalProcessor] No changes detected for ${id}`);
        return null;
      }

      // Create delta update
      const deltaUpdate: DeltaUpdate<T> = {
        id,
        previousChecksum: existingSnapshot?.checksum || "",
        newChecksum,
        changes:
          this.config.enableDeltaProcessing && existingSnapshot
            ? this.calculateDelta(existingSnapshot.data, newData)
            : newData,
        timestamp: Date.now(),
        operation: existingSnapshot ? "update" : "create",
      };

      // Create new snapshot
      const newSnapshot: DataSnapshot<T> = {
        id,
        data: newData,
        checksum: newChecksum,
        timestamp: Date.now(),
        version: (existingSnapshot?.version || 0) + 1,
        metadata: {
          source: options.source || "incremental-processor",
          type: options.type || "generic",
          size: this.estimateSize(newData),
        },
      };

      // Store snapshot
      await this.storeSnapshot(newSnapshot);

      // Update metrics
      this.updateProcessingMetrics(deltaUpdate, Date.now() - startTime);

      // Cache the processed data if cache integration is enabled
      if (this.config.cacheIntegration) {
        await this.cache.set(`snapshot:${id}`, newSnapshot, "generic", 300000); // 5 minute TTL
      }

      logger.info(
        `[IncrementalProcessor] Processed ${deltaUpdate.operation} for ${id} in ${Date.now() - startTime}ms`
      );
      return deltaUpdate;
    } catch (error) {
      logger.error(`[IncrementalProcessor] Processing failed for ${id}:`, error);
      throw error;
    }
  }

  async processBatch<T>(
    items: Array<{
      id: string;
      data: T;
      type?: string;
      source?: string;
    }>,
    options: {
      priority?: "critical" | "high" | "medium" | "low";
      maxConcurrency?: number;
    } = {}
  ): Promise<DeltaUpdate<T>[]> {
    if (!this.config.enableBatchOptimization || items.length === 0) {
      // Fallback to individual processing
      return Promise.all(
        items.map((item) =>
          this.processData(item.id, item.data, {
            type: item.type,
            source: item.source,
            priority: options.priority,
          })
        )
      ).then((results) => results.filter(Boolean) as DeltaUpdate<T>[]);
    }

    const startTime = Date.now();
    const batchId = this.generateBatchId();
    const priority = options.priority || "medium";
    const maxConcurrency = options.maxConcurrency || 5;

    logger.info(`[IncrementalProcessor] Processing batch ${batchId} with ${items.length} items`);

    try {
      // Create processing batch
      const batch: ProcessingBatch<(typeof items)[0]> = {
        batchId,
        items,
        batchSize: items.length,
        processingStartTime: startTime,
        priority,
      };

      this.pendingBatches.set(batchId, batch);

      // Process items in chunks to control concurrency
      const chunks = this.chunkArray(items, maxConcurrency);
      const results: DeltaUpdate<T>[] = [];

      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map((item) =>
            this.processData(item.id, item.data, {
              type: item.type,
              source: item.source,
              priority,
            })
          )
        );

        results.push(...(chunkResults.filter(Boolean) as DeltaUpdate<T>[]));
      }

      // Update batch metrics
      const processingTime = Date.now() - startTime;
      this.updateBatchMetrics(batch, processingTime);

      logger.info(`[IncrementalProcessor] Batch ${batchId} completed in ${processingTime}ms`);
      return results;
    } catch (error) {
      logger.error(`[IncrementalProcessor] Batch processing failed for ${batchId}:`, error);
      throw error;
    } finally {
      this.pendingBatches.delete(batchId);
    }
  }

  // ============================================================================
  // Delta Calculation and Conflict Resolution
  // ============================================================================

  private calculateDelta<T>(oldData: T, newData: T): Partial<T> {
    if (
      typeof oldData !== "object" ||
      typeof newData !== "object" ||
      oldData === null ||
      newData === null
    ) {
      return newData;
    }

    const delta: Partial<T> = {};
    const oldObj = oldData as Record<string, any>;
    const newObj = newData as Record<string, any>;

    // Find changed properties
    for (const key in newObj) {
      if (!(key in oldObj) || !this.deepEqual(oldObj[key], newObj[key])) {
        (delta as any)[key] = newObj[key];
      }
    }

    // Find deleted properties (set to undefined)
    for (const key in oldObj) {
      if (!(key in newObj)) {
        (delta as any)[key] = undefined;
      }
    }

    return delta;
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === "object") {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key) || !this.deepEqual(a[key], b[key])) {
          return false;
        }
      }

      return true;
    }

    return false;
  }

  async resolveConflict<T>(
    id: string,
    localUpdate: DeltaUpdate<T>,
    remoteUpdate: DeltaUpdate<T>
  ): Promise<DeltaUpdate<T>> {
    if (!this.config.enableConflictResolution) {
      // Default to local update
      return localUpdate;
    }

    logger.info(`[IncrementalProcessor] Resolving conflict for ${id}`);

    // Timestamp-based resolution (last write wins)
    if (remoteUpdate.timestamp > localUpdate.timestamp) {
      logger.info(`[IncrementalProcessor] Remote update is newer, using remote`);
      this.metrics.conflictsResolved++;
      return remoteUpdate;
    }

    // If timestamps are equal, try to merge changes
    if (remoteUpdate.timestamp === localUpdate.timestamp) {
      logger.info(`[IncrementalProcessor] Attempting to merge concurrent updates`);

      const mergedChanges = {
        ...localUpdate.changes,
        ...remoteUpdate.changes,
      };

      const mergedUpdate: DeltaUpdate<T> = {
        ...localUpdate,
        changes: mergedChanges,
        newChecksum: this.calculateChecksum(mergedChanges),
        conflictResolution: "merge",
      };

      this.metrics.conflictsResolved++;
      return mergedUpdate;
    }

    // Local update is newer
    logger.info(`[IncrementalProcessor] Local update is newer, keeping local`);
    return localUpdate;
  }

  // ============================================================================
  // Snapshot Management
  // ============================================================================

  private async getSnapshot<T>(id: string): Promise<DataSnapshot<T> | null> {
    try {
      // Try cache first if integration is enabled
      if (this.config.cacheIntegration) {
        const cached = await this.cache.get<DataSnapshot<T>>(`snapshot:${id}`, "generic");
        if (cached) {
          this.metrics.cacheHits++;
          return cached;
        }
        this.metrics.cacheMisses++;
      }

      // Check in-memory snapshots
      const snapshot = this.snapshots.get(id) as DataSnapshot<T> | undefined;
      return snapshot || null;
    } catch (error) {
      logger.error(`[IncrementalProcessor] Failed to get snapshot for ${id}:`, error);
      return null;
    }
  }

  private async storeSnapshot<T>(snapshot: DataSnapshot<T>): Promise<void> {
    try {
      // Store in memory
      this.snapshots.set(snapshot.id, snapshot);

      // Store in cache if integration is enabled
      if (this.config.cacheIntegration) {
        await this.cache.set(`snapshot:${snapshot.id}`, snapshot, "generic", 300000); // 5 minute TTL
      }
    } catch (error) {
      logger.error(`[IncrementalProcessor] Failed to store snapshot for ${snapshot.id}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private calculateChecksum(data: any): string {
    const serialized = JSON.stringify(data, Object.keys(data).sort());

    switch (this.config.checksumAlgorithm) {
      case "md5":
        return crypto.createHash("md5").update(serialized).digest("hex");
      case "sha256":
        return crypto.createHash("sha256").update(serialized).digest("hex");
      default:
        return crypto.createHash("sha256").update(serialized).digest("hex");
    }
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // ============================================================================
  // Metrics and Monitoring
  // ============================================================================

  private updateProcessingMetrics<T>(deltaUpdate: DeltaUpdate<T>, processingTime: number): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalProcessed++;

    if (deltaUpdate.operation === "create") {
      this.metrics.fullUpdates++;
    } else {
      this.metrics.deltaUpdates++;
    }

    // Update average processing time
    this.metrics.avgProcessingTime =
      (this.metrics.avgProcessingTime * (this.metrics.totalProcessed - 1) + processingTime) /
      this.metrics.totalProcessed;

    // Calculate data efficiency
    this.metrics.dataEfficiency = (this.metrics.deltaUpdates / this.metrics.totalProcessed) * 100;
  }

  private updateBatchMetrics<T>(batch: ProcessingBatch<T>, _processingTime: number): void {
    if (!this.config.enableMetrics) return;

    this.metrics.batchesProcessed++;

    // Update average batch size
    this.metrics.avgBatchSize =
      (this.metrics.avgBatchSize * (this.metrics.batchesProcessed - 1) + batch.batchSize) /
      this.metrics.batchesProcessed;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  getPendingBatches(): Map<string, ProcessingBatch> {
    return new Map(this.pendingBatches);
  }

  getSnapshotCount(): number {
    return this.snapshots.size;
  }

  async clearSnapshots(): Promise<void> {
    this.snapshots.clear();

    if (this.config.cacheIntegration) {
      // Clear snapshot-related cache entries
      // Note: UnifiedCacheSystem.clear() doesn't accept patterns, so we'll need to implement pattern-based clearing differently
      await this.cache.clear();
    }

    logger.info("[IncrementalProcessor] All snapshots cleared");
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = undefined;
    }

    this.snapshots.clear();
    this.pendingBatches.clear();

    logger.info("[IncrementalProcessor] Service destroyed");
  }
}

// ============================================================================
// Global Incremental Processor Instance
// ============================================================================

let globalIncrementalProcessorInstance: IncrementalDataProcessor | null = null;

export function getIncrementalDataProcessor(
  config?: Partial<IncrementalProcessorConfig>
): IncrementalDataProcessor {
  if (!globalIncrementalProcessorInstance || config) {
    globalIncrementalProcessorInstance = new IncrementalDataProcessor(config);
  }
  return globalIncrementalProcessorInstance;
}

export function resetIncrementalDataProcessor(): void {
  if (globalIncrementalProcessorInstance) {
    globalIncrementalProcessorInstance.destroy();
    globalIncrementalProcessorInstance = null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { IncrementalDataProcessor as default };
