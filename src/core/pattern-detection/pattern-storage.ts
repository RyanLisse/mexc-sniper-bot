/**
 * Pattern Storage - Repository and Caching Module
 *
 * Extracted from the monolithic pattern-detection-engine.ts (1503 lines).
 * Handles pattern persistence, caching, and retrieval with repository pattern.
 *
 * Architecture:
 * - Repository pattern for data access
 * - Intelligent caching with TTL
 * - Performance monitoring
 * - Error resilience
 */

import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { patternEmbeddings } from "../../db/schemas/patterns";
import { toSafeError } from "../../lib/error-type-utils";
import type { CalendarEntry, SymbolEntry } from "../../services/mexc-unified-exports";
import type { IPatternStorage } from "./interfaces";

/**
 * Pattern Storage Implementation
 *
 * Implements repository pattern for pattern data with intelligent caching.
 * Focuses on performance and reliability.
 */
export class PatternStorage implements IPatternStorage {
  private static instance: PatternStorage;
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[pattern-storage]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[pattern-storage]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[pattern-storage]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[pattern-storage]", message, context || ""),
  };

  // In-memory cache for performance
  private cache = new Map<string, any>();
  private cacheHits = 0;
  private cacheAccesses = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;

  static getInstance(): PatternStorage {
    if (!PatternStorage.instance) {
      PatternStorage.instance = new PatternStorage();
    }
    return PatternStorage.instance;
  }

  /**
   * Store Successful Pattern
   *
   * Persists successful patterns for learning and historical analysis.
   */
  async storeSuccessfulPattern(
    data: SymbolEntry | CalendarEntry,
    type: string,
    confidence: number
  ): Promise<void> {
    try {
      // Validate inputs
      if (!data || !type || !this.validateConfidenceScore(confidence)) {
        console.warn("Invalid pattern storage parameters", {
          hasData: !!data,
          type,
          confidence,
        });
        return; // Graceful failure
      }

      // Determine if data is SymbolEntry or CalendarEntry
      const isSymbolEntry = "sts" in data && "st" in data && "tt" in data;
      const symbolName = "symbol" in data ? data.symbol : isSymbolEntry ? data.cd : "unknown";

      // Generate unique pattern ID
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const patternId = `embed-${timestamp}-${randomSuffix}`;

      // Create pattern data JSON
      const patternDataJson = JSON.stringify({
        sts: isSymbolEntry ? (data as SymbolEntry).sts : undefined,
        st: isSymbolEntry ? (data as SymbolEntry).st : undefined,
        tt: isSymbolEntry ? (data as SymbolEntry).tt : undefined,
        firstOpenTime: "firstOpenTime" in data ? data.firstOpenTime : undefined,
        projectName: "projectName" in data ? data.projectName : undefined,
        symbol: symbolName,
        type,
        confidence,
      });

      // Generate a simple mock embedding (in a real implementation, this would use OpenAI)
      const mockEmbedding = this.generateMockEmbedding(patternDataJson);

      const now = new Date();

      // Prepare pattern data for storage
      const patternData = {
        patternId,
        symbolName,
        vcoinId: "vcoinId" in data ? data.vcoinId : undefined,
        patternType: type,
        patternData: patternDataJson,
        embedding: JSON.stringify(mockEmbedding),
        embeddingDimension: 1536,
        embeddingModel: "text-embedding-ada-002",
        confidence: Math.round(confidence * 100) / 100, // Round to 2 decimal places
        occurrences: 1,
        discoveredAt: now,
        lastSeenAt: now,
        similarityThreshold: 0.85,
        truePositives: 1,
        falsePositives: 0,
        isActive: true,
        createdAt: now,
      };

      // Store in database
      await db.insert(patternEmbeddings).values(patternData);

      // Invalidate relevant cache entries
      this.invalidateCacheByPattern(type);

      console.info("Pattern stored successfully", {
        symbolName,
        patternType: type,
        confidence,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      console.error(
        "Failed to store pattern",
        {
          type,
          confidence,
          error: safeError.message,
        },
        safeError
      );

      // Don't throw - graceful failure for storage operations
    }
  }

  /**
   * Get Historical Success Rate
   *
   * Retrieves success rate for a specific pattern type.
   */
  async getHistoricalSuccessRate(patternType: string): Promise<number> {
    if (!patternType) {
      return 75; // Default fallback
    }

    const cacheKey = `success_rate_${patternType}`;

    // Check cache first
    const cached = this.getCachedValue(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const patterns = await db
        .select()
        .from(patternEmbeddings)
        .where(
          and(eq(patternEmbeddings.patternType, patternType), eq(patternEmbeddings.isActive, true))
        )
        .limit(50);

      if (patterns.length === 0) {
        const defaultRate = 75;
        this.setCachedValue(cacheKey, defaultRate);
        return defaultRate;
      }

      const totalSuccesses = patterns.reduce((sum, p) => sum + (p.truePositives || 0), 0);
      const totalAttempts = patterns.reduce(
        (sum, p) => sum + (p.truePositives || 0) + (p.falsePositives || 0),
        0
      );

      const successRate = totalAttempts > 0 ? (totalSuccesses / totalAttempts) * 100 : 75;

      // Cache the result
      this.setCachedValue(cacheKey, successRate);

      return successRate;
    } catch (error) {
      const safeError = toSafeError(error);
      console.warn(
        "Failed to get historical success rate",
        {
          patternType,
          error: safeError.message,
        },
        safeError
      );

      return 75; // Default fallback
    }
  }

  /**
   * Find Similar Patterns
   *
   * Finds patterns similar to the provided pattern with optional filtering.
   */
  async findSimilarPatterns(
    pattern: any,
    options?: {
      threshold?: number;
      limit?: number;
      sameTypeOnly?: boolean;
    }
  ): Promise<any[]> {
    if (!pattern) {
      return [];
    }

    const { threshold = 0.7, limit = 20, sameTypeOnly = false } = options || {};

    const cacheKey = `similar_${JSON.stringify({
      pattern: pattern.symbolName,
      type: pattern.type,
      threshold,
      limit,
      sameTypeOnly,
    })}`;

    // Check cache first
    const cached = this.getCachedValue(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      let query = db.select().from(patternEmbeddings).where(eq(patternEmbeddings.isActive, true));

      // Apply type filter if requested
      if (sameTypeOnly && pattern.type) {
        query = query.where(eq(patternEmbeddings.patternType, pattern.type));
      }

      const allPatterns = await query.limit(Math.min(limit * 5, 500)); // Get more to filter from

      // Simple similarity calculation based on pattern data
      const similarPatterns = allPatterns
        .map((p) => ({
          ...p,
          similarity: this.calculatePatternSimilarity(pattern, p),
        }))
        .filter((p) => p.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      // Cache the result
      this.setCachedValue(cacheKey, similarPatterns);

      return similarPatterns;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error(
        "Failed to find similar patterns",
        {
          patternType: pattern.type,
          error: safeError.message,
        },
        safeError
      );

      return [];
    }
  }

  /**
   * Clear Cache
   *
   * Clears all cached data.
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheAccesses = 0;

    console.info("Pattern storage cache cleared");
  }

  /**
   * Get Cache Statistics
   *
   * Returns cache performance metrics.
   */
  getCacheStats(): {
    hitRatio: number;
    size: number;
    memoryUsage: number;
  } {
    const hitRatio = this.cacheAccesses > 0 ? this.cacheHits / this.cacheAccesses : 0;
    const size = this.cache.size;

    // Estimate memory usage (rough calculation)
    let memoryUsage = 0;
    for (const [key, value] of this.cache.entries()) {
      memoryUsage += key.length * 2; // UTF-16 characters
      memoryUsage += JSON.stringify(value.data).length * 2;
      memoryUsage += 64; // Overhead per entry
    }

    return {
      hitRatio: Math.round(hitRatio * 1000) / 1000, // 3 decimal places
      size,
      memoryUsage,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateConfidenceScore(score: number): boolean {
    return (
      typeof score === "number" && !isNaN(score) && isFinite(score) && score >= 0 && score <= 100
    );
  }

  private generateMockEmbedding(data: string): number[] {
    // Generate a mock embedding vector of 1536 dimensions (matching OpenAI's ada-002)
    // In a real implementation, this would use OpenAI's API
    const dimension = 1536;
    const embedding: number[] = [];
    
    // Create a deterministic but varied embedding based on the data
    let seed = 0;
    for (let i = 0; i < data.length; i++) {
      seed += data.charCodeAt(i);
    }
    
    // Simple pseudo-random number generator for consistent mock embeddings
    const random = (index: number) => {
      const x = Math.sin(seed + index) * 10000;
      return x - Math.floor(x);
    };
    
    for (let i = 0; i < dimension; i++) {
      // Generate values between -1 and 1 (typical for embeddings)
      embedding.push((random(i) - 0.5) * 2);
    }
    
    // Normalize the vector (optional, but often done for embeddings)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return embedding;
  }

  private getCachedValue(key: string): any {
    this.cacheAccesses++;

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.cacheHits++;
      return cached.data;
    }

    // Remove expired entry
    if (cached) {
      this.cache.delete(key);
    }

    return null;
  }

  private setCachedValue(key: string, data: any): void {
    // Implement cache size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries (simple FIFO)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private invalidateCacheByPattern(patternType: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.includes(patternType) || key.includes("success_rate")) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  private calculatePatternSimilarity(pattern1: any, pattern2: any): number {
    try {
      // Parse stored data
      const data1 = pattern1.data || {};
      const data2 = JSON.parse(pattern2.data || "{}");

      let similarity = 0;
      let comparisons = 0;

      // Compare sts, st, tt values
      if (data1.sts !== undefined && data2.sts !== undefined) {
        similarity += data1.sts === data2.sts ? 1 : 0;
        comparisons++;
      }

      if (data1.st !== undefined && data2.st !== undefined) {
        similarity += data1.st === data2.st ? 1 : 0;
        comparisons++;
      }

      if (data1.tt !== undefined && data2.tt !== undefined) {
        similarity += data1.tt === data2.tt ? 1 : 0;
        comparisons++;
      }

      // Compare pattern types
      if (pattern1.type && pattern2.patternType) {
        similarity += pattern1.type === pattern2.patternType ? 1 : 0;
        comparisons++;
      }

      // Compare confidence (within range)
      if (pattern1.confidence !== undefined && pattern2.confidence !== undefined) {
        const confidenceDiff = Math.abs(pattern1.confidence - pattern2.confidence);
        similarity += confidenceDiff <= 10 ? 1 : 0; // Within 10 points
        comparisons++;
      }

      return comparisons > 0 ? similarity / comparisons : 0;
    } catch (error) {
      console.warn("Pattern similarity calculation failed", {
        pattern1Type: pattern1.type,
        pattern2Type: pattern2.patternType,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return 0;
    }
  }
}
