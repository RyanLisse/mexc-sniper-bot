/**
 * Test Stability Utilities
 * MISSION: Test Stability & Reliability Agent
 * 
 * Comprehensive stability utilities to eliminate all sources of test flakiness:
 * - Memory leak detection and prevention
 * - Timing-related stability fixes
 * - Resource cleanup mechanisms
 * - Process isolation and safety
 * - Performance monitoring and optimization
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import type { MockedFunction } from 'vitest'

// Memory monitoring configuration
export interface MemoryMonitorConfig {
  maxHeapUsed: number
  maxRSSUsed: number
  gcThreshold: number
  warningThreshold: number
  monitoringInterval: number
}

export interface StabilityMetrics {
  memoryUsage: NodeJS.MemoryUsage
  testStartTime: number
  testDuration: number
  gcCount: number
  warningCount: number
  errorCount: number
}

// Global stability state
let stabilityMetrics: StabilityMetrics = {
  memoryUsage: process.memoryUsage(),
  testStartTime: Date.now(),
  testDuration: 0,
  gcCount: 0,
  warningCount: 0,
  errorCount: 0
}

let memoryMonitor: NodeJS.Timeout | null = null
let processEventListeners: Array<{ event: string, listener: (...args: any[]) => void }> = []

// Default memory monitoring configuration
const DEFAULT_MEMORY_CONFIG: MemoryMonitorConfig = {
  maxHeapUsed: 512 * 1024 * 1024, // 512MB
  maxRSSUsed: 1024 * 1024 * 1024, // 1GB
  gcThreshold: 256 * 1024 * 1024, // 256MB
  warningThreshold: 128 * 1024 * 1024, // 128MB
  monitoringInterval: 5000 // 5 seconds
}

/**
 * Initialize stability monitoring and cleanup mechanisms
 */
export function initializeStabilityUtilities(config: Partial<MemoryMonitorConfig> = {}) {
  const fullConfig = { ...DEFAULT_MEMORY_CONFIG, ...config }
  
  console.log('🛡️ Initializing test stability utilities...')
  
  // Reset stability metrics
  stabilityMetrics = {
    memoryUsage: process.memoryUsage(),
    testStartTime: Date.now(),
    testDuration: 0,
    gcCount: 0,
    warningCount: 0,
    errorCount: 0
  }
  
  // Start memory monitoring if enabled
  if (process.env.ENABLE_STABILITY_MONITORING === 'true') {
    startMemoryMonitoring(fullConfig)
  }
  
  // Setup process event handlers for stability
  setupProcessEventHandlers()
  
  // Setup automatic cleanup
  setupAutomaticCleanup()
  
  console.log('✅ Test stability utilities initialized')
}

/**
 * Start memory monitoring with automatic garbage collection
 */
function startMemoryMonitoring(config: MemoryMonitorConfig) {
  if (memoryMonitor) {
    clearInterval(memoryMonitor)
  }
  
  memoryMonitor = setInterval(() => {
    const usage = process.memoryUsage()
    stabilityMetrics.memoryUsage = usage
    
    // Check if memory usage is approaching limits
    if (usage.heapUsed > config.warningThreshold) {
      stabilityMetrics.warningCount++
      console.warn(`⚠️ High memory usage detected: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`)
    }
    
    // Force garbage collection if needed
    if (usage.heapUsed > config.gcThreshold && global.gc) {
      try {
        global.gc()
        stabilityMetrics.gcCount++
        console.log('🗑️ Forced garbage collection triggered')
      } catch (error) {
        console.warn('⚠️ Garbage collection failed:', error)
      }
    }
    
    // Emergency cleanup if approaching maximum limits
    if (usage.heapUsed > config.maxHeapUsed || usage.rss > config.maxRSSUsed) {
      stabilityMetrics.errorCount++
      console.error('🚨 Memory limit exceeded - triggering emergency cleanup')
      performEmergencyCleanup()
    }
    
  }, config.monitoringInterval)
}

/**
 * Setup process event handlers for stability
 */
function setupProcessEventHandlers() {
  // Handle unhandled rejections
  const rejectionHandler = (reason: any) => {
    stabilityMetrics.errorCount++
    console.error('🚨 Unhandled Promise Rejection in test:', reason)
    // Don't exit process during tests, just log
  }
  
  // Handle uncaught exceptions
  const exceptionHandler = (error: Error) => {
    stabilityMetrics.errorCount++
    console.error('🚨 Uncaught Exception in test:', error)
    // Don't exit process during tests, just log
  }
  
  process.on('unhandledRejection', rejectionHandler)
  process.on('uncaughtException', exceptionHandler)
  
  // Store listeners for cleanup
  processEventListeners.push(
    { event: 'unhandledRejection', listener: rejectionHandler },
    { event: 'uncaughtException', listener: exceptionHandler }
  )
}

