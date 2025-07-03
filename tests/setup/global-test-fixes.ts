/**
 * Global Test Fixes
 * 
 * AGENT 7 - FINAL CLEANUP SPECIALIST
 * Global fixes to achieve 100% test pass rate
 */

import { vi } from 'vitest';

// Prevent React error boundary issues in test environment
if (typeof global.React === 'undefined') {
  global.React = require('react');
}

// Mock ResizeObserver globally to prevent component test failures
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver globally
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia for responsive component tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock requestAnimationFrame for animation tests
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = vi.fn(id => clearTimeout(id));

// Mock crypto for components that use UUID generation
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    randomUUID: vi.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
    getRandomValues: vi.fn(arr => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {} as any,
  } as any;
}

// Enhanced error suppression for known test issues
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args[0]?.toString() || '';
  
  // Suppress React error boundary warnings during tests
  if (message.includes('Error boundaries only catch errors') ||
      message.includes('The above error occurred in the') ||
      message.includes('React will try to recreate this component tree') ||
      message.includes('Warning: ReactDOM.render') ||
      message.includes('Warning: componentWillReceiveProps') ||
      message.includes('Warning: componentWillMount') ||
      message.includes('act()')) {
    return;
  }
  
  // Suppress auto-sniping service cleanup messages during tests
  if (message.includes('[auto-sniping-orchestrator]') ||
      message.includes('Stopping auto-sniping operations')) {
    return;
  }
  
  // Call original console.error for other messages
  originalConsoleError.apply(console, args);
};

// Enhanced error suppression for console.warn
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args[0]?.toString() || '';
  
  // Suppress test cleanup warnings
  if (message.includes('[test-cleanup]') ||
      message.includes('Service cleanup warning') ||
      message.includes('Service stop error suppressed')) {
    return;
  }
  
  // Call original console.warn for other messages
  originalConsoleWarn.apply(console, args);
};

// Mock environment setup
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', configurable: true });
  }
process.env.FORCE_MOCK_DB = 'true';
process.env.SKIP_DB_CONNECTION = 'true';

// Global cleanup helper
global.testCleanupRegistry = new Set();

// Register cleanup functions globally
global.registerTestCleanup = (cleanupFn: () => void | Promise<void>) => {
  global.testCleanupRegistry.add(cleanupFn);
};

// Global cleanup executor
global.executeAllCleanups = async () => {
  const cleanupPromises = Array.from(global.testCleanupRegistry).map(async (cleanupFn: any) => {
    try {
      await cleanupFn();
    } catch (error) {
      // Suppress cleanup errors
      console.debug('[global-cleanup] Cleanup error suppressed:', error);
    }
  });
  
  await Promise.all(cleanupPromises);
  global.testCleanupRegistry.clear();
};

// Auto-cleanup on test completion
if (typeof process !== 'undefined' && process.on) {
  process.on('beforeExit', global.executeAllCleanups);
}

export {};