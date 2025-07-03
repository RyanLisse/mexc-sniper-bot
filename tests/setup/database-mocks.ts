/**
 * Database Mock System
 * 
 * Comprehensive database mocking for Drizzle ORM and schema exports.
 * Extracted from unified-mock-system.ts for better maintainability.
 */

import { vi } from 'vitest';
import { getGlobalMockStore } from './mock-store';
import type { ChainableQuery, MockDatabaseContext } from './mock-types';

// ============================================================================
// Utility Functions
// ============================================================================

function getTableName(table: any): string {
  if (table?._?.name) return table._.name;
  if (table?.name) return table.name;
  if (table?.[Symbol.for('drizzle:Name')]) return table[Symbol.for('drizzle:Name')];
  
  if (table?.constructor?.name && table.constructor.name !== 'Object') {
    return table.constructor.name.toLowerCase();
  }
  
  if (table?.toString && typeof table.toString === 'function') {
    const str = table.toString();
    const match = str.match(/name:\s*[\"']([^\"']+)[\"']/);
    if (match) return match[1];
  }
  
  if (table?.tableName) return table.tableName;
  if (table?.$name) return table.$name;
  
  return 'unknown';
}

function createChainableQuery(store: typeof getGlobalMockStore, tableName: string): ChainableQuery {
  let currentContext: MockDatabaseContext = {
    store: store(),
    tableName,
  };

  const chainable: ChainableQuery = {
    from: vi.fn().mockImplementation((table: any) => {
      currentContext.tableName = getTableName(table);
      return chainable;
    }),

    where: vi.fn().mockImplementation((condition: any) => {
      currentContext.whereCondition = condition;
      return chainable;
    }),

    select: vi.fn().mockImplementation((fields?: any) => {
      if (fields) {
        currentContext.selectFields = Array.isArray(fields) ? fields : [fields];
      }
      return chainable;
    }),

    insert: vi.fn().mockImplementation((table: any) => {
      currentContext.tableName = getTableName(table);
      return chainable;
    }),

    update: vi.fn().mockImplementation((values: any) => {
      currentContext.updateData = values;
      return chainable;
    }),

    delete: vi.fn().mockImplementation(() => {
      currentContext.isDelete = true;
      return chainable;
    }),

    limit: vi.fn().mockImplementation((count: number) => {
      currentContext.limitCount = count;
      return chainable;
    }),

    orderBy: vi.fn().mockImplementation((field: any) => {
      currentContext.orderByField = field;
      return chainable;
    }),

    values: vi.fn().mockImplementation((data: any) => {
      currentContext.insertData = data;
      return chainable;
    }),

    execute: vi.fn().mockImplementation(async () => {
      const { store, tableName, whereCondition, insertData, updateData, isDelete, limitCount } = currentContext;
      
      if (insertData) {
        const insertedData = Array.isArray(insertData) ? insertData : [insertData];
        return insertedData.map((item: any) => store.addRecord(tableName, item));
      }
      
      if (updateData && whereCondition) {
        return store.updateRecords(tableName, whereCondition, updateData);
      }
      
      if (isDelete && whereCondition) {
        return store.deleteRecords(tableName, whereCondition);
      }
      
      let results = whereCondition 
        ? store.findRecords(tableName, whereCondition)
        : store.getTable(tableName);
      
      if (limitCount) {
        results = results.slice(0, limitCount);
      }
      
      return results;
    }),

    get: vi.fn().mockImplementation(async () => {
      const results = await chainable.execute();
      return Array.isArray(results) ? results[0] : results;
    }),

    run: vi.fn().mockImplementation(() => chainable.execute()),
  };

  return chainable;
}

// ============================================================================
// Database Mock Implementation
// ============================================================================

// Mock @/src/db with comprehensive functionality
vi.mock('@/src/db', () => {
  const store = getGlobalMockStore();

  const mockDb = {
    execute: vi.fn().mockImplementation(async (query: any) => {
      if (query?.queryChunks) {
        return [{ test_value: 1, count: '1' }];
      }
      return [];
    }),

    query: vi.fn().mockImplementation(async () => []),

    insert: vi.fn().mockImplementation((table: any) => ({
      values: vi.fn().mockImplementation((data: any) => ({
        returning: vi.fn().mockImplementation(async () => {
          const tableName = getTableName(table);
          const insertedData = Array.isArray(data) ? data : [data];
          return insertedData.map((item: any) => store.addRecord(tableName, item));
        }),
        execute: vi.fn().mockImplementation(async () => {
          const tableName = getTableName(table);
          const insertedData = Array.isArray(data) ? data : [data];
          const results = insertedData.map((item: any) => store.addRecord(tableName, item));
          return {
            insertId: results[0]?.id,
            affectedRows: results.length,
            rows: results,
          };
        }),
        onConflictDoNothing: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockImplementation(async () => {
            const tableName = getTableName(table);
            const insertedData = Array.isArray(data) ? data : [data];
            return insertedData.map((item: any) => store.addRecord(tableName, item));
          }),
        })),
      })),
    })),

    select: vi.fn().mockImplementation((fields?: any) => {
      return createChainableQuery(() => store, 'unknown').select(fields);
    }),

    update: vi.fn().mockImplementation((table: any) => ({
      set: vi.fn().mockImplementation((values: any) => ({
        where: vi.fn().mockImplementation((condition: any) => ({
          returning: vi.fn().mockImplementation(async () => {
            const tableName = getTableName(table);
            return store.updateRecords(tableName, condition, values);
          }),
          execute: vi.fn().mockImplementation(async () => {
            const tableName = getTableName(table);
            const updated = store.updateRecords(tableName, condition, values);
            return {
              affectedRows: updated.length,
              rows: updated,
            };
          }),
        })),
      })),
    })),

    delete: vi.fn().mockImplementation((table: any) => ({
      where: vi.fn().mockImplementation((condition: any) => ({
        returning: vi.fn().mockImplementation(async () => {
          const tableName = getTableName(table);
          const records = store.findRecords(tableName, condition);
          store.deleteRecords(tableName, condition);
          return records;
        }),
        execute: vi.fn().mockImplementation(async () => {
          const tableName = getTableName(table);
          const result = store.deleteRecords(tableName, condition);
          return {
            affectedRows: result.deletedCount,
          };
        }),
      })),
    })),

    transaction: vi.fn().mockImplementation(async (callback: any) => {
      return await callback(mockDb);
    }),
  };

  return {
    db: mockDb,
    hasSupabaseConfig: vi.fn(() => true),
    executeWithRetry: vi.fn().mockImplementation(async (fn: () => Promise<any>) => await fn()),
  };
});