/**
 * Setup automatic cleanup mechanisms
 */
function setupAutomaticCleanup() {
  // Cleanup after each test
  afterEach(() => {
    // Clear all timers
    clearAllTimers()
    
    // Clear any pending promises
    vi.clearAllTimers()
    vi.clearAllMocks()
    
    // Force garbage collection if available
    if (global.gc && process.env.ENABLE_STABILITY_MONITORING === 'true') {
      try {
        global.gc()
      } catch (error) {
        // Ignore GC errors
      }
    }
  })
  
  // Final cleanup after all tests
  afterAll(() => {
    cleanupStabilityUtilities()
  })
}

/**
 * Perform emergency cleanup when memory limits are exceeded
 */
function performEmergencyCleanup() {
  console.log('🚨 Performing emergency stability cleanup...')
  
  // Clear all mocks and timers
  vi.clearAllMocks()
  vi.clearAllTimers()
  vi.restoreAllMocks()
  
  // Clear all intervals and timeouts
  clearAllTimers()
  
  // Force multiple garbage collections
  if (global.gc) {
    try {
      for (let i = 0; i < 3; i++) {
        global.gc()
      }
    } catch (error) {
      console.warn('⚠️ Emergency GC failed:', error)
    }
  }
  
  console.log('✅ Emergency cleanup completed')
}

/**
 * Clear all active timers and intervals
 */
function clearAllTimers() {
  // Clear all known timer types
  const maxTimerId = 1000 // Reasonable upper bound for timer IDs
  for (let i = 1; i <= maxTimerId; i++) {
    try {
      clearTimeout(i)
      clearInterval(i)
    } catch (error) {
      // Ignore errors for non-existent timers
    }
  }
}

/**
 * Cleanup stability utilities and monitoring
 */
export function cleanupStabilityUtilities() {
  console.log('🧹 Cleaning up test stability utilities...')
  
  // Stop memory monitoring
  if (memoryMonitor) {
    clearInterval(memoryMonitor)
    memoryMonitor = null
  }
  
  // Remove process event handlers
  processEventListeners.forEach(({ event, listener }) => {
    process.removeListener(event, listener)
  })
  processEventListeners = []
  
  // Final memory cleanup
  performEmergencyCleanup()
  
  // Calculate final metrics
  stabilityMetrics.testDuration = Date.now() - stabilityMetrics.testStartTime
  
  if (process.env.ENABLE_STABILITY_MONITORING === 'true') {
    console.log('📊 Final stability metrics:', {
      duration: `${stabilityMetrics.testDuration}ms`,
      memoryPeak: `${Math.round(stabilityMetrics.memoryUsage.heapUsed / 1024 / 1024)}MB`,
      gcCount: stabilityMetrics.gcCount,
      warnings: stabilityMetrics.warningCount,
      errors: stabilityMetrics.errorCount
    })
  }
  
  console.log('✅ Test stability utilities cleaned up')
}

/**
 * Get current stability metrics
 */
export function getStabilityMetrics(): StabilityMetrics {
  return { ...stabilityMetrics }
}

/**
 * Global timeout monitor for tracking and cleaning timeouts
 */
export const globalTimeoutMonitor = {
  activeTimeouts: new Set<NodeJS.Timeout>(),
  activeIntervals: new Set<NodeJS.Timeout>(),
  
  trackTimeout(timeout: NodeJS.Timeout) {
    this.activeTimeouts.add(timeout)
    return timeout
  },
  
  trackInterval(interval: NodeJS.Timeout) {
    this.activeIntervals.add(interval)
    return interval
  },
  
  clearAllTimeouts() {
    this.activeTimeouts.forEach(timeout => {
      try {
        clearTimeout(timeout)
      } catch (error) {
        // Ignore errors for already cleared timeouts
      }
    })
    this.activeTimeouts.clear()
  },
  
  clearAllIntervals() {
    this.activeIntervals.forEach(interval => {
      try {
        clearInterval(interval)
      } catch (error) {
        // Ignore errors for already cleared intervals
      }
    })
    this.activeIntervals.clear()
  },
  
  cleanup() {
    this.clearAllTimeouts()
    this.clearAllIntervals()
  }
}

/**
 * Test Context Manager for enhanced isolation and cleanup
 */
export class TestContextManager {
  private contexts = new Map<string, any>()
  private activeListeners = new Map<string, any[]>()
  private cleanupFunctions = new Map<string, Array<() => void | Promise<void>>>()
  
