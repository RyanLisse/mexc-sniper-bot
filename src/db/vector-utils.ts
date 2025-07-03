import { eq, sql } from "drizzle-orm";
import { db, executeWithRetry } from "./index";
import {
  type NewPatternEmbedding,
  patternEmbeddings,
  patternSimilarityCache,
} from "./schema";

// Vector similarity functions for PostgreSQL/NeonDB
export class VectorUtils {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[vector-utils]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[vector-utils]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[vector-utils]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[vector-utils]", message, context || ""),
  };

  /**
   * Calculate cosine similarity between two embeddings
   * Note: For PostgreSQL compatibility, we calculate this in JavaScript
   * In production with pgvector extension, this could be done in SQL
   */
  static calculateCosineSimilarity(
    embedding1: number[],
    embedding2: number[]
  ): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error("Embeddings must have the same dimension");
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Calculate Euclidean distance between two embeddings
   */
  static calculateEuclideanDistance(
    embedding1: number[],
    embedding2: number[]
  ): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error("Embeddings must have the same dimension");
    }

    let sum = 0;
    for (let i = 0; i < embedding1.length; i++) {
      const diff = embedding1[i] - embedding2[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Store a pattern embedding in the database
   */
  static async storePatternEmbedding(
    pattern: Omit<NewPatternEmbedding, "embedding"> & { embedding: number[] }
  ) {
    return executeWithRetry(async () => {
      const embeddingJson = JSON.stringify(pattern.embedding);

      await db.insert(patternEmbeddings).values({
        ...pattern,
        embedding: embeddingJson,
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      });
    }, "Store pattern embedding");
  }

  /**
   * Find similar patterns using vector similarity
   */
  static async findSimilarPatterns(
    embedding: number[],
    options: {
      limit?: number;
      threshold?: number;
      patternType?: string;
      symbolName?: string;
    } = {}
  ) {
    const { limit = 10, threshold = 0.85, patternType, symbolName } = options;

    return executeWithRetry(async () => {
      // Build query conditions
      const conditions = [];
      if (patternType) conditions.push(sql`pattern_type = ${patternType}`);
      if (symbolName) conditions.push(sql`symbol_name = ${symbolName}`);
      conditions.push(sql`is_active = 1`);

      // Fetch candidates
      const query = db
        .select({
          id: patternEmbeddings.id,
          patternId: patternEmbeddings.patternId,
          patternType: patternEmbeddings.patternType,
          symbolName: patternEmbeddings.symbolName,
          embedding: patternEmbeddings.embedding,
          patternData: patternEmbeddings.patternData,
          confidenceScore: patternEmbeddings.confidenceScore,
          similarityScore: patternEmbeddings.similarityScore,
          createdAt: patternEmbeddings.createdAt
        })
        .from(patternEmbeddings)
        .where(sql`${sql.join(conditions, sql` AND `)}`)
        .limit(100); // Fetch more candidates for client-side filtering

      const candidates = await query;

      // Calculate similarities client-side
      const results = candidates
        .map((candidate: any) => {
          const candidateEmbedding = JSON.parse(
            candidate.embedding
          ) as number[];
          const similarity = VectorUtils.calculateCosineSimilarity(
            embedding,
            candidateEmbedding
          );
          const distance = VectorUtils.calculateEuclideanDistance(
            embedding,
            candidateEmbedding
          );

          return {
            ...candidate,
            similarity,
            distance,
          };
        })
        .filter((result: any) => result.similarity >= threshold)
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, limit);

      return results;
    }, "Find similar patterns");
  }

  /**
   * Cache similarity between two patterns
   */
  static async cacheSimilarity(
    patternId1: string,
    patternId2: string,
    cosineSimilarity: number,
    euclideanDistance: number,
    cacheHours = 24
  ) {
    return executeWithRetry(async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + cacheHours * 60 * 60 * 1000);

      // Ensure consistent ordering for the cache
      const [id1, id2] = [patternId1, patternId2].sort();

      await db
        .insert(patternSimilarityCache)
        .values({
          patternId1: id1,
          patternId2: id2,
          cosineSimilarity,
          euclideanDistance,
          calculatedAt: now,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [
            patternSimilarityCache.patternId1,
            patternSimilarityCache.patternId2,
          ],
          set: {
            cosineSimilarity,
            euclideanDistance,
            calculatedAt: now,
            expiresAt,
          },
        });
    }, "Cache pattern similarity");
  }

  /**
   * Get cached similarity between two patterns
   */
  static async getCachedSimilarity(patternId1: string, patternId2: string) {
    return executeWithRetry(async () => {
      const now = new Date();
      const [id1, id2] = [patternId1, patternId2].sort();

      const result = await db
        .select({
          id: patternSimilarityCache.id,
          patternId1: patternSimilarityCache.patternId1,
          patternId2: patternSimilarityCache.patternId2,
          cosineSimilarity: patternSimilarityCache.cosineSimilarity,
          euclideanDistance: patternSimilarityCache.euclideanDistance,
          calculatedAt: patternSimilarityCache.calculatedAt,
          expiresAt: patternSimilarityCache.expiresAt
        })
        .from(patternSimilarityCache)
        .where(
          sql`pattern_id_1 = ${id1} AND pattern_id_2 = ${id2} AND expires_at > ${now}`
        )
        .limit(1);

      return result[0] || null;
    }, "Get cached similarity");
  }

  /**
   * Clean up expired cache entries
   */
  static async cleanupExpiredCache() {
    return executeWithRetry(async () => {
      const now = new Date();

      await db
        .delete(patternSimilarityCache)
        .where(sql`${patternSimilarityCache.expiresAt} <= ${now}`);

      return 0; // Return count for deleted records
    }, "Cleanup expired cache");
  }

  /**
   * Update pattern performance metrics
   */
  static async updatePatternMetrics(
    patternId: string,
    metrics: {
      occurrences?: number;
      successRate?: number;
      avgProfit?: number;
      truePositive?: boolean;
      falsePositive?: boolean;
    }
  ) {
    return executeWithRetry(async () => {
      const updates: any = {
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      };

      if (metrics.occurrences !== undefined) {
        updates.occurrences = sql`occurrences + ${metrics.occurrences}`;
      }

      if (metrics.successRate !== undefined) {
        updates.successRate = metrics.successRate;
      }

      if (metrics.avgProfit !== undefined) {
        updates.avgProfit = metrics.avgProfit;
      }

      if (metrics.truePositive) {
        updates.truePositives = sql`true_positives + 1`;
      }

      if (metrics.falsePositive) {
        updates.falsePositives = sql`false_positives + 1`;
      }

      await db
        .update(patternEmbeddings)
        .set(updates)
        .where(sql`pattern_id = ${patternId}`);
    }, "Update pattern metrics");
  }

  /**
   * Get pattern by ID with parsed embedding
   */
  static async getPattern(patternId: string) {
    return executeWithRetry(async () => {
      const result = await db
        .select()
        .from(patternEmbeddings)
        .where(sql`pattern_id = ${patternId}`)
        .limit(1);

      if (result[0]) {
        return {
          ...result[0],
          embedding: JSON.parse(result[0].embedding) as number[],
        };
      }

      return null;
    }, "Get pattern");
  }

  /**
   * Batch similarity search for multiple embeddings
   */
  static async batchSimilaritySearch(
    embeddings: { id: string; embedding: number[] }[],
    options: {
      limit?: number;
      threshold?: number;
      useCache?: boolean;
    } = {}
  ) {
    const { limit = 5, threshold = 0.85, useCache = true } = options;
    const results: Record<string, any[]> = {};

    for (const { id, embedding } of embeddings) {
      // Check cache first if enabled
      if (useCache) {
        const cachedResults = [];
        const patterns = await db
          .select()
          .from(patternEmbeddings)
          .where(eq(patternEmbeddings.isActive, true))
          .limit(20);

        for (const pattern of patterns) {
          const cached = await VectorUtils.getCachedSimilarity(
            id,
            pattern.patternId
          );
          if (cached && cached.cosineSimilarity >= threshold) {
            cachedResults.push({
              patternId: pattern.patternId,
              similarity: cached.cosineSimilarity,
              distance: cached.euclideanDistance,
              fromCache: true,
            });
          }
        }

        if (cachedResults.length >= limit) {
          results[id] = cachedResults
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
          continue;
        }
      }

      // Perform similarity search
      const similarPatterns = await VectorUtils.findSimilarPatterns(embedding, {
        limit,
        threshold,
      });

      // Cache results for future use
      if (useCache) {
        for (const similar of similarPatterns) {
          await VectorUtils.cacheSimilarity(
            id,
            similar.patternId,
            similar.similarity,
            similar.distance
          );
        }
      }

      results[id] = similarPatterns;
    }

    return results;
  }

  // ============================================================================
  // Enhanced Methods for Pattern Analytics
  // ============================================================================

  /**
   * Get patterns by type and date range
   */
  static async getPatternsByTypeAndDate(
    patternType: string,
    afterDate: Date,
    beforeDate?: Date
  ) {
    return executeWithRetry(async () => {
      const conditions = [
        sql`pattern_type = ${patternType}`,
        sql`is_active = 1`,
        sql`discovered_at >= ${afterDate.getTime() / 1000}`,
      ];

      if (beforeDate) {
        conditions.push(sql`discovered_at <= ${beforeDate.getTime() / 1000}`);
      }

      return await db
        .select()
        .from(patternEmbeddings)
        .where(sql.join(conditions, sql` AND `))
        .orderBy(sql`discovered_at DESC`);
    }, "Get patterns by type and date");
  }

  /**
   * Get patterns by date range with optional type filter
   */
  static async getPatternsByDateRange(
    startDate: Date,
    endDate: Date,
    patternType?: string
  ) {
    return executeWithRetry(async () => {
      const conditions = [
        sql`is_active = 1`,
        sql`discovered_at >= ${startDate.getTime() / 1000}`,
        sql`discovered_at <= ${endDate.getTime() / 1000}`,
      ];

      if (patternType) {
        conditions.push(sql`pattern_type = ${patternType}`);
      }

      return await db
        .select({
          id: patternEmbeddings.id,
          patternId: patternEmbeddings.patternId,
          patternType: patternEmbeddings.patternType,
          symbolName: patternEmbeddings.symbolName,
          vcoinId: patternEmbeddings.vcoinId,
          patternData: patternEmbeddings.patternData,
          embedding: patternEmbeddings.embedding,
          confidenceScore: patternEmbeddings.confidenceScore,
          similarityScore: patternEmbeddings.similarityScore,
          discoveredAt: patternEmbeddings.discoveredAt,
          createdAt: patternEmbeddings.createdAt,
          updatedAt: patternEmbeddings.updatedAt,
          isActive: patternEmbeddings.isActive
        })
        .from(patternEmbeddings)
        .where(sql.join(conditions, sql` AND `))
        .orderBy(sql`discovered_at DESC`);
    }, "Get patterns by date range");
  }

  /**
   * Deactivate old patterns based on criteria
   */
  static async deactivateOldPatterns(
    cutoffDate: Date,
    lowConfidenceThreshold: number
  ): Promise<number> {
    return executeWithRetry(async () => {
      const result = await db
        .update(patternEmbeddings)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          sql`(last_seen_at <= ${cutoffDate.getTime() / 1000} OR confidence < ${lowConfidenceThreshold}) AND is_active = 1`
        );

      return (result as any).changes || (result as any).rowsAffected || 0;
    }, "Deactivate old patterns");
  }

  /**
   * Enhanced similarity search with additional options
   */
  static async findSimilarPatternsEnhanced(
    embedding: number[],
    options: {
      limit?: number;
      threshold?: number;
      patternType?: string;
      afterDate?: Date;
      beforeDate?: Date;
      minConfidence?: number;
      maxResults?: number;
    } = {}
  ) {
    const {
      limit = 10,
      threshold = 0.85,
      patternType,
      afterDate,
      beforeDate,
      minConfidence,
      maxResults = 50,
    } = options;

    return executeWithRetry(async () => {
      // Build WHERE conditions
      const conditions = [`is_active = 1`];

      if (patternType) {
        conditions.push(`pattern_type = '${patternType}'`);
      }

      if (afterDate) {
        conditions.push(`discovered_at >= ${afterDate.getTime() / 1000}`);
      }

      if (beforeDate) {
        conditions.push(`discovered_at <= ${beforeDate.getTime() / 1000}`);
      }

      if (minConfidence) {
        conditions.push(`confidence >= ${minConfidence}`);
      }

      const whereClause = conditions.join(" AND ");

      const patterns = await db
        .select()
        .from(patternEmbeddings)
        .where(sql.raw(whereClause))
        .limit(maxResults);

      const similarities = [];

      for (const pattern of patterns) {
        try {
          const patternEmbedding = JSON.parse(pattern.embedding) as number[];
          const similarity = VectorUtils.calculateCosineSimilarity(
            embedding,
            patternEmbedding
          );
          const distance = VectorUtils.calculateEuclideanDistance(
            embedding,
            patternEmbedding
          );

          if (similarity >= threshold) {
            similarities.push({
              ...pattern,
              cosineSimilarity: similarity,
              euclideanDistance: distance,
              similarity, // Alias for backward compatibility
            });
          }
        } catch (error) {
          console.warn(
            `[VectorUtils] Failed to process pattern ${pattern.patternId}:`,
            error
          );
        }
      }

      return similarities
        .sort((a, b) => b.cosineSimilarity - a.cosineSimilarity)
        .slice(0, limit);
    }, "Enhanced similarity search");
  }
}

// Export convenience functions
export const vectorUtils = VectorUtils;
