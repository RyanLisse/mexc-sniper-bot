/**
 * Enhanced Vector Service
 * 
 * Implements native pgvector integration for high-performance vector operations.
 * Replaces JavaScript-based vector calculations with PostgreSQL native operations.
 * 
 * Key Features:
 * - Native pgvector extension integration
 * - Optimized vector similarity search
 * - Efficient vector indexing
 * - Fallback to JavaScript calculations
 * - Batch vector operations
 */

import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, executeWithRetry, monitoredQuery } from '../db';
import { patternEmbeddings, patternSimilarityCache } from '../db/schema';
import { toSafeError } from '../lib/error-type-utils';

// ============================================================================
// Types and Schemas
// ============================================================================

const VectorSearchOptionsSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.85),
  limit: z.number().min(1).max(1000).default(10),
  useNativeOps: z.boolean().default(true),
  patternType: z.string().optional(),
  symbolName: z.string().optional(),
  minConfidence: z.number().min(0).max(100).optional(),
  maxResults: z.number().min(1).max(1000).default(50),
});

const BatchSearchOptionsSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.85),
  limit: z.number().min(1).max(100).default(5),
  useCache: z.boolean().default(true),
  enableParallel: z.boolean().default(true),
});

type VectorSearchOptions = z.infer<typeof VectorSearchOptionsSchema>;
type BatchSearchOptions = z.infer<typeof BatchSearchOptionsSchema>;

interface VectorSearchResult {
  patternId: string;
  patternType: string;
  symbolName: string;
  similarity: number;
  distance: number;
  confidence: number;
  embedding?: number[];
  fromCache?: boolean;
}

interface IndexStatus {
  indexName: string;
  tableName: string;
  columnName: string;
  indexType: string;
  isValid: boolean;
  indexSize: string;
}

// ============================================================================
// Enhanced Vector Service
// ============================================================================

export class EnhancedVectorService {
  private logger = {
    info: (message: string, context?: any) =>
      console.info('[enhanced-vector-service]', message, context || ''),
    warn: (message: string, context?: any) =>
      console.warn('[enhanced-vector-service]', message, context || ''),
    error: (message: string, context?: any, error?: Error) =>
      console.error('[enhanced-vector-service]', message, context || '', error || ''),
    debug: (message: string, context?: any) =>
      console.debug('[enhanced-vector-service]', message, context || ''),
  };

  private pgvectorAvailable: boolean | null = null;
  private indexesCreated = false;

  /**
   * Initialize pgvector extension if available
   */
  async initializePgVector(): Promise<void> {
    try {
      this.logger.info('Initializing pgvector extension...');

      // Try to create the vector extension
      await executeWithRetry(async () => {
        await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
      });

      // Verify the extension is available
      const extensionCheck = await executeWithRetry(async () => {
        return await db.execute(
          sql`SELECT 1 FROM pg_extension WHERE extname = 'vector'`
        );
      });

      this.pgvectorAvailable = extensionCheck.length > 0;

      if (this.pgvectorAvailable) {
        this.logger.info('✅ pgvector extension initialized successfully');
        await this.createOptimizedIndexes();
      } else {
        this.logger.warn('⚠️ pgvector extension not available, using JavaScript fallback');
      }

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.warn('pgvector initialization failed, using JavaScript fallback', {
        error: safeError.message,
      });
      this.pgvectorAvailable = false;
    }
  }

  /**
   * Check if pgvector is supported
   */
  async checkVectorSupport(): Promise<boolean> {
    if (this.pgvectorAvailable !== null) {
      return this.pgvectorAvailable;
    }

    try {
      const result = await executeWithRetry(async () => {
        return await db.execute(
          sql`SELECT 1 FROM pg_available_extensions WHERE name = 'vector'`
        );
      });

      this.pgvectorAvailable = result.length > 0;
      return this.pgvectorAvailable;
    } catch (error) {
      this.pgvectorAvailable = false;
      return false;
    }
  }