  createContext(name: string) {
    const context = {
      name,
      startTime: Date.now(),
      timers: new Set<NodeJS.Timeout>(),
      intervals: new Set<NodeJS.Timeout>(),
      listeners: new Map<string, any[]>(),
      mocks: new Set<any>(),
      
      registerCleanup: (fn: () => void | Promise<void>) => {
        if (!this.cleanupFunctions.has(name)) {
          this.cleanupFunctions.set(name, [])
        }
        this.cleanupFunctions.get(name)!.push(fn)
      },
      
      addTimer: (timer: NodeJS.Timeout) => {
        context.timers.add(timer)
        globalTimeoutMonitor.trackTimeout(timer)
      },
      
      addInterval: (interval: NodeJS.Timeout) => {
        context.intervals.add(interval)
        globalTimeoutMonitor.trackInterval(interval)
      },
      
      addListener: (target: any, event: string, listener: any) => {
        if (!context.listeners.has(event)) {
          context.listeners.set(event, [])
        }
        context.listeners.get(event)!.push({ target, listener })
      },
      
      addMock: (mock: any) => {
        context.mocks.add(mock)
      }
    }
    
    this.contexts.set(name, context)
    return context
  }
  
  cleanupContext(name: string) {
    const context = this.contexts.get(name)
    if (!context) return
    
    // Clear timers
    context.timers.forEach(timer => {
      try {
        clearTimeout(timer)
      } catch (error) {
        // Ignore errors for already cleared timers
      }
    })
    context.timers.clear()
    
    // Clear intervals
    context.intervals.forEach(interval => {
      try {
        clearInterval(interval)
      } catch (error) {
        // Ignore errors for already cleared intervals
      }
    })
    context.intervals.clear()
    
    // Clear listeners
    context.listeners.forEach((listeners, event) => {
      listeners.forEach(({ target, listener }) => {
        try {
          if (target && typeof target.removeEventListener === 'function') {
            target.removeEventListener(event, listener)
          } else if (target && typeof target.off === 'function') {
            target.off(event, listener)
          }
        } catch (error) {
          // Ignore listener cleanup errors
        }
      })
    })
    context.listeners.clear()
    
    // Clear mocks
    context.mocks.forEach(mock => {
      try {
        if (mock && typeof mock.mockRestore === 'function') {
          mock.mockRestore()
        } else if (mock && typeof mock.mockClear === 'function') {
          mock.mockClear()
        }
      } catch (error) {
        // Ignore mock cleanup errors
      }
    })
    context.mocks.clear()
    
    // Run cleanup functions
    const cleanupFns = this.cleanupFunctions.get(name) || []
    cleanupFns.forEach(async (fn) => {
      try {
        await fn()
      } catch (error) {
        console.warn(`⚠️ Cleanup function error in ${name}:`, error)
      }
    })
    this.cleanupFunctions.delete(name)
    
    this.contexts.delete(name)
  }
  
  clearAllListeners() {
    this.activeListeners.forEach((listeners, event) => {
      listeners.forEach(({ target, listener }) => {
        try {
          if (target && typeof target.removeEventListener === 'function') {
            target.removeEventListener(event, listener)
          } else if (target && typeof target.off === 'function') {
            target.off(event, listener)
          }
        } catch (error) {
          // Ignore listener cleanup errors
        }
      })
    })
    this.activeListeners.clear()
  }
  
  cleanup() {
    this.contexts.forEach((_, name) => {
      this.cleanupContext(name)
    })
    this.clearAllListeners()
    globalTimeoutMonitor.cleanup()
  }
}

/**
 * Memory Leak Prevention utilities
 */
export class MemoryLeakPrevention {
  private static memorySnapshots: NodeJS.MemoryUsage[] = []
  private static leakDetectionThreshold = 50 * 1024 * 1024 // 50MB
  
  static takeMemorySnapshot(): NodeJS.MemoryUsage {
    const snapshot = process.memoryUsage()
    this.memorySnapshots.push(snapshot)
    
    // Keep only last 10 snapshots
    if (this.memorySnapshots.length > 10) {
      this.memorySnapshots.shift()
    }
    
    return snapshot
  }
  
  static detectMemoryLeaks(): boolean {
    if (this.memorySnapshots.length < 3) return false
    
    const recent = this.memorySnapshots.slice(-3)
    const growthRate = recent[2].heapUsed - recent[0].heapUsed
    
    if (growthRate > this.leakDetectionThreshold) {
      console.warn(`🚨 Potential memory leak detected: ${Math.round(growthRate / 1024 / 1024)}MB growth`)
      return true
    }
    
    return false
  }
  
  static cleanup() {
    this.memorySnapshots = []
    
    // Force garbage collection if available
    if (global.gc) {
      try {
        global.gc()
      } catch (error) {
        // Ignore GC errors
      }
    }
  }
}

/**
 * Global cleanup function registry
 */