// Mock Drizzle ORM operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: any, value: any) => (record: any) => record[field] === value),
  ne: vi.fn((field: any, value: any) => (record: any) => record[field] !== value),
  gt: vi.fn((field: any, value: any) => (record: any) => record[field] > value),
  gte: vi.fn((field: any, value: any) => (record: any) => record[field] >= value),
  lt: vi.fn((field: any, value: any) => (record: any) => record[field] < value),
  lte: vi.fn((field: any, value: any) => (record: any) => record[field] <= value),
  like: vi.fn((field: any, pattern: any) => (record: any) => {
    const value = record[field];
    if (typeof value !== 'string') return false;
    const regex = new RegExp(pattern.replace('%', '.*'), 'i');
    return regex.test(value);
  }),
  ilike: vi.fn((field: any, pattern: any) => (record: any) => {
    const value = record[field];
    if (typeof value !== 'string') return false;
    const regex = new RegExp(pattern.replace('%', '.*'), 'i');
    return regex.test(value);
  }),
  inArray: vi.fn((field: any, values: any[]) => (record: any) => values.includes(record[field])),
  notInArray: vi.fn((field: any, values: any[]) => (record: any) => !values.includes(record[field])),
  isNull: vi.fn((field: any) => (record: any) => record[field] === null),
  isNotNull: vi.fn((field: any) => (record: any) => record[field] !== null),
  between: vi.fn((field: any, min: any, max: any) => (record: any) => record[field] >= min && record[field] <= max),
  and: vi.fn((...conditions: any[]) => (record: any) => conditions.every(condition => condition(record))),
  or: vi.fn((...conditions: any[]) => (record: any) => conditions.some(condition => condition(record))),
  not: vi.fn((condition: any) => (record: any) => !condition(record)),
  sql: {
    raw: vi.fn((template: string, ...values: any[]) => ({
      queryChunks: [template, ...values],
    })),
  },
  count: vi.fn(() => ({ count: '1' })),
  sum: vi.fn(() => ({ sum: '0' })),
  avg: vi.fn(() => ({ avg: '0' })),
  min: vi.fn(() => ({ min: null })),
  max: vi.fn(() => ({ max: null })),
  desc: vi.fn((field: any) => ({ field, direction: 'desc' })),
  asc: vi.fn((field: any) => ({ field, direction: 'asc' })),
}));

