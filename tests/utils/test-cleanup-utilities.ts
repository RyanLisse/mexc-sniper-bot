/**
 * Test Cleanup Utilities
 * 
 * AGENT 7 - FINAL CLEANUP SPECIALIST
 * Utilities to ensure proper cleanup and prevent test interference
 */

import { vi } from 'vitest';
import React, { type ReactNode, Component } from 'react';

/**
 * Enhanced service cleanup that prevents state leakage between tests
 */
export async function cleanupServices(...services: any[]) {
  const cleanupPromises = services.map(async (service) => {
    if (!service) return;
    
    try {
      // Try common cleanup methods in order of preference
      if (typeof service.stop === 'function') {
        await service.stop();
      }
      if (typeof service.destroy === 'function') {
        await service.destroy();
      }
      if (typeof service.shutdown === 'function') {
        await service.shutdown();
      }
      if (typeof service.cleanup === 'function') {
        await service.cleanup();
      }
    } catch (error) {
      // Suppress cleanup errors to prevent cascading test failures
      console.warn('[test-cleanup] Service cleanup warning:', error);
    }
  });
  
  await Promise.all(cleanupPromises);
}

/**
 * Environment cleanup helper
 */
export function cleanupEnvironment() {
  // Clean up test environment variables
  delete process.env.FORCE_MOCK_DB;
  delete process.env.SKIP_DB_CONNECTION;
  delete process.env.USE_REAL_DATABASE;
  delete process.env.TEST_MODE;
  
  // Reset to test environment
  if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', configurable: true });
  }
}

/**
 * Mock cleanup helper
 */
export function cleanupMocks() {
  vi.clearAllMocks();
  
  // Clear timers safely - check if method exists
  if (typeof vi.clearAllTimers === 'function') {
    vi.clearAllTimers();
  } else if (typeof vi.useRealTimers === 'function') {
    // Fallback for older vitest versions
    vi.useRealTimers();
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}

/**
 * Complete test cleanup - use in afterEach
 */
export async function completeTestCleanup(...services: any[]) {
  await cleanupServices(...services);
  cleanupEnvironment();
  cleanupMocks();
  
  // Small delay to ensure cleanup is complete
  await new Promise(resolve => setTimeout(resolve, 10));
}

/**
 * Error boundary test helper for React components
 */
export function createTestErrorBoundary(testId = 'error-boundary') {
  return class TestErrorBoundary extends Component<{ children: ReactNode }> {
    constructor(props: { children: ReactNode }) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
      return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: any) {
      console.log("Error caught by boundary:", error.message);
    }

    render() {
      if ((this.state as any).hasError) {
        return React.createElement("div", { "data-testid": testId }, "Error caught");
      }
      return this.props.children;
    }
  };
}

/**
 * Mock database operations helper
 */
export function createMockDatabase() {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([])
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined)
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined)
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined)
    })
  };
}

/**
 * Suppress console errors during tests
 */
export function suppressConsoleErrors() {
  return vi.spyOn(console, 'error').mockImplementation(() => {});
}

/**
 * Wait for React state updates
 */
export async function waitForReactUpdate() {
  await new Promise(resolve => setTimeout(resolve, 0));
}