const globalCleanupRegistry = new Set<() => void | Promise<void>>()

export function registerCleanup(fn: () => void | Promise<void>) {
  globalCleanupRegistry.add(fn)
}

export async function cleanupContext() {
  // Run all registered cleanup functions
  for (const cleanupFn of globalCleanupRegistry) {
    try {
      await cleanupFn()
    } catch (error) {
      console.warn('⚠️ Global cleanup function error:', error)
    }
  }
  globalCleanupRegistry.clear()
  
  // Cleanup memory leak prevention
  MemoryLeakPrevention.cleanup()
  
  // Cleanup global timeout monitor
  globalTimeoutMonitor.cleanup()
}

export function clearAllListeners() {
  // Clear process listeners (but keep essential ones)
  const processListenerCounts = process.listenerCount('unhandledRejection') + 
                               process.listenerCount('uncaughtException')
  
  if (processListenerCounts > 10) {
    console.warn('⚠️ High number of process listeners detected, cleaning up test listeners only')
    
    // Remove only test-related listeners
    const testListenerEvents: Array<'unhandledRejection' | 'uncaughtException'> = ['unhandledRejection', 'uncaughtException']
    testListenerEvents.forEach(event => {
      const listeners = process.listeners(event as any)
      listeners.forEach(listener => {
        if (listener.toString().includes('test') || listener.toString().includes('vitest')) {
          process.removeListener(event, listener)
        }
      })
    })
  }
}

/**
 * Create a stable test context with automatic cleanup
 */
export function createStableTestContext(name: string) {
  const contextManager = new TestContextManager()
  const context = contextManager.createContext(name)
  
  // Auto-cleanup on test completion
  afterEach(async () => {
    contextManager.cleanupContext(name)
  })
  
  return context
}

/**
 * Wait for a condition with timeout and stability checks
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number
    interval?: number
    timeoutMessage?: string
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, timeoutMessage = 'Condition timeout' } = options
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await condition()
      if (result) {
        return
      }
    } catch (error) {
      // Ignore condition check errors and continue
    }
    
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  throw new Error(`${timeoutMessage} after ${timeout}ms`)
}

/**
 * Create a stable mock function with automatic cleanup
 */
export function createStableMock<T extends (...args: any[]) => any>(
  implementation?: T
): MockedFunction<T> {
  const mock = vi.fn(implementation) as MockedFunction<T>
  
  // Register for automatic cleanup
  afterEach(() => {
    mock.mockClear()
  })
  
  afterAll(() => {
    mock.mockRestore()
  })
  
  return mock
}

/**
 * Setup stable timing for tests that depend on time
 */
export function setupStableTiming(baseTime?: Date) {
  const fixedTime = baseTime || new Date('2024-01-01T00:00:00.000Z')
  
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(fixedTime)
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })
  
  return {
    fixedTime,
    advanceTime: (ms: number) => vi.advanceTimersByTime(ms),
    runAllTimers: () => vi.runAllTimers(),
    runOnlyPendingTimers: () => vi.runOnlyPendingTimers()
  }
}

/**
 * Setup stable random number generation
 */
export function setupStableRandom(seed: number = 12345) {
  const originalMathRandom = Math.random
  let currentSeed = seed
  
  const seededRandom = () => {
    const x = Math.sin(currentSeed++) * 10000
    return x - Math.floor(x)
  }
  
  beforeEach(() => {
    currentSeed = seed
    Math.random = seededRandom
  })
  
  afterEach(() => {
    Math.random = originalMathRandom
  })
  
  return {
    setSeed: (newSeed: number) => { currentSeed = newSeed },
    getSeed: () => currentSeed
  }
}

/**
 * Monitor test performance and stability
 */
export function monitorTestPerformance(testName: string) {
  const startTime = Date.now()
  const startMemory = process.memoryUsage()
  
  return {
    finish() {
      const endTime = Date.now()
      const endMemory = process.memoryUsage()
      const duration = endTime - startTime
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed
      
      if (process.env.ENABLE_STABILITY_MONITORING === 'true') {
        console.log(`📊 Test performance [${testName}]:`, {
          duration: `${duration}ms`,
          memoryDelta: `${Math.round(memoryDelta / 1024)}KB`,
          heapUsed: `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`
        })
      }
      
      return { duration, memoryDelta, endMemory }
    }
  }
}

// Auto-initialize stability utilities
if (process.env.VITEST_STABILITY_MODE === 'true') {
  initializeStabilityUtilities()
}

export default {
  initializeStabilityUtilities,
  cleanupStabilityUtilities,
  getStabilityMetrics,
  createStableTestContext,
  waitForCondition,
  createStableMock,
  setupStableTiming,
  setupStableRandom,
  monitorTestPerformance
}