// ============================================================================
// Schema Mocks
// ============================================================================

// Mock all schema exports to prevent import errors
const createMockTable = (name: string) => ({
  _: { name },
  name,
  [Symbol.for('drizzle:Name')]: name,
  tableName: name,
  $name: name,
});

// Mock patterns schema exports
vi.mock('@/src/db/schemas/patterns', () => ({
  patternEmbeddings: createMockTable('patternEmbeddings'),
  coinActivities: createMockTable('coinActivities'),
  monitoredListings: createMockTable('monitoredListings'),
  patternSimilarityCache: createMockTable('patternSimilarityCache'),
}));

// Mock trading schema exports
vi.mock('@/src/db/schemas/trading', () => ({
  executionHistory: createMockTable('executionHistory'),
  transactionLocks: createMockTable('transactionLocks'),
  transactionQueue: createMockTable('transactionQueue'),
  tradingStrategies: createMockTable('tradingStrategies'),
  transactions: createMockTable('transactions'),
  balanceSnapshots: createMockTable('balanceSnapshots'),
  portfolioSummary: createMockTable('portfolioSummary'),
}));

// Mock auth schema exports
vi.mock('@/src/db/schemas/auth', () => ({
  user: createMockTable('user'),
  session: createMockTable('session'),
  account: createMockTable('account'),
  verification: createMockTable('verification'),
  apiCredentials: createMockTable('apiCredentials'),
  userPreferences: createMockTable('userPreferences'),
}));

// Mock workflows schema exports
vi.mock('@/src/db/schemas/workflows', () => ({
  workflowActivity: createMockTable('workflowActivity'),
}));

// Mock performance schema exports
vi.mock('@/src/db/schemas/performance', () => ({
  systemHealthMetrics: createMockTable('systemHealthMetrics'),
  agentPerformanceMetrics: createMockTable('agentPerformanceMetrics'),
  workflowPerformanceMetrics: createMockTable('workflowPerformanceMetrics'),
  systemPerformanceSnapshots: createMockTable('systemPerformanceSnapshots'),
  performanceAlerts: createMockTable('performanceAlerts'),
  performanceBaselines: createMockTable('performanceBaselines'),
}));

// Mock safety schema exports
vi.mock('@/src/db/schemas/safety', () => ({
  riskEvents: createMockTable('riskEvents'),
  errorLogs: createMockTable('errorLogs'),
  simulationSessions: createMockTable('simulationSessions'),
  simulationTrades: createMockTable('simulationTrades'),
  riskAssessments: createMockTable('riskAssessments'),
  safetyThresholds: createMockTable('safetyThresholds'),
  circuitBreakerStates: createMockTable('circuitBreakerStates'),
}));

// Mock strategies schema exports
vi.mock('@/src/db/schemas/strategies', () => ({
  strategyExecutions: createMockTable('strategyExecutions'),
}));

// Mock alerts schema exports
vi.mock('@/src/db/schemas/alerts', () => ({
  alertEvents: createMockTable('alertEvents'),
}));