  /**
   * Native vector similarity search using pgvector
   */
  async nativeSimilaritySearch(
    queryEmbedding: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const validatedOptions = VectorSearchOptionsSchema.parse(options);
    const { threshold, limit, useNativeOps, patternType, symbolName, minConfidence, maxResults } = validatedOptions;

    const isVectorSupported = await this.checkVectorSupport();

    if (useNativeOps && isVectorSupported) {
      return this.performNativeVectorSearch(queryEmbedding, validatedOptions);
    } else {
      return this.performJavaScriptVectorSearch(queryEmbedding, validatedOptions);
    }
  }

  /**
   * PostgreSQL native vector similarity search
   */
  private async performNativeVectorSearch(
    queryEmbedding: number[],
    options: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    const { threshold, limit, patternType, symbolName, minConfidence, maxResults } = options;

    const startTime = performance.now();

    try {
      // Build WHERE conditions
      const conditions = ['is_active = true'];
      const parameters: any[] = [];

      if (patternType) {
        conditions.push('pattern_type = $' + (parameters.length + 1));
        parameters.push(patternType);
      }

      if (symbolName) {
        conditions.push('symbol_name = $' + (parameters.length + 1));
        parameters.push(symbolName);
      }

      if (minConfidence) {
        conditions.push('confidence >= $' + (parameters.length + 1));
        parameters.push(minConfidence);
      }

      // Convert embedding to PostgreSQL vector format
      const vectorString = `[${queryEmbedding.join(',')}]`;
      parameters.push(vectorString);

      // Native pgvector similarity search with cosine distance
      const query = `
        SELECT 
          pattern_id,
          pattern_type,
          symbol_name,
          confidence,
          1 - (embedding::vector <=> $${parameters.length}::vector) as similarity,
          embedding::vector <-> $${parameters.length}::vector as distance
        FROM pattern_embeddings
        WHERE ${conditions.join(' AND ')}
        AND (1 - (embedding::vector <=> $${parameters.length}::vector)) >= $${parameters.length + 1}
        ORDER BY embedding::vector <=> $${parameters.length}::vector
        LIMIT $${parameters.length + 2}
      `;

      parameters.push(threshold);
      parameters.push(limit);

      const results = await monitoredQuery(
        'native_vector_similarity_search',
        async () => {
          return await executeWithRetry(async () => {
            return await db.execute(sql.raw(query, parameters));
          });
        },
        {
          operationType: 'select',
          tableName: 'pattern_embeddings',
          query: query,
          parameters: parameters,
        }
      );

      const searchTime = performance.now() - startTime;

      this.logger.debug('Native vector search completed', {
        queryDimension: queryEmbedding.length,
        resultsFound: results.length,
        searchTimeMs: Math.round(searchTime),
        useNativePgVector: true,
        threshold,
        limit,
      });

      return results.map((row: any) => ({
        patternId: row.pattern_id,
        patternType: row.pattern_type,
        symbolName: row.symbol_name,
        similarity: parseFloat(row.similarity),
        distance: parseFloat(row.distance),
        confidence: row.confidence,
      }));

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Native vector search failed, falling back to JavaScript', {
        error: safeError.message,
        queryDimension: queryEmbedding.length,
      });

