/**
 * Enhanced Database Mocks for Vitest
 *
 * Comprehensive database mocking system that properly handles:
 * - Drizzle ORM query patterns and chains
 * - Schema-aware operations with proper table references
 * - Realistic data persistence during tests
 * - Proper error handling and edge cases
 * - Supabase client mocking
 * - Migration-related test support
 */

import { vi } from 'vitest';

// Enhanced mock data store with comprehensive table management
export interface EnhancedMockDataStore {
  // Core tables
  snipeTargets: any[];
  user: any[];
  users: any[]; // Supabase schema alias
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
  userRoles: any[];
  workflowSystemStatus: any[];

  // Utility methods
  getTable(tableName: string): any[];
  setTable(tableName: string, data: any[]): void;
  reset(): void;
  resetTable(tableName: string): void;
  addRecord(tableName: string, record: any): any;
  findRecords(tableName: string, condition: (record: any) => boolean): any[];
  updateRecords(tableName: string, condition: (record: any) => boolean, updates: any): any[];
  deleteRecords(tableName: string, condition: (record: any) => boolean): any[];
  countRecords(tableName: string, condition?: (record: any) => boolean): number;
}

/**
 * Creates an enhanced mock data store with comprehensive table management
 */
export function createEnhancedMockDataStore(): EnhancedMockDataStore {
  const store = {
    // Initialize all tables as empty arrays
    snipeTargets: [] as any[],
    user: [] as any[],
    users: [] as any[], // Supabase schema alias
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
    userRoles: [] as any[],
    workflowSystemStatus: [] as any[],

    // Utility methods
    getTable(tableName: string) {
      const table = (this as any)[tableName];
      if (!Array.isArray(table)) {
        // Auto-create missing tables
        (this as any)[tableName] = [];
        console.warn(`[EnhancedMockDataStore] Auto-created table '${tableName}'`);
        return (this as any)[tableName];
      }
      return table;
    },

    setTable(tableName: string, data: any[]) {
      if (Array.isArray(data)) {
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
      const table = this.getTable(tableName);
      table.length = 0; // Clear array in place
    },

    addRecord(tableName: string, record: any) {
      const table = this.getTable(tableName);
      const timestamp = new Date().toISOString();
      const newRecord = {
        id: record.id || `mock-${tableName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      const timestamp = new Date().toISOString();

      for (let i = 0; i < table.length; i++) {
        if (condition(table[i])) {
          table[i] = {
            ...table[i],
            ...updates,
            updatedAt: timestamp,
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

    countRecords(tableName: string, condition?: (record: any) => boolean) {
      const table = this.getTable(tableName);
      if (!condition) return table.length;
      return table.filter(condition).length;
    },
  };

  return store;
}

/**
 * Enhanced table name extraction for various Drizzle ORM patterns
 */
export function extractTableName(table: any): string {
  // Try multiple ways to get table name for maximum compatibility
  if (table?._?.name) return table._.name;
  if (table?.name) return table.name;
  if (table?.[Symbol.for('drizzle:Name')]) return table[Symbol.for('drizzle:Name')];
  if (table?.tableName) return table.tableName;
  if (table?.$name) return table.$name;
  if (table?.__tableName) return table.__tableName;

  // Try extracting from table constructor or prototype
  if (table?.constructor?.name && table.constructor.name !== 'Object') {
    const constructorName = table.constructor.name.toLowerCase();
    if (constructorName.includes('table')) {
      return constructorName.replace(/table$/, '');
    }
    return constructorName;
  }

  // Try parsing toString output
  if (table?.toString && typeof table.toString === 'function') {
    const str = table.toString();
    
    // Look for table name patterns
    const patterns = [
      /table[\s'"]*:[\s'"]*([^'"}\s,]+)/i,
      /name[\s'"]*:[\s'"]*([^'"}\s,]+)/i,
      /"([^"]+)"/,
      /'([^']+)'/,
    ];
    
    for (const pattern of patterns) {
      const match = str.match(pattern);
      if (match?.[1] && match[1] !== 'Object') {
        return match[1];
      }
    }
  }

  // Fallback: look for common properties that might indicate table name
  const keys = Object.keys(table || {});
  const tableKey = keys.find(key => 
    key.includes('table') || 
    key.includes('name') || 
    key.includes('schema')
  );
  
  if (tableKey && table[tableKey]) {
    return String(table[tableKey]);
  }

  console.warn('[Enhanced Database Mock] Could not determine table name, using "unknown"', {
    table: table,
    keys: Object.keys(table || {}),
    toString: table?.toString?.()
  });
  return 'unknown';
}

/**
 * Enhanced chainable query builder that properly implements Drizzle ORM patterns
 */
export function createEnhancedChainableQuery(store: EnhancedMockDataStore, tableName: string) {
  let currentData = [...store.getTable(tableName)];
  let whereConditions: any[] = [];
  let orderByColumns: any[] = [];
  let limitCount: number | null = null;
  let offsetCount: number = 0;
  let selectColumns: any[] = [];

  const executeQuery = () => {
    let result = [...currentData];

    // Apply where conditions (simplified - in real implementation would parse complex conditions)
    if (whereConditions.length > 0) {
      result = result.filter(record => {
        // Simple condition matching for common test cases
        return whereConditions.every(condition => {
          if (condition && typeof condition === 'object' && condition._type === 'eq') {
            const columnName = condition.column?.name || 'id';
            return record[columnName] === condition.value;
          }
          return true; // Allow unrecognized conditions to pass
        });
      });
    }

    // Apply ordering (simplified by id or first available field)
    if (orderByColumns.length > 0) {
      result.sort((a, b) => {
        const field = orderByColumns[0]?.name || 'id';
        const aVal = a[field];
        const bVal = b[field];
        
        if (aVal && bVal) {
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal);
          }
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return aVal - bVal;
          }
          return String(aVal).localeCompare(String(bVal));
        }
        return 0;
      });
    }

    // Apply offset
    if (offsetCount > 0) {
      result = result.slice(offsetCount);
    }

    // Apply limit
    if (limitCount !== null && limitCount > 0) {
      result = result.slice(0, limitCount);
    }

    // Apply column selection (simplified)
    if (selectColumns.length > 0) {
      result = result.map(record => {
        const selected: any = {};
        selectColumns.forEach(col => {
          const fieldName = col?.name || col;
          if (fieldName && record[fieldName] !== undefined) {
            selected[fieldName] = record[fieldName];
          }
        });
        return Object.keys(selected).length > 0 ? selected : record;
      });
    }

    return result;
  };

  const chainable = {
    // Query building methods
    where: vi.fn().mockImplementation((condition: any) => {
      whereConditions.push(condition);
      return chainable;
    }),

    orderBy: vi.fn().mockImplementation((column: any, direction?: 'asc' | 'desc') => {
      orderByColumns.push({ column, direction: direction || 'asc' });
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

    // Selection methods
    select: vi.fn().mockImplementation((columns: any) => {
      if (columns) {
        selectColumns = Array.isArray(columns) ? columns : [columns];
      }
      return chainable;
    }),

    // Promise-like methods
    then: vi.fn().mockImplementation((resolve: any, reject?: any) => {
      try {
        const result = executeQuery();
        return Promise.resolve(result).then(resolve, reject);
      } catch (error) {
        return reject ? reject(error) : Promise.reject(error);
      }
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

    // Additional Drizzle methods
    all: vi.fn().mockImplementation(async () => {
      return executeQuery();
    }),

    get: vi.fn().mockImplementation(async () => {
      const results = executeQuery();
      return results[0] || null;
    }),

    run: vi.fn().mockImplementation(async () => {
      const results = executeQuery();
      return {
        rows: results,
        rowCount: results.length,
        changes: results.length,
        lastInsertRowid: results[results.length - 1]?.id || null,
      };
    }),
  };

  // Make it properly thenable by setting up prototype chain
  Object.setPrototypeOf(chainable, Promise.prototype);

  return chainable;
}

/**
 * Creates enhanced mock database instance with full Drizzle ORM support
 */
export function createEnhancedMockDatabase(store: EnhancedMockDataStore) {
  return {
    // Core database methods
    execute: vi.fn().mockImplementation(async (query: any) => {
      // Handle raw SQL queries
      if (query?.queryChunks || typeof query === 'string') {
        // Simple SQL query result for common test patterns
        return [{ 
          test_value: 1, 
          count: '1',
          id: 'mock-result-id',
          success: true 
        }];
      }
      return [];
    }),

    query: vi.fn().mockImplementation(async (query: any) => {
      // Handle query objects and return appropriate mock data
      return {
        rows: [],
        rowCount: 0,
      };
    }),

    // Enhanced insert method with comprehensive error handling
    insert: vi.fn().mockImplementation((table: any) => ({
      values: vi.fn().mockImplementation((data: any) => {
        const tableName = extractTableName(table);
        
        return {
          returning: vi.fn().mockImplementation(async (columns?: any) => {
            const insertedData = Array.isArray(data) ? data : [data];
            
            const results = insertedData.map((item: any) => {
              return store.addRecord(tableName, item);
            });
            
            return results;
          }),

          execute: vi.fn().mockImplementation(async () => {
            const insertedData = Array.isArray(data) ? data : [data];
            
            const results = insertedData.map((item: any) => {
              return store.addRecord(tableName, item);
            });
            
            return {
              insertId: results[0]?.id || 'mock-insert-id',
              affectedRows: results.length,
              changes: results.length,
              rows: results,
              rowCount: results.length,
            };
          }),

          onConflictDoNothing: vi.fn().mockImplementation(() => ({
            returning: vi.fn().mockImplementation(async () => {
              const tableName = extractTableName(table);
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

            execute: vi.fn().mockImplementation(async () => {
              const tableName = extractTableName(table);
              const insertedData = Array.isArray(data) ? data : [data];
              const results: any[] = [];
              
              insertedData.forEach((item: any) => {
                const existing = store.findRecords(tableName, (record: any) => record.id === item.id);
                if (existing.length === 0) {
                  results.push(store.addRecord(tableName, item));
                }
              });
              
              return {
                insertId: results[0]?.id || null,
                affectedRows: results.length,
                changes: results.length,
                rows: results,
                rowCount: results.length,
              };
            }),
          })),

          onConflictDoUpdate: vi.fn().mockImplementation((config: any) => ({
            returning: vi.fn().mockImplementation(async () => {
              const tableName = extractTableName(table);
              const insertedData = Array.isArray(data) ? data : [data];
              const results: any[] = [];
              
              insertedData.forEach((item: any) => {
                const existing = store.findRecords(tableName, (record: any) => record.id === item.id);
                if (existing.length > 0) {
                  // Update existing record
                  const updated = store.updateRecords(tableName, (record: any) => record.id === item.id, item);
                  results.push(...updated);
                } else {
                  // Insert new record
                  results.push(store.addRecord(tableName, item));
                }
              });
              
              return results;
            }),
          })),
        };
      }),
    })),

    // Enhanced select method with full query chain support
    select: vi.fn().mockImplementation((columns?: any) => ({
      from: vi.fn().mockImplementation((table: any) => {
        const tableName = extractTableName(table);
        const query = createEnhancedChainableQuery(store, tableName);
        
        // If columns are specified, apply them to the query
        if (columns) {
          query.select(columns);
        }
        
        return query;
      }),
    })),

    // Enhanced update method
    update: vi.fn().mockImplementation((table: any) => ({
      set: vi.fn().mockImplementation((data: any) => ({
        where: vi.fn().mockImplementation(async (condition: any) => {
          const tableName = extractTableName(table);
          
          // Simple condition matching for updates
          const updateCondition = (record: any) => {
            if (condition && typeof condition === 'object' && condition._type === 'eq') {
              const columnName = condition.column?.name || 'id';
              return record[columnName] === condition.value;
            }
            return true; // Update all if condition not recognized
          };
          
          const updated = store.updateRecords(tableName, updateCondition, data);
          return updated;
        }),

        returning: vi.fn().mockImplementation(async (columns?: any) => {
          const tableName = extractTableName(table);
          // For returning, just return all records from the table
          return store.getTable(tableName);
        }),

        execute: vi.fn().mockImplementation(async () => {
          const tableName = extractTableName(table);
          const allRecords = store.getTable(tableName);
          const updated = store.updateRecords(tableName, () => true, data);
          
          return {
            affectedRows: updated.length,
            changes: updated.length,
            rows: updated,
            rowCount: updated.length,
          };
        }),
      })),
    })),

    // Enhanced delete method
    delete: vi.fn().mockImplementation((table: any) => ({
      where: vi.fn().mockImplementation(async (condition: any) => {
        const tableName = extractTableName(table);
        
        // Simple condition matching for deletes
        const deleteCondition = (record: any) => {
          if (condition && typeof condition === 'object' && condition._type === 'eq') {
            const columnName = condition.column?.name || 'id';
            return record[columnName] === condition.value;
          }
          return true; // Delete all if condition not recognized
        };
        
        const result = store.deleteRecords(tableName, deleteCondition);
        return {
          ...result,
          affectedRows: result.deletedCount,
          changes: result.deletedCount,
          rowCount: result.deletedCount,
        };
      }),

      execute: vi.fn().mockImplementation(async () => {
        const tableName = extractTableName(table);
        const result = store.deleteRecords(tableName, () => true);
        
        return {
          ...result,
          affectedRows: result.deletedCount,
          changes: result.deletedCount,
          rowCount: result.deletedCount,
        };
      }),
    })),

    // Enhanced transaction support with nested transaction handling
    transaction: vi.fn().mockImplementation(async (cb: (tx: any) => any) => {
      // Create a transaction-scoped database mock with isolated data
      const txStore = createEnhancedMockDataStore();
      
      // Copy current data to transaction store
      Object.keys(store).forEach(key => {
        if (Array.isArray((store as any)[key])) {
          txStore.setTable(key, (store as any)[key]);
        }
      });
      
      const txMock = createEnhancedMockDatabase(txStore);
      
      try {
        const result = await cb(txMock);
        
        // On success, commit changes back to main store
        Object.keys(txStore).forEach(key => {
          if (Array.isArray((txStore as any)[key])) {
            store.setTable(key, (txStore as any)[key]);
          }
        });
        
        return result;
      } catch (error) {
        // On error, discard transaction changes (rollback)
        console.warn('[Enhanced Database Mock] Transaction rolled back due to error:', error);
        throw error;
      }
    }),

    // Batch operations support with transaction semantics
    batch: vi.fn().mockImplementation(async (queries: any[]) => {
      const results = [];
      
      try {
        for (const query of queries) {
          let result;
          
          if (typeof query === 'function') {
            result = await query();
          } else if (query && typeof query.execute === 'function') {
            result = await query.execute();
          } else {
            result = query;
          }
          
          results.push(result);
        }
        
        return results;
      } catch (error) {
        console.warn('[Enhanced Database Mock] Batch operation failed:', error);
        throw error;
      }
    }),

    // Schema and metadata support
    _: {
      schema: {
        // Mock schema for table references and metadata
      },
    },

    // Connection management methods
    $client: {
      end: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    },

    // Additional methods for compatibility
    close: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),

    // Emergency cleanup hook
    $emergencyCleanup: vi.fn().mockImplementation(async () => {
      console.log('[Enhanced Database Mock] Emergency cleanup executed');
      store.reset();
      return Promise.resolve();
    }),
  };
}

/**
 * Initialize enhanced database mocks with comprehensive error handling and schema support
 */
export function initializeEnhancedDatabaseMocks() {
  const mockDataStore = createEnhancedMockDataStore();
  
  // Make store globally available for test utilities
  (global as any).mockDataStore = mockDataStore;

  // Mock the main database module with enhanced capabilities
  vi.mock('@/src/db', () => {
    // Create the mock database instance inside the factory to avoid hoisting issues
    const mockDbInstance = createEnhancedMockDatabase(mockDataStore);
    
    return {
      // Main database instance
      db: mockDbInstance,
      
      // Database lifecycle functions
      getDb: vi.fn().mockReturnValue(mockDbInstance),
      clearDbCache: vi.fn().mockImplementation(() => {
        mockDataStore.reset();
      }),
      initializeDatabase: vi.fn().mockResolvedValue(true),
      closeDatabase: vi.fn().mockResolvedValue(undefined),
      
      // Utility functions with enhanced error handling
      executeWithRetry: vi.fn().mockImplementation(async (queryFn: () => any, operationName = 'Database query') => {
        console.log(`[Enhanced Mock] Executing ${operationName}`);
        try {
          return await queryFn();
        } catch (error) {
          console.warn(`[Enhanced Mock] ${operationName} failed:`, error);
          throw error;
        }
      }),
      
      monitoredQuery: vi.fn().mockImplementation(async (queryName: string, queryFn: () => any, options = {}) => {
        console.log(`[Enhanced Mock] Monitored query: ${queryName}`, options);
        try {
          return await queryFn();
        } catch (error) {
          console.warn(`[Enhanced Mock] Monitored query ${queryName} failed:`, error);
          throw error;
        }
      }),
      
      executeOptimizedSelect: vi.fn().mockImplementation(async (queryFn: () => any, cacheKey?: string) => {
        console.log(`[Enhanced Mock] Optimized select${cacheKey ? ` (cache: ${cacheKey})` : ''}`);
        return await queryFn();
      }),
      
      executeOptimizedWrite: vi.fn().mockImplementation(async (queryFn: () => any, invalidatePatterns: string[] = []) => {
        console.log(`[Enhanced Mock] Optimized write (invalidating: ${invalidatePatterns.join(', ')})`);
        return await queryFn();
      }),
      
      executeBatchOperations: vi.fn().mockImplementation(async (operations: (() => any)[]) => {
        console.log(`[Enhanced Mock] Batch operations (${operations.length} operations)`);
        return Promise.all(operations.map(op => op()));
      }),
      
      // User preferences helper
      getUserPreferences: vi.fn().mockImplementation(async (userId: string) => {
        const prefs = mockDataStore.findRecords('userPreferences', (record: any) => record.userId === userId);
        return prefs[0] || null;
      }),
      
      // Health check
      healthCheck: vi.fn().mockResolvedValue({
        status: 'healthy',
        responseTime: 50,
        database: 'enhanced-mock-db',
        timestamp: new Date().toISOString(),
      }),
      
      // Configuration helpers
      hasSupabaseConfig: vi.fn().mockReturnValue(false),
      hasNeonConfig: vi.fn().mockReturnValue(true),
      
      // Supabase clients (mocked)
      supabase: {
        from: vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
          insert: vi.fn().mockResolvedValue({ data: [], error: null }),
          update: vi.fn().mockResolvedValue({ data: [], error: null }),
          delete: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
          signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
          signUp: vi.fn().mockResolvedValue({ data: null, error: null }),
          signOut: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      
      supabaseAdmin: {
        from: vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
          insert: vi.fn().mockResolvedValue({ data: [], error: null }),
          update: vi.fn().mockResolvedValue({ data: [], error: null }),
          delete: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      },
      
      // Export mock table objects for schema references
      snipeTargets: { _: { name: 'snipe_targets' }, name: 'snipe_targets' },
      user: { _: { name: 'user' }, name: 'user' },
      users: { _: { name: 'users' }, name: 'users' }, // Supabase schema
      apiCredentials: { _: { name: 'api_credentials' }, name: 'api_credentials' },
      userPreferences: { _: { name: 'user_preferences' }, name: 'user_preferences' },
      transactionLocks: { _: { name: 'transaction_locks' }, name: 'transaction_locks' },
      transactionQueue: { _: { name: 'transaction_queue' }, name: 'transaction_queue' },
      executionHistory: { _: { name: 'execution_history' }, name: 'execution_history' },
      transactions: { _: { name: 'transactions' }, name: 'transactions' },
      balanceSnapshots: { _: { name: 'balance_snapshots' }, name: 'balance_snapshots' },
      portfolioSummary: { _: { name: 'portfolio_summary' }, name: 'portfolio_summary' },
      workflowActivity: { _: { name: 'workflow_activity' }, name: 'workflow_activity' },
      coinActivities: { _: { name: 'coin_activities' }, name: 'coin_activities' },
      patternEmbeddings: { _: { name: 'pattern_embeddings' }, name: 'pattern_embeddings' },
      monitoredListings: { _: { name: 'monitored_listings' }, name: 'monitored_listings' },
      tradingStrategies: { _: { name: 'trading_strategies' }, name: 'trading_strategies' },
      systemHealthMetrics: { _: { name: 'system_health_metrics' }, name: 'system_health_metrics' },
      riskEvents: { _: { name: 'risk_events' }, name: 'risk_events' },
      simulationSessions: { _: { name: 'simulation_sessions' }, name: 'simulation_sessions' },
      simulationTrades: { _: { name: 'simulation_trades' }, name: 'simulation_trades' },
      positionSnapshots: { _: { name: 'position_snapshots' }, name: 'position_snapshots' },
      reconciliationReports: { _: { name: 'reconciliation_reports' }, name: 'reconciliation_reports' },
      errorIncidents: { _: { name: 'error_incidents' }, name: 'error_incidents' },
      agentPerformanceMetrics: { _: { name: 'agent_performance_metrics' }, name: 'agent_performance_metrics' },
      workflowPerformanceMetrics: { _: { name: 'workflow_performance_metrics' }, name: 'workflow_performance_metrics' },
      systemPerformanceSnapshots: { _: { name: 'system_performance_snapshots' }, name: 'system_performance_snapshots' },
      performanceAlerts: { _: { name: 'performance_alerts' }, name: 'performance_alerts' },
      performanceBaselines: { _: { name: 'performance_baselines' }, name: 'performance_baselines' },
      userRoles: { _: { name: 'user_roles' }, name: 'user_roles' },
      workflowSystemStatus: { _: { name: 'workflow_system_status' }, name: 'workflow_system_status' },
    };
  });

  // Mock Drizzle ORM functions
  vi.mock('drizzle-orm', () => ({
    and: vi.fn().mockImplementation((...conditions: any[]) => ({ _type: 'and', conditions })),
    or: vi.fn().mockImplementation((...conditions: any[]) => ({ _type: 'or', conditions })),
    eq: vi.fn().mockImplementation((column: any, value: any) => ({ _type: 'eq', column, value })),
    ne: vi.fn().mockImplementation((column: any, value: any) => ({ _type: 'ne', column, value })),
    gt: vi.fn().mockImplementation((column: any, value: any) => ({ _type: 'gt', column, value })),
    gte: vi.fn().mockImplementation((column: any, value: any) => ({ _type: 'gte', column, value })),
    lt: vi.fn().mockImplementation((column: any, value: any) => ({ _type: 'lt', column, value })),
    lte: vi.fn().mockImplementation((column: any, value: any) => ({ _type: 'lte', column, value })),
    like: vi.fn().mockImplementation((column: any, value: any) => ({ _type: 'like', column, value })),
    notLike: vi.fn().mockImplementation((column: any, value: any) => ({ _type: 'notLike', column, value })),
    inArray: vi.fn().mockImplementation((column: any, values: any[]) => ({ _type: 'in', column, values })),
    notInArray: vi.fn().mockImplementation((column: any, values: any[]) => ({ _type: 'notIn', column, values })),
    isNull: vi.fn().mockImplementation((column: any) => ({ _type: 'isNull', column })),
    isNotNull: vi.fn().mockImplementation((column: any) => ({ _type: 'isNotNull', column })),
    exists: vi.fn().mockImplementation((subquery: any) => ({ _type: 'exists', subquery })),
    notExists: vi.fn().mockImplementation((subquery: any) => ({ _type: 'notExists', subquery })),
    between: vi.fn().mockImplementation((column: any, min: any, max: any) => ({ _type: 'between', column, min, max })),
    notBetween: vi.fn().mockImplementation((column: any, min: any, max: any) => ({ _type: 'notBetween', column, min, max })),
    
    // SQL template literal function
    sql: vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: any[]) => ({
      _type: 'sql',
      strings,
      values,
      queryChunks: strings,
    })),
    
    // Aggregate functions
    count: vi.fn().mockImplementation((column?: any) => ({ _type: 'count', column })),
    sum: vi.fn().mockImplementation((column: any) => ({ _type: 'sum', column })),
    avg: vi.fn().mockImplementation((column: any) => ({ _type: 'avg', column })),
    min: vi.fn().mockImplementation((column: any) => ({ _type: 'min', column })),
    max: vi.fn().mockImplementation((column: any) => ({ _type: 'max', column })),
    
    // Ordering functions
    asc: vi.fn().mockImplementation((column: any) => ({ _type: 'asc', column })),
    desc: vi.fn().mockImplementation((column: any) => ({ _type: 'desc', column })),
    
    // Schema definition functions (for compatibility)
    pgTable: vi.fn().mockImplementation((name: string, schema: any) => ({ 
      _: { name }, 
      name, 
      ...schema 
    })),
    text: vi.fn().mockImplementation((name: string) => ({ name, type: 'text' })),
    integer: vi.fn().mockImplementation((name: string) => ({ name, type: 'integer' })),
    real: vi.fn().mockImplementation((name: string) => ({ name, type: 'real' })),
    boolean: vi.fn().mockImplementation((name: string) => ({ name, type: 'boolean' })),
    timestamp: vi.fn().mockImplementation((name: string, options?: any) => ({ name, type: 'timestamp', options })),
    uuid: vi.fn().mockImplementation((name: string) => ({ name, type: 'uuid' })),
    jsonb: vi.fn().mockImplementation((name: string) => ({ name, type: 'jsonb' })),
  }));

  // Mock specific schema modules to prevent import errors
  vi.mock('@/src/db/schemas', () => ({
    snipeTargets: { _: { name: 'snipe_targets' }, name: 'snipe_targets' },
    user: { _: { name: 'user' }, name: 'user' },
    users: { _: { name: 'users' }, name: 'users' },
    apiCredentials: { _: { name: 'api_credentials' }, name: 'api_credentials' },
    userPreferences: { _: { name: 'user_preferences' }, name: 'user_preferences' },
    transactionLocks: { _: { name: 'transaction_locks' }, name: 'transaction_locks' },
    transactionQueue: { _: { name: 'transaction_queue' }, name: 'transaction_queue' },
    executionHistory: { _: { name: 'execution_history' }, name: 'execution_history' },
    transactions: { _: { name: 'transactions' }, name: 'transactions' },
    balanceSnapshots: { _: { name: 'balance_snapshots' }, name: 'balance_snapshots' },
    portfolioSummary: { _: { name: 'portfolio_summary' }, name: 'portfolio_summary' },
    workflowActivity: { _: { name: 'workflow_activity' }, name: 'workflow_activity' },
    coinActivities: { _: { name: 'coin_activities' }, name: 'coin_activities' },
    patternEmbeddings: { _: { name: 'pattern_embeddings' }, name: 'pattern_embeddings' },
    monitoredListings: { _: { name: 'monitored_listings' }, name: 'monitored_listings' },
    tradingStrategies: { _: { name: 'trading_strategies' }, name: 'trading_strategies' },
  }));

  vi.mock('@/src/db/schemas/supabase-auth', () => ({
    users: { _: { name: 'users' }, name: 'users' },
    userRoles: { _: { name: 'user_roles' }, name: 'user_roles' },
    userPreferences: { _: { name: 'user_preferences' }, name: 'user_preferences' },
    snipeTargets: { _: { name: 'snipe_targets' }, name: 'snipe_targets' },
    workflowActivity: { _: { name: 'workflow_activity' }, name: 'workflow_activity' },
    workflowSystemStatus: { _: { name: 'workflow_system_status' }, name: 'workflow_system_status' },
    coinActivities: { _: { name: 'coin_activities' }, name: 'coin_activities' },
  }));

  vi.mock('@/src/db/schemas/patterns', () => ({
    coinActivities: { _: { name: 'coin_activities' }, name: 'coin_activities' },
    monitoredListings: { _: { name: 'monitored_listings' }, name: 'monitored_listings' },
    patternEmbeddings: { _: { name: 'pattern_embeddings' }, name: 'pattern_embeddings' },
    patternSimilarityCache: { _: { name: 'pattern_similarity_cache' }, name: 'pattern_similarity_cache' },
  }));

  vi.mock('@/src/db/schemas/workflows', () => ({
    workflowActivity: { _: { name: 'workflow_activity' }, name: 'workflow_activity' },
    workflowSystemStatus: { _: { name: 'workflow_system_status' }, name: 'workflow_system_status' },
  }));

  return { mockDataStore };
}

/**
 * Get the mock data store instance
 */
export function getMockDataStore(): EnhancedMockDataStore {
  return (global as any).mockDataStore || createEnhancedMockDataStore();
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
        name: 'Test User',
        createdAt: new Date().toISOString(),
      });
      
      // Also add to users table for Supabase compatibility
      store.addRecord('users', {
        id: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        legacyKindeId: 'kinde-test-user',
        emailVerified: true,
        createdAt: new Date().toISOString(),
      });
      break;
      
    case 'advanced':
      // Create comprehensive test data
      store.addRecord('user', {
        id: 'test-user-123',
        kindeId: 'kinde-test-user',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString(),
      });
      
      store.addRecord('users', {
        id: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        legacyKindeId: 'kinde-test-user',
        emailVerified: true,
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
      
      store.addRecord('userPreferences', {
        id: 'test-prefs-123',
        userId: 'test-user-123',
        defaultBuyAmountUsdt: 100,
        defaultTakeProfitLevel: 2,
        stopLossPercent: 15,
        readyStatePattern: '2,2,4',
        autoSnipeEnabled: true,
        createdAt: new Date().toISOString(),
      });
      break;
      
    case 'error-conditions':
      store.addRecord('user', {
        id: 'error-user-123',
        email: 'error@example.com',
        name: 'Error User',
        createdAt: new Date().toISOString(),
      });
      break;
  }
}

/**
 * Mock Supabase client with enhanced capabilities
 */
export function createMockSupabaseClient() {
  return {
    from: vi.fn().mockImplementation((table: string) => ({
      select: vi.fn().mockImplementation((columns = '*') => ({
        eq: vi.fn().mockImplementation((column: string, value: any) => ({
          single: vi.fn().mockResolvedValue({ 
            data: getMockDataStore().findRecords(table, (record: any) => record[column] === value)[0] || null, 
            error: null 
          }),
          limit: vi.fn().mockImplementation((count: number) => 
            Promise.resolve({ 
              data: getMockDataStore().findRecords(table, (record: any) => record[column] === value).slice(0, count), 
              error: null 
            })
          ),
        })),
        limit: vi.fn().mockImplementation((count: number) => 
          Promise.resolve({ 
            data: getMockDataStore().getTable(table).slice(0, count), 
            error: null 
          })
        ),
        range: vi.fn().mockImplementation((from: number, to: number) => 
          Promise.resolve({ 
            data: getMockDataStore().getTable(table).slice(from, to + 1), 
            error: null 
          })
        ),
        order: vi.fn().mockImplementation((column: string, options?: any) => ({
          limit: vi.fn().mockImplementation((count: number) => 
            Promise.resolve({ 
              data: getMockDataStore().getTable(table).slice(0, count), 
              error: null 
            })
          ),
        })),
      })),
      insert: vi.fn().mockImplementation((data: any) => {
        const inserted = Array.isArray(data) ? data : [data];
        const results = inserted.map(item => getMockDataStore().addRecord(table, item));
        return Promise.resolve({ data: results, error: null });
      }),
      update: vi.fn().mockImplementation((data: any) => ({
        eq: vi.fn().mockImplementation((column: string, value: any) => {
          const updated = getMockDataStore().updateRecords(table, (record: any) => record[column] === value, data);
          return Promise.resolve({ data: updated, error: null });
        }),
      })),
      delete: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockImplementation((column: string, value: any) => {
          const result = getMockDataStore().deleteRecords(table, (record: any) => record[column] === value);
          return Promise.resolve({ data: null, error: null, count: result.deletedCount });
        }),
      })),
      upsert: vi.fn().mockImplementation((data: any) => {
        const upserted = Array.isArray(data) ? data : [data];
        const results = upserted.map(item => {
          // Simple upsert logic: find by id and update or insert
          const existing = getMockDataStore().findRecords(table, (record: any) => record.id === item.id);
          if (existing.length > 0) {
            return getMockDataStore().updateRecords(table, (record: any) => record.id === item.id, item)[0];
          } else {
            return getMockDataStore().addRecord(table, item);
          }
        });
        return Promise.resolve({ data: results, error: null });
      }),
    })),
    
    auth: {
      getUser: vi.fn().mockResolvedValue({ 
        data: { 
          user: {
            id: 'test-user-123',
            email: 'test@example.com',
            user_metadata: { name: 'Test User' }
          } 
        }, 
        error: null 
      }),
      getSession: vi.fn().mockResolvedValue({ 
        data: { 
          session: {
            user: {
              id: 'test-user-123',
              email: 'test@example.com'
            },
            access_token: 'mock-access-token'
          } 
        }, 
        error: null 
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ 
        data: { 
          user: {
            id: 'test-user-123',
            email: 'test@example.com'
          },
          session: {
            access_token: 'mock-access-token'
          }
        }, 
        error: null 
      }),
      signUp: vi.fn().mockResolvedValue({ 
        data: { 
          user: {
            id: 'test-user-123',
            email: 'test@example.com'
          }
        }, 
        error: null 
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockImplementation((callback: any) => {
        // Simulate initial auth state
        callback('SIGNED_IN', {
          user: {
            id: 'test-user-123',
            email: 'test@example.com'
          },
          access_token: 'mock-access-token'
        });
        
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      }),
    },
    
    storage: {
      from: vi.fn().mockImplementation((bucket: string) => ({
        upload: vi.fn().mockResolvedValue({ 
          data: { path: `mock-path/${Date.now()}` }, 
          error: null 
        }),
        download: vi.fn().mockResolvedValue({ 
          data: new Blob(['mock file content']), 
          error: null 
        }),
        remove: vi.fn().mockResolvedValue({ 
          data: null, 
          error: null 
        }),
        list: vi.fn().mockResolvedValue({ 
          data: [], 
          error: null 
        }),
      })),
    },
    
    rpc: vi.fn().mockImplementation((functionName: string, params?: any) => {
      return Promise.resolve({ 
        data: `Mock result for ${functionName}`, 
        error: null 
      });
    }),
  };
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
  simulateDeadlock: vi.fn().mockRejectedValue(new Error('Deadlock detected')),
  simulateConnectionLoss: vi.fn().mockRejectedValue(new Error('Connection lost')),
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
    waiting: 0,
  }),
  getSlowQueries: vi.fn().mockReturnValue([]),
  getCacheHitRate: vi.fn().mockReturnValue(0.85),
  getAverageResponseTime: vi.fn().mockReturnValue(150),
};