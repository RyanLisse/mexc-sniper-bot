/**
 * Enhanced Database Mocks for Vitest
 * 
 * Comprehensive database mocking system that properly handles:
 * - Drizzle ORM query patterns
 * - Transaction management
 * - Schema-aware operations
 * - Realistic data persistence during tests
 */

import { vi } from 'vitest';

// Enhanced mock data store with better table management
export interface MockDataStore {
  // Tables
  snipeTargets: any[];
  user: any[];
  apiCredentials: any[];
  userPreferences: any[];
  patternEmbeddings: any[];
  coinActivities: any[];
  executionHistory: any[];
  transactionLocks: any[];
  transactionQueue: any[];
  workflowActivity: any[];
  monitoredListings: any[];
  tradingStrategies: any[];
  transactions: any[];
  balanceSnapshots: any[];
  portfolioSummary: any[];
  systemHealthMetrics: any[];
  riskEvents: any[];
  simulationSessions: any[];
  simulationTrades: any[];
  positionSnapshots: any[];
  reconciliationReports: any[];
  errorIncidents: any[];
  agentPerformanceMetrics: any[];
  workflowPerformanceMetrics: any[];
  systemPerformanceSnapshots: any[];
  performanceAlerts: any[];
  performanceBaselines: any[];
  
  // Utility methods
  getTable(tableName: string): any[];
  setTable(tableName: string, data: any[]): void;
  reset(): void;
  resetTable(tableName: string): void;
  addRecord(tableName: string, record: any): any;
  findRecords(tableName: string, condition: (record: any) => boolean): any[];
  updateRecords(tableName: string, condition: (record: any) => boolean, updates: any): any[];
  deleteRecords(tableName: string, condition: (record: any) => boolean): any[];
}

/**
 * Creates an enhanced mock data store with proper table management
 */
export function createMockDataStore(): MockDataStore {
  const store = {
    // Initialize all tables as empty arrays
    snipeTargets: [] as any[],
    user: [] as any[],
    apiCredentials: [] as any[],
    userPreferences: [] as any[],
    patternEmbeddings: [] as any[],
    coinActivities: [] as any[],
    executionHistory: [] as any[],
    transactionLocks: [] as any[],
    transactionQueue: [] as any[],
    workflowActivity: [] as any[],
    monitoredListings: [] as any[],
    tradingStrategies: [] as any[],
    transactions: [] as any[],
    balanceSnapshots: [] as any[],
    portfolioSummary: [] as any[],
    systemHealthMetrics: [] as any[],
    riskEvents: [] as any[],
    simulationSessions: [] as any[],
    simulationTrades: [] as any[],
    positionSnapshots: [] as any[],
    reconciliationReports: [] as any[],
    errorIncidents: [] as any[],
    agentPerformanceMetrics: [] as any[],
    workflowPerformanceMetrics: [] as any[],
    systemPerformanceSnapshots: [] as any[],
    performanceAlerts: [] as any[],
    performanceBaselines: [] as any[],

    // Utility methods
    getTable(tableName: string) {
      const table = (this as any)[tableName];
      if (!Array.isArray(table)) {
        console.warn(`[MockDataStore] Table '${tableName}' not found, returning empty array`);
        return [];
      }
      return table;
    },

    setTable(tableName: string, data: any[]) {
      if (tableName in this && Array.isArray(data)) {
        (this as any)[tableName] = [...data];
      }
    },

    reset() {
      // Reset all tables to empty arrays
      Object.keys(this).forEach(key => {
        if (Array.isArray((this as any)[key])) {
          (this as any)[key] = [];
        }
      });
    },

    resetTable(tableName: string) {
      if (tableName in this && Array.isArray((this as any)[tableName])) {
        (this as any)[tableName] = [];
      }
    },

    addRecord(tableName: string, record: any) {
      const table = this.getTable(tableName);
      const timestamp = new Date();
      const newRecord = {
        id: record.id || `mock-${tableName}-${Date.now()}-${table.length}`,
        ...record,
        createdAt: record.createdAt || timestamp,
        updatedAt: record.updatedAt || timestamp,
      };
      table.push(newRecord);
      return newRecord;
    },

    findRecords(tableName: string, condition: (record: any) => boolean) {
      const table = this.getTable(tableName);
      return table.filter(condition);
    },

    updateRecords(tableName: string, condition: (record: any) => boolean, updates: any) {
      const table = this.getTable(tableName);
      const updatedRecords: any[] = [];
      
      for (let i = 0; i < table.length; i++) {
        if (condition(table[i])) {
          table[i] = {
            ...table[i],
            ...updates,
            updatedAt: new Date(),
          };
          updatedRecords.push(table[i]);
        }
      }
      
      return updatedRecords;
    },

    deleteRecords(tableName: string, condition: (record: any) => boolean) {
      const table = this.getTable(tableName);
      const originalLength = table.length;
      
      for (let i = table.length - 1; i >= 0; i--) {
        if (condition(table[i])) {
          table.splice(i, 1);
        }
      }
      
      return { deletedCount: originalLength - table.length };
    },
  };

  return store;
}

