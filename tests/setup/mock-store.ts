/**
 * Mock Data Store Implementation
 * 
 * Provides in-memory data storage for test mocks.
 * Extracted from unified-mock-system.ts for better maintainability.
 */

import type { UnifiedMockStore } from './mock-types';

function createUnifiedMockStore(): UnifiedMockStore {
  const tables: Record<string, Array<Record<string, any>>> = {
    // Core tables
    snipeTargets: [],
    user: [],
    session: [],
    account: [],
    verification: [],
    apiCredentials: [],
    userPreferences: [],
    
    // Pattern tables
    patternEmbeddings: [],
    coinActivities: [],
    monitoredListings: [],
    patternSimilarityCache: [],
    
    // Trading tables
    executionHistory: [],
    transactionLocks: [],
    transactionQueue: [],
    tradingStrategies: [],
    transactions: [],
    balanceSnapshots: [],
    portfolioSummary: [],
    
    // Workflow tables
    workflowActivity: [],
    
    // Performance tables
    systemHealthMetrics: [],
    agentPerformanceMetrics: [],
    workflowPerformanceMetrics: [],
    systemPerformanceSnapshots: [],
    performanceAlerts: [],
    performanceBaselines: [],
    
    // Safety tables
    riskEvents: [],
    errorLogs: [],
    simulationSessions: [],
    simulationTrades: [],
    riskAssessments: [],
    safetyThresholds: [],
    circuitBreakerStates: [],
    
    // Alert tables
    alertEvents: [],
    
    // Additional tables
    strategyExecutions: [],
    marketData: [],
    priceHistory: [],
    orderBook: [],
    tradeSignals: [],
  };

  return {
    tables,

    getTable(tableName: string) {
      if (!tables[tableName]) {
        tables[tableName] = [];
      }
      return tables[tableName];
    },

    addRecord(tableName: string, record: Record<string, any>) {
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
      return this.getTable(tableName).filter(condition);
    },

    updateRecords(tableName: string, condition: (record: any) => boolean, updates: Record<string, any>) {
      const table = this.getTable(tableName);
      const updatedRecords: Array<Record<string, any>> = [];
      
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

    reset() {
      Object.keys(tables).forEach(key => {
        tables[key] = [];
      });
    },

    resetTable(tableName: string) {
      if (tables[tableName]) {
        tables[tableName] = [];
      }
    },
  };
}

// Global store instance
let globalMockStore: UnifiedMockStore | null = null;

export function getGlobalMockStore(): UnifiedMockStore {
  if (!globalMockStore) {
    globalMockStore = createUnifiedMockStore();
  }
  return globalMockStore;
}

export function resetGlobalMockStore(): void {
  globalMockStore = null;
}

export { createUnifiedMockStore };