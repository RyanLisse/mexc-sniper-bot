/**
 * Mock System Types and Interfaces
 * 
 * Core TypeScript interfaces and types for the unified mock system.
 * Extracted from unified-mock-system.ts for better maintainability.
 */

export interface UnifiedMockStore {
  // Database tables
  tables: Record<string, Array<Record<string, any>>>;
  
  // Utility methods
  getTable(name: string): Array<Record<string, any>>;
  addRecord(tableName: string, record: Record<string, any>): Record<string, any>;
  findRecords(tableName: string, condition: (record: any) => boolean): Array<Record<string, any>>;
  updateRecords(tableName: string, condition: (record: any) => boolean, updates: Record<string, any>): Array<Record<string, any>>;
  deleteRecords(tableName: string, condition: (record: any) => boolean): { deletedCount: number };
  reset(): void;
  resetTable(tableName: string): void;
}

export interface MockConfiguration {
  enableDatabase: boolean;
  enableAPI: boolean;
  enableBrowser: boolean;
  isIntegrationTest: boolean;
}

export interface ChainableQuery {
  from: (table: any) => ChainableQuery;
  where: (condition: any) => ChainableQuery;
  select: (fields?: any) => ChainableQuery;
  insert: (values: any) => ChainableQuery;
  update: (values: any) => ChainableQuery;
  delete: () => ChainableQuery;
  limit: (count: number) => ChainableQuery;
  orderBy: (field: any) => ChainableQuery;
  values: (data: any) => ChainableQuery;
  execute: () => Promise<any>;
  get: () => Promise<any>;
  run: () => Promise<any>;
}

export interface MockDatabaseContext {
  store: UnifiedMockStore;
  tableName: string;
  whereCondition?: (record: any) => boolean;
  selectFields?: string[];
  limitCount?: number;
  orderByField?: string;
  insertData?: any;
  updateData?: any;
  isDelete?: boolean;
}

export interface MockWebSocketClient {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: (message: any) => Promise<void>;
  on: (event: string, handler: Function) => void;
  off: (event: string, handler?: Function) => void;
  isConnected: () => boolean;
  getConnectionState: () => string;
}

export interface MockHealthCheckResult {
  success: boolean;
  message: string;
  timestamp: string;
  duration?: number;
  details?: Record<string, any>;
}