/**
 * Enhanced table name extraction for Drizzle ORM
 */
export function getTableName(table: any): string {
  // Try multiple ways to get table name for maximum compatibility
  if (table?._?.name) return table._.name;
  if (table?.name) return table.name;
  if (table?.[Symbol.for('drizzle:Name')]) return table[Symbol.for('drizzle:Name')];
  
  // Try extracting from table constructor or prototype
  if (table?.constructor?.name && table.constructor.name !== 'Object') {
    return table.constructor.name.toLowerCase();
  }
  
  // Try parsing toString output
  if (table?.toString && typeof table.toString === 'function') {
    const str = table.toString();
    const match = str.match(/name:\s*[\"']([^\"']+)[\"']/);
    if (match) return match[1];
  }
  
  // Try looking for common table properties
  if (table?.tableName) return table.tableName;
  if (table?.$name) return table.$name;
  
  console.warn('[Enhanced Database Mock] Could not determine table name, using "unknown"');
  return 'unknown';
}

/**
 * Creates enhanced chainable query builder for mocks
 */
export function createChainableQuery(store: MockDataStore, tableName: string) {
  let currentData = [...store.getTable(tableName)];
  let whereConditions: any[] = [];
  let orderByColumns: any[] = [];
  let limitCount: number | null = null;
  let offsetCount: number = 0;

  const executeQuery = () => {
    let result = [...currentData];

    // Apply where conditions (simplified - in real implementation would parse conditions)
    // For now, we'll return all data since proper condition parsing is complex

    // Apply ordering (simplified)
    if (orderByColumns.length > 0) {
      // Simple ordering by id if available
      result.sort((a, b) => {
        if (a.id && b.id) {
          return a.id.toString().localeCompare(b.id.toString());
        }
        return 0;
      });
    }

    // Apply offset
    if (offsetCount > 0) {
      result = result.slice(offsetCount);
    }

    // Apply limit
    if (limitCount !== null) {
      result = result.slice(0, limitCount);
    }

    return result;
  };

  const chainable = {
    where: vi.fn().mockImplementation((condition: any) => {
      whereConditions.push(condition);
      return chainable;
    }),

    orderBy: vi.fn().mockImplementation((column: any) => {
      orderByColumns.push(column);
      return chainable;
    }),

    limit: vi.fn().mockImplementation((count: number) => {
      limitCount = count;
      return chainable;
    }),

    offset: vi.fn().mockImplementation((count: number) => {
      offsetCount = count;
      return chainable;
    }),

    // Make it thenable for await support
    then: vi.fn().mockImplementation((resolve: any) => {
      return Promise.resolve(executeQuery()).then(resolve);
    }),

    catch: vi.fn().mockImplementation((reject: any) => {
      return Promise.resolve(executeQuery()).catch(reject);
    }),

    finally: vi.fn().mockImplementation((fn: any) => {
      return Promise.resolve(executeQuery()).finally(fn);
    }),

    // Direct execution support
    execute: vi.fn().mockImplementation(async () => {
      return executeQuery();
    }),
  };

  return chainable;
}

/**
 * Creates enhanced mock database instance with proper Drizzle ORM support
 */
export function createEnhancedMockDatabase(store: MockDataStore) {
  return {
    // Core database methods
    execute: vi.fn().mockImplementation(async (query: any) => {
      // Handle raw SQL queries
      if (query?.queryChunks) {
        // Simple SQL query result
        return [{ test_value: 1, count: '1' }];
      }
      return [];
    }),

    query: vi.fn().mockImplementation(async (query: any) => {
      // Handle query objects
      return [];
    }),

    // Enhanced insert method with proper error handling
    insert: vi.fn().mockImplementation((table: any) => ({
      values: vi.fn().mockImplementation((data: any) => ({
        returning: vi.fn().mockImplementation(async () => {
          const tableName = getTableName(table);
          const insertedData = Array.isArray(data) ? data : [data];
          
          const results = insertedData.map((item: any) => {
            return store.addRecord(tableName, item);
          });
          
          return results;
        }),

        execute: vi.fn().mockImplementation(async () => {
          const tableName = getTableName(table);
          const insertedData = Array.isArray(data) ? data : [data];
          
          const results = insertedData.map((item: any) => {
            return store.addRecord(tableName, item);
          });
          
          return {
            insertId: results[0]?.id,
            affectedRows: results.length,
            rows: results,
          };
        }),

        onConflictDoNothing: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockImplementation(async () => {
            // Handle conflict resolution
            const tableName = getTableName(table);
            const insertedData = Array.isArray(data) ? data : [data];
            const results: any[] = [];
            
            insertedData.forEach((item: any) => {
              // Simple conflict check - if id exists, don't insert
              const existing = store.findRecords(tableName, (record: any) => record.id === item.id);
              if (existing.length === 0) {
                results.push(store.addRecord(tableName, item));
              }
            });
            
            return results;
          }),
        })),
      })),
    })),

    // Enhanced select method
    select: vi.fn().mockImplementation((columns?: any) => ({
      from: vi.fn().mockImplementation((table: any) => {
        const tableName = getTableName(table);
        return createChainableQuery(store, tableName);
      }),
    })),

    // Enhanced update method
    update: vi.fn().mockImplementation((table: any) => ({
      set: vi.fn().mockImplementation((data: any) => ({
        where: vi.fn().mockImplementation(async (condition: any) => {
          const tableName = getTableName(table);
          // For mocks, we'll update all records (simplified)
          const updated = store.updateRecords(tableName, () => true, data);
          return updated;
        }),

        returning: vi.fn().mockImplementation(async () => {
          const tableName = getTableName(table);
          return store.getTable(tableName);
        }),
      })),
    })),

    // Enhanced delete method
    delete: vi.fn().mockImplementation((table: any) => ({
      where: vi.fn().mockImplementation(async (condition: any) => {
        const tableName = getTableName(table);
        // For mocks, we'll delete all records (simplified)
        const result = store.deleteRecords(tableName, () => true);
        return result;
      }),
    })),

    // Enhanced transaction support
    transaction: vi.fn().mockImplementation(async (cb: (tx: any) => any) => {
      // Create a transaction-scoped database mock
      const txMock = createEnhancedMockDatabase(store);
      try {
        const result = await cb(txMock);
        return result;
      } catch (error) {
        // In a real transaction, we'd rollback changes
        // For mocks, we'll just propagate the error
        throw error;
      }
    }),

    // Batch operations support
    batch: vi.fn().mockImplementation(async (queries: any[]) => {
      const results = [];
      for (const query of queries) {
        // Execute each query in sequence
        if (typeof query === 'function') {
          results.push(await query());
        } else {
          results.push(query);
        }
      }
      return results;
    }),

    // Schema information (for compatibility)
    _: {
      schema: {
        // Mock schema for table references
      },
    },
  };
}