      // Fallback to JavaScript implementation
      return this.performJavaScriptVectorSearch(queryEmbedding, options);
    }
  }

  /**
   * JavaScript fallback vector similarity search
   */
  private async performJavaScriptVectorSearch(
    queryEmbedding: number[],
    options: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    const { threshold, limit, patternType, symbolName, minConfidence, maxResults } = options;

    const startTime = performance.now();

    try {
      // Build query conditions
      const conditions = [eq(patternEmbeddings.isActive, true)];
      
      if (patternType) {
        conditions.push(eq(patternEmbeddings.patternType, patternType));
      }
      
      if (symbolName) {
        conditions.push(eq(patternEmbeddings.symbolName, symbolName));
      }
      
      if (minConfidence) {
        conditions.push(sql`confidence >= ${minConfidence}`);
      }

      // Fetch candidates
      const candidates = await monitoredQuery(
        'javascript_vector_search_candidates',
        async () => {
          return await executeWithRetry(async () => {
            return await db
              .select({
                patternId: patternEmbeddings.patternId,
                patternType: patternEmbeddings.patternType,
                symbolName: patternEmbeddings.symbolName,
                embedding: patternEmbeddings.embedding,
                confidence: patternEmbeddings.confidence,
              })
              .from(patternEmbeddings)
              .where(and(...conditions))
              .limit(maxResults);
          });
        },
        {
          operationType: 'select',
          tableName: 'pattern_embeddings',
          query: 'SELECT patternId, patternType, symbolName, embedding, confidence FROM pattern_embeddings WHERE ...',
          parameters: [patternType, symbolName, minConfidence].filter(Boolean),
        }
      );

      // Calculate similarities in JavaScript
      const results: VectorSearchResult[] = [];

      for (const candidate of candidates) {
        try {
          const candidateEmbedding = JSON.parse(candidate.embedding) as number[];
          const similarity = this.calculateCosineSimilarity(queryEmbedding, candidateEmbedding);
          const distance = this.calculateEuclideanDistance(queryEmbedding, candidateEmbedding);

          if (similarity >= threshold) {
            results.push({
              patternId: candidate.patternId,
              patternType: candidate.patternType,
              symbolName: candidate.symbolName,
              similarity,
              distance,
              confidence: candidate.confidence,
              embedding: candidateEmbedding,
            });
          }
        } catch (error) {
          this.logger.warn('Failed to process candidate embedding', {
            patternId: candidate.patternId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Sort by similarity and limit
      results.sort((a, b) => b.similarity - a.similarity);
      const finalResults = results.slice(0, limit);

      const searchTime = performance.now() - startTime;

      this.logger.debug('JavaScript vector search completed', {
        queryDimension: queryEmbedding.length,
        candidatesProcessed: candidates.length,
        resultsFound: finalResults.length,
        searchTimeMs: Math.round(searchTime),
        useNativePgVector: false,
        threshold,
        limit,
      });

      return finalResults;

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('JavaScript vector search failed', {
        error: safeError.message,
        queryDimension: queryEmbedding.length,
      });
      throw error;
    }
  }

  /**
   * Batch similarity search for multiple embeddings
   */
  async findSimilarPatternsBatch(
    queryEmbeddings: number[][],
    options: BatchSearchOptions = {}
  ): Promise<{ [index: number]: VectorSearchResult[] }> {
    const validatedOptions = BatchSearchOptionsSchema.parse(options);
    const { threshold, limit, useCache, enableParallel } = validatedOptions;

    if (queryEmbeddings.length === 0) return {};

    const startTime = performance.now();
    this.logger.info('Starting batch similarity search', {
      queryCount: queryEmbeddings.length,
      threshold,
      limit,
      useCache,
      enableParallel,
    });

    try {
      const results: { [index: number]: VectorSearchResult[] } = {};

      if (enableParallel && queryEmbeddings.length > 1) {
        // Parallel processing
        const promises = queryEmbeddings.map(async (embedding, index) => {
          const searchResults = await this.nativeSimilaritySearch(embedding, {
            threshold,
            limit,
            useNativeOps: true,
          });
          return { index, results: searchResults };
        });

        const parallelResults = await Promise.all(promises);
        for (const { index, results: searchResults } of parallelResults) {
          results[index] = searchResults;
        }
      } else {
        // Sequential processing
        for (let i = 0; i < queryEmbeddings.length; i++) {
          const searchResults = await this.nativeSimilaritySearch(queryEmbeddings[i], {
            threshold,
            limit,
            useNativeOps: true,
          });
          results[i] = searchResults;
        }
      }

      const totalTime = performance.now() - startTime;
      const totalResults = Object.values(results).reduce((sum, res) => sum + res.length, 0);

      this.logger.info('Batch similarity search completed', {
        queryCount: queryEmbeddings.length,
        totalResults,
        avgResultsPerQuery: totalResults / queryEmbeddings.length,
        totalTimeMs: Math.round(totalTime),
        avgTimePerQuery: Math.round(totalTime / queryEmbeddings.length),
        enableParallel,
      });

      return results;

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Batch similarity search failed', {
        queryCount: queryEmbeddings.length,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Create optimized vector indexes
   */
  async createOptimizedIndexes(): Promise<void> {
    if (!await this.checkVectorSupport()) {
      this.logger.warn('Cannot create vector indexes: pgvector not available');
      return;
    }

    if (this.indexesCreated) {
      this.logger.debug('Vector indexes already created');
      return;
    }

    try {
      this.logger.info('Creating optimized vector indexes...');

      // Create HNSW index for vector similarity search
      await executeWithRetry(async () => {
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS pattern_embeddings_vector_idx 
          ON pattern_embeddings 
          USING hnsw (embedding::vector vector_cosine_ops)
          WITH (m = 16, ef_construction = 64)
        `);
      });

      // Create index for active patterns
      await executeWithRetry(async () => {
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS pattern_embeddings_active_idx 
          ON pattern_embeddings (is_active, pattern_type, confidence)
          WHERE is_active = true
        `);
      });

      // Create compound index for filtered searches
      await executeWithRetry(async () => {
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS pattern_embeddings_filtered_search_idx 
          ON pattern_embeddings (pattern_type, symbol_name, is_active, confidence)
          WHERE is_active = true
        `);
      });

      this.indexesCreated = true;
      this.logger.info('✅ Vector indexes created successfully');

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Failed to create vector indexes', {
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Verify index optimization status
   */
  async verifyIndexes(): Promise<IndexStatus[]> {
    try {
      const indexQuery = sql`
        SELECT 
          indexname as index_name,
          tablename as table_name,
          indexdef as index_definition
        FROM pg_indexes 
        WHERE tablename = 'pattern_embeddings'
        AND indexname LIKE '%vector%' OR indexname LIKE '%pattern_embeddings%'
      `;

      const indexes = await executeWithRetry(async () => {
        return await db.execute(indexQuery);
      });

      const indexStatus: IndexStatus[] = indexes.map((index: any) => ({
        indexName: index.index_name,
        tableName: index.table_name,
        columnName: this.extractColumnFromIndexDef(index.index_definition),
        indexType: this.extractIndexTypeFromDef(index.index_definition),
        isValid: true,
        indexSize: 'unknown', // Would need additional query to get size
      }));

      this.logger.debug('Index verification completed', {
        indexCount: indexStatus.length,
        indexes: indexStatus.map(i => i.indexName),
      });

      return indexStatus;

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Index verification failed', {
        error: safeError.message,
      });
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  private calculateEuclideanDistance(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      const diff = vec1[i] - vec2[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Extract column name from index definition
   */
  private extractColumnFromIndexDef(indexDef: string): string {
    const match = indexDef.match(/\(([^)]+)\)/);
    return match ? match[1].split('::')[0] : 'unknown';
  }

  /**
   * Extract index type from index definition
   */
  private extractIndexTypeFromDef(indexDef: string): string {
    if (indexDef.includes('hnsw')) return 'hnsw';
    if (indexDef.includes('ivfflat')) return 'ivfflat';
    if (indexDef.includes('btree')) return 'btree';
    return 'unknown';
  }

  /**
   * Get service status and statistics
   */
  getStatus(): {
    pgvectorAvailable: boolean | null;
    indexesCreated: boolean;
    nativeOperationsEnabled: boolean;
  } {
    return {
      pgvectorAvailable: this.pgvectorAvailable,
      indexesCreated: this.indexesCreated,
      nativeOperationsEnabled: this.pgvectorAvailable === true,
    };
  }
}