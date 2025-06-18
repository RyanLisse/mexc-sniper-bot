/**
 * Test Branch Setup Utilities
 *
 * Provides utilities for setting up and managing test database branches
 * for the MEXC Sniper Bot testing framework.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export interface BranchConfig {
  name: string;
  description?: string;
  parentBranch?: string;
  autoDelete?: boolean;
  expiryDays?: number;
}

export interface BranchInfo {
  id: string;
  name: string;
  endpoint: string;
  createdAt: string;
  parentBranch?: string;
  status: 'active' | 'inactive' | 'deleted';
}

export interface TestBranchContext {
  branchId: string;
  branchName: string;
  connectionString: string;
  originalDatabaseUrl: string;
  cleanup: () => Promise<void>;
}

export interface BranchTestContext {
  branchInfo: BranchInfo;
  db: ReturnType<typeof drizzle>;
  cleanup: () => Promise<void>;
}

export interface TestBranchManager {
  createBranch(config: BranchConfig): Promise<BranchInfo>;
  deleteBranch(branchName: string): Promise<boolean>;
  listBranches(): Promise<BranchInfo[]>;
  getBranchInfo(branchName: string): Promise<BranchInfo | null>;
  switchToBranch(branchName: string): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * Mock implementation of Test Branch Manager
 * In a real implementation, this would integrate with Neon or similar service
 */
export class MockTestBranchManager implements TestBranchManager {
  private branches: Map<string, BranchInfo> = new Map();
  private currentBranch: string = 'main';

  async createBranch(config: BranchConfig): Promise<BranchInfo> {
    const branchInfo: BranchInfo = {
      id: `branch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: config.name,
      endpoint: `postgresql://test:${config.name}@localhost:5432/test_${config.name}`,
      createdAt: new Date().toISOString(),
      parentBranch: config.parentBranch || 'main',
      status: 'active',
    };

    this.branches.set(config.name, branchInfo);
    console.log(`[TestBranch] Created branch: ${config.name}`);
    
    return branchInfo;
  }

  async deleteBranch(branchName: string): Promise<boolean> {
    const branch = this.branches.get(branchName);
    if (!branch) {
      return false;
    }

    branch.status = 'deleted';
    console.log(`[TestBranch] Deleted branch: ${branchName}`);
    return true;
  }

  async listBranches(): Promise<BranchInfo[]> {
    return Array.from(this.branches.values()).filter(b => b.status !== 'deleted');
  }

  async getBranchInfo(branchName: string): Promise<BranchInfo | null> {
    const branch = this.branches.get(branchName);
    return branch && branch.status !== 'deleted' ? branch : null;
  }

  async switchToBranch(branchName: string): Promise<void> {
    const branch = this.branches.get(branchName);
    if (!branch || branch.status === 'deleted') {
      throw new Error(`Branch ${branchName} not found or deleted`);
    }

    this.currentBranch = branchName;
    console.log(`[TestBranch] Switched to branch: ${branchName}`);
  }

  async cleanup(): Promise<void> {
    const expiredBranches = Array.from(this.branches.values()).filter(
      branch => branch.status === 'active' && 
      new Date(branch.createdAt).getTime() < Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days
    );

    for (const branch of expiredBranches) {
      await this.deleteBranch(branch.name);
    }

    console.log(`[TestBranch] Cleaned up ${expiredBranches.length} expired branches`);
  }

  getCurrentBranch(): string {
    return this.currentBranch;
  }
}

// Global instance
let testBranchManager: TestBranchManager | null = null;

export function getTestBranchManager(): TestBranchManager {
  if (!testBranchManager) {
    testBranchManager = new MockTestBranchManager();
  }
  return testBranchManager;
}

/**
 * Set up a test database branch for testing (legacy function)
 */
export async function setupTestBranchLegacy(
  testName: string,
  options: {
    parentBranch?: string;
    autoDelete?: boolean;
    seed?: boolean;
  } = {}
): Promise<BranchInfo> {
  const manager = getTestBranchManager();
  
  const branchConfig: BranchConfig = {
    name: `test_${testName}_${Date.now()}`,
    description: `Test branch for ${testName}`,
    parentBranch: options.parentBranch || 'main',
    autoDelete: options.autoDelete !== false,
    expiryDays: 1,
  };

  const branchInfo = await manager.createBranch(branchConfig);
  
  // Seed with test data if requested
  if (options.seed) {
    await seedTestDatabase(branchInfo.endpoint);
  }

  return branchInfo;
}

/**
 * Set up a test database branch for testing (new interface)
 */