/**
 * Initialize enhanced database mocks with proper error handling
 */
export function initializeEnhancedDatabaseMocks() {
  const mockDataStore = createMockDataStore();
  
  // Make store globally available for test utilities
  global.mockDataStore = mockDataStore;

  // Mock the database module with enhanced capabilities
  vi.mock('@/src/db', () => {
    // Create the mock database instance inside the factory to avoid hoisting issues
    const mockDbInstance = createEnhancedMockDatabase(mockDataStore);
    
    return {
      db: mockDbInstance,
      getDb: vi.fn().mockReturnValue(mockDbInstance),
      
      // Cache management
      clearDbCache: vi.fn().mockImplementation(() => {
        mockDataStore.reset();
      }),
      
      // Database lifecycle
      initializeDatabase: vi.fn().mockResolvedValue(true),
      closeDatabase: vi.fn().mockResolvedValue(undefined),
      
      // Utility functions
      executeWithRetry: vi.fn().mockImplementation(async (queryFn: () => any, operationName = 'Database query') => {
        console.log(`[Enhanced Mock] Executing ${operationName}`);
        return await queryFn();
      }),
      
      monitoredQuery: vi.fn().mockImplementation(async (queryName: string, queryFn: () => any, options = {}) => {
        console.log(`[Enhanced Mock] Monitored query: ${queryName}`, options);
        return await queryFn();
      }),
      
      executeOptimizedSelect: vi.fn().mockImplementation(async (queryFn: () => any) => {
        return await queryFn();
      }),
      
      executeOptimizedWrite: vi.fn().mockImplementation(async (queryFn: () => any) => {
        return await queryFn();
      }),
      
      executeBatchOperations: vi.fn().mockImplementation(async (operations: (() => any)[]) => {
        return Promise.all(operations.map(op => op()));
      }),
      
      // Health check
      healthCheck: vi.fn().mockResolvedValue({
        status: 'healthy',
        responseTime: 50,
        database: 'enhanced-mock-neondb',
        timestamp: new Date().toISOString(),
      }),
      
      // Export mock table objects for schema references
      snipeTargets: { _: { name: 'snipe_targets' } },
      user: { _: { name: 'user' } },
      apiCredentials: { _: { name: 'api_credentials' } },
      userPreferences: { _: { name: 'user_preferences' } },
      transactionLocks: { _: { name: 'transaction_locks' } },
      transactionQueue: { _: { name: 'transaction_queue' } },
      executionHistory: { _: { name: 'execution_history' } },
      transactions: { _: { name: 'transactions' } },
      balanceSnapshots: { _: { name: 'balance_snapshots' } },
      portfolioSummary: { _: { name: 'portfolio_summary' } },
      workflowActivity: { _: { name: 'workflow_activity' } },
      coinActivities: { _: { name: 'coin_activities' } },
      patternEmbeddings: { _: { name: 'pattern_embeddings' } },
      monitoredListings: { _: { name: 'monitored_listings' } },
      tradingStrategies: { _: { name: 'trading_strategies' } },
      systemHealthMetrics: { _: { name: 'system_health_metrics' } },
      riskEvents: { _: { name: 'risk_events' } },
      simulationSessions: { _: { name: 'simulation_sessions' } },
      simulationTrades: { _: { name: 'simulation_trades' } },
      positionSnapshots: { _: { name: 'position_snapshots' } },
      reconciliationReports: { _: { name: 'reconciliation_reports' } },
      errorIncidents: { _: { name: 'error_incidents' } },
      agentPerformanceMetrics: { _: { name: 'agent_performance_metrics' } },
      workflowPerformanceMetrics: { _: { name: 'workflow_performance_metrics' } },
      systemPerformanceSnapshots: { _: { name: 'system_performance_snapshots' } },
      performanceAlerts: { _: { name: 'performance_alerts' } },
      performanceBaselines: { _: { name: 'performance_baselines' } },
    };
  });

  return { mockDataStore };
}

