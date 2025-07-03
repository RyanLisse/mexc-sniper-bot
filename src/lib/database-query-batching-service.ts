/**
 * Database Query Batching Service - Simple implementation
 */

export interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number;
}

const defaultConfig: BatchConfig = {
  maxBatchSize: 100,
  maxWaitTime: 1000,
};

export async function executeBatchQuery<T>(
  queries: (() => Promise<T>)[],
  config: BatchConfig = defaultConfig
): Promise<T[]> {
  // Simple implementation - execute all queries
  return Promise.all(queries.map(query => query()));
}

export interface BatchingStats {
  totalBatches: number;
  totalQueries: number;
  averageBatchSize: number;
  totalExecutionTime: number;
}

export function getBatchingStats(): BatchingStats {
  return {
    totalBatches: 0,
    totalQueries: 0,
    averageBatchSize: 0,
    totalExecutionTime: 0,
  };
}

export class DatabaseQueryBatchingService {
  private config: BatchConfig;

  constructor(config: BatchConfig = defaultConfig) {
    this.config = config;
  }

  async batchQueries<T>(queries: (() => Promise<T>)[]): Promise<T[]> {
    return executeBatchQuery(queries, this.config);
  }

  getStats(): BatchingStats {
    return getBatchingStats();
  }

  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const queryBatchingService = new DatabaseQueryBatchingService();

// Export global instance for compatibility
export const globalQueryBatchingService = queryBatchingService;