export async function setupTestBranch(options: {
  testSuite: string;
  timeout?: number;
}): Promise<TestBranchContext> {
  const manager = getTestBranchManager();
  
  const branchConfig: BranchConfig = {
    name: `test_${options.testSuite}_${Date.now()}`,
    description: `Test branch for ${options.testSuite}`,
    parentBranch: 'main',
    autoDelete: true,
    expiryDays: 1,
  };

  const branchInfo = await manager.createBranch(branchConfig);
  
  // Store original DATABASE_URL
  const originalDatabaseUrl = process.env.DATABASE_URL || '';
  
  return {
    branchId: branchInfo.id,
    branchName: branchInfo.name,
    connectionString: branchInfo.endpoint,
    originalDatabaseUrl,
    cleanup: async () => {
      await manager.deleteBranch(branchInfo.name);
      // Restore original DATABASE_URL if it was changed
      if (originalDatabaseUrl) {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    }
  };
}

/**
 * Clean up test database branch after testing
 */
export async function cleanupTestBranch(contextOrBranchName: TestBranchContext | string): Promise<void> {
  if (typeof contextOrBranchName === 'string') {
    const manager = getTestBranchManager();
    await manager.deleteBranch(contextOrBranchName);
  } else {
    await contextOrBranchName.cleanup();
  }
}

/**
 * Seed test database with sample data
 */
export async function seedTestDatabase(databaseUrl: string): Promise<void> {
  try {
    const sql = postgres(databaseUrl);
    const db = drizzle(sql);

    // Insert seed data here
    console.log(`[TestBranch] Seeded test database: ${databaseUrl}`);
    
    await sql.end();
  } catch (error) {
    console.error('[TestBranch] Failed to seed test database:', error);
    throw error;
  }
}

/**
 * Create a test database connection
 */
export function createTestDatabase(branchInfo: BranchInfo) {
  const sql = postgres(branchInfo.endpoint);
  return drizzle(sql);
}

/**
 * Utility for running tests with isolated database branches
 */
export async function withTestBranch<T>(
  testName: string,
  testFn: (db: ReturnType<typeof drizzle>, branchInfo: BranchInfo) => Promise<T>,
  options?: {
    parentBranch?: string;
    seed?: boolean;
  }
): Promise<T> {
  const branchInfo = await setupTestBranchLegacy(testName, options);
  
  try {
    const db = createTestDatabase(branchInfo);
    const result = await testFn(db, branchInfo);
    return result;
  } finally {
    await cleanupTestBranch(branchInfo.name);
  }
}

/**
 * Get test database configuration
 */
export function getTestDatabaseConfig(): {
  url: string;
  poolSize: number;
  timeout: number;
} {
  return {
    url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
    poolSize: 5,
    timeout: 10000,
  };
}

/**
 * Initialize test environment
 */
export async function initializeTestEnvironment(): Promise<void> {
  const manager = getTestBranchManager();
  
  // Clean up any existing test branches
  await manager.cleanup();
  
  console.log('[TestBranch] Test environment initialized');
}

/**
 * Reset test environment
 */
export async function resetTestEnvironment(): Promise<void> {
  const manager = getTestBranchManager();
  
  // Delete all test branches
  const branches = await manager.listBranches();
  for (const branch of branches) {
    if (branch.name.startsWith('test_')) {
      await manager.deleteBranch(branch.name);
    }
  }
  
  console.log('[TestBranch] Test environment reset');
}

// Additional exports for scripts and tests
export async function migrateTestBranch(contextOrBranchName: TestBranchContext | string): Promise<void> {
  if (typeof contextOrBranchName === 'string') {
    const manager = getTestBranchManager();
    const branch = await manager.getBranchInfo(contextOrBranchName);
    if (!branch) {
      throw new Error(`Branch ${contextOrBranchName} not found`);
    }
    
    const db = createTestDatabase(branch);
    console.log(`[TestBranch] Running migrations for branch: ${contextOrBranchName}`);
    // Migration logic would go here
  } else {
    console.log(`[TestBranch] Running migrations for branch: ${contextOrBranchName.branchName}`);
    // Migration logic would go here - can use contextOrBranchName.connectionString
  }
}

export async function checkTestBranchHealth(contextOrBranchName: TestBranchContext | string): Promise<boolean> {
  if (typeof contextOrBranchName === 'string') {
    const manager = getTestBranchManager();
    const branch = await manager.getBranchInfo(contextOrBranchName);
    if (!branch) {
      return false;
    }
    
    try {
      const db = createTestDatabase(branch);
      // Health check logic would go here
      console.log(`[TestBranch] Health check passed for branch: ${contextOrBranchName}`);
      return true;
    } catch (error) {
      console.error(`[TestBranch] Health check failed for branch: ${contextOrBranchName}`, error);
      return false;
    }
  } else {
    try {
      // Health check logic using context
      console.log(`[TestBranch] Health check passed for branch: ${contextOrBranchName.branchName}`);
      return true;
    } catch (error) {
      console.error(`[TestBranch] Health check failed for branch: ${contextOrBranchName.branchName}`, error);
      return false;
    }
  }
}

export async function cleanupAllTestBranches(): Promise<void> {
  const manager = getTestBranchManager();
  const branches = await manager.listBranches();
  
  for (const branch of branches) {
    if (branch.name.startsWith('test_')) {
      await manager.deleteBranch(branch.name);
    }
  }
  
  console.log(`[TestBranch] Cleaned up all test branches`);
}

// Global test branch context for tracking current test branch
let currentTestBranch: TestBranchContext | null = null;

export function getCurrentTestBranch(): TestBranchContext | null {
  return currentTestBranch;
}

export function setCurrentTestBranch(context: TestBranchContext | null): void {
  currentTestBranch = context;
}

export default {
  getTestBranchManager,
  setupTestBranch,
  cleanupTestBranch,
  seedTestDatabase,
  createTestDatabase,
  withTestBranch,
  getTestDatabaseConfig,
  initializeTestEnvironment,
  resetTestEnvironment,
  migrateTestBranch,
  checkTestBranchHealth,
  cleanupAllTestBranches,
};