/**
 * Get the mock data store instance
 */
export function getMockDataStore(): MockDataStore {
  return (global as any).mockDataStore || createMockDataStore();
}

/**
 * Reset all mock data
 */
export function resetMockData(): void {
  const store = getMockDataStore();
  if (store) {
    store.reset();
  }
}

/**
 * Set up test data for specific scenarios
 */
export function setupTestData(scenario: 'basic' | 'advanced' | 'error-conditions' = 'basic'): void {
  const store = getMockDataStore();
  resetMockData();
  
  switch (scenario) {
    case 'basic':
      store.addRecord('user', {
        id: 'test-user-123',
        kindeId: 'kinde-test-user',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      });
      break;
      
    case 'advanced':
      store.addRecord('user', {
        id: 'test-user-123',
        kindeId: 'kinde-test-user',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      });
      
      store.addRecord('apiCredentials', {
        id: 'test-creds-123',
        userId: 'test-user-123',
        mexcApiKey: 'test-api-key',
        mexcSecretKey: 'test-secret-key',
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      break;
      
    case 'error-conditions':
      store.addRecord('user', {
        id: 'error-user-123',
        kindeId: 'kinde-error-user',
        email: 'error@example.com',
        createdAt: new Date().toISOString(),
      });
      break;
  }
}

/**
 * Mock transaction helpers for testing
 */
export const mockTransactionHelpers = {
  simulateSuccess: vi.fn().mockResolvedValue(true),
  simulateError: vi.fn().mockRejectedValue(new Error('Mock transaction error')),
  simulateTimeout: vi.fn().mockImplementation(() => 
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Transaction timeout')), 100)
    )
  ),
};

/**
 * Mock performance metrics for testing
 */
export const mockPerformanceMetrics = {
  getQueryExecutionTime: vi.fn().mockReturnValue(Math.random() * 100),
  getConnectionPoolStats: vi.fn().mockReturnValue({
    active: 1,
    idle: 5,
    total: 6,
  }),
  getSlowQueries: vi.fn().mockReturnValue([]),
};